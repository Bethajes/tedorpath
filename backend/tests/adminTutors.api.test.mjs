/**
 * Admin tutor moderation API tests.
 *
 * These run against the real Express app and the real PostgreSQL database, so
 * they exercise the same code path as production. They create their own
 * records and clean up afterwards, and do not rely on seed data.
 *
 * Run with: npm test   (or: node --test tests/)
 */

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import express from 'express'

import { createApp } from '../src/app.js'
import { adminTutorsRouter } from '../src/modules/adminTutors/index.js'
import { closePrisma, prisma } from '../src/lib/prisma.js'

/**
 * Requirements covered: 7.1, 7.2, 7.3, 7.4, 7.5
 */

const TOKEN = process.env.ADMIN_API_TOKEN ?? ''
const auth = { Authorization: `Bearer ${TOKEN}` }

let server
let baseUrl

/** Rows created by these tests, removed at the end. */
const createdUserIds = []
const createdProfileIds = []
const createdSubjectIds = []

before(async () => {
  if (!TOKEN) {
    throw new Error('ADMIN_API_TOKEN must be set to run the admin tutor tests')
  }
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  // Dependency order: profiles reference subjects, subjects reference nothing.
  if (createdProfileIds.length) {
    await prisma.tutorProfile.deleteMany({ where: { id: { in: createdProfileIds } } })
  }
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
      ...(options.noAuth ? {} : auth),
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

/** Creates a subject and returns its id. */
async function createSubject() {
  const unique = crypto.randomUUID().slice(0, 8)
  const subject = await prisma.subject.create({
    data: {
      name: `Subject ${unique}`,
      slug: `subject-${unique}`,
      category: 'Mathematics',
    },
  })
  createdSubjectIds.push(subject.id)
  return subject.id
}

/**
 * Creates a User + TutorProfile pair for moderation.
 *
 * Rows are written through Prisma rather than the tutor API so each test can
 * choose the exact starting status, and so the suite does not depend on the
 * tutor endpoints still behaving a particular way.
 */
async function createProfile(overrides = {}) {
  const user = await prisma.user.create({
    data: { email: `admin-tutors-${crypto.randomUUID()}@test.local`, name: 'Test Tutor' },
  })
  createdUserIds.push(user.id)

  const subjectId = overrides.subjectId ?? (await createSubject())

  const profile = await prisma.tutorProfile.create({
    data: {
      userId: user.id,
      displayName: 'Test Tutor',
      headline: 'Mathematics specialist',
      bio: 'Ten years of teaching experience.',
      teachingMode: 'ONLINE',
      studentLevels: ['High School'],
      hourlyRate: 25,
      profileStatus: 'PENDING_REVIEW',
      verificationStatus: 'UNVERIFIED',
      ...overrides,
      userId: user.id,
      subjects: { create: [{ subjectId }] },
    },
  })
  createdProfileIds.push(profile.id)

  return profile
}

// ---------------------------------------------------------------------------
// The router's own guard, tested in isolation
// ---------------------------------------------------------------------------

/**
 * These mount ONLY adminTutorsRouter, with no other admin router in front of
 * it.
 *
 * That matters: adminRequestsRouter is mounted at the same `/api/admin` prefix
 * and applies `router.use(requireAdmin)` to *every* request entering it, even
 * ones that match none of its routes. So against the full app, a request to
 * `/api/admin/tutors` is rejected by that sibling's guard before this router
 * is ever reached — the mounted tests above would still pass with the guard
 * deleted from this router.
 *
 * Mounting it alone is what actually proves the moderation routes are closed on
 * their own account, instead of by accident of registration order.
 */
describe('adminTutorsRouter is closed on its own', () => {
  let soloServer
  let soloBaseUrl

  before(async () => {
    const app = express()
    app.use(express.json())
    app.use('/api/admin', adminTutorsRouter)
    soloServer = app.listen(0)
    await new Promise((resolve) => soloServer.once('listening', resolve))
    soloBaseUrl = `http://127.0.0.1:${soloServer.address().port}`
  })

  after(async () => {
    await new Promise((resolve) => soloServer.close(resolve))
  })

  async function soloApi(path, options = {}) {
    const response = await fetch(`${soloBaseUrl}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.noAuth ? {} : auth),
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

  it('refuses the list without a token', async () => {
    const { status, body } = await soloApi('/api/admin/tutors', { noAuth: true })

    assert.equal(status, 401, 'the list must not be readable without the admin token')
    assert.equal(body.success, false)
    assert.equal(body.error.code, 'UNAUTHORIZED')
  })

  it('refuses the detail view without a token', async () => {
    const profile = await createProfile()

    const { status } = await soloApi(`/api/admin/tutors/${profile.id}`, { noAuth: true })

    assert.equal(status, 401)
  })

  it('refuses a status change without a token, leaving the profile untouched', async () => {
    const profile = await createProfile()

    const { status } = await soloApi(`/api/admin/tutors/${profile.id}/status`, {
      method: 'PATCH',
      noAuth: true,
      body: JSON.stringify({ status: 'APPROVED' }),
    })

    assert.equal(status, 401)

    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.equal(stored.profileStatus, 'PENDING_REVIEW')
  })

  it('refuses a wrong token', async () => {
    const { status } = await soloApi('/api/admin/tutors', {
      noAuth: true,
      headers: { Authorization: 'Bearer wrong-token' },
    })

    assert.equal(status, 401)
  })

  it('serves the list once the token is supplied', async () => {
    const { status } = await soloApi('/api/admin/tutors')

    assert.equal(status, 200, 'the guard must not be so broad that it blocks valid admins')
  })
})

// ---------------------------------------------------------------------------
// Requirements 7.1, 7.2: the admin guard
// ---------------------------------------------------------------------------

describe('security boundary', () => {
  it('rejects a tutor list with no admin token', async () => {
    const { status, body } = await api('/api/admin/tutors', { noAuth: true })

    assert.equal(status, 401)
    assert.equal(body.success, false)
    assert.equal(body.error.code, 'UNAUTHORIZED')
  })

  it('rejects a tutor list with a wrong admin token', async () => {
    const { status } = await api('/api/admin/tutors', {
      noAuth: true,
      headers: { Authorization: 'Bearer not-the-real-token' },
    })

    assert.equal(status, 401)
  })

  it('rejects a profile detail request with no admin token', async () => {
    const profile = await createProfile()

    const { status, body } = await api(`/api/admin/tutors/${profile.id}`, { noAuth: true })

    assert.equal(status, 401)
    assert.equal(body.error.code, 'UNAUTHORIZED')
  })

  it('rejects a status change with no admin token, leaving the profile untouched', async () => {
    const profile = await createProfile()

    const { status } = await api(`/api/admin/tutors/${profile.id}/status`, {
      method: 'PATCH',
      noAuth: true,
      body: JSON.stringify({ status: 'APPROVED' }),
    })

    assert.equal(status, 401)

    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.equal(stored.profileStatus, 'PENDING_REVIEW', 'the profile must not have been approved')
  })

  it('accepts the token via X-Admin-Token as well as Authorization', async () => {
    const { status } = await api('/api/admin/tutors', {
      noAuth: true,
      headers: { 'X-Admin-Token': TOKEN },
    })

    assert.equal(status, 200)
  })
})

// ---------------------------------------------------------------------------
// Requirement 7.1: GET /api/admin/tutors
// ---------------------------------------------------------------------------

describe('GET /api/admin/tutors', () => {
  it('returns profiles with their moderation fields and pagination', async () => {
    await createProfile({ displayName: 'Listed Tutor' })

    const { status, body } = await api('/api/admin/tutors?limit=5')

    assert.equal(status, 200)
    assert.equal(body.success, true)
    assert.ok(Array.isArray(body.data.items))
    assert.ok(body.data.pagination, 'pagination metadata is expected')

    const listed = body.data.items.find((item) => item.displayName === 'Listed Tutor')
    assert.ok(listed, 'the seeded profile should appear in the list')
    assert.equal(listed.profileStatus, 'PENDING_REVIEW')
    assert.equal(listed.verificationStatus, 'UNVERIFIED')
    assert.ok(Array.isArray(listed.subjects))
  })

  it('exposes draft and unapproved profiles, which the public directory hides', async () => {
    await createProfile({ displayName: 'Hidden Draft', profileStatus: 'DRAFT' })

    const { status, body } = await api('/api/admin/tutors?limit=100')

    assert.equal(status, 200)
    const found = body.data.items.find((item) => item.displayName === 'Hidden Draft')
    assert.ok(found, 'an admin must be able to see a DRAFT profile')
    assert.equal(found.profileStatus, 'DRAFT')
  })

  it('filters by profile status', async () => {
    await createProfile({ displayName: 'Suspended Tutor', profileStatus: 'SUSPENDED' })

    const { status, body } = await api('/api/admin/tutors?status=SUSPENDED&limit=100')

    assert.equal(status, 200)
    const statuses = body.data.items.map((item) => item.profileStatus)
    assert.ok(statuses.includes('SUSPENDED'))
    assert.ok(
      statuses.every((value) => value === 'SUSPENDED'),
      `only SUSPENDED profiles should be returned, saw ${JSON.stringify(statuses)}`,
    )
  })

  it('rejects a nonsensical limit instead of silently clamping it', async () => {
    const { status, body } = await api('/api/admin/tutors?limit=0')

    assert.equal(status, 400)
    assert.equal(body.error.code, 'VALIDATION_ERROR')
  })
})

// ---------------------------------------------------------------------------
// Requirement 7.2: GET /api/admin/tutors/:id
// ---------------------------------------------------------------------------

describe('GET /api/admin/tutors/:id', () => {
  it('returns the full profile including moderation fields', async () => {
    const profile = await createProfile({ displayName: 'Detail Tutor' })

    const { status, body } = await api(`/api/admin/tutors/${profile.id}`)

    assert.equal(status, 200)
    assert.equal(body.data.id, profile.id)
    assert.equal(body.data.displayName, 'Detail Tutor')
    assert.equal(body.data.profileStatus, 'PENDING_REVIEW')
    assert.equal(body.data.verificationStatus, 'UNVERIFIED')

    // Moderation view includes the full submitted content and the owner.
    assert.equal(body.data.bio, 'Ten years of teaching experience.')
    assert.equal(body.data.user.id, profile.userId)
    assert.equal(body.data.subjects.length, 1)
  })

  it('returns 404 for a well-formed but unknown id', async () => {
    const { status, body } = await api(`/api/admin/tutors/${crypto.randomUUID()}`)

    assert.equal(status, 404)
    assert.equal(body.error.code, 'NOT_FOUND')
  })

  it('returns 400 for an id that is not a UUID', async () => {
    const { status, body } = await api('/api/admin/tutors/not-a-uuid')

    assert.equal(status, 400)
    assert.equal(body.error.code, 'VALIDATION_ERROR')
  })
})

// ---------------------------------------------------------------------------
// Requirements 7.3, 7.4: PATCH /api/admin/tutors/:id/status
// ---------------------------------------------------------------------------

describe('PATCH /api/admin/tutors/:id/status', () => {
  it('applies a valid status change', async () => {
    const profile = await createProfile()

    const { status, body } = await api(`/api/admin/tutors/${profile.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'APPROVED' }),
    })

    assert.equal(status, 200)
    assert.equal(body.data.profileStatus, 'APPROVED')

    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.equal(stored.profileStatus, 'APPROVED', 'the change must be persisted')
  })

  for (const target of ['REJECTED', 'SUSPENDED']) {
    it(`applies a ${target} status change`, async () => {
      const profile = await createProfile({ profileStatus: 'APPROVED' })

      const { status, body } = await api(`/api/admin/tutors/${profile.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: target }),
      })

      assert.equal(status, 200)
      assert.equal(body.data.profileStatus, target)
    })
  }

  it('rejects an unknown status with 422 and changes nothing', async () => {
    const profile = await createProfile()

    const { status, body } = await api(`/api/admin/tutors/${profile.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'PUBLISHED' }),
    })

    assert.equal(status, 422, 'Requirement 7.4 names 422 for a disallowed status')
    assert.equal(body.success, false)
    assert.ok(Array.isArray(body.error.fields))

    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.equal(stored.profileStatus, 'PENDING_REVIEW', 'an invalid status must not be stored')
  })

  it('rejects a tutor workflow state that is not a moderation decision', async () => {
    const profile = await createProfile()

    for (const attempted of ['DRAFT', 'PENDING_REVIEW']) {
      const { status } = await api(`/api/admin/tutors/${profile.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: attempted }),
      })

      assert.equal(status, 422, `${attempted} is not an admin-settable status`)
    }

    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.equal(stored.profileStatus, 'PENDING_REVIEW')
  })

  it('rejects a missing status with 422', async () => {
    const profile = await createProfile()

    const { status } = await api(`/api/admin/tutors/${profile.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    })

    assert.equal(status, 422)
  })

  it('returns 404 for a well-formed but unknown id', async () => {
    const { status, body } = await api(`/api/admin/tutors/${crypto.randomUUID()}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'APPROVED' }),
    })

    assert.equal(status, 404)
    assert.equal(body.error.code, 'NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
// Requirement 7.5: approval does not imply verification
// ---------------------------------------------------------------------------

describe('Requirement 7.5: approval does not imply verification', () => {
  it('leaves verificationStatus untouched when approving without it', async () => {
    const profile = await createProfile({ verificationStatus: 'UNVERIFIED' })

    const { status, body } = await api(`/api/admin/tutors/${profile.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'APPROVED' }),
    })

    assert.equal(status, 200)
    assert.equal(body.data.profileStatus, 'APPROVED')
    assert.equal(
      body.data.verificationStatus,
      'UNVERIFIED',
      'approval alone must not verify the tutor',
    )

    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.equal(stored.verificationStatus, 'UNVERIFIED')
  })

  it('does not downgrade an already-verified tutor when approving', async () => {
    // The regression this guards: defaulting verificationStatus in the schema
    // would silently unverify an existing VERIFIED tutor on approval.
    const profile = await createProfile({ verificationStatus: 'VERIFIED' })

    const { status, body } = await api(`/api/admin/tutors/${profile.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'APPROVED' }),
    })

    assert.equal(status, 200)
    assert.equal(body.data.verificationStatus, 'VERIFIED')

    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.equal(stored.verificationStatus, 'VERIFIED')
  })

  it('sets verificationStatus to VERIFIED when the admin asks for it explicitly', async () => {
    const profile = await createProfile({ verificationStatus: 'UNVERIFIED' })

    const { status, body } = await api(`/api/admin/tutors/${profile.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'APPROVED', verificationStatus: 'VERIFIED' }),
    })

    assert.equal(status, 200)
    assert.equal(body.data.profileStatus, 'APPROVED')
    assert.equal(body.data.verificationStatus, 'VERIFIED')

    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.equal(stored.verificationStatus, 'VERIFIED')
  })

  it('honours an explicit UNVERIFIED even when approving', async () => {
    const profile = await createProfile({ verificationStatus: 'VERIFIED' })

    const { status, body } = await api(`/api/admin/tutors/${profile.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'APPROVED', verificationStatus: 'UNVERIFIED' }),
    })

    assert.equal(status, 200)
    assert.equal(body.data.verificationStatus, 'UNVERIFIED')
  })

  it('rejects an unknown verificationStatus with 422', async () => {
    const profile = await createProfile()

    const { status } = await api(`/api/admin/tutors/${profile.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'APPROVED', verificationStatus: 'TRUSTED' }),
    })

    assert.equal(status, 422)
  })

  it('does not let the moderation endpoint edit the tutor-authored content', async () => {
    const profile = await createProfile({ displayName: 'Original Name' })

    const { status } = await api(`/api/admin/tutors/${profile.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'APPROVED', displayName: 'Rewritten By Admin' }),
    })

    assert.equal(status, 422, 'unrecognised fields must be refused, not silently ignored')

    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.equal(stored.displayName, 'Original Name')
  })
})
