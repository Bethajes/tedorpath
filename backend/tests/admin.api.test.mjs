import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { createApp } from '../src/app.js'
import { closePrisma, prisma } from '../src/lib/prisma.js'

/**
 * Admin API tests.
 *
 * These run against the real Express app and the real PostgreSQL database, so
 * they exercise the same code path as production. They create their own
 * records and clean up afterwards.
 *
 * Run with: npm test   (or: node --test tests/)
 */

const TOKEN = process.env.ADMIN_API_TOKEN ?? ''
const auth = { Authorization: `Bearer ${TOKEN}` }

let server
let baseUrl

/** Rows created by these tests, removed at the end. */
let createdIds = []
const createdProfileIds = []
const createdUserIds = []

before(async () => {
  if (!TOKEN) {
    throw new Error('ADMIN_API_TOKEN must be set to run the admin tests')
  }
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (createdIds.length) {
    await prisma.tutorRequest.deleteMany({ where: { id: { in: createdIds } } })
  }
  // Profiles before users: the profile row is owned by the user row.
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

/** Create a request through the real public endpoint. */
async function seedRequest(overrides = {}) {
  const payload = {
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
    ...overrides,
  }
  const { status, body } = await api('/api/tutor-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  assert.equal(status, 201, `seed failed: ${JSON.stringify(body)}`)
  createdIds.push(body.data.id)
  return body.data.id
}

describe('security boundary', () => {
  it('rejects admin requests with no token', async () => {
    for (const path of [
      '/api/admin/stats',
      '/api/admin/tutor-requests',
      `/api/admin/tutor-requests/${crypto.randomUUID()}`,
    ]) {
      const { status, body } = await api(path, { noAuth: true })
      assert.equal(status, 401, `${path} should require a token`)
      assert.equal(body.success, false)
      assert.equal(body.error.code, 'UNAUTHORIZED')
    }
  })

  it('rejects an incorrect token', async () => {
    const { status, body } = await api('/api/admin/tutor-requests', {
      noAuth: true,
      headers: { Authorization: 'Bearer not-the-right-token' },
    })
    assert.equal(status, 401)
    assert.equal(body.error.code, 'UNAUTHORIZED')
  })

  it('rejects write and delete verbs without a token', async () => {
    const id = await seedRequest()
    const patch = await api(`/api/admin/tutor-requests/${id}`, {
      method: 'PATCH',
      noAuth: true,
      body: JSON.stringify({ status: 'COMPLETED' }),
    })
    assert.equal(patch.status, 401)

    const del = await api(`/api/admin/tutor-requests/${id}`, {
      method: 'DELETE',
      noAuth: true,
    })
    assert.equal(del.status, 401)

    // The record must be untouched.
    const still = await prisma.tutorRequest.findUnique({ where: { id } })
    assert.equal(still.status, 'NEW')
  })

  it('accepts the token via X-Admin-Token header', async () => {
    const { status } = await api('/api/admin/stats', {
      noAuth: true,
      headers: { 'X-Admin-Token': TOKEN },
    })
    assert.equal(status, 200)
  })

  it('never leaks admin notes through the public API', async () => {
    const id = await seedRequest()
    await api(`/api/admin/tutor-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ adminNotes: 'SECRET-INTERNAL-NOTE' }),
    })

    // The public endpoint only accepts submissions; make sure no public route
    // exposes stored records or notes.
    for (const path of ['/api/tutor-requests', `/api/tutor-requests/${id}`]) {
      const { body } = await api(path)
      assert.ok(
        !JSON.stringify(body ?? {}).includes('SECRET-INTERNAL-NOTE'),
        `${path} must not expose admin notes`,
      )
    }
  })
})

/**
 * Creates an approved tutor profile that requests can be aimed at.
 *
 * A request that names a tutor is the normal case for anyone who found a tutor
 * in the directory rather than filling in the form cold, so the admin queue has
 * to be able to say who it was aimed at.
 */
async function seedTutorProfile(displayName = 'Bethel Berihun') {
  const user = await prisma.user.create({
    data: { email: `admin-tutor-${crypto.randomUUID()}@test.local`, name: displayName },
  })
  createdUserIds.push(user.id)

  const profile = await prisma.tutorProfile.create({
    data: {
      userId: user.id,
      displayName,
      headline: 'Chemistry and physics',
      bio: 'Ten years teaching.',
      teachingMode: 'BOTH',
      studentLevels: ['High School'],
      profileStatus: 'APPROVED',
    },
  })
  createdProfileIds.push(profile.id)
  return profile
}

describe('the tutor a client chose (Requirement 13.1)', () => {
  it('names the chosen tutor on the request list', async () => {
    const tutor = await seedTutorProfile('Zebedee Nightingale')
    await seedRequest({ tutorProfileId: tutor.id, subject: 'Physics' })

    const { status, body } = await api('/api/admin/tutor-requests?limit=100')
    assert.equal(status, 200)

    const request = body.data.items.find((item) => item.subject === 'Physics')
    assert.ok(request, 'the seeded request must be listed')
    assert.equal(request.tutorProfileId, tutor.id)
    // The whole point: an admin triaging the queue can see who it is for
    // without opening anything.
    assert.equal(request.tutor.displayName, 'Zebedee Nightingale')
    assert.equal(request.tutor.id, tutor.id)
    assert.equal(request.tutor.profileStatus, 'APPROVED')
  })

  it('names the chosen tutor on the request detail', async () => {
    const tutor = await seedTutorProfile('Amara Okonkwo')
    const requestId = await seedRequest({ tutorProfileId: tutor.id, subject: 'Biology' })

    const { status, body } = await api(`/api/admin/tutor-requests/${requestId}`)
    assert.equal(status, 200)
    assert.equal(body.data.tutor.displayName, 'Amara Okonkwo')
    assert.equal(body.data.tutor.headline, 'Chemistry and physics')
  })

  it('reports tutor as null for a request nobody chose a tutor for', async () => {
    const requestId = await seedRequest({ subject: 'Exam Preparation' })

    const { body } = await api(`/api/admin/tutor-requests/${requestId}`)
    assert.equal(body.data.tutor, null, 'a cold request must not claim a tutor')
    assert.equal(body.data.tutorProfileId, null)
  })

  it('leaves the request readable when the chosen tutor is deleted', async () => {
    // The relation is onDelete: SetNull, so a removed profile must not take the
    // client's request — and the client's own contact details — with it.
    const tutor = await seedTutorProfile('Doomed Profile')
    const requestId = await seedRequest({ tutorProfileId: tutor.id, subject: 'University Course' })

    // Deleting an already-removed id from the cleanup list is unnecessary: the
    // deleteMany in after() is a no-op for a row that is already gone.
    await prisma.tutorProfile.delete({ where: { id: tutor.id } })

    const { status, body } = await api(`/api/admin/tutor-requests/${requestId}`)
    assert.equal(status, 200)
    assert.equal(body.data.tutor, null)
    assert.equal(body.data.fullName, 'Abel Tesfaye', 'the request itself must survive')
  })

  it('finds a request by searching for the chosen tutor', async () => {
    const tutor = await seedTutorProfile('Ravi Patel')
    await seedRequest({ tutorProfileId: tutor.id, subject: 'AI & Technology' })
    await seedRequest({ subject: 'Other' })

    const { body } = await api('/api/admin/tutor-requests?limit=100&q=Ravi%20Patel')
    const subjects = body.data.items.map((item) => item.subject)

    assert.ok(subjects.includes('AI & Technology'), 'the tutor name must be searchable')
    assert.ok(!subjects.includes('Other'), 'an unrelated request must not match')
  })

  it('does not lose the tutor when the status is updated', async () => {
    // The status endpoint selects a different column set; the chosen tutor has
    // to survive an admin marking it CONTACTED.
    const tutor = await seedTutorProfile('Grace Hopper')
    const requestId = await seedRequest({ tutorProfileId: tutor.id, subject: 'Programming' })

    await api(`/api/admin/tutor-requests/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CONTACTED' }),
    })

    const { body } = await api(`/api/admin/tutor-requests/${requestId}`)
    assert.equal(body.data.status, 'CONTACTED')
    assert.equal(body.data.tutor.displayName, 'Grace Hopper')
  })
})

describe('GET /api/admin/stats', () => {
  it('counts requests by status from the database', async () => {
    const before = (await api('/api/admin/stats')).body.data

    const a = await seedRequest({ fullName: 'Stats One' })
    const b = await seedRequest({ fullName: 'Stats Two' })
    await api(`/api/admin/tutor-requests/${a}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CONTACTED' }),
    })
    await api(`/api/admin/tutor-requests/${b}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'COMPLETED' }),
    })

    const after = (await api('/api/admin/stats')).body.data

    assert.equal(after.total, before.total + 2)
    assert.equal(after.CONTACTED, before.CONTACTED + 1)
    assert.equal(after.COMPLETED, before.COMPLETED + 1)
    assert.equal(after.NEW, before.NEW)

    for (const key of ['total', 'NEW', 'CONTACTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']) {
      assert.equal(typeof after[key], 'number', `${key} should be numeric`)
    }
  })

  it('counts tutor applications separately from tutor requests', async () => {
    // The regression this guards: a dashboard built only from TutorRequest shows
    // all zeroes while a tutor is waiting for a decision, and the admin concludes
    // nothing has arrived. A pending application has to be visible here.
    // Snapshot before creating anything, so the delta measures this profile.
    const before = (await api('/api/admin/stats')).body.data

    const user = await prisma.user.create({
      data: { email: `admin-stats-${crypto.randomUUID()}@test.local`, name: 'Stats Tutor' },
    })
    createdUserIds.push(user.id)
    const profile = await prisma.tutorProfile.create({
      data: {
        userId: user.id,
        displayName: 'Stats Tutor',
        headline: 'Waiting to be reviewed',
        bio: 'x',
        teachingMode: 'ONLINE',
        studentLevels: ['High School'],
        profileStatus: 'PENDING_REVIEW',
      },
    })
    createdProfileIds.push(profile.id)

    const after = (await api('/api/admin/stats')).body.data

    assert.equal(
      after.tutorApplications.PENDING_REVIEW,
      before.tutorApplications.PENDING_REVIEW + 1,
      'a profile waiting for review must be counted',
    )
    assert.equal(
      after.total,
      before.total,
      'an application is not a request: the request total must not move',
    )

    for (const key of ['total', 'PENDING_REVIEW', 'NEEDS_INFORMATION', 'APPROVED']) {
      assert.equal(
        typeof after.tutorApplications[key],
        'number',
        `tutorApplications.${key} should be numeric`,
      )
    }
  })
})

describe('GET /api/admin/tutor-requests', () => {
  it('returns newest first', async () => {
    const older = await seedRequest({ fullName: 'Order Older' })
    const newer = await seedRequest({ fullName: 'Order Newer' })
    // Force distinct, known timestamps.
    await prisma.tutorRequest.update({
      where: { id: older },
      data: { createdAt: new Date('2020-01-01T00:00:00Z') },
    })
    await prisma.tutorRequest.update({
      where: { id: newer },
      data: { createdAt: new Date('2030-01-01T00:00:00Z') },
    })

    const { status, body } = await api('/api/admin/tutor-requests?limit=100')
    assert.equal(status, 200)
    assert.equal(body.success, true)

    const ids = body.data.items.map((item) => item.id)
    assert.ok(ids.indexOf(newer) < ids.indexOf(older), 'newer record should come first')
  })

  it('paginates with page and limit', async () => {
    for (let i = 0; i < 3; i++) await seedRequest({ fullName: `Pager ${i}` })

    const first = await api('/api/admin/tutor-requests?page=1&limit=2')
    assert.equal(first.body.data.items.length, 2)
    assert.equal(first.body.data.pagination.page, 1)
    assert.equal(first.body.data.pagination.limit, 2)
    assert.ok(first.body.data.pagination.total >= 3)
    assert.equal(first.body.data.pagination.totalPages, Math.ceil(first.body.data.pagination.total / 2))

    const second = await api('/api/admin/tutor-requests?page=2&limit=2')
    const firstIds = first.body.data.items.map((i) => i.id)
    const secondIds = second.body.data.items.map((i) => i.id)
    assert.equal(firstIds.filter((id) => secondIds.includes(id)).length, 0, 'pages must not overlap')
  })

  it('caps the limit and rejects out-of-range values', async () => {
    const capped = await api('/api/admin/tutor-requests?limit=1000000')
    assert.equal(capped.status, 400, 'an oversized limit must be rejected, not silently capped')

    const zero = await api('/api/admin/tutor-requests?limit=0')
    assert.equal(zero.status, 400)

    const hugePage = await api('/api/admin/tutor-requests?page=0')
    assert.equal(hugePage.status, 400)
  })

  it('does not return admin notes or full contact details in the list', async () => {
    const id = await seedRequest({ fullName: 'List Privacy' })
    await api(`/api/admin/tutor-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ adminNotes: 'LIST-SHOULD-NOT-SHOW-THIS' }),
    })

    const { body } = await api('/api/admin/tutor-requests?limit=100')
    const row = body.data.items.find((item) => item.id === id)
    assert.ok(row, 'seeded row should be listed')
    assert.equal(row.adminNotes, undefined)
    assert.equal(row.description, undefined)
    assert.equal(row.email, undefined)
    assert.ok(!JSON.stringify(body).includes('LIST-SHOULD-NOT-SHOW-THIS'))
  })

  it('filters by status', async () => {
    const id = await seedRequest({ fullName: 'Filter Target' })
    await api(`/api/admin/tutor-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    })

    const filtered = await api('/api/admin/tutor-requests?status=IN_PROGRESS&limit=100')
    assert.equal(filtered.status, 200)
    assert.ok(filtered.body.data.items.every((item) => item.status === 'IN_PROGRESS'))
    assert.ok(filtered.body.data.items.some((item) => item.id === id))

    const all = await api('/api/admin/tutor-requests?status=all&limit=100')
    assert.equal(all.status, 200)
  })

  it('rejects an unknown status filter', async () => {
    const { status, body } = await api('/api/admin/tutor-requests?status=BOGUS')
    assert.equal(status, 400)
    assert.equal(body.error.code, 'VALIDATION_ERROR')
  })

  it('searches by name, phone, email and subject', async () => {
    const id = await seedRequest({
      fullName: 'Searchable Person',
      phone: '+44 7700 900123',
      email: 'searchable@example.com',
      subject: 'Chemistry',
    })

    for (const term of ['Searchable', 'searchable person', '7700 900123', 'searchable@example.com', 'Chemistry']) {
      const { status, body } = await api(`/api/admin/tutor-requests?q=${encodeURIComponent(term)}&limit=100`)
      assert.equal(status, 200, `search "${term}" should be accepted`)
      assert.ok(
        body.data.items.some((item) => item.id === id),
        `search "${term}" should find the seeded record`,
      )
    }
  })

  it('returns an empty page when nothing matches', async () => {
    const { status, body } = await api('/api/admin/tutor-requests?q=zzzz-no-such-person-zzzz')
    assert.equal(status, 200)
    assert.equal(body.data.items.length, 0)
    assert.equal(body.data.pagination.total, 0)
  })
})

describe('GET /api/admin/tutor-requests/:id', () => {
  it('returns the full record including internal notes', async () => {
    const id = await seedRequest({ fullName: 'Detail Person' })
    await api(`/api/admin/tutor-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ adminNotes: 'Called on Tuesday.' }),
    })

    const { status, body } = await api(`/api/admin/tutor-requests/${id}`)
    assert.equal(status, 200)
    assert.equal(body.data.id, id)
    assert.equal(body.data.fullName, 'Detail Person')
    assert.equal(body.data.phone, '0912345678')
    assert.equal(body.data.email, 'abel@example.com')
    assert.equal(body.data.telegramUsername, '@abel')
    assert.equal(body.data.description, 'I need help with calculus for my exam.')
    assert.equal(body.data.adminNotes, 'Called on Tuesday.')
    assert.equal(body.data.status, 'NEW')
    assert.ok(body.data.createdAt)
    assert.ok(body.data.updatedAt)
  })

  it('returns 404 for a well-formed but unknown id', async () => {
    const { status, body } = await api(`/api/admin/tutor-requests/${crypto.randomUUID()}`)
    assert.equal(status, 404)
    assert.equal(body.error.code, 'NOT_FOUND')
  })

  it('returns 400 for a malformed id', async () => {
    const { status, body } = await api('/api/admin/tutor-requests/not-a-uuid')
    assert.equal(status, 400)
    assert.equal(body.error.code, 'VALIDATION_ERROR')
  })
})

describe('PATCH /api/admin/tutor-requests/:id', () => {
  it('walks the status through the full workflow', async () => {
    const id = await seedRequest({ fullName: 'Workflow Person' })

    for (const [from, to] of [
      ['NEW', 'CONTACTED'],
      ['CONTACTED', 'IN_PROGRESS'],
      ['IN_PROGRESS', 'COMPLETED'],
    ]) {
      const current = (await api(`/api/admin/tutor-requests/${id}`)).body.data
      assert.equal(current.status, from, `expected to start at ${from}`)

      const updated = await api(`/api/admin/tutor-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: to }),
      })
      assert.equal(updated.status, 200)
      assert.equal(updated.body.data.status, to)
    }
  })

  it('supports CANCELLED and reverting to NEW', async () => {
    const id = await seedRequest()
    for (const status of ['CANCELLED', 'NEW']) {
      const { status: code, body } = await api(`/api/admin/tutor-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      assert.equal(code, 200)
      assert.equal(body.data.status, status)
    }
  })

  it('rejects an invalid status', async () => {
    const id = await seedRequest()
    const { status, body } = await api(`/api/admin/tutor-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'BANANA' }),
    })
    assert.equal(status, 400)
    assert.equal(body.error.code, 'VALIDATION_ERROR')

    const unchanged = (await api(`/api/admin/tutor-requests/${id}`)).body.data
    assert.equal(unchanged.status, 'NEW')
  })

  it('adds, updates and clears admin notes', async () => {
    const id = await seedRequest({ fullName: 'Notes Person' })

    const added = await api(`/api/admin/tutor-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ adminNotes: 'First note' }),
    })
    assert.equal(added.status, 200)
    assert.equal(added.body.data.adminNotes, 'First note')

    const updated = await api(`/api/admin/tutor-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ adminNotes: 'Second note' }),
    })
    assert.equal(updated.body.data.adminNotes, 'Second note')

    const cleared = await api(`/api/admin/tutor-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ adminNotes: '' }),
    })
    assert.equal(cleared.status, 200)
    assert.ok(
      cleared.body.data.adminNotes === null || cleared.body.data.adminNotes === '',
      'empty notes should clear the field',
    )
  })

  it('rejects excessively long admin notes', async () => {
    const id = await seedRequest()
    const { status } = await api(`/api/admin/tutor-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ adminNotes: 'x'.repeat(5001) }),
    })
    assert.equal(status, 400)
  })

  it('refuses to modify client-submitted fields', async () => {
    const id = await seedRequest({ fullName: 'Immutable Person' })

    for (const payload of [
      { fullName: 'Hacked' },
      { phone: '0000000' },
      { email: 'attacker@example.com' },
      { subject: 'Astrology' },
      { description: 'rewritten by admin' },
      { id: crypto.randomUUID() },
      { createdAt: '2030-01-01T00:00:00Z' },
    ]) {
      const { status, body } = await api(`/api/admin/tutor-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      assert.equal(status, 400, `payload ${JSON.stringify(payload)} should be rejected`)
      assert.equal(body.error.code, 'VALIDATION_ERROR')
    }

    // Even combined with an allowed field, unknown keys must be refused.
    const mixed = await api(`/api/admin/tutor-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CONTACTED', fullName: 'Hacked' }),
    })
    assert.equal(mixed.status, 400)

    const record = (await api(`/api/admin/tutor-requests/${id}`)).body.data
    assert.equal(record.fullName, 'Immutable Person')
    assert.equal(record.status, 'NEW')
  })

  it('rejects an empty patch body', async () => {
    const id = await seedRequest()
    const { status } = await api(`/api/admin/tutor-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    })
    assert.equal(status, 400)
  })

  it('returns 404 when patching an unknown id', async () => {
    const { status, body } = await api(`/api/admin/tutor-requests/${crypto.randomUUID()}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CONTACTED' }),
    })
    assert.equal(status, 404)
    assert.equal(body.error.code, 'NOT_FOUND')
  })
})

describe('DELETE /api/admin/tutor-requests/:id', () => {
  it('deletes a request and 404s afterwards', async () => {
    const id = await seedRequest({ fullName: 'Delete Me' })

    const deleted = await api(`/api/admin/tutor-requests/${id}`, { method: 'DELETE' })
    assert.equal(deleted.status, 200)
    assert.equal(deleted.body.data.deleted, true)

    const after = await api(`/api/admin/tutor-requests/${id}`)
    assert.equal(after.status, 404)

    const gone = await prisma.tutorRequest.findUnique({ where: { id } })
    assert.equal(gone, null)

    createdIds = createdIds.filter((created) => created !== id)
  })

  it('404s when deleting twice', async () => {
    const id = await seedRequest()
    assert.equal((await api(`/api/admin/tutor-requests/${id}`, { method: 'DELETE' })).status, 200)
    assert.equal((await api(`/api/admin/tutor-requests/${id}`, { method: 'DELETE' })).status, 404)
    createdIds = createdIds.filter((created) => created !== id)
  })

  it('400s for a malformed id', async () => {
    const { status } = await api('/api/admin/tutor-requests/nope', { method: 'DELETE' })
    assert.equal(status, 400)
  })
})

describe('public endpoints stay public and unchanged', () => {
  it('GET /api/health is unchanged', async () => {
    const response = await fetch(`${baseUrl}/api/health`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { success: true, data: { status: 'ok' } })
  })

  it('POST /api/tutor-requests still accepts public submissions without a token', async () => {
    const { status, body } = await api('/api/tutor-requests', {
      method: 'POST',
      noAuth: true,
      body: JSON.stringify({
        fullName: 'Public Person',
        phone: '0912345678',
        subject: 'Biology',
        educationLevel: 'High School',
        learningMode: 'In-person',
        helpDescription: 'I need help with cell biology.',
      }),
    })
    assert.equal(status, 201)
    assert.ok(body.data.id)
    createdIds.push(body.data.id)
  })

  it('POST /api/tutor-requests still validates', async () => {
    const { status } = await api('/api/tutor-requests', {
      method: 'POST',
      noAuth: true,
      body: JSON.stringify({ fullName: '', phone: 'abc', subject: '' }),
    })
    assert.equal(status, 400)
  })
})
