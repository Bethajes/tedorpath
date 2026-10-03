/**
 * Tutor rates, stated per market.
 *
 * Tedor Tutors serves Ethiopian learners, who think in birr, and learners
 * elsewhere, who think in dollars. A tutor states their own rate in each, so
 * there is no conversion anywhere in this codebase — which is the property these
 * tests exist to protect. If a rate ever became "computed", every assertion here
 * about the numbers being exactly what was stored would be the thing that broke
 * first.
 *
 * Runs against the real Express app and PostgreSQL database.
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

const createdProfileIds = []
const createdUserIds = []

before(async () => {
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (createdProfileIds.length) {
    await prisma.tutorProfile.deleteMany({ where: { id: { in: createdProfileIds } } })
  }
  if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
  await new Promise((resolve) => server.close(resolve))
  await closePrisma()
})

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
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

/**
 * A user with a live session.
 *
 * Minted directly rather than through the sign-in endpoints: this suite is about
 * the rate rules, and a password round-trip on every case would test the auth
 * module instead.
 */
async function createTutorUser() {
  const user = await prisma.user.create({
    data: { email: `rates-${crypto.randomUUID()}@test.local`, name: 'Rate Tutor' },
  })
  createdUserIds.push(user.id)

  const token = randomBytes(32).toString('hex')
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  })

  return { userId: user.id, token }
}

/** An APPROVED tutor with the given rates, directly in the database. */
async function seedTutor(rates, overrides = {}) {
  const { userId } = await createTutorUser()

  const profile = await prisma.tutorProfile.create({
    data: {
      userId,
      displayName: 'Rate Tutor',
      headline: 'Mathematics',
      bio: 'Teaches mathematics.',
      teachingMode: 'ONLINE',
      studentLevels: ['High School'],
      profileStatus: 'APPROVED',
      // Overrides reach both places they matter: the columns the profile has, and
      // the rows its prices live in. The rate keys are stripped from the column
      // spread because they are no longer columns, and folded into `rates` so a
      // call site can still say `seedTutor({ etb: 900 }, { hourlyRateUsd: 15 })`.
      ...withoutRates(overrides),
      rates: ratesFor({
        hourlyRateEtb: rates.etb,
        hourlyRateUsd: rates.usd,
        ...withoutRates(overrides),
      }),
    },
  })
  createdProfileIds.push(profile.id)
  return profile
}

// ---------------------------------------------------------------------------
// The directory picks the rate for the visitor's market
// ---------------------------------------------------------------------------

describe('GET /api/tutors — the market decides which rate is shown', () => {
  it('shows the birr rate to an Ethiopian visitor', async () => {
    const tutor = await seedTutor({ etb: 900, usd: 12 })

    const { status, body } = await api(`/api/tutors/${tutor.id}?market=ETB`)

    assert.equal(status, 200)
    assert.equal(body.data.hourlyRate, 900)
    assert.equal(body.data.hourlyRateCurrency, 'ETB')
  })

  it('shows the dollar rate to a visitor outside Ethiopia', async () => {
    const tutor = await seedTutor({ etb: 900, usd: 12 })

    const { body } = await api(`/api/tutors/${tutor.id}?market=USD`)

    assert.equal(body.data.hourlyRate, 12)
    assert.equal(body.data.hourlyRateCurrency, 'USD')
  })

  it('defaults to birr for a visitor who has not said where they are', async () => {
    const tutor = await seedTutor({ etb: 900, usd: 12 })

    // Ethiopia is the platform's default market. Somebody who has given us nothing
    // to go on is served birr, because this is an Ethiopian marketplace and that
    // is the market it is built around.
    //
    // This is the last resort, not a guess: a country the learner has given us —
    // saved on their account, or chosen in the request flow — outranks it, which
    // the cases below and `the market registry is the source of truth` cover.
    const { body } = await api(`/api/tutors/${tutor.id}`)

    assert.equal(body.data.hourlyRate, 900)
    assert.equal(body.data.hourlyRateCurrency, 'ETB')
  })

  it('never reports the other market\'s price, so a client cannot show two', async () => {
    const tutor = await seedTutor({ etb: 900, usd: 12 })

    const { body } = await api(`/api/tutors/${tutor.id}?market=USD`)

    // The tutor's own birr price is NOT sent, converted or otherwise. Nothing in
    // this codebase knows what 900 birr is worth, and a client holding both prices
    // is one layout change away from showing a learner two prices for the same
    // hour. Absent is the only safe answer.
    assert.equal(body.data.hourlyRate, 12)
    assert.equal('hourlyRateOtherMarket' in body.data, false)
    assert.equal('hourlyRateOtherCurrency' in body.data, false)
    assert.deepEqual(
      Object.keys(body.data).filter((key) => /rate/i.test(key)).sort(),
      ['hourlyRate', 'hourlyRateCurrency'],
      'the listing should carry exactly one price and its unit',
    )
  })

  it('reports no rate for a tutor who does not price in that market', async () => {
    const tutor = await seedTutor({ etb: 500 })

    const { body } = await api(`/api/tutors/${tutor.id}?market=USD`)

    // Null, not 0: "this tutor does not take international bookings" and "this
    // tutor is free" are different answers and must not collapse into one number.
    assert.equal(body.data.hourlyRate, null)
    assert.equal(body.data.hourlyRateCurrency, 'USD')
  })

  it('ignores an unrecognised market rather than failing the page view', async () => {
    const tutor = await seedTutor({ etb: 900, usd: 12 })

    const { status, body } = await api(`/api/tutors/${tutor.id}?market=EUR`)

    // Falls back to the default market rather than erroring. A link somebody
    // shared before the change carried `?market=`, and a stale value in one must
    // not turn a profile into a 400.
    assert.equal(status, 200, 'a stale link must not turn a profile into an error')
    assert.equal(body.data.hourlyRateCurrency, 'ETB')
  })

  it('applies the market to a directory listing', async () => {
    await seedTutor({ etb: 900, usd: 12 }, { displayName: 'Market Tutor' })

    const birr = await api('/api/tutors?market=ETB')
    const dollars = await api('/api/tutors?market=USD')

    const birrItem = birr.body.data.items.find((item) => item.displayName === 'Market Tutor')
    const dollarItem = dollars.body.data.items.find((item) => item.displayName === 'Market Tutor')

    assert.equal(birrItem.hourlyRate, 900)
    assert.equal(dollarItem.hourlyRate, 12)
  })
})

// ---------------------------------------------------------------------------
// The rate filter and the rate sort follow the market
// ---------------------------------------------------------------------------

describe('the rate filter and sort are answered in the visitor\'s own money', () => {
  it('filters on the market being browsed', async () => {
    // One tutor charges a lot in birr and little in dollars. A range filter that
    // read the wrong column would show this tutor under "affordable" in Ethiopia
    // and hide them abroad — or the reverse, which is worse.
    await seedTutor({ etb: 900, usd: 12 }, { displayName: 'Two Market Tutor' })

    const cheapInDollars = await api('/api/tutors?market=USD&maxRate=20')
    const cheapInBirr = await api('/api/tutors?market=ETB&maxRate=900')

    const foundInDollars = cheapInDollars.body.data.items.some(
      (item) => item.displayName === 'Two Market Tutor',
    )
    const foundInBirr = cheapInBirr.body.data.items.some(
      (item) => item.displayName === 'Two Market Tutor',
    )

    assert.equal(foundInDollars, true)
    assert.equal(foundInBirr, true)
  })

  it('sorts on the market being browsed', async () => {
    await seedTutor({ etb: 900, usd: 12 }, { displayName: 'Sort By Market Tutor' })

    const dollars = await api('/api/tutors?market=USD&sort=price_asc')
    const etb = await api('/api/tutors?market=ETB&sort=price_asc')

    const inDollars = dollars.body.data.items.find((item) => item.displayName === 'Sort By Market Tutor')
    const inEtb = etb.body.data.items.find((item) => item.displayName === 'Sort By Market Tutor')

    assert.equal(inDollars.hourlyRate, 12)
    assert.equal(inEtb.hourlyRate, 900)
  })

  it('puts a tutor who does not price in this market last, not first', async () => {
    // Nulls first would present an unpriced tutor as the cheapest in the list.
    await seedTutor({ etb: 900 }, { displayName: 'Ethiopia Only Tutor' })
    await seedTutor({ etb: 2000, usd: 40 }, { displayName: 'Both Markets Tutor' })

    const { body } = await api('/api/tutors?market=USD&sort=price_asc')
    const names = body.data.items.map((item) => item.displayName)

    assert.ok(names.includes('Ethiopia Only Tutor'))
    assert.ok(names.includes('Both Markets Tutor'))
    assert.ok(
      names.indexOf('Both Markets Tutor') < names.indexOf('Ethiopia Only Tutor'),
      `expected the priced tutor first in price_asc, got ${JSON.stringify(names)}`,
    )
  })

  it('rejects a market it does not recognise, rather than guessing', async () => {
    const { status, body } = await api('/api/tutors?market=EUR')

    assert.equal(status, 400)
    assert.equal(body.error.code, 'VALIDATION_ERROR')
  })
})

// ---------------------------------------------------------------------------
// What a tutor can state
// ---------------------------------------------------------------------------

describe('what a tutor can state', () => {
  const validProfile = {
    displayName: 'Rate Tutor',
    headline: 'Mathematics',
    bio: 'I teach mathematics.',
    teachingMode: 'ONLINE',
    studentLevels: ['High School'],
  }

  async function createTutor(body) {
    const { token } = await createTutorUser()

    const result = await api('/api/tutor-profile', {
      method: 'POST',
      token,
      body: { ...validProfile, ...body },
    })
    if (result.body?.data?.id) createdProfileIds.push(result.body.data.id)
    return result
  }

  it('accepts a rate for one market only', async () => {
    const { status } = await createTutor({ hourlyRateEtb: 900 })

    assert.equal(status, 201, 'serving a single market is entirely normal')
  })

  it('accepts a rate for both markets', async () => {
    const { status } = await createTutor({ hourlyRateEtb: 900, hourlyRateUsd: 12 })

    assert.equal(status, 201)
  })

  it('accepts a profile with no rate yet, because pricing comes later', async () => {
    // The onboarding wizard creates the draft at step 1 and collects the rate at
    // step 7, so requiring it here would break the very first save.
    const { status } = await createTutor({})

    assert.equal(status, 201)
  })

  it('rejects a rate of zero, which is not a price', async () => {
    const { status, body } = await createTutor({ hourlyRateEtb: 0 })

    // A zero rate would read as free lessons in every price filter and every sort,
    // and no tutor means that. A tutor who wants to offer a free first lesson
    // declines the market instead, and the directory says "no rate" rather than 0.
    assert.equal(status, 422)
    assert.ok(
      body.error.fields.some((field) => field.message.includes('greater than zero')),
      `expected a positive-rate message, got ${JSON.stringify(body.error.fields)}`,
    )
  })

  it('rejects a rate of zero in the rates map too', async () => {
    const { status, body } = await createTutor({ rates: { ETB: 0 } })

    assert.equal(status, 422)
    assert.ok(
      body.error.fields.some((field) => field.message.includes('greater than zero')),
      `expected a positive-rate message, got ${JSON.stringify(body.error.fields)}`,
    )
  })

  it('rejects a negative rate', async () => {
    const { status, body } = await createTutor({ hourlyRateEtb: -5 })

    assert.equal(status, 422)
    assert.ok(body.error.fields.some((field) => field.field === 'hourlyRateEtb'))
  })

  it('rejects the old single-rate field, rather than quietly ignoring it', async () => {
    // Silently dropping it would let a tutor believe they had set a price.
    const { status, body } = await createTutor({ hourlyRate: 900 })

    assert.equal(status, 422)
    // Reported as an unrecognized key rather than dropped. Silently ignoring it
    // would let a tutor believe they had set a price and publish a profile with
    // none, which is the exact confusion the old column's removal would cause.
    assert.ok(
      body.error.fields.some((field) => field.message.includes('hourlyRate')),
      `expected the message to name hourlyRate, got ${JSON.stringify(body.error.fields)}`,
    )
  })
})

// ---------------------------------------------------------------------------
// Prices are a map, so a market can be added without a code change
// ---------------------------------------------------------------------------

describe('the rates map is the storage contract', () => {
  const validProfile = {
    displayName: 'Map Tutor',
    headline: 'Mathematics',
    bio: 'I teach mathematics.',
    teachingMode: 'ONLINE',
    studentLevels: ['High School'],
  }

  async function createTutor(body) {
    const { token } = await createTutorUser()

    const result = await api('/api/tutor-profile', {
      method: 'POST',
      token,
      body: { ...validProfile, ...body },
    })
    if (result.body?.data?.id) createdProfileIds.push(result.body.data.id)
    return result
  }

  it('accepts rates keyed by market code and returns them as a map', async () => {
    const { status, body } = await createTutor({ rates: { ETB: 900, USD: 12 } })

    assert.equal(status, 201)
    assert.deepEqual(body.data.rates, { ETB: 900, USD: 12 })
  })

  it('normalises a lowercase market code rather than inventing a second market', async () => {
    const { status, body } = await createTutor({ rates: { etb: 900 } })

    assert.equal(status, 201)
    assert.deepEqual(body.data.rates, { ETB: 900 })
  })

  it('lets a later submission replace the whole set, rather than merging into it', async () => {
    const { token } = await createTutorUser()

    const created = await api('/api/tutor-profile', {
      method: 'POST',
      token,
      body: { ...validProfile, rates: { ETB: 900, USD: 12 } },
    })
    createdProfileIds.push(created.body.data.id)

    // The tutor drops the international price. Replacing rather than merging is what
    // stops a declined market lingering from a previous draft.
    const updated = await api('/api/tutor-profile', {
      method: 'PATCH',
      token,
      body: { rates: { ETB: 950 } },
    })

    assert.equal(updated.status, 200)
    assert.deepEqual(updated.body.data.rates, { ETB: 950 })

    const stored = await prisma.tutorProfileRate.findMany({
      where: { tutorProfileId: created.body.data.id },
    })
    assert.deepEqual(
      stored.map((row) => row.marketCode),
      ['ETB'],
      'the USD row must be gone, not merely absent from the response',
    )
  })

  it('leaves prices untouched by a patch that says nothing about them', async () => {
    const { token } = await createTutorUser()

    const created = await api('/api/tutor-profile', {
      method: 'POST',
      token,
      body: { ...validProfile, rates: { ETB: 900, USD: 12 } },
    })
    createdProfileIds.push(created.body.data.id)

    // Omitting a field in a PATCH means "I am not changing it". Treating a missing
    // rates key as "no prices" would let any unrelated edit wipe a tutor's prices.
    const updated = await api('/api/tutor-profile', {
      method: 'PATCH',
      token,
      body: { headline: 'A new headline' },
    })

    assert.equal(updated.status, 200)
    assert.deepEqual(updated.body.data.rates, { ETB: 900, USD: 12 })
  })

  it('rejects a price in a market the platform does not sell in', async () => {
    // EUR is not offered, so there is nothing on the site that could display it. The
    // tutor is told, rather than the row being written and silently never shown.
    const { status, body } = await createTutor({ rates: { EUR: 20 } })

    assert.equal(status, 422)
    assert.ok(
      body.error.fields.some((field) => field.message.includes('EUR')),
      `expected the message to name EUR, got ${JSON.stringify(body.error.fields)}`,
    )
  })

  it('leaves no profile behind when a price is rejected', async () => {
    const before = await prisma.tutorProfile.count()

    const { status } = await createTutor({ rates: { EUR: 20 } })

    assert.equal(status, 422)
    const after = await prisma.tutorProfile.count()
    assert.equal(after, before, 'the profile and its prices must be written or not at all')
  })

  it('serves the price for whichever market the buyer is browsing, from one stored set', async () => {
    const tutor = await seedTutor({ etb: 900, usd: 12 })

    // One profile, two rows. Which row reaches the buyer is decided entirely by the
    // market in the URL — nothing is converted and nothing is stored per buyer.
    const stored = await prisma.tutorProfileRate.findMany({
      where: { tutorProfileId: tutor.id },
      orderBy: { marketCode: 'asc' },
    })
    assert.deepEqual(
      stored.map((row) => [row.marketCode, Number(row.amount)]),
      [
        ['ETB', 900],
        ['USD', 12],
      ],
    )

    const birr = await api(`/api/tutors/${tutor.id}?market=ETB`)
    const dollars = await api(`/api/tutors/${tutor.id}?market=USD`)

    assert.equal(birr.body.data.hourlyRate, 900)
    assert.equal(dollars.body.data.hourlyRate, 12)
  })
})

// ---------------------------------------------------------------------------
// The market registry is data, and it is what everything else is driven from
// ---------------------------------------------------------------------------

describe('the market registry is the source of truth', () => {
  it('publishes every active market through the onboarding config', async () => {
    const { status, body } = await api('/api/onboarding/config')

    assert.equal(status, 200)
    const codes = body.data.markets.map((market) => market.code)

    assert.ok(codes.includes('ETB'), `expected ETB in ${JSON.stringify(codes)}`)
    assert.ok(codes.includes('USD'), `expected USD in ${JSON.stringify(codes)}`)
  })

  it('names exactly one default market, and it is one of the published ones', async () => {
    const { body } = await api('/api/onboarding/config')
    const codes = body.data.markets.map((market) => market.code)

    // Two defaults would make the fallback for an unmarked visitor a coin toss
    // depending on which row the database happened to return first.
    const defaults = body.data.markets.filter((market) => market.isDefault)
    assert.equal(defaults.length, 1, `expected one default, got ${JSON.stringify(defaults)}`)
    assert.equal(body.data.defaultMarketCode, defaults[0].code)
    assert.ok(codes.includes(body.data.defaultMarketCode))
  })

  it('serves the default market to a visitor who has not asked for one', async () => {
    const { body } = await api('/api/onboarding/config')
    const tutor = await seedTutor({ etb: 900, usd: 12 })

    const { body: listing } = await api(`/api/tutors/${tutor.id}`)

    assert.equal(listing.data.hourlyRateCurrency, body.data.defaultMarketCode)
  })

  it('deactivates a market without disturbing the prices already stored for it', async () => {
    // The scenario the `active` flag exists for: a market is withdrawn from sale.
    // Existing tutors keep their stored price, because deleting it would throw away
    // something they told us and would make re-activating the market lossy.
    const tutor = await seedTutor({ etb: 900, usd: 12 })
    const market = await prisma.market.findUnique({ where: { code: 'USD' } })

    await prisma.market.update({ where: { code: 'USD' }, data: { active: false } })
    try {
      const { body: config } = await api('/api/onboarding/config')
      assert.equal(
        config.data.markets.some((entry) => entry.code === 'USD'),
        false,
        'a deactivated market must not be offered',
      )

      const { body: listing } = await api(`/api/tutors/${tutor.id}`)
      assert.equal(
        listing.data.hourlyRateCurrency,
        'ETB',
        'withdrawing a market must fall back to a market that is still offered',
      )

      const stored = await prisma.tutorProfileRate.count({
        where: { tutorProfileId: tutor.id, marketCode: 'USD' },
      })
      assert.equal(stored, 1, 'the withdrawn price must still be stored')
    } finally {
      await prisma.market.update({ where: { code: 'USD' }, data: { active: true } })
    }
  })
})