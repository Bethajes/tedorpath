/**
 * Property-based tests for the public tutor directory API.
 *
 * Each test runs against the real Express app and the real PostgreSQL database.
 * The tests create their own TutorProfile records (via Prisma directly) and
 * clean up afterwards so they do not depend on seed data.
 */

import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { after, before, describe, it } from 'node:test'
import fc from 'fast-check'

import { createApp } from '../src/app.js'
import { SESSION_COOKIE_NAME } from '../src/modules/auth/cookies.js'
import { closePrisma, prisma } from '../src/lib/prisma.js'
import { ratesFor, withoutRates } from './helpers/rates.mjs'

let server
let baseUrl

/** IDs created during these tests — cleaned up in after(). */
const createdUserIds = []
const createdProfileIds = []
const createdSubjectIds = []

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
  // Subjects after profiles: the join rows are owned by the profile.
  if (createdSubjectIds.length) {
    await prisma.subject.deleteMany({ where: { id: { in: createdSubjectIds } } })
  }
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
  }
  await new Promise((resolve) => server.close(resolve))
  await closePrisma()
})

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
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

/** Authenticated variant of `api`, carrying a session cookie. */
async function apiAuth(path, options = {}, token) {
  return api(path, {
    ...options,
    headers: {
      ...options.headers,
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    },
  })
}

/**
 * Creates a User with a live session.
 *
 * The session row stores the SHA-256 of the token, because that is what
 * findSessionByToken() looks up (see auth/service.js); the cookie carries the
 * raw token. Writing the row directly avoids an Argon2 hash per generated user.
 */
async function createUserWithSession() {
  const user = await prisma.user.create({
    data: { email: `test-${crypto.randomUUID()}@test.local`, name: 'Test Tutor' },
  })
  createdUserIds.push(user.id)

  const token = randomBytes(32).toString('hex')
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 3600000),
    },
  })

  return { userId: user.id, token }
}

/**
 * Creates a minimal User + TutorProfile pair for testing.
 * Returns { userId, profileId }.
 */
async function seedProfile(overrides = {}) {
  const user = await prisma.user.create({
    data: {
      email: `test-${crypto.randomUUID()}@test.local`,
      name: 'Test Tutor',
    },
  })
  createdUserIds.push(user.id)

  return seedProfileFor(user.id, overrides)
}

/** Creates a TutorProfile for an existing user. */
async function seedProfileFor(userId, overrides = {}) {
  const profile = await prisma.tutorProfile.create({
    data: {
      userId,
      displayName: 'Test Tutor',
      headline: 'Test headline',
      bio: 'Test bio content',
      teachingMode: 'ONLINE',
      studentLevels: ['High School'],
      profileStatus: 'APPROVED',
      // Prices are rate rows now, so the rate keys are lifted out of the column
      // spread and written as rows. Without this the whole insert is rejected,
      // which fails the property for the wrong reason.
      ...withoutRates(overrides),
      rates: ratesFor(overrides),
    },
  })
  createdProfileIds.push(profile.id)
  return { userId, profileId: profile.id }
}

/**
 * Creates a pool of subjects for the many-to-many property.
 * Returns their ids in creation order.
 */
async function seedSubjects(count) {
  const ids = []
  for (let index = 0; index < count; index += 1) {
    const unique = `${index}-${crypto.randomUUID().slice(0, 8)}`
    const subject = await prisma.subject.create({
      data: {
        name: `Subject ${unique}`,
        slug: `subject-${unique}`,
        category: 'Test category',
      },
    })
    createdSubjectIds.push(subject.id)
    ids.push(subject.id)
  }
  return ids
}

// ---------------------------------------------------------------------------
// Property 1: Only approved profiles appear in the public directory
// Feature: tutor-marketplace, Property 1: Only approved profiles appear in the public directory
// Validates: Requirements 4.1
// ---------------------------------------------------------------------------

describe('Property 1: Only approved profiles appear in the public directory', () => {
  it('GET /api/tutors returns only APPROVED profiles for any mix of statuses', async () => {
    /**
     * **Feature: tutor-marketplace, Property 1: Only approved profiles appear in the public directory**
     * **Validates: Requirements 4.1**
     *
     * For any set of TutorProfiles with mixed statuses, the API must only
     * return those with profileStatus = APPROVED.
     */
    const allStatuses = [
      'DRAFT',
      'PENDING_REVIEW',
      'APPROVED',
      'SUSPENDED',
      'REJECTED',
      'NEEDS_INFORMATION',
    ]

    await fc.assert(
      fc.asyncProperty(
        // Pick a random non-empty subset of statuses to seed
        fc.shuffledSubarray(allStatuses, { minLength: 2, maxLength: 6 }),
        async (statuses) => {
          const ids = []
          for (const status of statuses) {
            const { profileId } = await seedProfile({ profileStatus: status })
            ids.push({ profileId, status })
          }

          const { status, body } = await api('/api/tutors?limit=100')
          assert.equal(status, 200)
          assert.equal(body.success, true)

          const returnedIds = new Set(body.data.items.map((i) => i.id))

          for (const { profileId, status: pStatus } of ids) {
            if (pStatus === 'APPROVED') {
              assert.ok(
                returnedIds.has(profileId),
                `APPROVED profile ${profileId} must appear in results`,
              )
            } else {
              assert.ok(
                !returnedIds.has(profileId),
                `Profile with status ${pStatus} (id=${profileId}) must NOT appear in results`,
              )
            }
          }
        },
      ),
      { numRuns: 10 }, // Reduced: each run hits the real DB
    )
  })
})

// ---------------------------------------------------------------------------
// Property 13: NEEDS_INFORMATION profiles are not publicly visible
// ---------------------------------------------------------------------------

describe('Property 13: NEEDS_INFORMATION profiles are not publicly visible', () => {
  it('never appears in the directory list, whatever else is seeded alongside it', async () => {
    /**
     * **Feature: tutor-marketplace-extended, Property 13: NEEDS_INFORMATION profiles are not publicly visible**
     * **Validates: Requirements 19.6, 29.1, 29.2**
     *
     * For any TutorProfile in NEEDS_INFORMATION, the public directory must
     * never return it, and its detail endpoint must never resolve it. The
     * status means the admin has asked the tutor for more information — the
     * application is mid-conversation, not live, so it must stay off the
     * public site no matter which other profiles exist.
     */
    const others = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SUSPENDED', 'REJECTED']

    await fc.assert(
      fc.asyncProperty(
        // Any mix of other statuses sharing the query with the one under test.
        fc.shuffledSubarray(others, { minLength: 0, maxLength: others.length }),
        async (companionStatuses) => {
          const subject = await seedProfile({ profileStatus: 'NEEDS_INFORMATION' })

          const companions = []
          for (const status of companionStatuses) {
            const { profileId } = await seedProfile({ profileStatus: status })
            companions.push({ profileId, status })
          }

          const { status, body } = await api('/api/tutors?limit=100')
          assert.equal(status, 200)
          assert.equal(body.success, true)

          const returnedIds = new Set(body.data.items.map((item) => item.id))
          assert.ok(
            !returnedIds.has(subject.profileId),
            'a NEEDS_INFORMATION profile must never be returned by the directory',
          )

          // The other statuses keep behaving exactly as they did: APPROVED
          // shows up, everything else does not. This guards against a fix that
          // simply widens or narrows the filter wholesale.
          for (const { profileId, status: companionStatus } of companions) {
            if (companionStatus === 'APPROVED') {
              assert.ok(returnedIds.has(profileId), 'APPROVED profiles must still be listed')
            } else {
              assert.ok(
                !returnedIds.has(profileId),
                `${companionStatus} must still be hidden`,
              )
            }
          }
        },
      ),
      { numRuns: 8 },
    )
  })

  it('always 404s the detail endpoint, for any starting state of the database', async () => {
    /**
     * The detail endpoint resolves by id, so a NEEDS_INFORMATION profile is the
     * case most likely to leak: a student with a bookmarked URL would get a
     * live page for a profile that is not approved. It must be indistinguishable
     * from a profile that does not exist.
     */
    const others = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SUSPENDED', 'REJECTED']

    await fc.assert(
      fc.asyncProperty(
        fc.shuffledSubarray(others, { minLength: 0, maxLength: others.length }),
        async (companionStatuses) => {
          const subject = await seedProfile({ profileStatus: 'NEEDS_INFORMATION' })

          for (const status of companionStatuses) {
            await seedProfile({ profileStatus: status })
          }

          const { status: httpStatus, body } = await api(`/api/tutors/${subject.profileId}`)

          assert.equal(
            httpStatus,
            404,
            'a NEEDS_INFORMATION profile must 404 exactly like a missing one',
          )
          assert.equal(body.success, false)
        },
      ),
      { numRuns: 8 },
    )
  })

  it('never returns the admin message on a NEEDS_INFORMATION profile', async () => {
    /**
     * The admin's message is written for the applicant, and the applicant reads
     * it through the authenticated /me endpoint. It must not reach the public
     * API even if the profile were somehow matched by a filter.
     */
    const secret = 'INTERNAL-ADMIN-MESSAGE-MARKER'

    await fc.assert(
      fc.asyncProperty(
        fc.shuffledSubarray(['DRAFT', 'PENDING_REVIEW', 'APPROVED'], {
          minLength: 1,
          maxLength: 3,
        }),
        async (companionStatuses) => {
          await seedProfile({
            profileStatus: 'NEEDS_INFORMATION',
            adminMessage: secret,
            adminNotes: secret,
          })

          for (const status of companionStatuses) {
            await seedProfile({ profileStatus: status })
          }

          const { body } = await api('/api/tutors?limit=100')
          assert.ok(
            !JSON.stringify(body).includes(secret),
            'admin-only messages must never appear in the public directory',
          )
        },
      ),
      { numRuns: 6 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 2: Applied filters are always satisfied by every returned profile
// Feature: tutor-marketplace, Property 2: Applied filters are always satisfied by every returned profile
// Validates: Requirements 4.3, 4.4, 4.5, 4.6, 4.7
// ---------------------------------------------------------------------------

describe('Property 2: Applied filters are satisfied by every returned profile', () => {
  it('every returned profile satisfies the mode filter', async () => {
    /**
     * **Feature: tutor-marketplace, Property 2: Applied filters are always satisfied by every returned profile**
     * **Validates: Requirements 4.5**
     */
    const modes = ['ONLINE', 'IN_PERSON', 'BOTH']

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...modes),
        async (mode) => {
          // Seed one profile matching the mode and one not matching
          const otherMode = modes.find((m) => m !== mode) ?? 'ONLINE'
          await seedProfile({ teachingMode: mode, displayName: `Mode Match ${mode}` })
          await seedProfile({ teachingMode: otherMode, displayName: `Mode NoMatch ${otherMode}` })

          const { status, body } = await api(`/api/tutors?mode=${mode}&limit=100`)
          assert.equal(status, 200)

          for (const item of body.data.items) {
            assert.equal(
              item.teachingMode,
              mode,
              `Item ${item.id} has teachingMode=${item.teachingMode}, expected ${mode}`,
            )
          }
        },
      ),
      { numRuns: 3 },
    )
  })

  it('every returned profile satisfies the level filter', async () => {
    /**
     * **Feature: tutor-marketplace, Property 2: Applied filters are always satisfied by every returned profile**
     * **Validates: Requirements 4.4**
     */
    const levels = ['Primary School', 'High School', 'University', 'Adult Learning']

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...levels),
        async (level) => {
          const otherLevel = levels.find((l) => l !== level) ?? 'University'
          await seedProfile({ studentLevels: [level], displayName: `Level Match` })
          await seedProfile({ studentLevels: [otherLevel], displayName: `Level NoMatch` })

          const { status, body } = await api(`/api/tutors?level=${encodeURIComponent(level)}&limit=100`)
          assert.equal(status, 200)

          for (const item of body.data.items) {
            assert.ok(
              item.studentLevels.includes(level),
              `Item ${item.id} has levels=${JSON.stringify(item.studentLevels)}, expected to include "${level}"`,
            )
          }
        },
      ),
      { numRuns: 3 },
    )
  })

  it('every returned profile satisfies the rate range filter', async () => {
    /**
     * **Feature: tutor-marketplace, Property 2: Applied filters are always satisfied by every returned profile**
     * **Validates: Requirements 4.7**
     */
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 50 }),
        fc.integer({ min: 51, max: 150 }),
        async (minRate, maxRate) => {
          // Seed profiles: one in range, one below, one above
          await seedProfile({ hourlyRateUsd: (minRate + maxRate) / 2, displayName: 'In Range' })
          await seedProfile({ hourlyRateUsd: minRate - 1, displayName: 'Below Range' })
          await seedProfile({ hourlyRateUsd: maxRate + 1, displayName: 'Above Range' })

          const { status, body } = await api(`/api/tutors?minRate=${minRate}&maxRate=${maxRate}&limit=100`)
          assert.equal(status, 200)

          for (const item of body.data.items) {
            if (item.hourlyRate !== null) {
              assert.ok(
                item.hourlyRate >= minRate && item.hourlyRate <= maxRate,
                `Item ${item.id} has rate=${item.hourlyRate}, expected between ${minRate} and ${maxRate}`,
              )
            }
          }
        },
      ),
      { numRuns: 5 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 3: Pagination envelope is mathematically consistent
// Feature: tutor-marketplace, Property 3: Pagination envelope is mathematically consistent
// Validates: Requirements 4.8, 4.11
// ---------------------------------------------------------------------------

describe('Property 3: Pagination envelope is mathematically consistent', () => {
  it('pagination metadata is consistent for any page/limit combination', async () => {
    /**
     * **Feature: tutor-marketplace, Property 3: Pagination envelope is mathematically consistent**
     * **Validates: Requirements 4.8, 4.11**
     *
     * For any paginated response, totalPages = ceil(total / limit),
     * items.length <= limit, and when total = 0 the envelope is still valid.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),   // page
        fc.integer({ min: 1, max: 20 }),  // limit
        async (page, limit) => {
          const { status, body } = await api(`/api/tutors?page=${page}&limit=${limit}`)
          assert.equal(status, 200)
          assert.equal(body.success, true)

          const { pagination, items } = body.data
          const { page: retPage, limit: retLimit, total, totalPages } = pagination

          // Items length must not exceed limit
          assert.ok(
            items.length <= retLimit,
            `items.length (${items.length}) must be <= limit (${retLimit})`,
          )

          // totalPages must be ceil(total / limit) or 0 when total = 0
          const expectedTotalPages = total === 0 ? 0 : Math.ceil(total / retLimit)
          assert.equal(
            totalPages,
            expectedTotalPages,
            `totalPages (${totalPages}) must equal ceil(${total}/${retLimit}) = ${expectedTotalPages}`,
          )

          // total must be a non-negative integer
          assert.ok(total >= 0, `total must be >= 0, got ${total}`)

          // page must be returned as-is
          assert.equal(retPage, page)
        },
      ),
      { numRuns: 20 },
    )
  })

  it('empty result returns a valid envelope, not an error', async () => {
    /**
     * **Feature: tutor-marketplace, Property 3: Pagination envelope is mathematically consistent**
     * **Validates: Requirements 4.11**
     */
    // Search for something that can never exist
    const { status, body } = await api('/api/tutors?q=zzz-absolutely-no-match-xyz-123')
    assert.equal(status, 200)
    assert.equal(body.success, true)
    assert.equal(body.data.items.length, 0)
    assert.equal(body.data.pagination.total, 0)
    assert.equal(body.data.pagination.totalPages, 0)
    assert.equal(body.data.pagination.page, 1)
    assert.equal(body.data.pagination.limit, 12)
  })
})

// ---------------------------------------------------------------------------
// Property 4: Sorting order invariant
// Feature: tutor-marketplace, Property 4: Sorting order invariant
// Validates: Requirements 4.9, 4.10
// ---------------------------------------------------------------------------

describe('Property 4: Sorting order invariant', () => {
  before(async () => {
    // Seed a set of profiles with known rates and timestamps for sort testing
    await seedProfile({ hourlyRateUsd: 20, displayName: 'Sort Tutor Low' })
    await seedProfile({ hourlyRateUsd: 50, displayName: 'Sort Tutor Mid' })
    await seedProfile({ hourlyRateUsd: 100, displayName: 'Sort Tutor High' })
    await seedProfile({ hourlyRateUsd: null, displayName: 'Sort Tutor NoRate' })
  })

  it('price_asc: consecutive items are in ascending order (nulls last)', async () => {
    /**
     * **Feature: tutor-marketplace, Property 4: Sorting order invariant**
     * **Validates: Requirements 4.9, 4.10**
     */
    const { status, body } = await api('/api/tutors?sort=price_asc&limit=100')
    assert.equal(status, 200)

    const items = body.data.items
    // nulls must come after all non-null rates
    const withRate = items.filter((i) => i.hourlyRate !== null)
    const withoutRate = items.filter((i) => i.hourlyRate === null)

    // Non-null rates must be in ascending order
    for (let i = 0; i < withRate.length - 1; i++) {
      assert.ok(
        withRate[i].hourlyRate <= withRate[i + 1].hourlyRate,
        `price_asc: items[${i}].hourlyRate (${withRate[i].hourlyRate}) > items[${i + 1}].hourlyRate (${withRate[i + 1].hourlyRate})`,
      )
    }

    // All nulls must come after non-nulls
    const lastNonNullIdx = items.map((i) => i.hourlyRate !== null).lastIndexOf(true)
    const firstNullIdx = items.map((i) => i.hourlyRate === null).indexOf(true)
    if (firstNullIdx !== -1 && lastNonNullIdx !== -1) {
      assert.ok(
        lastNonNullIdx < firstNullIdx,
        'price_asc: null rates must appear after all non-null rates',
      )
    }
  })

  it('price_desc: consecutive items are in descending order (nulls last)', async () => {
    /**
     * **Feature: tutor-marketplace, Property 4: Sorting order invariant**
     * **Validates: Requirements 4.9, 4.10**
     */
    const { status, body } = await api('/api/tutors?sort=price_desc&limit=100')
    assert.equal(status, 200)

    const items = body.data.items
    const withRate = items.filter((i) => i.hourlyRate !== null)
    const withoutRate = items.filter((i) => i.hourlyRate === null)

    for (let i = 0; i < withRate.length - 1; i++) {
      assert.ok(
        withRate[i].hourlyRate >= withRate[i + 1].hourlyRate,
        `price_desc: items[${i}].hourlyRate (${withRate[i].hourlyRate}) < items[${i + 1}].hourlyRate (${withRate[i + 1].hourlyRate})`,
      )
    }

    const lastNonNullIdx = items.map((i) => i.hourlyRate !== null).lastIndexOf(true)
    const firstNullIdx = items.map((i) => i.hourlyRate === null).indexOf(true)
    if (firstNullIdx !== -1 && lastNonNullIdx !== -1) {
      assert.ok(
        lastNonNullIdx < firstNullIdx,
        'price_desc: null rates must appear after all non-null rates',
      )
    }
  })

  it('newest: consecutive items have descending createdAt', async () => {
    /**
     * **Feature: tutor-marketplace, Property 4: Sorting order invariant**
     * **Validates: Requirements 4.9, 4.10**
     */
    const { status, body } = await api('/api/tutors?sort=newest&limit=100')
    assert.equal(status, 200)

    const items = body.data.items
    for (let i = 0; i < items.length - 1; i++) {
      const a = new Date(items[i].createdAt).getTime()
      const b = new Date(items[i + 1].createdAt).getTime()
      assert.ok(
        a >= b,
        `newest: items[${i}].createdAt (${items[i].createdAt}) is before items[${i + 1}].createdAt (${items[i + 1].createdAt})`,
      )
    }
  })
})

// ---------------------------------------------------------------------------
// Property 5: Public API responses never contain private fields
// Feature: tutor-marketplace, Property 5: Public API responses never contain private fields
// Validates: Requirements 2.8, 5.4, 16.1
// ---------------------------------------------------------------------------

const PRIVATE_FIELDS = [
  'passwordHash',
  'tokenHash',
  'revokedAt',
  'emailVerifiedAt',
  'phoneVerifiedAt',
  'adminNotes',
]

describe('Property 5: Public API responses never contain private fields', () => {
  it('GET /api/tutors never exposes private fields for any profile', async () => {
    /**
     * **Feature: tutor-marketplace, Property 5: Public API responses never contain private fields**
     * **Validates: Requirements 2.8, 5.4, 16.1**
     *
     * For any TutorProfile retrieved via GET /api/tutors, the serialized JSON
     * must not contain any private user fields.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('ONLINE', 'IN_PERSON', 'BOTH'),
        async (mode) => {
          await seedProfile({ teachingMode: mode, displayName: `P5 List ${mode}` })

          const { status, body } = await api('/api/tutors?limit=100')
          assert.equal(status, 200)

          const raw = JSON.stringify(body)
          for (const field of PRIVATE_FIELDS) {
            assert.ok(
              !raw.includes(`"${field}"`),
              `GET /api/tutors response must not contain field "${field}"`,
            )
          }
        },
      ),
      { numRuns: 5 },
    )
  })

  it('GET /api/tutors/:id never exposes private fields for any approved profile', async () => {
    /**
     * **Feature: tutor-marketplace, Property 5: Public API responses never contain private fields**
     * **Validates: Requirements 2.8, 5.4, 16.1**
     *
     * For any TutorProfile retrieved via GET /api/tutors/:id, the serialized JSON
     * must not contain any private user fields.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('ONLINE', 'IN_PERSON', 'BOTH'),
        async (mode) => {
          const { profileId } = await seedProfile({ teachingMode: mode, displayName: `P5 Detail ${mode}` })

          const { status, body } = await api(`/api/tutors/${profileId}`)
          assert.equal(status, 200)

          const raw = JSON.stringify(body)
          for (const field of PRIVATE_FIELDS) {
            assert.ok(
              !raw.includes(`"${field}"`),
              `GET /api/tutors/:id response must not contain field "${field}"`,
            )
          }
        },
      ),
      { numRuns: 5 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 12: Subject-to-profile many-to-many relationship round-trips
// Feature: tutor-marketplace, Property 12: Subject-to-profile many-to-many relationship round-trips
// Validates: Requirements 1.5, 2.5
// ---------------------------------------------------------------------------

describe('Property 12: Subject-to-profile many-to-many relationship round-trips', () => {
  it('a profile reads back exactly the subjects it was given', async () => {
    /**
     * **Feature: tutor-marketplace, Property 12: Subject-to-profile many-to-many relationship round-trips**
     * **Validates: Requirements 1.5, 2.5**
     *
     * For any TutorProfile associated with any non-empty set of subjects,
     * querying the profile with its subjects included must return exactly the
     * same set of subject IDs that were associated — no more, no fewer.
     *
     * The set is generated as a non-empty subset of a fixed subject pool, so
     * the "no more" half of the claim is meaningful: the pool contains
     * subjects the profile was *not* given, and any of those leaking into the
     * read-back fails the assertion.
     */
    const pool = await seedSubjects(6)

    await fc.assert(
      fc.asyncProperty(
        // A subset of a concrete array cannot contain duplicates, and minLength
        // 1 keeps it non-empty as the property specifies.
        fc.subarray(pool, { minLength: 1 }),
        async (subjectIds) => {
          const { profileId } = await seedProfile()

          await prisma.tutorProfileSubject.createMany({
            data: subjectIds.map((subjectId) => ({ tutorProfileId: profileId, subjectId })),
          })

          // Read back through the relationship, not through the write path.
          const stored = await prisma.tutorProfile.findUnique({
            where: { id: profileId },
            include: { subjects: { include: { subject: true } } },
          })

          const readBack = stored.subjects.map((row) => row.subject.id).sort()

          assert.deepEqual(
            readBack,
            [...subjectIds].sort(),
            'the profile must read back exactly the subjects it was given',
          )
          // The join must not have invented rows for unassociated subjects.
          assert.equal(stored.subjects.length, subjectIds.length)
        },
      ),
      { numRuns: 10 },
    )
  })

  it('the public detail endpoint returns exactly the associated subjects', async () => {
    /**
     * The same round-trip, observed through GET /api/tutors/:id, which is where
     * a client actually sees the relationship. Profiles are APPROVED so they
     * are visible in the public directory.
     */
    const pool = await seedSubjects(5)

    await fc.assert(
      fc.asyncProperty(
        fc.subarray(pool, { minLength: 1 }),
        async (subjectIds) => {
          const { profileId } = await seedProfile({ profileStatus: 'APPROVED' })

          await prisma.tutorProfileSubject.createMany({
            data: subjectIds.map((subjectId) => ({ tutorProfileId: profileId, subjectId })),
          })

          const { status, body } = await api(`/api/tutors/${profileId}`)

          assert.equal(status, 200)
          const returned = body.data.subjects.map((subject) => subject.id).sort()

          assert.deepEqual(returned, [...subjectIds].sort())
        },
      ),
      { numRuns: 10 },
    )
  })

  it('the public list endpoint returns exactly the associated subjects', async () => {
    /**
     * The directory list flattens the same join table through a different DTO
     * from the detail endpoint, so it is checked separately: a bug in one
     * mapper is invisible to a test that only reads the other.
     */
    const pool = await seedSubjects(5)

    await fc.assert(
      fc.asyncProperty(
        fc.subarray(pool, { minLength: 1 }),
        async (subjectIds) => {
          const marker = `roundtrip-${crypto.randomUUID().slice(0, 8)}`
          const { profileId } = await seedProfile({
            profileStatus: 'APPROVED',
            displayName: marker,
          })

          await prisma.tutorProfileSubject.createMany({
            data: subjectIds.map((subjectId) => ({ tutorProfileId: profileId, subjectId })),
          })

          const { status, body } = await api('/api/tutors?limit=100')
          assert.equal(status, 200)

          const card = body.data.items.find((item) => item.displayName === marker)
          assert.ok(card, 'the seeded profile should appear in the directory')

          assert.deepEqual(
            card.subjects.map((subject) => subject.id).sort(),
            [...subjectIds].sort(),
            'the list card must carry exactly the associated subjects',
          )
        },
      ),
      { numRuns: 10 },
    )
  })

  it('narrowing the subject set through PATCH leaves no orphan join rows', async () => {
    /**
     * The same round-trip, but driven through the endpoint that actually
     * rewrites the set. PATCH implements the replacement as delete-then-create
     * rather than a diff, which is exactly the kind of thing that leaves stale
     * join rows behind — so this is the path worth pinning. Doing the same
     * delete/create by hand would only be testing Prisma, not this code.
     */
    const pool = await seedSubjects(4)

    await fc.assert(
      fc.asyncProperty(
        fc.subarray(pool, { minLength: 1 }),
        fc.subarray(pool, { minLength: 1 }),
        async (initial, replacement) => {
          const { userId, token } = await createUserWithSession()
          const { profileId } = await seedProfileFor(userId)

          const setSubjects = async (ids) => {
            const result = await apiAuth(
              '/api/tutor-profile',
              { method: 'PATCH', body: JSON.stringify({ subjectIds: ids }) },
              token,
            )
            assert.equal(result.status, 200, `PATCH failed: ${JSON.stringify(result.body)}`)
            return result
          }

          await setSubjects(initial)
          const final = await setSubjects(replacement)

          // The response reflects the replacement, not the union.
          assert.deepEqual(
            final.body.data.subjects.map((subject) => subject.id).sort(),
            [...replacement].sort(),
          )

          // And nothing survives in the join table.
          const stored = await prisma.tutorProfile.findUnique({
            where: { id: profileId },
            include: { subjects: { include: { subject: true } } },
          })
          assert.deepEqual(
            stored.subjects.map((row) => row.subject.id).sort(),
            [...replacement].sort(),
            'only the replacement set should remain',
          )
        },
      ),
      { numRuns: 10 },
    )
  })
})
