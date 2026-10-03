/**
 * Homepage statistics overrides API tests.
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

const SETTINGS_PATH = '/api/admin/site-stats'
const PUBLIC_PATH = '/api/public/stats'

const STAT_KEYS = ['approvedTutors', 'subjects', 'universities', 'countries']

let server
let baseUrl

before(async () => {
  if (!TOKEN) {
    throw new Error('ADMIN_API_TOKEN must be set to run the site statistics tests')
  }
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`

  // Start from "no overrides" so the suite does not depend on, or leak into,
  // whatever happens to be in the developer's database. The row is removed
  // again in `after` — the count tests in tutors.api.test.mjs read the public
  // endpoint and would otherwise see these values.
  await prisma.platformStats.deleteMany()
})

after(async () => {
  // Essential, not tidy: an override left behind would change the homepage
  // figures for every test that runs after this file.
  await prisma.platformStats.deleteMany()
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
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { status: response.status, body }
}

/** Reads the admin settings screen's payload. */
async function settings() {
  const { status, body } = await api(SETTINGS_PATH)
  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(body)}`)
  return body.data
}

/** Reads what a public visitor is currently served. */
async function published() {
  const { status, body } = await api(PUBLIC_PATH, { noAuth: true })
  assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(body)}`)
  return body.data
}

describe('GET /api/admin/site-stats — settings with nothing overridden', () => {
  it('requires the admin token', async () => {
    const { status, body } = await api(SETTINGS_PATH, { noAuth: true })

    assert.equal(status, 401)
    assert.equal(body.success, false)
  })

  it('reports all four overrides as null when nothing has been overridden', async () => {
    const data = await settings()

    for (const key of STAT_KEYS) {
      assert.equal(data.overrides[key], null, `${key} should have no override`)
    }
    assert.equal(data.updatedAt, null, 'an untouched table has never been updated')
  })

  it('shows the live count, which is what the public endpoint is serving', async () => {
    const data = await settings()
    const live = await published()

    for (const key of STAT_KEYS) {
      assert.equal(typeof data.live[key], 'number', `${key} live count must be a number`)
      assert.equal(
        data.showing[key],
        live[key],
        `with no override, ${key} must be published exactly as counted`,
      )
    }
  })

  it('does not accept a value for a metric that does not exist', async () => {
    const { status, body } = await api(SETTINGS_PATH, {
      method: 'PATCH',
      body: JSON.stringify({ satisfactionScore: 99 }),
    })

    assert.equal(status, 400)
    assert.equal(body.error.code, 'VALIDATION_ERROR')
  })
})

describe('PATCH /api/admin/site-stats — overriding a figure', () => {
  it('requires the admin token', async () => {
    const { status } = await api(SETTINGS_PATH, {
      method: 'PATCH',
      noAuth: true,
      body: JSON.stringify({ approvedTutors: 500 }),
    })

    assert.equal(status, 401)
  })

  it('publishes the override instead of the live count', async () => {
    const { status, body } = await api(SETTINGS_PATH, {
      method: 'PATCH',
      body: JSON.stringify({ approvedTutors: 500 }),
    })

    assert.equal(status, 200)
    assert.equal(body.success, true)
    assert.equal(body.data.overrides.approvedTutors, 500)

    const live = await published()
    assert.equal(live.approvedTutors, 500, 'the public endpoint must serve the override')
    assert.equal(
      body.data.showing.approvedTutors,
      500,
      'the screen must show what visitors are actually seeing',
    )
    assert.notEqual(
      body.data.live.approvedTutors,
      500,
      'this test is only meaningful if the live count differs from the override',
    )
  })

  it('records when the override changed', async () => {
    // Reset the row so "never been updated" is actually true here rather than
    // left over from the previous test in this suite.
    await prisma.platformStats.deleteMany()
    assert.equal((await settings()).updatedAt, null)

    await api(SETTINGS_PATH, {
      method: 'PATCH',
      body: JSON.stringify({ subjects: 42 }),
    })

    const after = await settings()
    assert.equal(typeof after.updatedAt, 'string')
    assert.equal(
      Date.parse(after.updatedAt) <= Date.now(),
      true,
      'the timestamp must be in the past, not the future',
    )
  })

  it('leaves untouched fields alone', async () => {
    await api(SETTINGS_PATH, {
      method: 'PATCH',
      body: JSON.stringify({ approvedTutors: 120, countries: 7 }),
    })

    // A second save names only `universities`. The other two must survive it:
    // this is what makes a partial save safe when two admins are working.
    await api(SETTINGS_PATH, {
      method: 'PATCH',
      body: JSON.stringify({ universities: 15 }),
    })

    const data = await settings()
    assert.equal(data.overrides.approvedTutors, 120)
    assert.equal(data.overrides.countries, 7)
    assert.equal(data.overrides.universities, 15)
  })

  it('serves every override at once', async () => {
    const wanted = {
      approvedTutors: 210,
      subjects: 33,
      universities: 9,
      countries: 4,
    }

    await api(SETTINGS_PATH, { method: 'PATCH', body: JSON.stringify(wanted) })

    const live = await published()
    for (const key of STAT_KEYS) {
      assert.equal(live[key], wanted[key], `${key} must be published as the override`)
    }
  })

  it('refuses a save that names no statistic at all', async () => {
    const { status, body } = await api(SETTINGS_PATH, { method: 'PATCH', body: JSON.stringify({}) })

    assert.equal(status, 400)
    assert.equal(body.error.code, 'VALIDATION_ERROR')
  })
})

describe('PATCH /api/admin/site-stats — values the homepage cannot render', () => {
  /*
   * The homepage prints wording instead of a zero (`statDisplayValue` in the
   * frontend), so an override of 0 would put a card on screen that contradicts
   * its own number. These are rejected rather than stored.
   */
  const rejected = [
    ['zero', 0],
    ['negative', -5],
    ['a fraction', 12.5],
    ['above the ceiling', 10_000_000],
  ]

  for (const [label, value] of rejected) {
    it(`refuses ${label}`, async () => {
      const { status, body } = await api(SETTINGS_PATH, {
        method: 'PATCH',
        body: JSON.stringify({ approvedTutors: value }),
      })

      assert.equal(status, 400, `${label} must not be storable`)
      assert.equal(body.error.code, 'VALIDATION_ERROR')

      const data = await settings()
      assert.notEqual(
        data.overrides.approvedTutors,
        value,
        'a rejected value must not have been written',
      )
    })
  }

  it('refuses a non-numeric value', async () => {
    const { status } = await api(SETTINGS_PATH, {
      method: 'PATCH',
      body: JSON.stringify({ subjects: 'lots' }),
    })

    assert.equal(status, 400)
  })
})

describe('PATCH /api/admin/site-stats — clearing an override', () => {
  it('null hands the figure back to the live count', async () => {
    await api(SETTINGS_PATH, { method: 'PATCH', body: JSON.stringify({ approvedTutors: 999 }) })
    assert.equal((await published()).approvedTutors, 999)

    const { status, body } = await api(SETTINGS_PATH, {
      method: 'PATCH',
      body: JSON.stringify({ approvedTutors: null }),
    })

    assert.equal(status, 200)
    assert.equal(body.data.overrides.approvedTutors, null)

    const data = await settings()
    const live = await published()
    assert.equal(
      live.approvedTutors,
      data.live.approvedTutors,
      'with the override gone, the published figure is the live count again',
    )
  })

  it('clears all four at once', async () => {
    await api(SETTINGS_PATH, {
      method: 'PATCH',
      body: JSON.stringify({ approvedTutors: 1, subjects: 2, universities: 3, countries: 4 }),
    })

    const { status } = await api(SETTINGS_PATH, {
      method: 'PATCH',
      body: JSON.stringify({ approvedTutors: null, subjects: null, universities: null, countries: null }),
    })

    assert.equal(status, 200)

    const data = await settings()
    const live = await published()
    for (const key of STAT_KEYS) {
      assert.equal(data.overrides[key], null, `${key} override should be gone`)
      assert.equal(live[key], data.live[key], `${key} should be back to its live count`)
    }
  })
})

describe('GET /api/public/stats — what a visitor sees', () => {
  it('still answers without any authentication', async () => {
    await api(SETTINGS_PATH, { method: 'PATCH', body: JSON.stringify({ subjects: 77 }) })

    const { status, body } = await api(PUBLIC_PATH, { noAuth: true })

    assert.equal(status, 200)
    assert.equal(body.success, true)
    assert.equal(body.data.subjects, 77)
  })

  it('carries exactly the four documented keys and nothing about the overrides', async () => {
    await api(SETTINGS_PATH, { method: 'PATCH', body: JSON.stringify({ subjects: 77 }) })

    const live = await published()

    assert.deepEqual(
      Object.keys(live).sort(),
      [...STAT_KEYS].sort(),
      'the public payload must not grow a key just because the admin UI has more to show',
    )
    for (const key of STAT_KEYS) {
      assert.equal(typeof live[key], 'number')
      assert.ok(Number.isInteger(live[key]), `${key} must be a whole number`)
    }
  })
})
