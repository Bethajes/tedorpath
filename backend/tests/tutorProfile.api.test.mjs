/**
 * Unit tests for the authenticated tutor profile management API.
 *
 * Example-based (as opposed to the property tests in
 * tutorProfile.property.test.mjs): each test pins one concrete behaviour and
 * one concrete edge case, so a failure names the rule that broke.
 *
 * Runs against the real Express app and PostgreSQL database, creating and
 * cleaning up its own records.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */

import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { after, before, describe, it } from 'node:test'

import { createApp } from '../src/app.js'
import { SESSION_COOKIE_NAME } from '../src/modules/auth/cookies.js'
import { closePrisma, prisma } from '../src/lib/prisma.js'
import { ratesFor, withoutRates } from './helpers/rates.mjs'

let server
let baseUrl

const createdUserIds = []
const createdProfileIds = []
const createdSubjectIds = []

before(async () => {
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  // Dependency order: profiles join to subjects, subjects stand alone.
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

/**
 * Calls the API. Pass `token: null` to send no session cookie at all.
 */
async function api(path, { method = 'GET', body, token } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Cookie = `${SESSION_COOKIE_NAME}=${token}`

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await response.text()
  let parsed = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }
  return { status: response.status, body: parsed }
}

/**
 * A user with a live session.
 *
 * The session row stores the SHA-256 of the token because that is what
 * findSessionByToken() looks up; the raw token is what goes in the cookie.
 * Sessions are written directly rather than by signing in, because an Argon2
 * hash per user would dominate the runtime of this file.
 */
async function createUser() {
  const user = await prisma.user.create({
    data: { email: `profile-api-${crypto.randomUUID()}@test.local`, name: 'Test Tutor' },
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

async function createSubject() {
  const unique = crypto.randomUUID().slice(0, 8)
  const subject = await prisma.subject.create({
    data: { name: `Subject ${unique}`, slug: `subject-${unique}`, category: 'Mathematics' },
  })
  createdSubjectIds.push(subject.id)
  return subject.id
}

/** Attaches a fresh subject to the caller's profile, as a subject picker would. */
async function attachSubject(userId) {
  const subjectId = await createSubject()
  const profile = await prisma.tutorProfile.findUnique({ where: { userId } })
  await prisma.tutorProfileSubject.create({
    data: { tutorProfileId: profile.id, subjectId },
  })
  return subjectId
}

/** A minimal payload the create endpoint accepts. */
const validCreate = {
  displayName: 'Ada Lovelace',
  headline: 'Mathematics and computer science',
  bio: 'I have taught mathematics for ten years.',
  teachingMode: 'ONLINE',
  studentLevels: ['High School'],
}

/** Seeds a profile straight through Prisma, for tests that need a given state. */
async function seedProfile(userId, overrides = {}) {
  const profile = await prisma.tutorProfile.create({
    data: {
      displayName: 'Seeded Tutor',
      headline: 'Seeded headline',
      bio: 'Seeded bio',
      teachingMode: 'ONLINE',
      studentLevels: ['High School'],
      profileStatus: 'DRAFT',
      verificationStatus: 'UNVERIFIED',
      ...withoutRates(overrides),
      rates: ratesFor(overrides),
      userId,
    },
  })
  createdProfileIds.push(profile.id)
  return profile
}

/** Creates a profile through the API and records it for cleanup. */
/**
 * Creates a profile through the API and records it for cleanup.
 *
 * Overrides are sent as written, including the pre-markets `hourlyRateEtb` /
 * `hourlyRateUsd` pair. The API accepts that shape on purpose, so the suite that
 * exercises the old contract keeps working and a regression in it would fail.
 */
async function createViaApi(token, overrides = {}) {
  const result = await api('/api/tutor-profile', {
    method: 'POST',
    token,
    body: { ...validCreate, ...overrides },
  })
  assert.equal(result.status, 201, `create failed: ${JSON.stringify(result.body)}`)
  createdProfileIds.push(result.body.data.id)
  return result.body.data
}

// ---------------------------------------------------------------------------
// Requirement 6.1 — every route requires authentication
// ---------------------------------------------------------------------------

describe('authentication', () => {
  const routes = [
    ['POST', '/api/tutor-profile', validCreate],
    ['PATCH', '/api/tutor-profile', { headline: 'x' }],
    ['GET', '/api/tutor-profile/me', undefined],
    ['POST', '/api/tutor-profile/submit', undefined],
  ]

  for (const [method, path, body] of routes) {
    it(`${method} ${path} requires a session`, async () => {
      const { status, body: payload } = await api(path, { method, body })

      assert.equal(status, 401)
      assert.equal(payload.success, false)
      assert.equal(payload.error.code, 'UNAUTHORIZED')
    })
  }

  it('rejects a session token that was never issued', async () => {
    const { status } = await api('/api/tutor-profile/me', { token: randomBytes(32).toString('hex') })

    assert.equal(status, 401)
  })

  it('rejects an expired session', async () => {
    const { userId } = await createUser()
    const expired = randomBytes(32).toString('hex')
    await prisma.session.create({
      data: {
        userId,
        tokenHash: createHash('sha256').update(expired).digest('hex'),
        expiresAt: new Date(Date.now() - 1000),
      },
    })

    const { status } = await api('/api/tutor-profile/me', { token: expired })

    assert.equal(status, 401)
  })
})

// ---------------------------------------------------------------------------
// Requirement 6.1 — create
// ---------------------------------------------------------------------------

describe('POST /api/tutor-profile', () => {
  it('creates a DRAFT profile linked to the caller', async () => {
    const { userId, token } = await createUser()

    const { status, body } = await api('/api/tutor-profile', {
      method: 'POST',
      token,
      body: validCreate,
    })

    assert.equal(status, 201)
    assert.equal(body.success, true)
    assert.equal(body.data.profileStatus, 'DRAFT', 'a new profile must start as a draft')
    assert.equal(body.data.verificationStatus, 'UNVERIFIED')

    const stored = await prisma.tutorProfile.findUnique({ where: { userId } })
    assert.ok(stored, 'the profile must be persisted against the caller')
    assert.equal(stored.profileStatus, 'DRAFT')
  })

  it('refuses to let a tutor approve their own profile', async () => {
    // The create schema is strict and has no profileStatus field, so a tutor
    // cannot skip moderation by asking for it directly.
    const { token } = await createUser()

    const { status, body } = await api('/api/tutor-profile', {
      method: 'POST',
      token,
      body: { ...validCreate, profileStatus: 'APPROVED', verificationStatus: 'VERIFIED' },
    })

    assert.equal(status, 422)
    assert.equal(body.error.code, 'VALIDATION_ERROR')
  })

  it('refuses to create a profile belonging to somebody else', async () => {
    const { userId: otherId } = await createUser()
    const { token } = await createUser()

    const { status } = await api('/api/tutor-profile', {
      method: 'POST',
      token,
      body: { ...validCreate, userId: otherId },
    })

    assert.equal(status, 422, 'userId is not an accepted create field')

    const leaked = await prisma.tutorProfile.findUnique({ where: { userId: otherId } })
    assert.equal(leaked, null, 'no profile may be created for another user')
  })

  it('rejects a payload missing a required field', async () => {
    const { token } = await createUser()
    const { displayName, ...withoutName } = validCreate

    const { status, body } = await api('/api/tutor-profile', {
      method: 'POST',
      token,
      body: withoutName,
    })

    assert.equal(status, 422)
    assert.equal(body.error.code, 'VALIDATION_ERROR')
    assert.ok(
      body.error.fields.some((field) => field.field === 'displayName'),
      'the failing field should be named',
    )
  })

  it('rejects a teaching mode outside the enum', async () => {
    const { token } = await createUser()

    const { status } = await api('/api/tutor-profile', {
      method: 'POST',
      token,
      body: { ...validCreate, teachingMode: 'CARRIER_PIGEON' },
    })

    assert.equal(status, 422)
  })
})

// ---------------------------------------------------------------------------
// Requirement 6.2 — one profile per user
// ---------------------------------------------------------------------------

describe('POST /api/tutor-profile (duplicate)', () => {
  it('returns 409 for a second profile by the same user', async () => {
    const { token } = await createUser()
    await createViaApi(token)

    const { status, body } = await api('/api/tutor-profile', {
      method: 'POST',
      token,
      body: validCreate,
    })

    assert.equal(status, 409)
    assert.equal(body.success, false)
    assert.equal(body.error.code, 'PROFILE_ALREADY_EXISTS')
  })

  it('keeps the first profile when a duplicate is rejected', async () => {
    const { userId, token } = await createUser()
    await createViaApi(token, { displayName: 'First Name' })

    await api('/api/tutor-profile', { method: 'POST', token, body: validCreate })

    const stored = await prisma.tutorProfile.findUnique({ where: { userId } })
    assert.equal(stored.displayName, 'First Name', 'the rejected create must not overwrite')
  })

  it('allows a different user to have their own profile', async () => {
    const first = await createUser()
    const second = await createUser()
    const createdFirst = await createViaApi(first.token)

    const secondResult = await api('/api/tutor-profile', {
      method: 'POST',
      token: second.token,
      body: validCreate,
    })
    assert.equal(secondResult.status, 201)
    createdProfileIds.push(secondResult.body.data.id)

    assert.notEqual(
      secondResult.body.data.id,
      createdFirst.id,
      'each user gets their own profile row',
    )
  })
})

// ---------------------------------------------------------------------------
// Requirement 6.3 — partial update
// ---------------------------------------------------------------------------

describe('PATCH /api/tutor-profile', () => {
  it('updates only the fields present in the body', async () => {
    const { userId, token } = await createUser()
    await seedProfile(userId, {
      displayName: 'Original Name',
      headline: 'Original headline',
      bio: 'Original bio',
      location: 'Original location',
    })

    const { status, body } = await api('/api/tutor-profile', {
      method: 'PATCH',
      token,
      body: { headline: 'Updated headline' },
    })

    assert.equal(status, 200)
    assert.equal(body.data.headline, 'Updated headline')

    const stored = await prisma.tutorProfile.findUnique({ where: { userId } })
    assert.equal(stored.headline, 'Updated headline', 'the patched field is updated')
    assert.equal(stored.displayName, 'Original Name', 'an absent field must not be cleared')
    assert.equal(stored.bio, 'Original bio')
    assert.equal(stored.location, 'Original location')
  })

  it('leaves the moderation status untouched', async () => {
    const { userId, token } = await createUser()
    await seedProfile(userId, { profileStatus: 'PENDING_REVIEW' })

    const { status } = await api('/api/tutor-profile', {
      method: 'PATCH',
      token,
      body: { headline: 'Still under review' },
    })

    assert.equal(status, 200)
    const stored = await prisma.tutorProfile.findUnique({ where: { userId } })
    assert.equal(stored.profileStatus, 'PENDING_REVIEW', 'a tutor cannot self-approve by editing')
  })

  it('rejects an empty body', async () => {
    const { userId, token } = await createUser()
    await seedProfile(userId)

    const { status, body } = await api('/api/tutor-profile', { method: 'PATCH', token, body: {} })

    assert.equal(status, 400)
    assert.equal(body.error.code, 'NO_DATA')
  })

  it('returns 404 when the caller has no profile yet', async () => {
    const { token } = await createUser()

    const { status, body } = await api('/api/tutor-profile', {
      method: 'PATCH',
      token,
      body: { headline: 'Nothing to update' },
    })

    assert.equal(status, 404)
    assert.equal(body.error.code, 'PROFILE_NOT_FOUND')
  })

  it('replaces the subject list when subjectIds is supplied', async () => {
    const { userId, token } = await createUser()
    await seedProfile(userId)
    const first = await createSubject()
    const second = await createSubject()

    await api('/api/tutor-profile', { method: 'PATCH', token, body: { subjectIds: [first] } })
    const { body } = await api('/api/tutor-profile', {
      method: 'PATCH',
      token,
      body: { subjectIds: [second] },
    })

    assert.deepEqual(body.data.subjects.map((s) => s.id), [second], 'subjects are replaced, not added')

    const stored = await prisma.tutorProfile.findUnique({
      where: { userId },
      include: { subjects: true },
    })
    assert.equal(stored.subjects.length, 1)
  })
})

// ---------------------------------------------------------------------------
// Requirement 6.4 — ownership is enforced server-side
// ---------------------------------------------------------------------------

describe('PATCH /api/tutor-profile (ownership)', () => {
  it('returns 403 when the body names a different user', async () => {
    const owner = await createUser()
    const attacker = await createUser()
    await seedProfile(owner.userId, { displayName: 'Owner Name' })
    await seedProfile(attacker.userId, { displayName: 'Attacker Name' })

    const { status, body } = await api('/api/tutor-profile', {
      method: 'PATCH',
      token: attacker.token,
      body: { userId: owner.userId, displayName: 'Hijacked' },
    })

    assert.equal(status, 403)
    assert.equal(body.error.code, 'FORBIDDEN')

    const stored = await prisma.tutorProfile.findUnique({ where: { userId: owner.userId } })
    assert.equal(stored.displayName, 'Owner Name', "the owner's profile must be untouched")
  })

  it('allows the owner to name themselves', async () => {
    const { userId, token } = await createUser()
    await seedProfile(userId, { displayName: 'Owner Name' })

    const { status, body } = await api('/api/tutor-profile', {
      method: 'PATCH',
      token,
      body: { userId, displayName: 'Renamed' },
    })

    assert.equal(status, 200)
    assert.equal(body.data.displayName, 'Renamed')
  })

  it('rejects a non-UUID userId in the body', async () => {
    const { token } = await createUser()
    await seedProfile((await createUser()).userId)

    const { status } = await api('/api/tutor-profile', {
      method: 'PATCH',
      token,
      body: { userId: 'not-a-uuid', displayName: 'Hijacked' },
    })

    assert.equal(status, 422)
  })

  it('does not expose another user\'s profile through /me', async () => {
    const owner = await createUser()
    const other = await createUser()
    await seedProfile(owner.userId, { displayName: 'Owner Name' })

    const { status, body } = await api('/api/tutor-profile/me', { token: other.token })

    assert.equal(status, 404, 'a user without a profile gets 404, not somebody else\'s data')
    assert.equal(body.success, false)
  })
})

// ---------------------------------------------------------------------------
// Requirement 6.5 — GET /me
// ---------------------------------------------------------------------------

describe('GET /api/tutor-profile/me', () => {
  it('returns the caller\'s profile including draft-only fields', async () => {
    const { userId, token } = await createUser()
    await seedProfile(userId, {
      displayName: 'Ada',
      headline: 'Maths',
      bio: 'Long bio',
      location: 'Addis Ababa',
      profilePhotoUrl: 'https://example.com/a.png',
      availability: 'Evenings',
      hourlyRateEtb: 900,
      hourlyRateUsd: 12,
      experience: 'Ten years',
      education: 'MSc',
      languages: ['English', 'Amharic'],
      studentLevels: ['High School', 'University'],
      profileStatus: 'DRAFT',
    })
    await attachSubject(userId)

    const { status, body } = await api('/api/tutor-profile/me', { token })

    assert.equal(status, 200)
    assert.equal(body.data.displayName, 'Ada')
    assert.equal(body.data.profileStatus, 'DRAFT')

    // Fields that only matter before approval must still be present here.
    for (const field of [
      'hourlyRateEtb',
      'hourlyRateUsd',
      'availability',
      'experience',
      'education',
      'languages',
    ]) {
      assert.ok(field in body.data, `${field} should be returned to the owner`)
    }
    assert.deepEqual(body.data.studentLevels, ['High School', 'University'])
    assert.equal(body.data.subjects.length, 1)
  })

  it('returns 404 when the caller has no profile', async () => {
    const { token } = await createUser()

    const { status, body } = await api('/api/tutor-profile/me', { token })

    assert.equal(status, 404)
    assert.equal(body.error.code, 'PROFILE_NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
// Requirements 6.6, 6.7 — submit for review
// ---------------------------------------------------------------------------

describe('POST /api/tutor-profile/submit', () => {
  it('moves a complete draft to PENDING_REVIEW', async () => {
    const { userId, token } = await createUser()
    await seedProfile(userId, { hourlyRateEtb: 900 })
    await attachSubject(userId)

    const { status, body } = await api('/api/tutor-profile/submit', { method: 'POST', token })

    assert.equal(status, 200)
    assert.equal(body.data.profileStatus, 'PENDING_REVIEW')

    const stored = await prisma.tutorProfile.findUnique({ where: { userId } })
    assert.equal(stored.profileStatus, 'PENDING_REVIEW', 'the transition must be persisted')
  })

  it('accepts a profile created through the API once a subject is added', async () => {
    const { token } = await createUser()
    await createViaApi(token, { hourlyRateEtb: 900 })
    const subjectId = await createSubject()

    await api('/api/tutor-profile', { method: 'PATCH', token, body: { subjectIds: [subjectId] } })
    const { status, body } = await api('/api/tutor-profile/submit', { method: 'POST', token })

    assert.equal(status, 200)
    assert.equal(body.data.profileStatus, 'PENDING_REVIEW')
  })

  it('returns 422 and names the missing fields', async () => {
    const { userId, token } = await createUser()
    // No subject and no rate in any market: the two things a create cannot supply.
    // The field is named `rates` rather than a market, because the rule is
    // "price at least one market" and it should not have to be restated per market.
    await seedProfile(userId, { hourlyRateEtb: null, hourlyRateUsd: null })

    const { status, body } = await api('/api/tutor-profile/submit', { method: 'POST', token })

    assert.equal(status, 422)
    assert.equal(body.error.code, 'INCOMPLETE_PROFILE')
    assert.ok(Array.isArray(body.error.fields), 'the missing fields must be listed')
    assert.deepEqual([...body.error.fields].sort(), ['rates', 'subjects'])
  })

  it('accepts a tutor who priced only one market', async () => {
    const { userId, token } = await createUser()
    // Serving one market and declining the other is normal — most tutors do not
    // take international bookings — so it must not block a submission.
    await seedProfile(userId, { hourlyRateEtb: 900 })
    await attachSubject(userId)

    const { status, body } = await api('/api/tutor-profile/submit', { method: 'POST', token })

    assert.equal(status, 200, 'one priced market is enough to submit')
    assert.equal(body.data.profileStatus, 'PENDING_REVIEW')
  })

  it('reports blank identity fields as missing', async () => {
    const { userId, token } = await createUser()
    // The columns are NOT NULL, so a blank field is stored as an empty string.
    await seedProfile(userId, { displayName: '', headline: '', bio: '', hourlyRateEtb: 900 })
    await attachSubject(userId)

    const { status, body } = await api('/api/tutor-profile/submit', { method: 'POST', token })

    assert.equal(status, 422)
    for (const field of ['displayName', 'headline', 'bio']) {
      assert.ok(
        body.error.fields.includes(field),
        `${field} should be reported missing, got ${JSON.stringify(body.error.fields)}`,
      )
    }
  })

  it('reports empty student levels as missing', async () => {
    const { userId, token } = await createUser()
    await seedProfile(userId, { studentLevels: [], hourlyRateEtb: 900 })
    await attachSubject(userId)

    const { status, body } = await api('/api/tutor-profile/submit', { method: 'POST', token })

    assert.equal(status, 422)
    assert.ok(body.error.fields.includes('studentLevels'))
  })

  it('returns 404 when the caller has no profile', async () => {
    const { token } = await createUser()

    const { status, body } = await api('/api/tutor-profile/submit', { method: 'POST', token })

    assert.equal(status, 404)
    assert.equal(body.error.code, 'PROFILE_NOT_FOUND')
  })

  it('refuses to resubmit a profile that is already under review', async () => {
    const { userId, token } = await createUser()
    await seedProfile(userId, { profileStatus: 'PENDING_REVIEW' })

    const { status, body } = await api('/api/tutor-profile/submit', { method: 'POST', token })

    assert.equal(status, 400)
    // The extended submit endpoint (Requirements 25.4, 28.5) reports a
    // PENDING_REVIEW resubmission with its own code rather than the generic
    // INVALID_STATUS, so the applicant can be told "already under review"
    // instead of "invalid status".
    assert.equal(body.error.code, 'ALREADY_UNDER_REVIEW')
  })
})
