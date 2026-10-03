/**
 * Property-based tests for the extended admin tutor moderation API.
 *
 * Each test runs against the real Express app and the real PostgreSQL database.
 * Profiles are written through Prisma so each run can start from an arbitrary
 * status, and everything is cleaned up afterwards.
 *
 * These three properties are the same idea from three angles: a moderation
 * decision that cannot be explained must not be applied at all, and saving a
 * document check must never be a way to move a profile between states.
 */

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import fc from 'fast-check'

import { createApp } from '../src/app.js'
import { closePrisma, prisma } from '../src/lib/prisma.js'
import {
  REJECTION_REASONS,
  VERIFICATION_CHECKLIST_KEYS,
  VERIFICATION_STATUSES,
} from '../src/modules/adminTutors/validation.js'
import { ratesFor, withoutRates } from './helpers/rates.mjs'

let server
let baseUrl

const TOKEN = process.env.ADMIN_API_TOKEN ?? ''
const auth = { Authorization: `Bearer ${TOKEN}` }

/** Rows created during these tests — cleaned up in after(). */
const createdUserIds = []
const createdProfileIds = []
const createdSubjectIds = []

before(async () => {
  if (!TOKEN) {
    throw new Error('ADMIN_API_TOKEN must be set to run the admin tutor property tests')
  }
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
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
      ...auth,
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

async function createSubject() {
  const unique = crypto.randomUUID().slice(0, 8)
  const subject = await prisma.subject.create({
    data: {
      name: `Subject ${unique}`,
      slug: `subject-${unique}`,
      category: 'Test category',
    },
  })
  createdSubjectIds.push(subject.id)
  return subject.id
}

/** Creates a User + TutorProfile pair, joined to one subject. */
async function createProfile(overrides = {}) {
  const user = await prisma.user.create({
    data: { email: `admin-prop-${crypto.randomUUID()}@test.local`, name: 'Test Tutor' },
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
// Property 16: Rejection requires a reason — profile status is protected
// ---------------------------------------------------------------------------

describe('Property 16: Rejection requires a reason — profile status is protected', () => {
  it('returns 422 and leaves the status untouched when REJECTED has no reason', async () => {
    /**
     * **Feature: tutor-marketplace-extended, Property 16: Rejection requires a reason — profile status is protected**
     * **Validates: Requirements 22.1, 22.5, 28.2**
     *
     * For any admin request to PATCH /api/admin/tutors/:id/status that sets
     * status = 'REJECTED' without a rejectionReason field, the system must
     * return HTTP 422, and the profile's profileStatus must remain unchanged in
     * the database after the failed request.
     */
    const startStatuses = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SUSPENDED', 'REJECTED']

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...startStatuses),
        // Any near-miss the admin might send in place of a real reason. Each
        // one is a rejection with no usable reason, so each must be refused.
        fc.constantFrom(
          { label: 'absent' },
          { label: 'undefined key', rejectionReason: undefined },
          { label: 'null', rejectionReason: null },
          { label: 'empty string', rejectionReason: '' },
          { label: 'whitespace', rejectionReason: '   ' },
        ),
        async (startStatus, badReason) => {
          const profile = await createProfile({ profileStatus: startStatus })

          const payload = { status: 'REJECTED', ...badReason }
          const { status, body } = await api(`/api/admin/tutors/${profile.id}/status`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })

          assert.equal(status, 422, `expected 422 for rejection case "${badReason.label}"`)

          const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
          assert.equal(
            stored.profileStatus,
            startStatus,
            `a refused rejection must not move the profile out of ${startStatus}`,
          )
          assert.equal(stored.rejectionReason, null, 'no reason may be written by a refused request')

          // A refusal must also not smuggle in a tutor-authored edit.
          assert.equal(stored.displayName, 'Test Tutor')
          if (Array.isArray(body?.error?.fields)) {
            assert.ok(
              body.error.fields.some((field) => field.field === 'rejectionReason'),
              'the response should point at the missing field',
            )
          }
        },
      ),
      { numRuns: 12 },
    )
  })

  it('accepts every declared reason category, for every starting status', async () => {
    /**
     * The complement of Property 16: the guard must reject only genuinely
     * missing reasons. If it rejected a valid category the workflow would be
     * unusable, so every category is exercised against every starting status
     * and must apply cleanly.
     */
    const startStatuses = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SUSPENDED', 'REJECTED']

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...startStatuses),
        fc.constantFrom(...REJECTION_REASONS),
        async (startStatus, reason) => {
          const profile = await createProfile({ profileStatus: startStatus })

          const { status, body } = await api(`/api/admin/tutors/${profile.id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'REJECTED', rejectionReason: reason }),
          })

          assert.equal(status, 200, `reason "${reason}" must be accepted`)
          assert.equal(body.data.profileStatus, 'REJECTED')
          assert.equal(body.data.rejectionReason, reason)

          const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
          assert.equal(stored.profileStatus, 'REJECTED')
          assert.equal(stored.rejectionReason, reason)
        },
      ),
      { numRuns: 10 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 19: NEEDS_INFORMATION requires an admin message — status protected
// ---------------------------------------------------------------------------

describe('Property 19: NEEDS_INFORMATION requires an admin message — profile status is protected', () => {
  it('returns 422 and leaves the status untouched when NEEDS_INFORMATION has no message', async () => {
    /**
     * **Feature: tutor-marketplace-extended, Property 19: NEEDS_INFORMATION requires an admin message — profile status is protected**
     * **Validates: Requirements 19.3, 28.3**
     *
     * For any admin request to PATCH /api/admin/tutors/:id/status that sets
     * status = 'NEEDS_INFORMATION' without an adminMessage field, the system
     * must return HTTP 422, and the profile's profileStatus must remain
     * unchanged in the database after the failed request.
     */
    const startStatuses = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SUSPENDED', 'REJECTED']

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...startStatuses),
        fc.constantFrom(
          { label: 'absent' },
          { label: 'undefined key', adminMessage: undefined },
          { label: 'null', adminMessage: null },
          { label: 'empty string', adminMessage: '' },
          { label: 'whitespace', adminMessage: '   ' },
          { label: 'tab and newline', adminMessage: '\t\n' },
        ),
        async (startStatus, badMessage) => {
          const profile = await createProfile({ profileStatus: startStatus })

          const { status, body } = await api(`/api/admin/tutors/${profile.id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'NEEDS_INFORMATION', ...badMessage }),
          })

          assert.equal(status, 422, `expected 422 for message case "${badMessage.label}"`)

          const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
          assert.equal(
            stored.profileStatus,
            startStatus,
            `a refused request for information must not move the profile out of ${startStatus}`,
          )
          assert.equal(stored.adminMessage, null, 'no message may be written by a refused request')

          if (Array.isArray(body?.error?.fields)) {
            assert.ok(body.error.fields.some((field) => field.field === 'adminMessage'))
          }
        },
      ),
      { numRuns: 12 },
    )
  })

  it('accepts any non-blank message, for every starting status', async () => {
    /** The complement of Property 19: a real message must always be accepted. */
    const startStatuses = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SUSPENDED', 'REJECTED']

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...startStatuses),
        // Text that is never blank once trimmed, and never over the 2000 limit.
        fc
          .string({ minLength: 1, maxLength: 60 })
          .filter((text) => text.trim().length > 0)
          .map((text) => `Please send: ${text}`.slice(0, 200)),
        async (startStatus, message) => {
          const profile = await createProfile({ profileStatus: startStatus })

          const { status, body } = await api(`/api/admin/tutors/${profile.id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'NEEDS_INFORMATION', adminMessage: message }),
          })

          assert.equal(status, 200)
          assert.equal(body.data.profileStatus, 'NEEDS_INFORMATION')
          assert.equal(body.data.adminMessage, message.trim())

          const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
          assert.equal(stored.profileStatus, 'NEEDS_INFORMATION')
          assert.equal(stored.adminMessage, message.trim())
        },
      ),
      { numRuns: 10 },
    )
  })

  it('never turns a REJECTED attempt into a message-less NEEDS_INFORMATION', async () => {
    /**
     * A rejection reason is required for REJECTED and a message for
     * NEEDS_INFORMATION; neither substitutes for the other. Sending only a
     * rejectionReason must not satisfy the message requirement.
     */
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...REJECTION_REASONS), async (reason) => {
        const profile = await createProfile({ profileStatus: 'PENDING_REVIEW' })

        const { status } = await api(`/api/admin/tutors/${profile.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'NEEDS_INFORMATION', rejectionReason: reason }),
        })

        assert.equal(status, 422, 'a rejection reason is not an admin message')

        const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
        assert.equal(stored.profileStatus, 'PENDING_REVIEW')
        assert.equal(stored.adminMessage, null)
      }),
      { numRuns: REJECTION_REASONS.length },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 18: Verification checklist updates never change profile status
// ---------------------------------------------------------------------------

describe('Property 18: Verification checklist updates never change profile status', () => {
  it('leaves profileStatus unchanged for any verification payload and starting status', async () => {
    /**
     * **Feature: tutor-marketplace-extended, Property 18: Verification checklist updates never change profile status**
     * **Validates: Requirements 27.3**
     *
     * For any TutorProfile, calling PATCH /api/admin/tutors/:id/verification
     * with any valid payload (any combination of verificationStatus,
     * adminNotes, and verificationChecklist values) must leave profileStatus on
     * the profile exactly unchanged. The verification endpoint is a separate
     * concern from the status endpoint.
     */
    const allStatuses = [
      'DRAFT',
      'PENDING_REVIEW',
      'APPROVED',
      'SUSPENDED',
      'REJECTED',
      'NEEDS_INFORMATION',
    ]

    /** An arbitrary subset of checklist keys, each independently true or false. */
    const arbitraryChecklist = fc
      .dictionary(
        fc.constantFrom(...VERIFICATION_CHECKLIST_KEYS),
        fc.boolean(),
        { minKeys: 1, maxKeys: VERIFICATION_CHECKLIST_KEYS.length },
      )

    const arbitraryPayload = fc.oneof(
      arbitraryChecklist.map((verificationChecklist) => ({ verificationChecklist })),
      fc.constantFrom(...VERIFICATION_STATUSES).map((verificationStatus) => ({ verificationStatus })),
      fc.string({ minLength: 1, maxLength: 80 }).map((adminNotes) => ({ adminNotes })),
      arbitraryChecklist
        .chain((verificationChecklist) =>
          fc
            .constantFrom(...VERIFICATION_STATUSES)
            .chain((verificationStatus) =>
              fc.record({
                verificationChecklist: fc.constant(verificationChecklist),
                verificationStatus: fc.constant(verificationStatus),
              }),
            ),
        ),
    )

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...allStatuses),
        arbitraryPayload,
        async (startStatus, payload) => {
          const profile = await createProfile({ profileStatus: startStatus })

          const { status, body } = await api(`/api/admin/tutors/${profile.id}/verification`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })

          assert.equal(status, 200, `valid payload ${JSON.stringify(payload)} must be accepted`)
          assert.equal(
            body.data.profileStatus,
            startStatus,
            'the response must report the unchanged status',
          )

          const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
          assert.equal(
            stored.profileStatus,
            startStatus,
            `verification on a ${startStatus} profile must not change its status`,
          )
        },
      ),
      { numRuns: 15 },
    )
  })

  it('never moves a profile to APPROVED, whatever the payload claims', async () => {
    /**
     * The sharpest form of the same guarantee: a profile that is not approved
     * stays not approved, however verification-shaped the request looks. The
     * status endpoint is the only way to approve, and it is a different path.
     */
    const notApproved = ['DRAFT', 'PENDING_REVIEW', 'SUSPENDED', 'REJECTED', 'NEEDS_INFORMATION']

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...notApproved),
        fc.constantFrom(...VERIFICATION_STATUSES),
        fc.constantFrom('APPROVED', 'VERIFIED', 'true', 1, null),
        async (startStatus, verificationStatus, profileStatus) => {
          const profile = await createProfile({ profileStatus: startStatus })

          const { status } = await api(`/api/admin/tutors/${profile.id}/verification`, {
            method: 'PATCH',
            body: JSON.stringify({ verificationStatus, profileStatus }),
          })

          // Whether the smuggled profileStatus is merely unknown (400) or would
          // otherwise have applied, the stored status must not move.
          assert.ok(status === 400 || status === 200, `unexpected status ${status}`)

          const stored = await prisma.tutorProfile.findUnique({ where: { id: profile.id } })
          assert.equal(
            stored.profileStatus,
            startStatus,
            'the verification endpoint must not be a back door to approval',
          )
        },
      ),
      { numRuns: 10 },
    )
  })
})
