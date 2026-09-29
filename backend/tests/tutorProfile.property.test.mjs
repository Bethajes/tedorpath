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
import { after, before, describe, it } from 'node:test'
import fc from 'fast-check'

import { createApp } from '../src/app.js'
import { closePrisma, prisma } from '../src/lib/prisma.js'

let server
let baseUrl

/** IDs created during these tests — cleaned up in after(). */
const createdUserIds = []
const createdProfileIds = []

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
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: crypto.randomUUID().replace(/-/g, ''),
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    },
  })

  return { userId: user.id, sessionToken: session.tokenHash }
}

/**
 * Helper to make authenticated API calls.
 */
async function apiAuth(path, options = {}, sessionToken) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Cookie: sessionToken ? `session=${sessionToken}` : '',
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
          displayName: fc.string({ minLength: 1, maxLength: 100 }),
          headline: fc.string({ minLength: 1, maxLength: 160 }),
          bio: fc.string({ minLength: 1, maxLength: 2000 }),
          location: fc.oneof(fc.constant(undefined), fc.string({ maxLength: 120 })),
          teachingMode: fc.constantFrom('ONLINE', 'IN_PERSON', 'BOTH'),
          studentLevels: fc.array(fc.constantFrom('Primary School', 'High School', 'University', 'Adult Learning'), { minLength: 1, maxLength: 5 }),
          hourlyRate: fc.oneof(fc.constant(undefined), fc.float({ min: 0, max: 9999.99 })),
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
          originalName: fc.string({ minLength: 1, maxLength: 100 }),
          originalHeadline: fc.string({ minLength: 1, maxLength: 160 }),
          originalBio: fc.string({ minLength: 1, maxLength: 2000 }),
          originalTeachingMode: fc.constantFrom('ONLINE', 'IN_PERSON', 'BOTH'),
          originalLocation: fc.string({ maxLength: 120 }),
          
          // Fields to update (some may be undefined to test partial update)
          newDisplayName: fc.oneof(fc.constant(undefined), fc.string({ minLength: 1, maxLength: 100 })),
          newHeadline: fc.oneof(fc.constant(undefined), fc.string({ minLength: 1, maxLength: 160 })),
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
  it('PATCH /api/tutor-profile returns 403 when user A tries to update user B\'s profile', async () => {
    /**
     * **Feature: tutor-marketplace, Property 8: Profile ownership is enforced server-side**
     * **Validates: Requirements 6.4, 16.2, 16.3**
     *
     * For any two distinct authenticated users A and B, user A calling
     * PATCH /api/tutor-profile in a way that would modify user B's profile
     * must receive HTTP 403. The stored profile of user B must remain unchanged
     * after the attempt.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userADisplayName: fc.string({ minLength: 1, maxLength: 100 }),
          userBDisplayName: fc.string({ minLength: 1, maxLength: 100 }),
          attemptedName: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        async (data) => {
          // Create two distinct users with their own sessions
          const userA = await createTestUser()
          const userB = await createTestUser()
          
          // Create a profile for user B
          const userBProfile = await createProfileForUser(userB.userId, {
            displayName: data.userBDisplayName,
          })

          // User A tries to update user B's profile
          const { status, body } = await apiAuth('/api/tutor-profile', {
            method: 'PATCH',
            body: JSON.stringify({ displayName: data.attemptedName }),
          }, userA.sessionToken)

          // Should return 403 Forbidden
          assert.equal(status, 403)
          assert.equal(body.success, false)
          assert.equal(body.error.code, 'PROFILE_NOT_FOUND')

          // Verify user B's profile remains unchanged
          const dbProfile = await prisma.tutorProfile.findUnique({
            where: { userId: userB.userId },
          })
          assert.equal(dbProfile.displayName, data.userBDisplayName)
        }
      ),
      { numRuns: 10 }
    )
  })
})