/**
 * Property-based tests for the public tutor directory API.
 *
 * Each test runs against the real Express app and the real PostgreSQL database.
 * The tests create their own TutorProfile records (via Prisma directly) and
 * clean up afterwards so they do not depend on seed data.
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

  const profile = await prisma.tutorProfile.create({
    data: {
      userId: user.id,
      displayName: 'Test Tutor',
      headline: 'Test headline',
      bio: 'Test bio content',
      teachingMode: 'ONLINE',
      studentLevels: ['High School'],
      profileStatus: 'APPROVED',
      ...overrides,
    },
  })
  createdProfileIds.push(profile.id)
  return { userId: user.id, profileId: profile.id }
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
    const allStatuses = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SUSPENDED', 'REJECTED']

    await fc.assert(
      fc.asyncProperty(
        // Pick a random non-empty subset of statuses to seed
        fc.shuffledSubarray(allStatuses, { minLength: 2, maxLength: 5 }),
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
          await seedProfile({ hourlyRate: (minRate + maxRate) / 2, displayName: 'In Range' })
          await seedProfile({ hourlyRate: minRate - 1, displayName: 'Below Range' })
          await seedProfile({ hourlyRate: maxRate + 1, displayName: 'Above Range' })

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
    await seedProfile({ hourlyRate: 20, displayName: 'Sort Tutor Low' })
    await seedProfile({ hourlyRate: 50, displayName: 'Sort Tutor Mid' })
    await seedProfile({ hourlyRate: 100, displayName: 'Sort Tutor High' })
    await seedProfile({ hourlyRate: null, displayName: 'Sort Tutor NoRate' })
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
