/**
 * Unit tests for GET /api/tutors (public tutor directory).
 *
 * Runs against the real Express app and PostgreSQL database.
 * Requirements: 4.1–4.11
 */

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { createApp } from '../src/app.js'
import { closePrisma, prisma } from '../src/lib/prisma.js'

let server
let baseUrl

const createdUserIds = []
const createdProfileIds = []

before(async () => {
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (createdProfileIds.length) {
    await prisma.tutorProfile.deleteMany({ where: { id: { in: createdProfileIds } } })
  }
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
  }
  await new Promise((resolve) => server.close(resolve))
  await closePrisma()
})

async function api(path) {
  const response = await fetch(`${baseUrl}${path}`)
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, body }
}

async function seedProfile(overrides = {}) {
  const user = await prisma.user.create({
    data: {
      email: `unit-${crypto.randomUUID()}@test.local`,
      name: overrides.displayName ?? 'Test Tutor',
    },
  })
  createdUserIds.push(user.id)

  const profile = await prisma.tutorProfile.create({
    data: {
      userId: user.id,
      displayName: overrides.displayName ?? 'Test Tutor',
      headline: overrides.headline ?? 'Great tutor for any subject',
      bio: overrides.bio ?? 'Bio text here',
      teachingMode: overrides.teachingMode ?? 'ONLINE',
      studentLevels: overrides.studentLevels ?? ['High School'],
      profileStatus: overrides.profileStatus ?? 'APPROVED',
      location: overrides.location ?? null,
      hourlyRate: overrides.hourlyRate ?? null,
    },
  })
  createdProfileIds.push(profile.id)
  return profile
}

// ---------------------------------------------------------------------------
// Basic shape and APPROVED-only guarantee
// ---------------------------------------------------------------------------

describe('GET /api/tutors — basic response shape', () => {
  it('returns 200 with success envelope', async () => {
    const { status, body } = await api('/api/tutors')
    assert.equal(status, 200)
    assert.equal(body.success, true)
    assert.ok(Array.isArray(body.data.items))
    assert.ok(typeof body.data.pagination === 'object')
  })

  it('only returns APPROVED profiles — Req 4.1', async () => {
    const approved = await seedProfile({ displayName: 'Approved One', profileStatus: 'APPROVED' })
    const draft = await seedProfile({ displayName: 'Draft One', profileStatus: 'DRAFT' })
    const pending = await seedProfile({ displayName: 'Pending One', profileStatus: 'PENDING_REVIEW' })
    const suspended = await seedProfile({ displayName: 'Suspended One', profileStatus: 'SUSPENDED' })
    const rejected = await seedProfile({ displayName: 'Rejected One', profileStatus: 'REJECTED' })

    const { body } = await api('/api/tutors?limit=100')
    const ids = body.data.items.map((i) => i.id)

    assert.ok(ids.includes(approved.id), 'APPROVED profile must be in results')
    assert.ok(!ids.includes(draft.id), 'DRAFT profile must NOT be in results')
    assert.ok(!ids.includes(pending.id), 'PENDING_REVIEW profile must NOT be in results')
    assert.ok(!ids.includes(suspended.id), 'SUSPENDED profile must NOT be in results')
    assert.ok(!ids.includes(rejected.id), 'REJECTED profile must NOT be in results')
  })
})

// ---------------------------------------------------------------------------
// Search (q parameter) — Req 4.2
// ---------------------------------------------------------------------------

describe('GET /api/tutors — search by q', () => {
  it('matches by displayName', async () => {
    const profile = await seedProfile({ displayName: 'UniqueSearchNameXYZ' })
    const { body } = await api('/api/tutors?q=UniqueSearchNameXYZ&limit=100')
    assert.ok(body.data.items.some((i) => i.id === profile.id))
  })

  it('matches by headline', async () => {
    const profile = await seedProfile({ headline: 'UniqueHeadlineZQW expert tutor' })
    const { body } = await api('/api/tutors?q=UniqueHeadlineZQW&limit=100')
    assert.ok(body.data.items.some((i) => i.id === profile.id))
  })

  it('returns empty for unmatched search', async () => {
    const { body } = await api('/api/tutors?q=zzz-no-match-absolutely-xyz-9999')
    assert.equal(body.data.items.length, 0)
  })
})

// ---------------------------------------------------------------------------
// Individual filters
// ---------------------------------------------------------------------------

describe('GET /api/tutors — mode filter — Req 4.5', () => {
  it('filters by ONLINE', async () => {
    await seedProfile({ teachingMode: 'ONLINE', displayName: 'Online Tutor' })
    const { body } = await api('/api/tutors?mode=ONLINE&limit=100')
    for (const item of body.data.items) {
      assert.equal(item.teachingMode, 'ONLINE')
    }
  })

  it('filters by IN_PERSON', async () => {
    await seedProfile({ teachingMode: 'IN_PERSON', displayName: 'InPerson Tutor' })
    const { body } = await api('/api/tutors?mode=IN_PERSON&limit=100')
    for (const item of body.data.items) {
      assert.equal(item.teachingMode, 'IN_PERSON')
    }
  })
})

describe('GET /api/tutors — level filter — Req 4.4', () => {
  it('filters by student level', async () => {
    await seedProfile({ studentLevels: ['Primary School'], displayName: 'Primary Tutor' })
    await seedProfile({ studentLevels: ['University'], displayName: 'Uni Tutor' })

    const { body } = await api('/api/tutors?level=Primary%20School&limit=100')
    for (const item of body.data.items) {
      assert.ok(item.studentLevels.includes('Primary School'))
    }
  })
})

describe('GET /api/tutors — location filter — Req 4.6', () => {
  it('returns only profiles whose location contains the search term', async () => {
    await seedProfile({ location: 'Sydney CBD', displayName: 'Sydney Tutor' })
    await seedProfile({ location: 'Melbourne', displayName: 'Melbourne Tutor' })

    const { body } = await api('/api/tutors?location=Sydney&limit=100')
    for (const item of body.data.items) {
      assert.ok(item.location?.toLowerCase().includes('sydney'))
    }
  })
})

describe('GET /api/tutors — rate filters — Req 4.7', () => {
  it('minRate excludes profiles below the threshold', async () => {
    await seedProfile({ hourlyRate: 10, displayName: 'Cheap Tutor' })
    await seedProfile({ hourlyRate: 80, displayName: 'Expensive Tutor' })

    const { body } = await api('/api/tutors?minRate=50&limit=100')
    for (const item of body.data.items) {
      if (item.hourlyRate !== null) {
        assert.ok(item.hourlyRate >= 50)
      }
    }
  })

  it('maxRate excludes profiles above the threshold', async () => {
    await seedProfile({ hourlyRate: 200, displayName: 'Very Expensive Tutor' })
    await seedProfile({ hourlyRate: 30, displayName: 'Affordable Tutor' })

    const { body } = await api('/api/tutors?maxRate=100&limit=100')
    for (const item of body.data.items) {
      if (item.hourlyRate !== null) {
        assert.ok(item.hourlyRate <= 100)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Pagination — Req 4.8, 4.11
// ---------------------------------------------------------------------------

describe('GET /api/tutors — pagination', () => {
  it('returns a valid pagination envelope', async () => {
    const { body } = await api('/api/tutors?page=1&limit=5')
    const { pagination } = body.data
    assert.equal(pagination.page, 1)
    assert.equal(pagination.limit, 5)
    assert.ok(typeof pagination.total === 'number')
    assert.ok(typeof pagination.totalPages === 'number')
    assert.ok(body.data.items.length <= 5)
  })

  it('default limit is 12', async () => {
    const { body } = await api('/api/tutors')
    assert.equal(body.data.pagination.limit, 12)
  })

  it('limit is capped at 100 — Req 4.8', async () => {
    const { status, body } = await api('/api/tutors?limit=200')
    assert.equal(status, 400, 'limit > 100 should be rejected')
    assert.equal(body.error.code, 'VALIDATION_ERROR')
  })

  it('page=0 is rejected', async () => {
    const { status } = await api('/api/tutors?page=0')
    assert.equal(status, 400)
  })
})

// ---------------------------------------------------------------------------
// Sort — Req 4.9, 4.10
// ---------------------------------------------------------------------------

describe('GET /api/tutors — sort modes', () => {
  it('accepts all valid sort values', async () => {
    for (const sort of ['recommended', 'price_asc', 'price_desc', 'newest']) {
      const { status } = await api(`/api/tutors?sort=${sort}`)
      assert.equal(status, 200, `sort=${sort} should be accepted`)
    }
  })

  it('rejects an invalid sort value', async () => {
    const { status, body } = await api('/api/tutors?sort=bogus')
    assert.equal(status, 400)
    assert.equal(body.error.code, 'VALIDATION_ERROR')
  })
})

// ---------------------------------------------------------------------------
// Invalid params
// ---------------------------------------------------------------------------

describe('GET /api/tutors — invalid params rejected', () => {
  it('rejects an invalid mode', async () => {
    const { status } = await api('/api/tutors?mode=FLYING')
    assert.equal(status, 400)
  })

  it('rejects a non-numeric minRate', async () => {
    const { status } = await api('/api/tutors?minRate=abc')
    assert.equal(status, 400)
  })

  it('rejects a non-numeric maxRate', async () => {
    const { status } = await api('/api/tutors?maxRate=abc')
    assert.equal(status, 400)
  })
})

// ---------------------------------------------------------------------------
// Empty result — Req 4.11
// ---------------------------------------------------------------------------

describe('GET /api/tutors — empty result', () => {
  it('returns a valid envelope when no profiles match — Req 4.11', async () => {
    const { status, body } = await api('/api/tutors?q=zzz-no-match-absolutely-xyz-9999')
    assert.equal(status, 200)
    assert.equal(body.success, true)
    assert.equal(body.data.items.length, 0)
    assert.equal(body.data.pagination.total, 0)
    assert.equal(body.data.pagination.totalPages, 0)
  })
})

// ---------------------------------------------------------------------------
// Private field exclusion — Req 16.1
// ---------------------------------------------------------------------------

describe('GET /api/tutors — private fields excluded', () => {
  it('never includes private user fields', async () => {
    await seedProfile({ displayName: 'Privacy Tutor' })
    const { body } = await api('/api/tutors?limit=100')

    const raw = JSON.stringify(body)
    for (const field of ['passwordHash', 'tokenHash', 'revokedAt', 'emailVerifiedAt', 'phoneVerifiedAt', 'adminNotes']) {
      assert.ok(!raw.includes(field), `Response must not contain "${field}"`)
    }
  })
})

// ---------------------------------------------------------------------------
// GET /api/tutors/:id — Req 5.1–5.4
// ---------------------------------------------------------------------------

describe('GET /api/tutors/:id — valid approved profile', () => {
  it('returns 200 with full TutorDetailDTO for an approved profile', async () => {
    const profile = await seedProfile({ displayName: 'Detail Tutor', bio: 'Full bio content here' })
    const { status, body } = await api(`/api/tutors/${profile.id}`)

    assert.equal(status, 200)
    assert.equal(body.success, true)
    assert.equal(body.data.id, profile.id)
    assert.equal(body.data.displayName, 'Detail Tutor')
    assert.ok('bio' in body.data, 'full bio must be present')
    assert.ok('subjects' in body.data)
    assert.ok('studentLevels' in body.data)
    assert.ok('teachingMode' in body.data)
    assert.ok('languages' in body.data)
  })

  it('bio is not truncated in the detail view', async () => {
    const longBio = 'A'.repeat(500)
    const profile = await seedProfile({ displayName: 'Long Bio Tutor', bio: longBio })
    const { body } = await api(`/api/tutors/${profile.id}`)

    assert.equal(body.data.bio.length, 500, 'Full bio should not be truncated')
  })
})

describe('GET /api/tutors/:id — 404 cases', () => {
  it('returns 404 for a non-existent ID — Req 5.3', async () => {
    const fakeId = crypto.randomUUID()
    const { status, body } = await api(`/api/tutors/${fakeId}`)

    assert.equal(status, 404)
    assert.equal(body.success, false)
    assert.equal(body.error.code, 'NOT_FOUND')
  })

  it('returns 404 for a DRAFT profile — Req 5.2', async () => {
    const profile = await seedProfile({ displayName: 'Draft Detail', profileStatus: 'DRAFT' })
    const { status } = await api(`/api/tutors/${profile.id}`)
    assert.equal(status, 404)
  })

  it('returns 404 for a PENDING_REVIEW profile — Req 5.2', async () => {
    const profile = await seedProfile({ displayName: 'Pending Detail', profileStatus: 'PENDING_REVIEW' })
    const { status } = await api(`/api/tutors/${profile.id}`)
    assert.equal(status, 404)
  })

  it('returns 404 for a SUSPENDED profile — Req 5.2', async () => {
    const profile = await seedProfile({ displayName: 'Suspended Detail', profileStatus: 'SUSPENDED' })
    const { status } = await api(`/api/tutors/${profile.id}`)
    assert.equal(status, 404)
  })

  it('returns 404 for a REJECTED profile — Req 5.2', async () => {
    const profile = await seedProfile({ displayName: 'Rejected Detail', profileStatus: 'REJECTED' })
    const { status } = await api(`/api/tutors/${profile.id}`)
    assert.equal(status, 404)
  })
})

describe('GET /api/tutors/:id — private fields excluded — Req 5.4, 16.1', () => {
  it('never includes private user fields in the detail response', async () => {
    const profile = await seedProfile({ displayName: 'Private Check Tutor' })
    const { body } = await api(`/api/tutors/${profile.id}`)

    const raw = JSON.stringify(body)
    for (const field of ['passwordHash', 'tokenHash', 'revokedAt', 'emailVerifiedAt', 'phoneVerifiedAt', 'adminNotes']) {
      assert.ok(!raw.includes(field), `Response must not contain "${field}"`)
    }
  })
})
