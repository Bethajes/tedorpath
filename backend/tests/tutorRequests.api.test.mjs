/**
 * Unit tests for POST /api/tutor-requests — the optional TutorProfile link.
 *
 * The link is an extension to an existing public form, so the bulk of this
 * file is about backward compatibility: a request that says nothing about
 * tutors must behave exactly as it did before the column existed.
 *
 * Runs against the real Express app and PostgreSQL database.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { createApp } from '../src/app.js'
import { closePrisma, prisma } from '../src/lib/prisma.js'

let server
let baseUrl

const createdRequestIds = []
const createdUserIds = []
const createdProfileIds = []

before(async () => {
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  // Requests first: they hold a foreign key to the profiles.
  if (createdRequestIds.length) {
    await prisma.tutorRequest.deleteMany({ where: { id: { in: createdRequestIds } } })
  }
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
  const response = await fetch(`${baseUrl}${path}`, options)
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, body }
}

/** A minimal body the endpoint accepts — the pre-existing contract, unchanged. */
const validRequest = {
  fullName: 'Abel Tesfaye',
  phone: '0912345678',
  telegram: '@abel',
  email: 'abel@example.com',
  subject: 'Mathematics',
  educationLevel: 'University',
  learningMode: 'Online',
  helpDescription: 'I need help with calculus for my exam.',
  preferredLocation: 'Downtown',
  preferredDays: 'Monday',
  preferredTime: 'Evening',
  budget: '$20 per hour',
  additionalInfo: '',
}

/** Posts a request and records it for cleanup. */
async function submit(body) {
  const result = await api('/api/tutor-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (result.status === 201) createdRequestIds.push(result.body.data.id)
  return result
}

/** A profile owned by a throwaway user, in the given moderation state. */
async function createProfile(profileStatus = 'APPROVED') {
  const user = await prisma.user.create({
    data: { email: `req-link-${crypto.randomUUID()}@test.local`, name: 'Linked Tutor' },
  })
  createdUserIds.push(user.id)

  const profile = await prisma.tutorProfile.create({
    data: {
      userId: user.id,
      displayName: 'Linked Tutor',
      headline: 'Mathematics specialist',
      bio: 'Ten years of teaching.',
      teachingMode: 'ONLINE',
      studentLevels: ['High School'],
      profileStatus,
    },
  })
  createdProfileIds.push(profile.id)
  return profile
}

// ---------------------------------------------------------------------------
// Requirement 3.2 — backward compatibility
// ---------------------------------------------------------------------------

describe('POST /api/tutor-requests (backward compatibility)', () => {
  it('accepts a request that says nothing about tutors', async () => {
    const { status, body } = await submit(validRequest)

    assert.equal(status, 201)
    assert.equal(body.success, true)

    const stored = await prisma.tutorRequest.findUnique({ where: { id: body.data.id } })
    assert.equal(stored.tutorProfileId, null, 'an unlinked request must have no profile')
  })

  it('stores every pre-existing field exactly as before', async () => {
    const { body } = await submit(validRequest)
    const stored = await prisma.tutorRequest.findUnique({ where: { id: body.data.id } })

    assert.equal(stored.fullName, 'Abel Tesfaye')
    assert.equal(stored.phone, '0912345678')
    assert.equal(stored.telegramUsername, '@abel')
    assert.equal(stored.email, 'abel@example.com')
    assert.equal(stored.subject, 'Mathematics')
    assert.equal(stored.educationLevel, 'University')
    assert.equal(stored.learningMode, 'Online')
    assert.equal(stored.description, 'I need help with calculus for my exam.')
    assert.equal(stored.location, 'Downtown')
    assert.equal(stored.preferredDays, 'Monday')
    assert.equal(stored.preferredTime, 'Evening')
    assert.equal(stored.budget, '$20 per hour')
    assert.equal(stored.status, 'NEW', 'the default status is unchanged')
  })

  it('still echoes back only the id, not the personal data it was given', async () => {
    const { body } = await submit(validRequest)

    assert.deepEqual(Object.keys(body.data), ['id'])
  })

  it('accepts an explicit null tutorProfileId', async () => {
    const { status, body } = await submit({ ...validRequest, tutorProfileId: null })

    assert.equal(status, 201)
    const stored = await prisma.tutorRequest.findUnique({ where: { id: body.data.id } })
    assert.equal(stored.tutorProfileId, null)
  })

  it('still rejects unknown fields rather than discarding them', async () => {
    // The new field must not have turned the strict schema into a lenient one.
    const { status, body } = await submit({ ...validRequest, somethingElse: 'nope' })

    assert.equal(status, 400)
    assert.equal(body.error.code, 'VALIDATION_ERROR')
  })

  it('still rejects a body that is missing a required field', async () => {
    const { fullName, ...withoutName } = validRequest
    const { status, body } = await submit(withoutName)

    assert.equal(status, 400)
    assert.ok(body.error.fields.some((field) => field.field === 'fullName'))
  })
})

// ---------------------------------------------------------------------------
// Requirement 3.3 — a valid tutorProfileId links the request
// ---------------------------------------------------------------------------

describe('POST /api/tutor-requests (valid tutorProfileId)', () => {
  it('links the request to the referenced profile', async () => {
    const profile = await createProfile()

    const { status, body } = await submit({ ...validRequest, tutorProfileId: profile.id })

    assert.equal(status, 201)

    const stored = await prisma.tutorRequest.findUnique({
      where: { id: body.data.id },
      include: { tutorProfile: true },
    })
    assert.equal(stored.tutorProfileId, profile.id, 'the foreign key must be persisted')
    assert.ok(stored.tutorProfile, 'the relation must resolve to the profile')
    assert.equal(stored.tutorProfile.displayName, 'Linked Tutor')
  })

  for (const profileStatus of ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SUSPENDED', 'REJECTED']) {
    it(`links to a ${profileStatus} profile`, async () => {
      // The client chose this tutor from what they could see; deciding what is
      // contactable is moderation's job, not the form's.
      const profile = await createProfile(profileStatus)

      const { status, body } = await submit({ ...validRequest, tutorProfileId: profile.id })

      assert.equal(status, 201, `a ${profileStatus} profile should still be linkable`)
      const stored = await prisma.tutorRequest.findUnique({ where: { id: body.data.id } })
      assert.equal(stored.tutorProfileId, profile.id)
    })
  }

  it('links two different requests to the same profile', async () => {
    const profile = await createProfile()

    const first = await submit({ ...validRequest, tutorProfileId: profile.id })
    const second = await submit({
      ...validRequest,
      fullName: 'Second Client',
      tutorProfileId: profile.id,
    })

    assert.equal(first.status, 201)
    assert.equal(second.status, 201)

    const linked = await prisma.tutorRequest.count({ where: { tutorProfileId: profile.id } })
    assert.equal(linked, 2, 'a profile can be requested by more than one client')
  })

  it('does not expose the linked profile in the response', async () => {
    const profile = await createProfile()

    const { body } = await submit({ ...validRequest, tutorProfileId: profile.id })

    // The response stays minimal; the link is an internal routing detail.
    assert.deepEqual(Object.keys(body.data), ['id'])
  })
})

// ---------------------------------------------------------------------------
// Requirement 3.4 — a bad tutorProfileId is a validation error
// ---------------------------------------------------------------------------

describe('POST /api/tutor-requests (invalid tutorProfileId)', () => {
  it('returns 400 for a well-formed UUID that matches no profile', async () => {
    const { status, body } = await submit({ ...validRequest, tutorProfileId: crypto.randomUUID() })

    assert.equal(status, 400, 'Requirement 3.4 requires a validation error')
    assert.equal(body.success, false)
    assert.equal(body.error.code, 'VALIDATION_ERROR')
    assert.ok(
      body.error.fields.some((field) => field.field === 'tutorProfileId'),
      'the offending field should be named',
    )
  })

  it('does not persist anything when the profile is not found', async () => {
    const missingId = crypto.randomUUID()

    await submit({ ...validRequest, tutorProfileId: missingId })

    // Scoped to the id that was rejected rather than a global row count: the
    // test files share one database and run concurrently, so a total here would
    // be measuring other suites' traffic.
    const linked = await prisma.tutorRequest.count({ where: { tutorProfileId: missingId } })
    assert.equal(linked, 0, 'a rejected request must not leave a row behind')
  })

  it('returns 400 for a value that is not a UUID', async () => {
    for (const bad of ['not-a-uuid', '123', '', 'null']) {
      const { status, body } = await submit({ ...validRequest, tutorProfileId: bad })

      assert.equal(status, 400, `"${bad}" should be rejected`)
      assert.equal(body.error.code, 'VALIDATION_ERROR')
    }
  })

  it('returns 400 for a numeric tutorProfileId', async () => {
    const { status } = await submit({ ...validRequest, tutorProfileId: 42 })

    assert.equal(status, 400)
  })
})

// ---------------------------------------------------------------------------
// Requirement 3.1 — the foreign key is nullable and uses onDelete: SetNull
// ---------------------------------------------------------------------------

describe('tutorProfileId foreign key behaviour', () => {
  it('nulls the link instead of deleting the request when the profile goes', async () => {
    const profile = await createProfile()
    const { body } = await submit({ ...validRequest, tutorProfileId: profile.id })

    // Removing the profile must not take the client's request with it.
    await prisma.tutorProfile.delete({ where: { id: profile.id } })
    const index = createdProfileIds.indexOf(profile.id)
    if (index !== -1) createdProfileIds.splice(index, 1)

    const stored = await prisma.tutorRequest.findUnique({ where: { id: body.data.id } })
    assert.ok(stored, 'onDelete: SetNull must preserve the request')
    assert.equal(stored.tutorProfileId, null, 'the link is cleared, not cascaded')
    assert.equal(stored.fullName, 'Abel Tesfaye', 'the request content is untouched')
  })

  it('is null on a row that predates the column', async () => {
    // A request stored without the field at all is indistinguishable from one
    // that explicitly sent null, which is what makes the rollout safe.
    const user = await prisma.user.create({
      data: { email: `legacy-${crypto.randomUUID()}@test.local`, name: 'Legacy' },
    })
    createdUserIds.push(user.id)

    const legacy = await prisma.tutorRequest.create({
      data: {
        fullName: 'Legacy Client',
        phone: '0911000000',
        subject: 'Physics',
        educationLevel: 'High School',
        learningMode: 'Online',
        description: 'An older request with no link.',
      },
    })
    createdRequestIds.push(legacy.id)

    assert.equal(legacy.tutorProfileId, null)
  })
})
