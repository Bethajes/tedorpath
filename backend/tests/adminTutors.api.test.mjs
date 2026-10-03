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
import { ratesFor, withoutRates } from './helpers/rates.mjs'

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
      // Priced in the local market so a moderator has a number to look at. A rate
      // row rather than a column: the rate table is what a profile stores.
      rates: ratesFor({ hourlyRateEtb: 25 }),
      profileStatus: 'PENDING_REVIEW',
      verificationStatus: 'UNVERIFIED',
      ...withoutRates(overrides),
      rates: ratesFor(overrides),
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

  // REJECTED carries a required reason from the extended workflow, so it is
  // exercised separately from SUSPENDED below rather than in the same loop.
  // Requirements: 22.1, 22.4
  it('applies a SUSPENDED status change', async () => {
    const profile = await createProfile({ profileStatus: 'APPROVED' })

    const { status, body } = await api(`/api/admin/tutors/${profile.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'SUSPENDED' }),
    })

    assert.equal(status, 200)
    assert.equal(body.data.profileStatus, 'SUSPENDED')
  })

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

// ---------------------------------------------------------------------------
// Rejection and NEEDS_INFORMATION (Requirement 19.3, 22.1–22.5, 28.2, 28.3)
// ---------------------------------------------------------------------------

describe('moderation outcomes that must carry an explanation', () => {
  it('applies a REJECTED status change and persists the reason', async () => {
    const profile = await createProfile({ profileStatus: 'PENDING_REVIEW' })

    const { status, body } = await api(`/api/admin/tutors/${profile.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'REJECTED',
        rejectionReason: 'MISSING_DOCUMENT',
        adminMessage: 'Please resend your government ID.',
      }),
    })

    assert.equal(status, 200)
    assert.equal(body.data.profileStatus, 'REJECTED')
    assert.equal(body.data.rejectionReason, 'MISSING_DOCUMENT')
    assert.equal(body.data.adminMessage, 'Please resend your government ID.')

    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.equal(stored.profileStatus, 'REJECTED')
    assert.equal(stored.rejectionReason, 'MISSING_DOCUMENT')
    assert.equal(stored.adminMessage, 'Please resend your government ID.')
  })

  it('rejects REJECTED without a rejectionReason with 422 and changes nothing', async () => {
    const profile = await createProfile({ profileStatus: 'PENDING_REVIEW' })

    const { status, body } = await api(`/api/admin/tutors/${profile.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'REJECTED' }),
    })

    assert.equal(status, 422, 'Requirement 22.1: a rejection must say why')
    assert.equal(body.error.code, 'REJECTION_REASON_REQUIRED')

    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.equal(stored.profileStatus, 'PENDING_REVIEW', 'a rejected request must not be applied')
    assert.equal(stored.rejectionReason, null)
  })

  it('rejects an unknown rejectionReason category with 422', async () => {
    const profile = await createProfile()

    const { status, body } = await api(`/api/admin/tutors/${profile.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'REJECTED', rejectionReason: 'BECAUSE_I_SAID_SO' }),
    })

    assert.equal(status, 422)
    assert.equal(body.error.code, 'INVALID_STATUS')
  })

  it('accepts REJECTED with a reason and no adminMessage', async () => {
    const profile = await createProfile()

    const { status, body } = await api(`/api/admin/tutors/${profile.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'REJECTED', rejectionReason: 'PROFILE_INCOMPLETE' }),
    })

    assert.equal(status, 200)
    assert.equal(body.data.rejectionReason, 'PROFILE_INCOMPLETE')
    assert.equal(body.data.adminMessage, null)
  })

  it('applies NEEDS_INFORMATION and persists the admin message', async () => {
    const profile = await createProfile({ profileStatus: 'PENDING_REVIEW' })

    const { status, body } = await api(`/api/admin/tutors/${profile.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'NEEDS_INFORMATION',
        adminMessage: 'Please upload a photo of your teaching certificate.',
      }),
    })

    assert.equal(status, 200)
    assert.equal(body.data.profileStatus, 'NEEDS_INFORMATION')
    assert.equal(body.data.adminMessage, 'Please upload a photo of your teaching certificate.')

    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.equal(stored.profileStatus, 'NEEDS_INFORMATION')
    assert.equal(stored.adminMessage, 'Please upload a photo of your teaching certificate.')
  })

  it('rejects NEEDS_INFORMATION without an adminMessage with 422 and changes nothing', async () => {
    const profile = await createProfile({ profileStatus: 'PENDING_REVIEW' })

    const { status, body } = await api(`/api/admin/tutors/${profile.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'NEEDS_INFORMATION' }),
    })

    assert.equal(status, 422, 'Requirement 22.2: asking for information must say what')
    assert.equal(body.error.code, 'ADMIN_MESSAGE_REQUIRED')

    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.equal(stored.profileStatus, 'PENDING_REVIEW', 'a rejected request must not be applied')
  })

  it('treats a whitespace-only adminMessage as absent', async () => {
    const profile = await createProfile()

    const { status, body } = await api(`/api/admin/tutors/${profile.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'NEEDS_INFORMATION', adminMessage: '   ' }),
    })

    assert.equal(status, 422, 'a message of spaces tells the tutor nothing')
    assert.equal(body.error.code, 'ADMIN_MESSAGE_REQUIRED')
  })

  it('does not require either field for APPROVED or SUSPENDED', async () => {
    for (const target of ['APPROVED', 'SUSPENDED']) {
      const profile = await createProfile({ profileStatus: 'PENDING_REVIEW' })

      const { status } = await api(`/api/admin/tutors/${profile.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: target }),
      })

      assert.equal(status, 200, `${target} must not demand a reason or a message`)
    }
  })

  it('leaves a previous rejectionReason alone when the admin sends no new one', async () => {
    const profile = await createProfile({
      profileStatus: 'REJECTED',
      rejectionReason: 'MISSING_DOCUMENT',
      adminMessage: 'Resend your ID.',
    })

    const { status } = await api(`/api/admin/tutors/${profile.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'NEEDS_INFORMATION', adminMessage: 'Still waiting on your ID.' }),
    })

    assert.equal(status, 200)

    // The new message replaces the old one; the old reason is kept rather than
    // blanked, so the history of the decision is not destroyed by a later one.
    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.equal(stored.adminMessage, 'Still waiting on your ID.')
    assert.equal(stored.rejectionReason, 'MISSING_DOCUMENT')
  })

  it('exposes the moderation fields on the detail view', async () => {
    const profile = await createProfile({
      applicationReference: 'TT-2026-000042',
      rejectionReason: 'OTHER',
      adminMessage: 'Not a fit for the subjects listed.',
      adminNotes: 'Spoke to the tutor on the phone.',
      verificationChecklist: { govIdReceived: true, identityReviewed: true },
      verifiedAt: new Date('2026-02-03T04:05:06.000Z'),
    })

    const { status, body } = await api(`/api/admin/tutors/${profile.id}`)

    assert.equal(status, 200)
    assert.equal(body.data.applicationReference, 'TT-2026-000042')
    assert.equal(body.data.rejectionReason, 'OTHER')
    assert.equal(body.data.adminMessage, 'Not a fit for the subjects listed.')
    assert.equal(body.data.adminNotes, 'Spoke to the tutor on the phone.')
    assert.equal(body.data.verificationChecklist.govIdReceived, true)
    assert.equal(body.data.verifiedAt, '2026-02-03T04:05:06.000Z')
  })

  it('lists profiles filtered by NEEDS_INFORMATION', async () => {
    const profile = await createProfile({ profileStatus: 'NEEDS_INFORMATION' })

    const { status, body } = await api('/api/admin/tutors?status=NEEDS_INFORMATION&limit=100')

    assert.equal(status, 200, 'the status filter must accept every real enum value')
    assert.ok(
      body.data.items.some((item) => item.id === profile.id),
      'a NEEDS_INFORMATION profile must be reachable in the moderation queue',
    )
  })
})

// ---------------------------------------------------------------------------
// Moderation queue search (Requirement 23.4)
// ---------------------------------------------------------------------------

describe('GET /api/admin/tutors — search', () => {
  it('matches on display name, case-insensitively', async () => {
    const match = await createProfile({ displayName: 'Uniquehandle Featherstone' })
    await createProfile({ displayName: 'Someone Else Entirely' })

    const { status, body } = await api('/api/admin/tutors?limit=100&q=uniquehandle')

    assert.equal(status, 200)
    const ids = body.data.items.map((item) => item.id)
    assert.ok(ids.includes(match.id), 'a case-different name must still match')
  })

  it('matches on headline', async () => {
    const match = await createProfile({ headline: 'Quantum Mechanics specialist' })

    const { body } = await api('/api/admin/tutors?limit=100&q=quantum')
    const ids = body.data.items.map((item) => item.id)

    assert.ok(ids.includes(match.id), 'an admin searches by what the tutor teaches')
  })

  it('matches on the account email, so a colleague can find the applicant', async () => {
    const profile = await createProfile()
    const email = await prisma.user.findUnique({ where: { id: profile.userId } })

    const { body } = await api(`/api/admin/tutors?limit=100&q=${encodeURIComponent(email.email)}`)
    const ids = body.data.items.map((item) => item.id)

    assert.ok(ids.includes(profile.id), 'the applicant may be known by their account email')
  })

  it('returns only matching profiles', async () => {
    const match = await createProfile({ displayName: 'Distinguishable One' })
    const other = await createProfile({ displayName: 'Distinguishable Two' })

    const { body } = await api('/api/admin/tutors?limit=100&q=Distinguishable%20One')
    const ids = body.data.items.map((item) => item.id)

    assert.ok(ids.includes(match.id))
    assert.ok(!ids.includes(other.id), 'a partial match must not pull in a different profile')
  })

  it('applies the search and the status filter together', async () => {
    const pending = await createProfile({
      displayName: 'Combined Filter Person',
      profileStatus: 'PENDING_REVIEW',
    })
    const approved = await createProfile({
      displayName: 'Combined Filter Person',
      profileStatus: 'APPROVED',
    })

    const { body } = await api('/api/admin/tutors?limit=100&q=Combined%20Filter%20Person&status=PENDING_REVIEW')
    const ids = body.data.items.map((item) => item.id)

    assert.ok(ids.includes(pending.id), 'the pending profile matches both filters')
    assert.ok(!ids.includes(approved.id), 'an approved profile is excluded by the status filter')
  })

  it('ignores a blank search term', async () => {
    const profile = await createProfile()

    const { body } = await api('/api/admin/tutors?limit=100&q=')
    const ids = body.data.items.map((item) => item.id)

    assert.ok(
      ids.includes(profile.id),
      'an empty q must behave as no filter, not as a search matching nothing',
    )
  })

  it('rejects an over-long search term with 400', async () => {
    const { status } = await api(`/api/admin/tutors?q=${'x'.repeat(101)}`)
    assert.equal(status, 400)
  })

  it('returns an empty page when nothing matches', async () => {
    const { status, body } = await api('/api/admin/tutors?limit=100&q=zzzznotarealnamezzzz')

    assert.equal(status, 200)
    assert.deepEqual(body.data.items, [])
    assert.equal(body.data.pagination.total, 0)
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/admin/tutors/:id/verification (Requirement 26.3, 27.3–27.5)
// ---------------------------------------------------------------------------

describe('PATCH /api/admin/tutors/:id/verification', () => {
  it('requires the admin token', async () => {
    const profile = await createProfile()

    const { status, body } = await api(`/api/admin/tutors/${profile.id}/verification`, {
      method: 'PATCH',
      noAuth: true,
      body: JSON.stringify({ adminNotes: 'sneaky' }),
    })

    assert.equal(status, 401)
    assert.equal(body.success, false)

    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.equal(stored.adminNotes, null, 'an unauthenticated write must change nothing')
  })

  it('updates verificationStatus without changing profileStatus', async () => {
    const profile = await createProfile({
      profileStatus: 'PENDING_REVIEW',
      verificationStatus: 'UNVERIFIED',
    })

    const { status, body } = await api(`/api/admin/tutors/${profile.id}/verification`, {
      method: 'PATCH',
      body: JSON.stringify({ verificationStatus: 'DOCUMENTS_RECEIVED' }),
    })

    assert.equal(status, 200)
    assert.equal(body.data.verificationStatus, 'DOCUMENTS_RECEIVED')
    assert.equal(body.data.profileStatus, 'PENDING_REVIEW', 'Requirement 27.3: status is not touched')

    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.equal(stored.verificationStatus, 'DOCUMENTS_RECEIVED')
    assert.equal(stored.profileStatus, 'PENDING_REVIEW')
  })

  it('saves adminNotes', async () => {
    const profile = await createProfile()

    const { status, body } = await api(`/api/admin/tutors/${profile.id}/verification`, {
      method: 'PATCH',
      body: JSON.stringify({ adminNotes: 'Government ID received. Certificate pending.' }),
    })

    assert.equal(status, 200)
    assert.equal(body.data.adminNotes, 'Government ID received. Certificate pending.')

    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.equal(stored.adminNotes, 'Government ID received. Certificate pending.')
  })

  it('saves the verificationChecklist', async () => {
    const profile = await createProfile()

    const checklist = {
      govIdReceived: true,
      identityReviewed: true,
      educationDocReceived: false,
      educationReviewed: false,
      certificateReceived: true,
      qualificationReviewed: false,
    }

    const { status, body } = await api(`/api/admin/tutors/${profile.id}/verification`, {
      method: 'PATCH',
      body: JSON.stringify({ verificationChecklist: checklist }),
    })

    assert.equal(status, 200)
    assert.deepEqual(body.data.verificationChecklist, checklist)

    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.deepEqual(stored.verificationChecklist, checklist)
  })

  it('accepts a partial checklist', async () => {
    const profile = await createProfile()

    const { status } = await api(`/api/admin/tutors/${profile.id}/verification`, {
      method: 'PATCH',
      body: JSON.stringify({ verificationChecklist: { govIdReceived: true } }),
    })

    assert.equal(status, 200, 'an admin should be able to tick one box and save')

    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.deepEqual(stored.verificationChecklist, { govIdReceived: true })
  })

  it('sets verifiedAt when the admin records a VERIFIED status', async () => {
    const profile = await createProfile({ verificationStatus: 'UNVERIFIED' })

    const { status, body } = await api(`/api/admin/tutors/${profile.id}/verification`, {
      method: 'PATCH',
      body: JSON.stringify({ verificationStatus: 'VERIFIED' }),
    })

    assert.equal(status, 200)
    assert.ok(body.data.verifiedAt, 'a VERIFIED result must be dated')

    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.ok(stored.verifiedAt instanceof Date)
  })

  it('leaves verifiedAt alone for a note-only edit', async () => {
    const stamp = new Date('2026-01-01T00:00:00.000Z')
    const profile = await createProfile({ verifiedAt: stamp })

    const { status } = await api(`/api/admin/tutors/${profile.id}/verification`, {
      method: 'PATCH',
      body: JSON.stringify({ adminNotes: 'Just a note.' }),
    })

    assert.equal(status, 200)

    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.equal(stored.verifiedAt.toISOString(), stamp.toISOString())
  })

  it('honours an explicit verifiedAt', async () => {
    const profile = await createProfile()

    const { status, body } = await api(`/api/admin/tutors/${profile.id}/verification`, {
      method: 'PATCH',
      body: JSON.stringify({ verifiedAt: '2026-03-04T05:06:07.000Z' }),
    })

    assert.equal(status, 200)
    assert.equal(body.data.verifiedAt, '2026-03-04T05:06:07.000Z')
  })

  it('rejects an unknown checklist key', async () => {
    const profile = await createProfile()

    const { status } = await api(`/api/admin/tutors/${profile.id}/verification`, {
      method: 'PATCH',
      body: JSON.stringify({ verificationChecklist: { passportPhotoReceived: true } }),
    })

    assert.equal(status, 400, 'a typo must be refused rather than silently dropped')

    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.equal(stored.verificationChecklist, null)
  })

  it('rejects a non-boolean checklist value', async () => {
    const profile = await createProfile()

    const { status } = await api(`/api/admin/tutors/${profile.id}/verification`, {
      method: 'PATCH',
      body: JSON.stringify({ verificationChecklist: { govIdReceived: 'yes' } }),
    })

    assert.equal(status, 400)
  })

  it('rejects an unknown verificationStatus', async () => {
    const profile = await createProfile()

    const { status } = await api(`/api/admin/tutors/${profile.id}/verification`, {
      method: 'PATCH',
      body: JSON.stringify({ verificationStatus: 'TRUSTED' }),
    })

    assert.equal(status, 400)
  })

  it('rejects an empty body', async () => {
    const profile = await createProfile()

    const { status } = await api(`/api/admin/tutors/${profile.id}/verification`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    })

    assert.equal(status, 400, 'a no-op request is a mistake worth reporting')
  })

  it('refuses profileStatus as a field', async () => {
    const profile = await createProfile({ profileStatus: 'PENDING_REVIEW' })

    const { status } = await api(`/api/admin/tutors/${profile.id}/verification`, {
      method: 'PATCH',
      body: JSON.stringify({ profileStatus: 'APPROVED' }),
    })

    assert.equal(status, 400, 'the verification endpoint must not be a back door to approval')

    const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
    assert.equal(stored.profileStatus, 'PENDING_REVIEW')
  })

  it('returns 404 for an unknown profile id', async () => {
    const { status, body } = await api(
      `/api/admin/tutors/${crypto.randomUUID()}/verification`,
      { method: 'PATCH', body: JSON.stringify({ adminNotes: 'nothing to update' }) },
    )

    assert.equal(status, 404)
    assert.equal(body.error.code, 'NOT_FOUND')
  })

  it('returns 400 for a malformed profile id', async () => {
    const { status } = await api(`/api/admin/tutors/not-a-uuid/verification`, {
      method: 'PATCH',
      body: JSON.stringify({ adminNotes: 'nothing to update' }),
    })

    assert.equal(status, 400)
  })
})
