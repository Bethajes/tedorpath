/**
 * GET /api/onboarding/config — the wizard's reference data.
 *
 * The wizard derives the budget currency, the scheduling timezone, the education
 * levels and the suggested subjects from what this endpoint returns, so these
 * tests are about the endpoint being genuinely configurable rather than about a
 * hardcoded list happening to look right.
 *
 * Runs against the real Express app and PostgreSQL database.
 */

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { createApp } from '../src/app.js'
import { closePrisma, prisma } from '../src/lib/prisma.js'

let server
let baseUrl

// Everything the tests insert, so the shared database is left as they found it.
const createdCountryIds = []
const createdLevelIds = []
const createdSystemIds = []
const createdCurrencyCodes = []

before(async () => {
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  // Reverse dependency order.
  if (createdLevelIds.length) await prisma.educationLevel.deleteMany({ where: { id: { in: createdLevelIds } } })
  if (createdCountryIds.length) await prisma.country.deleteMany({ where: { id: { in: createdCountryIds } } })
  if (createdSystemIds.length) await prisma.educationSystem.deleteMany({ where: { id: { in: createdSystemIds } } })
  if (createdCurrencyCodes.length) await prisma.currency.deleteMany({ where: { code: { in: createdCurrencyCodes } } })
  await new Promise((resolve) => server.close(resolve))
  await closePrisma()
})

async function api(path) {
  const response = await fetch(`${baseUrl}${path}`)
  return { status: response.status, body: await response.json() }
}

const getConfig = () => api('/api/onboarding/config')

/** A currency that cannot collide with a seeded one. */
async function createCurrency(code, name) {
  await prisma.currency.create({ data: { code, name, symbol: code, sortOrder: 9999 } })
  createdCurrencyCodes.push(code)
  return code
}

/** An education system with no countries pointing at it, so it is reachable. */
async function createSystem(code) {
  const system = await prisma.educationSystem.create({ data: { code, name: `System ${code}` } })
  createdSystemIds.push(system.id)
  return system
}

// ---------------------------------------------------------------------------
// Shape and authentication
// ---------------------------------------------------------------------------

describe('GET /api/onboarding/config', () => {
  it('is reachable without authentication', async () => {
    const { status } = await getConfig()
    assert.equal(status, 200, 'the wizard is the first thing an anonymous visitor sees')
  })

  it('returns every part the wizard needs in one response', async () => {
    const { body } = await getConfig()

    assert.equal(body.success, true)
    for (const key of [
      'currencies',
      'countries',
      'educationSystems',
      'learningGoals',
      'subjects',
      'timezones',
    ]) {
      assert.ok(Array.isArray(body.data[key]), `${key} should be a list`)
    }
  })

  it('answers an unknown sub-path with the standard error envelope', async () => {
    const { status, body } = await api('/api/onboarding/nope')

    assert.equal(status, 404)
    assert.equal(body.error.code, 'NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
// Countries drive currency, timezone and curriculum
// ---------------------------------------------------------------------------

describe('country configuration', () => {
  it('gives Ethiopia its own curriculum and its own currency', async () => {
    const { body } = await getConfig()
    const ethiopia = body.data.countries.find((country) => country.code === 'ET')

    assert.ok(ethiopia, 'Ethiopia should be in the list')
    assert.equal(ethiopia.currencyCode, 'ETB')
    assert.equal(ethiopia.timezone, 'Africa/Addis_Ababa')
    assert.equal(ethiopia.educationSystemCode, 'ETH')

    const system = body.data.educationSystems.find((s) => s.code === 'ETH')
    assert.ok(system)
    assert.ok(
      system.levels.some((level) => level.code === 'eth-grade-9-10'),
      'the Ethiopian curriculum should be Ethiopian grades, not generic ones',
    )
  })

  it('gives international countries the generic curriculum and no Ethiopian grades', async () => {
    const { body } = await getConfig()

    for (const code of ['US', 'GB', 'KE']) {
      const country = body.data.countries.find((entry) => entry.code === code)
      assert.ok(country, `${code} should be in the list`)

      const system = body.data.educationSystems.find((s) => s.code === country.educationSystemCode)
      assert.ok(system)
      assert.ok(
        !system.levels.some((level) => level.code.startsWith('eth-')),
        `${code} must not be offered Ethiopian grades`,
      )
      assert.ok(
        system.levels.some((level) => level.code === 'int-high'),
        `${code} should be offered the generic High School level`,
      )
    }
  })

  it('lists the currency each country points at', async () => {
    const { body } = await getConfig()
    const codes = new Set(body.data.currencies.map((currency) => currency.code))

    for (const country of body.data.countries) {
      assert.ok(
        codes.has(country.currencyCode),
        `${country.code} points at ${country.currencyCode}, which is not in the currency list`,
      )
    }
  })

  it('lists the timezone each country points at', async () => {
    const { body } = await getConfig()

    for (const country of body.data.countries) {
      assert.ok(
        body.data.timezones.includes(country.timezone),
        `${country.timezone} should be offered as a suggestion`,
      )
    }
  })

  it('carries a currency name and symbol for every currency it offers', async () => {
    const { body } = await getConfig()

    for (const currency of body.data.currencies) {
      assert.match(currency.code, /^[A-Z]{3}$/, 'currency codes are ISO 4217')
      assert.ok(currency.name.length > 0)
      assert.ok(currency.symbol.length > 0, 'the budget field shows a symbol')
      assert.ok(currency.decimals >= 0 && currency.decimals <= 4)
    }
  })
})

// ---------------------------------------------------------------------------
// Education levels are configurable, not hardcoded
// ---------------------------------------------------------------------------

describe('education level configuration', () => {
  it('suggests subjects per level, and only real subjects', async () => {
    const { body } = await getConfig()
    const subjectIds = new Set(body.data.subjects.map((subject) => subject.id))

    const ethiopian = body.data.educationSystems.find((s) => s.code === 'ETH')
    const senior = ethiopian.levels.find((level) => level.code === 'eth-grade-9-10')

    assert.ok(senior.subjectIds.length > 0, 'a level should suggest subjects')
    for (const id of senior.subjectIds) {
      assert.ok(subjectIds.has(id), `suggested subject ${id} is not in the catalogue`)
    }
  })

  it('suggests different subjects for different levels', async () => {
    const { body } = await getConfig()
    const system = body.data.educationSystems.find((s) => s.code === 'ETH')

    const primary = system.levels.find((level) => level.code === 'eth-grade-1-3')
    const university = system.levels.find((level) => level.code === 'eth-university')

    const overlap = primary.subjectIds.filter((id) => university.subjectIds.includes(id))
    assert.ok(
      primary.subjectIds.length > 0 && university.subjectIds.length > 0,
      'both levels should suggest subjects',
    )
    assert.ok(
      overlap.length < Math.min(primary.subjectIds.length, university.subjectIds.length),
      'suggestions should be contextual to the level, not identical everywhere',
    )
  })

  it('orders levels within a system', async () => {
    const { body } = await getConfig()

    for (const system of body.data.educationSystems) {
      assert.ok(system.levels.length > 0, `${system.code} should define levels`)
    }
  })

  it('omits a deactivated level from the picker', async () => {
    const system = await createSystem('TST_OFF')
    const level = await prisma.educationLevel.create({
      data: {
        code: 'tst-off-level',
        name: 'Switched Off Level',
        stage: 'Test',
        educationSystemId: system.id,
        sortOrder: 0,
        active: false,
      },
    })
    createdLevelIds.push(level.id)

    const { body } = await getConfig()
    const returned = body.data.educationSystems.find((s) => s.code === 'TST_OFF')

    assert.ok(
      !returned.levels.some((entry) => entry.code === 'tst-off-level'),
      'an inactive level must not be offered and then rejected on submit',
    )
  })

  it('picks up a level added after deployment, with no code change', async () => {
    // The point of the whole design: curriculum is data.
    const system = await createSystem('TST_NEW')
    const level = await prisma.educationLevel.create({
      data: {
        code: 'tst-new-level',
        name: 'Brand New Stage',
        stage: 'Test',
        educationSystemId: system.id,
        sortOrder: 0,
        aliases: ['Legacy Wording'],
      },
    })
    createdLevelIds.push(level.id)

    const { body } = await getConfig()
    const returned = body.data.educationSystems.find((s) => s.code === 'TST_NEW')

    assert.equal(returned.levels.length, 1)
    assert.equal(returned.levels[0].name, 'Brand New Stage')
    assert.deepEqual(returned.levels[0].aliases, ['Legacy Wording'])
  })
})

// ---------------------------------------------------------------------------
// Countries are configurable, not hardcoded
// ---------------------------------------------------------------------------

describe('country configuration is data, not code', () => {
  it('picks up a country added after deployment', async () => {
    const code = 'ZZ'
    await createCurrency('ZZD', 'Test Dollar')

    const system = await prisma.educationSystem.findFirst({ select: { id: true } })
    const country = await prisma.country.create({
      data: {
        code,
        name: 'Zzzland',
        currencyCode: 'ZZD',
        timezone: 'UTC',
        educationSystemId: system.id,
        sortOrder: 9999,
      },
    })
    createdCountryIds.push(country.id)

    const { body } = await getConfig()
    const added = body.data.countries.find((entry) => entry.code === code)

    assert.ok(added, 'a new country must appear without a deploy')
    assert.equal(added.currencyCode, 'ZZD')
    assert.ok(body.data.timezones.includes('UTC'))
  })

  it('omits a deactivated country', async () => {
    const code = 'ZY'
    await createCurrency('ZYD', 'Test Dinar')

    const system = await prisma.educationSystem.findFirst({ select: { id: true } })
    const country = await prisma.country.create({
      data: {
        code,
        name: 'Zzyland',
        currencyCode: 'ZYD',
        timezone: 'UTC',
        educationSystemId: system.id,
        active: false,
        sortOrder: 9998,
      },
    })
    createdCountryIds.push(country.id)

    const { body } = await getConfig()
    assert.ok(!body.data.countries.some((entry) => entry.code === code))
  })
})

// ---------------------------------------------------------------------------
// Subjects and goals
// ---------------------------------------------------------------------------

describe('subjects and learning goals', () => {
  it('offers the catalogue with a category and a description', async () => {
    const { body } = await getConfig()

    assert.ok(body.data.subjects.length > 0)
    for (const subject of body.data.subjects) {
      assert.ok(subject.name.length > 0)
      assert.ok(subject.category.length > 0)
    }
  })

  it('omits a deactivated subject from the catalogue', async () => {
    const slug = `tst-retired-${crypto.randomUUID().slice(0, 8)}`
    const subject = await prisma.subject.create({
      data: {
        name: 'Retired Subject',
        slug,
        category: 'Test',
        active: false,
      },
    })

    try {
      const { body } = await getConfig()
      assert.ok(!body.data.subjects.some((entry) => entry.slug === slug))
    } finally {
      await prisma.subject.delete({ where: { id: subject.id } })
    }
  })

  it('offers a learning goal list in a defined order', async () => {
    const { body } = await getConfig()

    assert.ok(body.data.learningGoals.length > 0)
    const codes = body.data.learningGoals.map((goal) => goal.code)
    assert.ok(codes.includes('exam-preparation'), 'the goals the product promises should be listed')
    assert.ok(codes.includes('other'), 'a client must always be able to say something else')
  })

  it('exposes no database ids in the configuration', async () => {
    // The browser addresses configuration by stable codes. Leaking uuids would
    // tie stored requests to rows an operator could later reseed.
    const { body } = await getConfig()

    for (const country of body.data.countries) {
      assert.equal(country.id, undefined)
      assert.ok(!('educationSystemId' in country))
    }
    for (const system of body.data.educationSystems) {
      assert.equal(system.id, undefined)
      for (const level of system.levels) {
        assert.equal(level.id, undefined)
      }
    }
  })
})