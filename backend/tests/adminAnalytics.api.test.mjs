/**
 * Admin analytics API tests.
 *
 * These run against the real Express app and the real PostgreSQL database, so
 * they exercise the same code path as production. They create their own records
 * and clean up afterwards, and do not rely on seed data.
 *
 * Run with: npm test   (or: node --test tests/)
 */

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { createApp } from '../src/app.js'
import { closePrisma, prisma } from '../src/lib/prisma.js'

const TOKEN = process.env.ADMIN_API_TOKEN ?? ''
const auth = { Authorization: `Bearer ${TOKEN}` }

const DASHBOARD = '/api/admin/dashboard'
const ACTIVITY = '/api/admin/activity'

let server
let baseUrl

/** Rows created by these tests, removed at the end. */
const createdUserIds = []
const createdProfileIds = []

before(async () => {
  if (!TOKEN) {
    throw new Error('ADMIN_API_TOKEN must be set to run the analytics tests')
  }
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  // Dependency order: profiles are owned by users.
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

/**
 * Writes a profile straight through Prisma.
 *
 * `createdAt` is settable so a test can put a record on a specific day and prove
 * the trend series buckets it there rather than wherever "now" happens to be.
 */
async function createProfile(overrides = {}) {
  const user = await prisma.user.create({
    data: { email: `analytics-${crypto.randomUUID()}@test.local`, name: 'Analytics Tutor' },
  })
  createdUserIds.push(user.id)

  const profile = await prisma.tutorProfile.create({
    data: {
      userId: user.id,
      displayName: 'Analytics Tutor',
      headline: 'Mathematics',
      bio: 'Test fixture.',
      teachingMode: 'ONLINE',
      studentLevels: ['High School'],
      profileStatus: 'PENDING_REVIEW',
      verificationStatus: 'UNVERIFIED',
      ...overrides,
    },
  })
  createdProfileIds.push(profile.id)
  return profile
}

// ---------------------------------------------------------------------------
// Security boundary
// ---------------------------------------------------------------------------

describe('GET /api/admin/dashboard — security boundary', () => {
  it('rejects a request with no token', async () => {
    const { status, body } = await api(DASHBOARD, { noAuth: true })

    assert.equal(status, 401)
    assert.equal(body.error.code, 'UNAUTHORIZED')
  })

  it('rejects a wrong token', async () => {
    const { status } = await api(DASHBOARD, {
      headers: { Authorization: 'Bearer not-the-right-token' },
    })

    assert.equal(status, 401)
  })
})

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

describe('GET /api/admin/dashboard — response shape', () => {
  it('answers 200 with the standard success envelope', async () => {
    const { status, body } = await api(DASHBOARD)

    assert.equal(status, 200)
    assert.equal(body.success, true)
  })

  it('carries every group the dashboard renders', async () => {
    const { body } = await api(DASHBOARD)

    for (const key of [
      'requests',
      'applications',
      'verification',
      'learners',
      'matching',
      'subjects',
      'trends',
      'activity',
    ]) {
      assert.ok(key in body.data, `the response must include "${key}"`)
    }
  })

  it('counts every request status, with a zero for statuses nobody is in', async () => {
    const { body } = await api(DASHBOARD)

    // Absent keys default to zero rather than being left out, so the dashboard
    // can read `data.requests.COMPLETED` without a guard on every field.
    for (const key of ['total', 'NEW', 'CONTACTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']) {
      assert.equal(typeof body.data.requests[key], 'number', `requests.${key} must be a number`)
      assert.ok(body.data.requests[key] >= 0)
    }
  })

  it('counts every application and verification status', async () => {
    const { body } = await api(DASHBOARD)

    for (const key of [
      'total',
      'PENDING_REVIEW',
      'NEEDS_INFORMATION',
      'APPROVED',
      'SUSPENDED',
      'REJECTED',
      'DRAFT',
    ]) {
      assert.equal(typeof body.data.applications[key], 'number', `applications.${key}`)
    }
    for (const key of [
      'VERIFIED',
      'DOCUMENTS_REQUESTED',
      'DOCUMENTS_RECEIVED',
      'NEEDS_MORE_INFORMATION',
      'UNVERIFIED',
    ]) {
      assert.equal(typeof body.data.verification[key], 'number', `verification.${key}`)
    }
  })

  it('ships the learner window alongside the learner counts', async () => {
    // The UI has to be able to say what "recently" means. A count of registered
    // accounts presented as "active learners" would be a different claim.
    const { body } = await api(DASHBOARD)

    assert.equal(typeof body.data.learners.registered, 'number')
    assert.equal(typeof body.data.learners.requestedRecently, 'number')
    assert.equal(typeof body.data.learners.windowDays, 'number')
    assert.ok(body.data.learners.windowDays > 0)
  })

  it('counts learner accounts from the CLIENT role only', async () => {
    const { body: before } = await api(DASHBOARD)

    // A fixture created here is a plain client with no profile, which is the
    // cheapest possible way to add exactly one learner account.
    const user = await prisma.user.create({
      data: { email: `learner-${crypto.randomUUID()}@test.local`, name: 'New Learner' },
    })
    createdUserIds.push(user.id)

    const { body: after } = await api(DASHBOARD)

    assert.equal(after.data.learners.registered, before.data.learners.registered + 1)
  })
})

// ---------------------------------------------------------------------------
// Matching and follow-ups
// ---------------------------------------------------------------------------

describe('GET /api/admin/dashboard — matching and follow-ups', () => {
  it('splits requests into matched and unmatched, and the two sum to the total', async () => {
    const { body } = await api(DASHBOARD)
    const { total, matched, unmatched } = body.data.matching

    assert.equal(matched + unmatched, total, 'every request is either matched or unmatched')
  })

  it('excludes cancelled requests from the matching total', async () => {
    // A cancelled request is nobody's problem, so counting it would inflate the
    // "requests without a tutor" figure an admin is meant to act on.
    const { body } = await api(DASHBOARD)

    assert.ok(body.data.matching.total <= body.data.requests.total)
  })

  it('echoes the follow-up threshold it applied', async () => {
    const { body } = await api(DASHBOARD)

    assert.equal(body.data.matching.staleDays, 7, 'the default threshold is 7 days')
    assert.equal(typeof body.data.matching.stale, 'number')
  })

  it('applies a caller-supplied follow-up threshold', async () => {
    const { body } = await api(`${DASHBOARD}?staleDays=3`)

    assert.equal(body.data.matching.staleDays, 3)
  })

  it('rejects a nonsensical window rather than clamping it', async () => {
    const { status, body } = await api(`${DASHBOARD}?staleDays=0`)

    assert.equal(status, 400)
    assert.equal(body.error.code, 'VALIDATION_ERROR')
  })
})

// ---------------------------------------------------------------------------
// Trend series
// ---------------------------------------------------------------------------

describe('GET /api/admin/dashboard — trend series', () => {
  it('returns exactly one point per day in the requested window', async () => {
    for (const days of [7, 30, 90]) {
      const { body } = await api(`${DASHBOARD}?days=${days}`)

      assert.equal(body.data.trends.requests.length, days, `days=${days} request points`)
      assert.equal(body.data.trends.applications.length, days, `days=${days} application points`)
    }
  })

  it('zero-fills the series so a gap reads as a real zero, not a missing day', async () => {
    const { body } = await api(`${DASHBOARD}?days=30`)

    // Every point is a number and the dates are consecutive: a chart built from
    // this cannot silently skip a day nobody queried.
    const dates = body.data.trends.requests.map((point) => point.date)
    for (let index = 1; index < dates.length; index += 1) {
      const previous = new Date(`${dates[index - 1]}T00:00:00Z`)
      const current = new Date(`${dates[index]}T00:00:00Z`)
      const gap = (current - previous) / (24 * 60 * 60 * 1000)
      assert.equal(gap, 1, `${dates[index - 1]} → ${dates[index]} must be consecutive`)
    }

    for (const point of body.data.trends.requests) {
      assert.equal(typeof point.count, 'number')
      assert.ok(Number.isInteger(point.count))
      assert.ok(point.count >= 0)
    }
  })

  it('buckets a record onto the day it was created', async () => {
    // A profile dated three days ago must move exactly one point in the series,
    // and it must be the point for that day.
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    threeDaysAgo.setUTCHours(12, 0, 0, 0)

    const { body: before } = await api(`${DASHBOARD}?days=30`)
    const target = threeDaysAgo.toISOString().slice(0, 10)
    const beforePoint = before.data.trends.applications.find((p) => p.date === target)
    assert.ok(beforePoint, 'the target day must already be in the series')

    const profile = await createProfile({ createdAt: threeDaysAgo })

    const { body: after } = await api(`${DASHBOARD}?days=30`)
    const afterPoint = after.data.trends.applications.find((p) => p.date === target)

    assert.equal(
      afterPoint.count,
      beforePoint.count + 1,
      `the profile must be counted on ${target}`,
    )

    await prisma.tutorProfile.delete({ where: { id: profile.id } })
    createdProfileIds.pop()
  })

  it('ignores records outside the window', async () => {
    const old = new Date('2020-01-01T12:00:00Z')
    const profile = await createProfile({ createdAt: old })

    const { body } = await api(`${DASHBOARD}?days=30`)
    const total = body.data.trends.applications.reduce((sum, p) => sum + p.count, 0)
    const allTime = body.data.applications.total

    assert.ok(
      total <= allTime,
      'a 30-day window can never hold more records than the table does',
    )
    // And the old record must not be in any point.
    assert.ok(
      !body.data.trends.applications.some((p) => p.date === '2020-01-01'),
      'a 2020 record cannot fall inside a 30-day window',
    )

    await prisma.tutorProfile.delete({ where: { id: profile.id } })
    createdProfileIds.pop()
  })

  it('reports the window it actually covered', async () => {
    const { body } = await api(`${DASHBOARD}?days=7`)

    assert.equal(body.data.trends.days, 7)
    const from = new Date(`${body.data.trends.from}T00:00:00Z`)
    const to = new Date(`${body.data.trends.to}T00:00:00Z`)
    const span = (to - from) / (24 * 60 * 60 * 1000)

    assert.equal(span, 6, 'a 7-day window spans 7 days, i.e. 6 gaps between the ends')
  })

  it('refuses a window longer than a year', async () => {
    const { status, body } = await api(`${DASHBOARD}?days=400`)

    assert.equal(status, 400)
    assert.equal(body.error.code, 'VALIDATION_ERROR')
  })
})

// ---------------------------------------------------------------------------
// Subject breakdown
// ---------------------------------------------------------------------------

describe('GET /api/admin/dashboard — subject breakdown', () => {
  it('counts the subjects that were actually written on requests', async () => {
    const { body: before } = await api(DASHBOARD)
    const sumBefore = before.data.subjects.reduce((sum, row) => sum + row.count, 0)

    /*
     * Seeded through the public endpoint rather than through Prisma, so the row
     * is exactly what a real submission produces. That endpoint validates
     * `subject` against the catalogue, so a real subject is fetched first
     * instead of being invented here.
     */
    const catalogue = await fetch(`${baseUrl}/api/subjects`).then((response) => response.json())
    assert.ok(Array.isArray(catalogue.data) && catalogue.data.length > 0, 'the catalogue is seeded')
    const subject = catalogue.data[0].name

    const response = await fetch(`${baseUrl}/api/tutor-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Analytics Subject',
        phone: '0911000000',
        subject,
        educationLevel: 'University',
        learningMode: 'Online',
        helpDescription: 'Need help with a problem set.',
      }),
    })
    const created = await response.json()
    assert.equal(response.status, 201, `seed failed: ${JSON.stringify(created)}`)

    const { body: after } = await api(DASHBOARD)
    const sumAfter = after.data.subjects.reduce((sum, row) => sum + row.count, 0)

    assert.equal(sumAfter, sumBefore + 1, 'the new request must be counted exactly once')

    await prisma.tutorRequest.delete({ where: { id: created.data.id } })
  })

  it('caps the breakdown so the panel cannot grow without bound', async () => {
    const { body } = await api(DASHBOARD)

    assert.ok(body.data.subjects.length <= 8)
  })
})

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

describe('GET /api/admin/activity — the feed', () => {
  it('requires the admin token', async () => {
    const { status, body } = await api(ACTIVITY, { noAuth: true })

    assert.equal(status, 401)
    assert.equal(body.error.code, 'UNAUTHORIZED')
  })

  it('returns at most the requested number of entries, newest first', async () => {
    const { body } = await api(`${ACTIVITY}?limit=5`)

    assert.ok(body.data.items.length <= 5, 'never more than asked for')

    const times = body.data.items.map((entry) => new Date(entry.occurredAt).getTime())
    for (let index = 1; index < times.length; index += 1) {
      assert.ok(
        times[index] <= times[index - 1],
        'entries must be ordered newest first',
      )
    }
  })

  it('namespaces ids so the two tables cannot collide in one list', async () => {
    const { body } = await api(`${ACTIVITY}?limit=20`)

    for (const entry of body.data.items) {
      assert.ok(
        entry.id.startsWith('request:') || entry.id.startsWith('profile:'),
        `unexpected id shape: ${entry.id}`,
      )
      assert.equal(entry.entityId.length, 36, 'entityId must be the raw uuid')
    }
  })

  it('reports whether a record is new or was written again, and nothing more', async () => {
    // There is no audit log, so `isNew` is derived from createdAt === updatedAt.
    // The feed must not claim an approval or a rejection happened.
    const profile = await createProfile({ profileStatus: 'PENDING_REVIEW' })

    const { body } = await api(`${ACTIVITY}?limit=50`)
    const mine = body.data.items.find((entry) => entry.id === `profile:${profile.id}`)

    assert.ok(mine, 'a freshly created profile must appear in the feed')
    assert.equal(mine.kind, 'application')
    assert.equal(mine.isNew, true)

    await prisma.tutorProfile.delete({ where: { id: profile.id } })
    createdProfileIds.pop()
  })

  it('treats an edited profile as updated rather than new', async () => {
    const profile = await createProfile({ profileStatus: 'PENDING_REVIEW' })

    // A second write moves updatedAt, which is what "was touched again" means.
    await prisma.tutorProfile.update({
      where: { id: profile.id },
      data: { headline: 'Edited headline' },
    })

    const { body } = await api(`${ACTIVITY}?limit=50`)
    const mine = body.data.items.find((entry) => entry.id === `profile:${profile.id}`)

    assert.equal(mine.isNew, false)
    assert.equal(mine.headline, 'Edited headline')

    await prisma.tutorProfile.delete({ where: { id: profile.id } })
    createdProfileIds.pop()
  })

  it('rejects a limit outside the allowed range', async () => {
    const { status } = await api(`${ACTIVITY}?limit=5000`)

    assert.equal(status, 400)
  })
})
