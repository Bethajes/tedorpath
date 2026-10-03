/**
 * POST /api/tutor-requests — the adaptive wizard's request shape.
 *
 * The wizard is a different client from the single-page form that preceded it:
 * it sends identifiers from the database-driven catalogue, several subjects
 * instead of one, and a budget as an amount plus a currency. These tests cover
 * that shape, and just as importantly cover that the old shape still works —
 * a bookmarked tab or a cached bundle is a real deployment condition, not a
 * hypothetical.
 *
 * Runs against the real Express app and PostgreSQL database.
 */

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { createApp } from '../src/app.js'
import { closePrisma, prisma } from '../src/lib/prisma.js'

let server
let baseUrl

const createdRequestIds = []

// Real rows read from the seeded configuration, so the tests assert against
// what the product actually offers rather than a hand-built fixture.
let ethiopia
let ethiopianLevel
let internationalLevel
let subjects
let otherSubject

before(async () => {
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`

  ethiopia = await prisma.country.findUnique({ where: { code: 'ET' } })
  ethiopianLevel = await prisma.educationLevel.findUnique({
    where: { code: 'eth-grade-9-10' },
  })
  internationalLevel = await prisma.educationLevel.findUnique({
    where: { code: 'int-high' },
  })

  const catalogue = await prisma.subject.findMany({ orderBy: { name: 'asc' } })
  subjects = catalogue
  otherSubject = catalogue.find((subject) => subject.name === 'Other')

  assert.ok(ethiopia && ethiopianLevel && internationalLevel, 'run `npm run db:seed` first')
})

after(async () => {
  if (createdRequestIds.length) {
    await prisma.tutorRequest.deleteMany({ where: { id: { in: createdRequestIds } } })
  }
  await new Promise((resolve) => server.close(resolve))
  await closePrisma()
})

async function submit(body) {
  const response = await fetch(`${baseUrl}/api/tutor-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  const parsed = text ? JSON.parse(text) : null
  if (parsed?.success) createdRequestIds.push(parsed.data.id)
  return { status: response.status, body: parsed }
}

/** The contact details every request needs, whatever shape the rest takes. */
const CONTACT = {
  fullName: 'Bethel Ayele',
  phone: '+251911234567',
  telegram: '@bethel',
  email: 'bethel@example.com',
  learningMode: 'Online',
  helpDescription: 'I need help with quadratic equations before my Grade 10 exam.',
}

/** A full wizard submission: identifiers, several subjects, split budget. */
function wizardRequest(overrides = {}) {
  return {
    ...CONTACT,
    subjectIds: subjects.slice(0, 3).map((subject) => subject.id),
    educationLevelCode: ethiopianLevel.code,
    countryCode: ethiopia.code,
    timezone: 'Africa/Addis_Ababa',
    learningGoal: 'exam-preparation',
    preferredLocation: 'Addis Ababa',
    preferredDayNames: ['Monday', 'Wednesday', 'Friday'],
    preferredTimeRanges: ['16:00–18:00', '19:00–20:00'],
    budgetAmount: 400,
    budgetCurrency: ethiopia.currencyCode,
    additionalInfo: 'I would prefer a tutor who speaks Amharic.',
    ...overrides,
  }
}

/** The stored row, with its subjects resolved. */
function stored(id) {
  return prisma.tutorRequest.findUnique({
    where: { id },
    include: { subjects: { include: { subject: true } } },
  })
}

// ---------------------------------------------------------------------------
// The wizard's own shape
// ---------------------------------------------------------------------------

describe('POST /api/tutor-requests (wizard shape)', () => {
  it('accepts a request that identifies its subjects by id', async () => {
    const { status, body } = await submit(wizardRequest())

    assert.equal(status, 201)
    assert.equal(body.success, true)

    const request = await stored(body.data.id)
    assert.equal(request.subjects.length, 3, 'every selected subject should be linked')
    assert.equal(
      request.subject,
      subjects
        .slice(0, 3)
        .map((subject) => subject.name)
        .join(', '),
      'the readable summary should be composed from the chosen subjects',
    )
  })

  it('stores the country, timezone and education level code as given', async () => {
    const { body } = await submit(wizardRequest())
    const request = await stored(body.data.id)

    assert.equal(request.countryCode, 'ET')
    assert.equal(request.timezone, 'Africa/Addis_Ababa')
    assert.equal(request.educationLevelCode, 'eth-grade-9-10')
    assert.equal(request.educationLevel, 'Grades 9–10', 'the label is resolved, not sent by the client')
  })

  it('stores the budget as an amount and a currency, and never as one alone', async () => {
    const { body } = await submit(wizardRequest({ budgetAmount: 750.5 }))
    const request = await stored(body.data.id)

    assert.equal(Number(request.budgetAmount), 750.5)
    assert.equal(request.budgetCurrency, 'ETB')
    assert.equal(request.budget, '750.5 ETB', 'the readable summary carries both')
  })

  it('accepts a budget in a currency other than the country default', async () => {
    // A client in Ethiopia may be paying a tutor abroad. Nothing here converts;
    // it stores what they said.
    const { body } = await submit(wizardRequest({ budgetAmount: 120, budgetCurrency: 'USD' }))
    const request = await stored(body.data.id)

    assert.equal(request.budgetCurrency, 'USD')
    assert.equal(request.budget, '120 USD')
  })

  it('rejects an amount with no currency beside it', async () => {
    const { budgetCurrency, ...withoutCurrency } = wizardRequest()
    const { status, body } = await submit(withoutCurrency)

    assert.equal(status, 400)
    assert.equal(body.error.code, 'VALIDATION_ERROR')
    assert.ok(
      body.error.fields.some((field) => field.field === 'budgetCurrency'),
      'the missing currency should be named',
    )
  })

  it('never stores an exchange rate or a converted amount', async () => {
    const { body } = await submit(wizardRequest({ budgetAmount: 400, budgetCurrency: 'ETB' }))
    const request = await stored(body.data.id)

    // The stored amount is exactly what was typed. Anything else would mean the
    // server had decided what the client's money was worth.
    assert.equal(Number(request.budgetAmount), 400)
  })

  it('composes the availability sentences the admin screens read', async () => {
    const { body } = await submit(wizardRequest())
    const request = await stored(body.data.id)

    assert.deepEqual(request.preferredDayNames, ['Monday', 'Wednesday', 'Friday'])
    assert.equal(request.preferredDays, 'Monday, Wednesday and Friday')
    assert.deepEqual(request.preferredTimeRanges, ['16:00–18:00', '19:00–20:00'])
    assert.equal(request.preferredTime, '16:00–18:00 and 19:00–20:00')
  })

  it('stores the learning goal and the other-subject wording', async () => {
    const { body } = await submit(
      wizardRequest({
        subjectIds: [otherSubject.id, subjects[0].id],
        subjectOther: 'Environmental Economics',
        learningGoal: 'skill-development',
      }),
    )
    const request = await stored(body.data.id)

    assert.equal(request.learningGoal, 'skill-development')
    assert.equal(request.subjectOther, 'Environmental Economics')
  })

  it('still returns only the new id, never the personal data it was given', async () => {
    const { body } = await submit(wizardRequest())
    assert.deepEqual(Object.keys(body.data), ['id'])
  })
})

// ---------------------------------------------------------------------------
// Referential integrity — an option that no longer exists
// ---------------------------------------------------------------------------

describe('POST /api/tutor-requests (stale references)', () => {
  it('rejects a subject id that names nothing', async () => {
    const { status, body } = await submit(
      wizardRequest({ subjectIds: [crypto.randomUUID()] }),
    )

    assert.equal(status, 400)
    assert.equal(body.error.code, 'VALIDATION_ERROR')
    assert.ok(body.error.fields.some((field) => field.field === 'subjectIds'))
  })

  it('rejects an education level code that names nothing', async () => {
    const { status, body } = await submit(wizardRequest({ educationLevelCode: 'made-up-level' }))

    assert.equal(status, 400)
    assert.ok(body.error.fields.some((field) => field.field === 'educationLevelCode'))
  })

  it('rejects a country code that names nothing', async () => {
    const { status, body } = await submit(wizardRequest({ countryCode: 'ZZ' }))

    assert.equal(status, 400)
    assert.ok(body.error.fields.some((field) => field.field === 'countryCode'))
  })

  it('rejects a learning goal that is not in the catalogue', async () => {
    const { status, body } = await submit(wizardRequest({ learningGoal: 'invented-goal' }))

    assert.equal(status, 400)
    assert.ok(body.error.fields.some((field) => field.field === 'learningGoal'))
  })

  it('rejects a timezone the runtime does not recognise', async () => {
    const { status, body } = await submit(wizardRequest({ timezone: 'Mars/Olympus_Mons' }))

    assert.equal(status, 400)
    assert.ok(body.error.fields.some((field) => field.field === 'timezone'))
  })

  it('stores nothing when a reference is rejected', async () => {
    const fullName = `Stale Reference ${crypto.randomUUID()}`
    await submit(wizardRequest({ fullName, countryCode: 'ZZ' }))

    // Scoped to this request's name rather than a global count: the suites share
    // one database and run concurrently.
    const stored_ = await prisma.tutorRequest.count({ where: { fullName } })
    assert.equal(stored_, 0, 'a rejected request must not leave a row behind')
  })

  it('stores nothing when one of several subject ids is bogus', async () => {
    const fullName = `Partial Subjects ${crypto.randomUUID()}`
    const { status } = await submit(
      wizardRequest({ fullName, subjectIds: [subjects[0].id, crypto.randomUUID()] }),
    )

    assert.equal(status, 400)
    assert.equal(await prisma.tutorRequest.count({ where: { fullName } }), 0)
  })

  it('accepts an international level from a different education system', async () => {
    // The client is in Ethiopia but studying the generic curriculum — or the
    // other way round. Both are legal; the wizard just offers what the country
    // configures.
    const { status, body } = await submit(wizardRequest({ educationLevelCode: internationalLevel.code }))
    const request = await stored(body.data.id)

    assert.equal(status, 201)
    assert.equal(request.educationLevel, internationalLevel.name)
  })
})

// ---------------------------------------------------------------------------
// Backward compatibility — the original single-page form
// ---------------------------------------------------------------------------

describe('POST /api/tutor-requests (original form still works)', () => {
  const legacyRequest = {
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

  it('accepts the exact body the old form sent', async () => {
    const { status, body } = await submit(legacyRequest)

    assert.equal(status, 201)
    assert.equal(body.success, true)
  })

  it('stores every pre-existing field exactly as before', async () => {
    const { body } = await submit(legacyRequest)
    const request = await stored(body.data.id)

    assert.equal(request.fullName, 'Abel Tesfaye')
    assert.equal(request.phone, '0912345678')
    assert.equal(request.telegramUsername, '@abel')
    assert.equal(request.email, 'abel@example.com')
    assert.equal(request.subject, 'Mathematics')
    assert.equal(request.educationLevel, 'University')
    assert.equal(request.learningMode, 'Online')
    assert.equal(request.description, 'I need help with calculus for my exam.')
    assert.equal(request.location, 'Downtown')
    assert.equal(request.preferredDays, 'Monday')
    assert.equal(request.preferredTime, 'Evening')
    assert.equal(request.budget, '$20 per hour', 'a free-text budget is kept verbatim')
  })

  it('leaves the wizard columns null rather than inventing values for them', async () => {
    const { body } = await submit(legacyRequest)
    const request = await stored(body.data.id)

    assert.equal(request.countryCode, null)
    assert.equal(request.timezone, null)
    assert.equal(request.educationLevelCode, null)
    assert.equal(request.learningGoal, null)
    assert.equal(request.budgetAmount, null)
    assert.equal(request.budgetCurrency, null)
    assert.deepEqual(request.preferredDayNames, [])
    assert.deepEqual(request.preferredTimeRanges, [])
    assert.equal(request.subjects.length, 0, 'no ids were sent, so no rows are invented')
  })

  it('still rejects a body with no subject at all', async () => {
    const { subject, ...withoutSubject } = legacyRequest
    const { status, body } = await submit(withoutSubject)

    assert.equal(status, 400)
    assert.ok(body.error.fields.some((field) => field.field === 'subjectIds'))
  })

  it('still rejects a body with no education level', async () => {
    const { educationLevel, ...withoutLevel } = legacyRequest
    const { status, body } = await submit(withoutLevel)

    assert.equal(status, 400)
    assert.ok(body.error.fields.some((field) => field.field === 'educationLevelCode'))
  })

  it('still rejects unknown fields rather than discarding them', async () => {
    const { status, body } = await submit({ ...legacyRequest, somethingElse: 'nope' })

    assert.equal(status, 400)
    assert.equal(body.error.code, 'VALIDATION_ERROR')
  })

  it('still rejects an unsupported learning mode', async () => {
    const { status } = await submit({ ...legacyRequest, learningMode: 'By Carrier Pigeon' })

    assert.equal(status, 400)
  })

  it('now accepts a subject the old allow-list never contained', async () => {
    // Subjects are database-driven, so adding one to the catalogue must not
    // require editing a constant in two codebases.
    const { status, body } = await submit({ ...legacyRequest, subject: 'Environmental Economics' })

    assert.equal(status, 201)
    const request = await stored(body.data.id)
    assert.equal(request.subject, 'Environmental Economics')
  })
})