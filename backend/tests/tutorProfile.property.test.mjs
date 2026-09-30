/**
 * Property-based tests for the authenticated tutor profile management API.
 *
 * Each test runs against the real Express app and the real PostgreSQL database.
 * Tests create their own User and TutorProfile records via Prisma directly
 * and clean up afterwards.
 *
 * Requirements coverage: 2.3, 2.4, 6.1, 6.3, 6.4, 16.2, 16.3
 */

import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { after, before, describe, it } from 'node:test'
import fc from 'fast-check'

import { createApp } from '../src/app.js'
import { SESSION_COOKIE_NAME } from '../src/modules/auth/cookies.js'
import { closePrisma, prisma } from '../src/lib/prisma.js'

let server
let baseUrl

/** IDs created during these tests — cleaned up in after(). */
const createdUserIds = []
const createdProfileIds = []

/**
 * A string that stays non-empty after the API trims it.
 *
 * The schemas `.trim()` every text field and then require at least one
 * character, so a raw `fc.string` can generate a payload (e.g. "   ") that the
 * API correctly rejects. Generating blank-ish input here would test the
 * validator rather than the property under test.
 */
function nonBlank(maxLength) {
  return fc
    .string({ minLength: 1, maxLength })
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

/**
 * A rate with exactly two decimal places, matching the Decimal(10, 2) column.
 *
 * Built from an integer number of cents so it is always representable as a
 * 32-bit float, which is what fast-check's `fc.float` requires.
 */
const rate = fc.integer({ min: 0, max: 999_999 }).map((cents) => cents / 100)

before(async () => {
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  // Clean up in dependency order: profiles, then users
  if (createdProfileIds.length) {
    await prisma.tutorProfile.deleteMany({ where: { id: { in: createdProfileIds } } })
  }
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
  }
  await new Promise((resolve) => server.close(resolve))
  await closePrisma()
})

/**
 * Helper to create a test user with a session for authenticated API calls.
 * Returns { userId, sessionToken }.
 *
 * The session row must store the SHA-256 hash of the token, because that is
 * what findSessionByToken() looks up (see auth/service.js). The raw token is
 * what goes in the cookie. Storing the raw token here would make every call
 * 401 and silently turn these properties into no-ops.
 *
 * Sessions are written directly rather than by signing in: going through
 * /api/auth/login would mean an Argon2 hash per generated user, which is far
 * too slow for a property test.
 */
async function createTestUser() {
  const email = `test-${crypto.randomUUID()}@test.local`
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Test User',
    },
  })
  createdUserIds.push(user.id)

  // Create a session for authentication
  const sessionToken = randomBytes(32).toString('hex')
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: createHash('sha256').update(sessionToken).digest('hex'),
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    },
  })

  return { userId: user.id, sessionToken }
}

/**
 * Helper to make authenticated API calls.
 */
async function apiAuth(path, options = {}, sessionToken) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Cookie: sessionToken ? `${SESSION_COOKIE_NAME}=${sessionToken}` : '',
      ...options.headers,
    },
  })
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, body }
}

/**
 * Helper to create a tutor profile for testing.
 */
async function createProfileForUser(userId, data = {}) {
  const profile = await prisma.tutorProfile.create({
    data: {
      userId,
      displayName: data.displayName || 'Test Tutor',
      headline: data.headline || 'Test headline',
      bio: data.bio || 'Test bio content',
      teachingMode: data.teachingMode || 'ONLINE',
      studentLevels: data.studentLevels || ['High School'],
      profileStatus: data.profileStatus || 'DRAFT',
      verificationStatus: data.verificationStatus || 'UNVERIFIED',
      ...data,
    },
  })
  createdProfileIds.push(profile.id)
  return profile
}

// ---------------------------------------------------------------------------
// Property 6: New profile always defaults to DRAFT
// Feature: tutor-marketplace, Property 6: New profile always defaults to DRAFT
// Validates: Requirements 2.3, 2.4, 6.1
// ---------------------------------------------------------------------------

describe('Property 6: New profile always defaults to DRAFT', () => {
  it('POST /api/tutor-profile creates profile with DRAFT status for any valid input', async () => {
    /**
     * **Feature: tutor-marketplace, Property 6: New profile always defaults to DRAFT**
     * **Validates: Requirements 2.3, 2.4, 6.1**
     *
     * For any authenticated user creating a TutorProfile via POST /api/tutor-profile
     * with any valid payload, the persisted profile must have profileStatus = DRAFT
     * and verificationStatus = UNVERIFIED.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          displayName: nonBlank(100),
          headline: nonBlank(160),
          bio: nonBlank(2000),
          location: fc.oneof(fc.constant(undefined), fc.string({ maxLength: 120 })),
          teachingMode: fc.constantFrom('ONLINE', 'IN_PERSON', 'BOTH'),
          studentLevels: fc.array(fc.constantFrom('Primary School', 'High School', 'University', 'Adult Learning'), { minLength: 1, maxLength: 5 }),
          hourlyRate: fc.oneof(fc.constant(undefined), rate),
        }),
        async (profileData) => {
          // Create a test user with session
          const { userId, sessionToken } = await createTestUser()

          // Call API to create profile
          const { status, body } = await apiAuth('/api/tutor-profile', {
            method: 'POST',
            body: JSON.stringify(profileData),
          }, sessionToken)

          // Should succeed
          assert.equal(status, 201)
          assert.equal(body.success, true)

          // Verify profile has DRAFT status
          assert.equal(body.data.profileStatus, 'DRAFT')
          assert.equal(body.data.verificationStatus, 'UNVERIFIED')

          // Verify in database directly
          const dbProfile = await prisma.tutorProfile.findUnique({
            where: { userId },
          })
          assert.ok(dbProfile, 'Profile should exist in database')
          assert.equal(dbProfile.profileStatus, 'DRAFT')
          assert.equal(dbProfile.verificationStatus, 'UNVERIFIED')
        }
      ),
      { numRuns: 10 } // Reduced: each run creates a user and hits the real DB
    )
  })

  it('a second create by the same user returns 409', async () => {
    /**
     * Requirement 6.2: a user may hold only one tutor profile.
     */
    const { sessionToken } = await createTestUser()

    const payload = {
      displayName: 'Test Tutor',
      headline: 'Test headline',
      bio: 'Test bio',
      teachingMode: 'ONLINE',
      studentLevels: ['High School'],
    }

    const first = await apiAuth('/api/tutor-profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, sessionToken)
    assert.equal(first.status, 201)
    createdProfileIds.push(first.body.data.id)

    const second = await apiAuth('/api/tutor-profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, sessionToken)

    assert.equal(second.status, 409)
    assert.equal(second.body.success, false)
    assert.equal(second.body.error.code, 'PROFILE_ALREADY_EXISTS')
  })
})

// ---------------------------------------------------------------------------
// Property 7: Partial update touches only specified fields
// Feature: tutor-marketplace, Property 7: Partial update touches only specified fields
// Validates: Requirements 6.3
// ---------------------------------------------------------------------------

describe('Property 7: Partial update touches only specified fields', () => {
  it('PATCH /api/tutor-profile updates only specified fields for any partial payload', async () => {
    /**
     * **Feature: tutor-marketplace, Property 7: Partial update touches only specified fields**
     * **Validates: Requirements 6.3**
     *
     * For any PATCH payload sent to /api/tutor-profile, only the fields present
     * in the payload should change in the stored TutorProfile; all fields absent
     * from the payload must retain their prior values unchanged.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Original profile data
          originalName: nonBlank(100),
          originalHeadline: nonBlank(160),
          originalBio: nonBlank(2000),
          originalTeachingMode: fc.constantFrom('ONLINE', 'IN_PERSON', 'BOTH'),
          originalLocation: fc.string({ maxLength: 120 }),
          
          // Fields to update (some may be undefined to test partial update)
          newDisplayName: fc.oneof(fc.constant(undefined), nonBlank(100)),
          newHeadline: fc.oneof(fc.constant(undefined), nonBlank(160)),
        }),
        async (data) => {
          // Create a test user with session and initial profile
          const { userId, sessionToken } = await createTestUser()
          
          const originalProfile = await createProfileForUser(userId, {
            displayName: data.originalName,
            headline: data.originalHeadline,
            bio: data.originalBio,
            teachingMode: data.originalTeachingMode,
            location: data.originalLocation,
          })

          // Build PATCH payload with only defined fields
          const patchPayload = {}
          if (data.newDisplayName !== undefined) patchPayload.displayName = data.newDisplayName
          if (data.newHeadline !== undefined) patchPayload.headline = data.newHeadline

          // If no fields to update, skip this test case
          if (Object.keys(patchPayload).length === 0) {
            return true
          }

          // Call API to update profile
          const { status, body } = await apiAuth('/api/tutor-profile', {
            method: 'PATCH',
            body: JSON.stringify(patchPayload),
          }, sessionToken)

          // Should succeed
          assert.equal(status, 200)
          assert.equal(body.success, true)

          // Verify updated fields
          if (data.newDisplayName !== undefined) {
            assert.equal(body.data.displayName, data.newDisplayName)
          } else {
            assert.equal(body.data.displayName, data.originalName)
          }

          if (data.newHeadline !== undefined) {
            assert.equal(body.data.headline, data.newHeadline)
          } else {
            assert.equal(body.data.headline, data.originalHeadline)
          }

          // Verify unchanged fields in database
          const dbProfile = await prisma.tutorProfile.findUnique({
            where: { userId },
          })
          
          // Bio should remain unchanged
          assert.equal(dbProfile.bio, data.originalBio)
          // Teaching mode should remain unchanged
          assert.equal(dbProfile.teachingMode, data.originalTeachingMode)
          // Location should remain unchanged
          assert.equal(dbProfile.location, data.originalLocation)
        }
      ),
      { numRuns: 10 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 8: Profile ownership is enforced server-side
// Feature: tutor-marketplace, Property 8: Profile ownership is enforced server-side
// Validates: Requirements 6.4, 16.2, 16.3
// ---------------------------------------------------------------------------

describe('Property 8: Profile ownership is enforced server-side', () => {
  it('PATCH /api/tutor-profile returns 403 when user A targets user B\'s profile', async () => {
    /**
     * **Feature: tutor-marketplace, Property 8: Profile ownership is enforced server-side**
     * **Validates: Requirements 6.4, 16.2, 16.3**
     *
     * For any two distinct authenticated users A and B, user A calling
     * PATCH /api/tutor-profile in a way that would modify user B's profile
     * must receive HTTP 403. The stored profile of user B must remain unchanged
     * after the attempt.
     *
     * Requirement 6.4 describes the attempt as "modifying the identifier in the
     * request", so that is what is generated here: A sends B's userId in the
     * body. A must have a profile of their own, otherwise the request would
     * simply 404 and the ownership check would never be reached.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userADisplayName: nonBlank(100),
          userBDisplayName: nonBlank(100),
          attemptedName: nonBlank(100),
        }),
        async (data) => {
          // Create two distinct users with their own sessions
          const userA = await createTestUser()
          const userB = await createTestUser()
          
          // Both users have a profile, so the only thing separating them is ownership
          await createProfileForUser(userA.userId, {
            displayName: data.userADisplayName,
          })
          await createProfileForUser(userB.userId, {
            displayName: data.userBDisplayName,
          })

          // User A tries to update user B's profile by naming B in the request
          const { status, body } = await apiAuth('/api/tutor-profile', {
            method: 'PATCH',
            body: JSON.stringify({ userId: userB.userId, displayName: data.attemptedName }),
          }, userA.sessionToken)

          // Should return 403 Forbidden
          assert.equal(status, 403)
          assert.equal(body.success, false)
          assert.equal(body.error.code, 'FORBIDDEN')

          // Verify user B's profile remains unchanged
          const dbProfile = await prisma.tutorProfile.findUnique({
            where: { userId: userB.userId },
          })
          assert.equal(dbProfile.displayName, data.userBDisplayName)

          // ...and that A's own profile was not modified as a side effect
          const dbProfileA = await prisma.tutorProfile.findUnique({
            where: { userId: userA.userId },
          })
          assert.equal(dbProfileA.displayName, data.userADisplayName)
        }
      ),
      { numRuns: 10 }
    )
  })

  it('PATCH /api/tutor-profile succeeds when the body names the caller themself', async () => {
    /**
     * A matching userId must not be treated as an attack: it is redundant with
     * the session, so the request is allowed and the caller's own profile is
     * updated. Guards against "fixing" 6.4 by rejecting every supplied userId.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          originalName: nonBlank(100),
          newName: nonBlank(100),
        }),
        async (data) => {
          const user = await createTestUser()
          await createProfileForUser(user.userId, { displayName: data.originalName })

          const { status, body } = await apiAuth('/api/tutor-profile', {
            method: 'PATCH',
            body: JSON.stringify({ userId: user.userId, displayName: data.newName }),
          }, user.sessionToken)

          assert.equal(status, 200)
          assert.equal(body.success, true)
          assert.equal(body.data.displayName, data.newName)
        }
      ),
      { numRuns: 10 }
    )
  })
})

// ---------------------------------------------------------------------------
// Helpers for submission tests — builds a complete, submittable profile
// ---------------------------------------------------------------------------

/**
 * Seed a Subject row and return its id. Re-uses an existing subject with this
 * name if one already exists (idempotent across test runs).
 */
async function ensureSubject(name = 'Mathematics') {
  const slug = name.toLowerCase().replace(/\s+/g, '-')
  const existing = await prisma.subject.findUnique({ where: { slug } })
  if (existing) return existing.id
  const created = await prisma.subject.create({
    data: { name, slug, category: 'Test', active: true },
  })
  return created.id
}

/**
 * Create a complete DRAFT profile that passes validateProfileCompleteness.
 * The caller receives the profile + its subjectId so it can be reused.
 */
async function createCompleteProfile(userId, overrides = {}) {
  const subjectId = await ensureSubject()

  const profile = await prisma.tutorProfile.create({
    data: {
      userId,
      displayName: 'Test Tutor',
      headline: 'Great tutor',
      bio: 'I have been teaching for 10 years.',
      teachingMode: 'ONLINE',
      studentLevels: ['High School'],
      hourlyRate: 50,
      profileStatus: overrides.profileStatus || 'DRAFT',
      verificationStatus: 'UNVERIFIED',
      applicationReference: overrides.applicationReference || null,
      subjects: {
        create: [{ subject: { connect: { id: subjectId } } }],
      },
    },
  })
  createdProfileIds.push(profile.id)
  return { profile, subjectId }
}

// ---------------------------------------------------------------------------
// Property 14: Application reference is generated exactly once per profile
// Feature: tutor-marketplace-extended, Property 14: Application reference is generated exactly once per profile
// Validates: Requirements 20.1, 20.5, 20.6
// ---------------------------------------------------------------------------

describe('Property 14: Application reference is generated exactly once per profile', () => {
  it('first submission generates a reference matching TT-YYYY-NNNNNN, resubmission retains it', async () => {
    /**
     * **Feature: tutor-marketplace-extended, Property 14: Application reference is generated exactly once per profile**
     * **Validates: Requirements 20.1, 20.5, 20.6**
     *
     * For any TutorProfile, calling POST /api/tutor-profile/submit for the first
     * time must set applicationReference to a non-null value matching
     * TT-YYYY-NNNNNN. A subsequent resubmission (from REJECTED or
     * NEEDS_INFORMATION) must leave applicationReference unchanged.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('REJECTED', 'NEEDS_INFORMATION'),
        async (resubmitStatus) => {
          const { userId, sessionToken } = await createTestUser()
          await createCompleteProfile(userId)

          // First submission: DRAFT → PENDING_REVIEW, generates reference
          const first = await apiAuth('/api/tutor-profile/submit', {
            method: 'POST',
          }, sessionToken)

          assert.equal(first.status, 200, `First submit failed: ${JSON.stringify(first.body)}`)
          assert.equal(first.body.success, true)

          const ref = first.body.data.applicationReference
          assert.ok(ref, 'applicationReference must be set after first submit')
          assert.match(ref, /^TT-\d{4}-\d{6}$/, 'reference must match TT-YYYY-NNNNNN')

          // Manually move the profile to the resubmit status so we can test retention
          await prisma.tutorProfile.update({
            where: { userId },
            data: { profileStatus: resubmitStatus },
          })

          // Resubmission: REJECTED/NEEDS_INFORMATION → PENDING_REVIEW, retains reference
          const second = await apiAuth('/api/tutor-profile/submit', {
            method: 'POST',
          }, sessionToken)

          assert.equal(second.status, 200, `Resubmit failed: ${JSON.stringify(second.body)}`)
          assert.equal(second.body.data.applicationReference, ref,
            'applicationReference must be identical on resubmission')
        }
      ),
      { numRuns: 10 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 15: Application reference values are unique across all profiles
// Feature: tutor-marketplace-extended, Property 15: Application reference values are unique across all profiles
// Validates: Requirements 20.2
// ---------------------------------------------------------------------------

describe('Property 15: Application reference values are unique across all profiles', () => {
  it('submitting N distinct profiles produces N distinct applicationReference values', async () => {
    /**
     * **Feature: tutor-marketplace-extended, Property 15: Application reference values are unique across all profiles**
     * **Validates: Requirements 20.2**
     *
     * For any two distinct TutorProfiles that have both been submitted at least
     * once, their applicationReference values must be different strings.
     * No two profiles may share a reference.
     *
     * Strategy: submit a batch of complete profiles sequentially and verify
     * that all resulting references form a set of the same size (i.e., no
     * duplicates). Sequentially rather than concurrently, because Node's
     * single-threaded event loop plus Prisma's transaction serialisation makes
     * sequential the realistic production path on a single-host deployment.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        async (batchSize) => {
          // Create batchSize users, each with a complete DRAFT profile
          const users = []
          for (let i = 0; i < batchSize; i++) {
            const { userId, sessionToken } = await createTestUser()
            await createCompleteProfile(userId)
            users.push({ userId, sessionToken })
          }

          // Submit each profile sequentially and collect the references
          const references = []
          for (const { sessionToken } of users) {
            const { status, body } = await apiAuth('/api/tutor-profile/submit', {
              method: 'POST',
            }, sessionToken)

            assert.equal(status, 200, `Submit failed: ${JSON.stringify(body)}`)
            assert.ok(
              body.data.applicationReference,
              'applicationReference must be set after submission'
            )
            references.push(body.data.applicationReference)
          }

          // All references must be distinct — a Set drops duplicates, so its
          // size must equal the original array length.
          const unique = new Set(references)
          assert.equal(
            unique.size,
            references.length,
            `Duplicate applicationReference found among: ${references.join(', ')}`
          )
        }
      ),
      { numRuns: 5 } // Each run submits up to 5 profiles against the real DB
    )
  })
})

// ---------------------------------------------------------------------------
// Property 17: Resubmission from REJECTED or NEEDS_INFORMATION transitions to PENDING_REVIEW
// Feature: tutor-marketplace-extended, Property 17: Resubmission from REJECTED or NEEDS_INFORMATION transitions to PENDING_REVIEW
// Validates: Requirements 25.4, 25.5, 28.4
// ---------------------------------------------------------------------------

describe('Property 17: Resubmission transitions to PENDING_REVIEW without changing the reference', () => {
  it('submitting from REJECTED or NEEDS_INFORMATION sets status to PENDING_REVIEW and retains reference', async () => {
    /**
     * **Feature: tutor-marketplace-extended, Property 17: Resubmission from REJECTED or NEEDS_INFORMATION transitions to PENDING_REVIEW**
     * **Validates: Requirements 25.4, 25.5, 28.4**
     *
     * For any complete TutorProfile whose profileStatus is REJECTED or
     * NEEDS_INFORMATION, calling POST /api/tutor-profile/submit must:
     * (a) return success, (b) set profileStatus to PENDING_REVIEW, and
     * (c) leave applicationReference identical to its value before the call.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('REJECTED', 'NEEDS_INFORMATION'),
        async (startStatus) => {
          const { userId, sessionToken } = await createTestUser()
          // Use a unique reference per run to avoid the unique constraint collision.
          // The reference format matches TT-YYYY-NNNNNN for a recognisable shape,
          // but we embed a random suffix so no two test runs share a value.
          const existingRef = `TT-${new Date().getFullYear()}-${randomBytes(3).toString('hex')}`
          await createCompleteProfile(userId, {
            profileStatus: startStatus,
            applicationReference: existingRef,
          })

          const { status, body } = await apiAuth('/api/tutor-profile/submit', {
            method: 'POST',
          }, sessionToken)

          assert.equal(status, 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`)
          assert.equal(body.success, true)
          assert.equal(body.data.profileStatus, 'PENDING_REVIEW')
          assert.equal(body.data.applicationReference, existingRef,
            'applicationReference must not change on resubmission')

          // Verify in DB
          const dbProfile = await prisma.tutorProfile.findUnique({ where: { userId } })
          assert.equal(dbProfile.profileStatus, 'PENDING_REVIEW')
          assert.equal(dbProfile.applicationReference, existingRef)
        }
      ),
      { numRuns: 10 }
    )
  })

  it('submitting from PENDING_REVIEW returns 400 ALREADY_UNDER_REVIEW', async () => {
    /**
     * Validates: Requirements 28.5
     * Guard: a profile already under review must not be resubmitted.
     */
    const { userId, sessionToken } = await createTestUser()
    await createCompleteProfile(userId, { profileStatus: 'PENDING_REVIEW' })

    const { status, body } = await apiAuth('/api/tutor-profile/submit', {
      method: 'POST',
    }, sessionToken)

    assert.equal(status, 400)
    assert.equal(body.error.code, 'ALREADY_UNDER_REVIEW')
  })

  it('submitting from APPROVED returns 400 ALREADY_APPROVED', async () => {
    /**
     * Validates: Requirements 28.6
     */
    const { userId, sessionToken } = await createTestUser()
    await createCompleteProfile(userId, { profileStatus: 'APPROVED' })

    const { status, body } = await apiAuth('/api/tutor-profile/submit', {
      method: 'POST',
    }, sessionToken)

    assert.equal(status, 400)
    assert.equal(body.error.code, 'ALREADY_APPROVED')
  })
})
