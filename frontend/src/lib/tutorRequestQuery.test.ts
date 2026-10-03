import { describe, expect, it } from 'vitest'

import { buildTutorRequestHref, parseTutorRequestPrefill } from './tutorRequestQuery'
import { buildWizardSchema, toRequestPayload } from '@/features/tutorRequest/tutorRequest.schema'
import { EMPTY_FORM_VALUES, type WizardFormValues } from '@/features/tutorRequest/tutorRequest.steps'
import type { OnboardingConfig } from '@/features/tutorRequest/tutorRequest.config'

/**
 * The chosen tutor has to survive the trip from a profile page to the stored
 * request.
 *
 * It used to be dropped in two places — nothing read `?tutorId=`, and the
 * schema had no field for it — so a client who deliberately chose a tutor
 * produced a request indistinguishable from one typed in cold. These cover the
 * two places the value is parsed, because either one losing it loses the whole
 * feature.
 */

const TUTOR_ID = 'a52b1a0f-03d2-48dc-8eca-8aa22f00a47c'

describe('parseTutorRequestPrefill — the chosen tutor', () => {
  it('reads a valid tutorId', () => {
    const prefill = parseTutorRequestPrefill(`?tutorId=${TUTOR_ID}`)

    expect(prefill.tutorProfileId).toBe(TUTOR_ID)
  })

  it('is empty when no tutor was chosen', () => {
    expect(parseTutorRequestPrefill('').tutorProfileId).toBe('')
    expect(parseTutorRequestPrefill('?subject=Mathematics').tutorProfileId).toBe('')
  })

  it('ignores a hand-edited id that is not a UUID', () => {
    // A hand-edited URL must not be able to seed the form with something the API
    // would reject on submit, after the client has already typed everything.
    for (const bad of ['not-a-uuid', '123', '../../etc/passwd', `${TUTOR_ID} OR 1=1`]) {
      expect(parseTutorRequestPrefill(`?tutorId=${encodeURIComponent(bad)}`).tutorProfileId).toBe('')
    }
  })

  it('carries the tutor alongside the other preferences', () => {
    const prefill = parseTutorRequestPrefill(
      `?tutorId=${TUTOR_ID}&subject=Mathematics&level=University&mode=Online`,
    )

    expect(prefill).toEqual({
      tutorProfileId: TUTOR_ID,
      subject: 'Mathematics',
      educationLevel: 'University',
      learningMode: 'Online',
    })
  })

  it('does not let a bad tutor id stop the other values being read', () => {
    const prefill = parseTutorRequestPrefill('?tutorId=nope&subject=Physics&level=High%20School')

    expect(prefill.tutorProfileId).toBe('')
    expect(prefill.subject).toBe('Physics')
    expect(prefill.educationLevel).toBe('High School')
  })
})

describe('parseTutorRequestPrefill — database-driven options', () => {
  it('accepts a subject that is not in any hardcoded list', () => {
    // Subjects live in the database now, so the parser cannot decide what a valid
    // subject name is. It bounds the value and lets the wizard resolve it.
    const prefill = parseTutorRequestPrefill('?subject=Environmental%20Economics')

    expect(prefill.subject).toBe('Environmental Economics')
  })

  it('accepts a level that is not in any hardcoded list', () => {
    expect(parseTutorRequestPrefill('?level=Grades%209%E2%80%9310').educationLevel).toBe(
      'Grades 9–10',
    )
  })

  it('discards a blank or absurdly long value rather than carrying it', () => {
    expect(parseTutorRequestPrefill('?subject=').subject).toBe('')
    expect(parseTutorRequestPrefill(`?subject=${'x'.repeat(200)}`).subject).toBe('')
  })

  it('still rejects a teaching mode that is not one of the three', () => {
    // Delivery methods are a closed list — they are not catalogue content, and
    // the stored column is grouped on by the admin filters.
    expect(parseTutorRequestPrefill('?mode=Carrier%20Pigeon').learningMode).toBe('')
    expect(parseTutorRequestPrefill('?mode=In-person').learningMode).toBe('In-person')
  })
})

describe('buildTutorRequestHref', () => {
  it('omits a preference that was not chosen', () => {
    expect(buildTutorRequestHref({})).toBe('/request-tutor')
    expect(buildTutorRequestHref({ subject: '' })).toBe('/request-tutor')
  })

  it('includes the preferences that were chosen', () => {
    expect(buildTutorRequestHref({ subject: 'Physics' })).toBe(
      '/request-tutor?subject=Physics',
    )
  })

  it('omits an unsupported teaching mode but keeps the rest of the link', () => {
    const href = buildTutorRequestHref({
      subject: 'Physics',
      educationLevel: 'University',
      learningMode: 'Carrier Pigeon',
    })

    expect(href).toBe('/request-tutor?subject=Physics&level=University')
  })
})

/** A configuration small enough to reason about, shaped like the real response. */
const config: OnboardingConfig = {
  currencies: [
    { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br', decimals: 2 },
    { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  ],
  countries: [
    {
      code: 'ET',
      name: 'Ethiopia',
      currencyCode: 'ETB',
      timezone: 'Africa/Addis_Ababa',
      educationSystemCode: 'ETH',
    },
    {
      code: 'US',
      name: 'United States',
      currencyCode: 'USD',
      timezone: 'America/New_York',
      educationSystemCode: 'INT',
    },
  ],
  educationSystems: [
    {
      code: 'INT',
      name: 'International (general)',
      description: null,
      levels: [
        { code: 'int-high', name: 'High School', stage: 'Senior Secondary', aliases: ['Senior Secondary'], subjectIds: ['sub-english'] },
      ],
    },
    {
      code: 'ETH',
      name: 'Ethiopian education system',
      description: null,
      levels: [
        {
          code: 'eth-grade-9-10',
          name: 'Grades 9–10',
          stage: 'Senior Secondary',
          aliases: ['Grade 9'],
          subjectIds: ['sub-maths', 'sub-physics'],
        },
      ],
    },
  ],
  learningGoals: [
    { code: 'exam-preparation', name: 'Exam preparation', description: null },
    { code: 'other', name: 'Something else', description: null },
  ],
  subjects: [
    { id: 'sub-maths', name: 'Mathematics', slug: 'mathematics', category: 'School Subjects', description: null },
    { id: 'sub-physics', name: 'Physics', slug: 'physics', category: 'School Subjects', description: null },
    { id: 'sub-english', name: 'English', slug: 'english', category: 'School Subjects', description: null },
    { id: 'sub-other', name: 'Other', slug: 'other', category: 'Other', description: null },
  ],
  timezones: ['Africa/Addis_Ababa', 'America/New_York'],
}

/** A complete, valid answer set. Individual tests override one field at a time. */
function complete(): WizardFormValues {
  return {
    ...EMPTY_FORM_VALUES,
    countryCode: 'ET',
    educationLevelCode: 'eth-grade-9-10',
    subjectIds: ['sub-maths'],
    learningGoal: 'exam-preparation',
    learningMode: 'Online',
    timezone: 'Africa/Addis_Ababa',
    budgetAmount: '450',
    budgetCurrency: 'ETB',
    helpDescription: 'I am struggling with quadratic equations before my exam.',
    fullName: 'Bethel Berihun',
    phone: '0912345678',
  }
}

describe('buildWizardSchema — the chosen tutor', () => {
  const schema = buildWizardSchema(config)

  it('accepts a UUID', () => {
    expect(schema.safeParse({ ...complete(), tutorProfileId: TUTOR_ID }).success).toBe(true)
  })

  it('accepts an absent or empty value, because most people pick no tutor', () => {
    expect(schema.safeParse(complete()).success).toBe(true)
    expect(schema.safeParse({ ...complete(), tutorProfileId: '' }).success).toBe(true)
  })

  it('rejects a malformed id rather than sending it to the API', () => {
    expect(schema.safeParse({ ...complete(), tutorProfileId: 'nope' }).success).toBe(false)
  })
})

describe('buildWizardSchema — the configuration is the authority', () => {
  const schema = buildWizardSchema(config)

  it('rejects a country, level, subject, goal or currency the catalogue lacks', () => {
    expect(schema.safeParse({ ...complete(), countryCode: 'ZZ' }).success).toBe(false)
    expect(schema.safeParse({ ...complete(), educationLevelCode: 'made-up' }).success).toBe(false)
    expect(schema.safeParse({ ...complete(), subjectIds: ['sub-ghost'] }).success).toBe(false)
    expect(schema.safeParse({ ...complete(), learningGoal: 'invented' }).success).toBe(false)
    expect(schema.safeParse({ ...complete(), budgetCurrency: 'ZZZ' }).success).toBe(false)
  })

  it('accepts any timezone the runtime recognises, not only the ones suggested', () => {
    // Someone in Ethiopia may be sitting in Dublin. Refusing their timezone would
    // store the wrong one silently.
    expect(schema.safeParse({ ...complete(), timezone: 'Europe/Dublin' }).success).toBe(true)
    expect(schema.safeParse({ ...complete(), timezone: 'Mars/Olympus_Mons' }).success).toBe(false)
  })
})

describe('buildWizardSchema — rules that depend on other answers', () => {
  const schema = buildWizardSchema(config)

  it('requires a location when a tutor could turn up in a room', () => {
    for (const mode of ['In-person', 'Either']) {
      const result = schema.safeParse({ ...complete(), learningMode: mode })
      expect(result.success).toBe(false)
      expect(result.error?.issues.some((issue) => issue.path.includes('preferredLocation'))).toBe(
        true,
      )
    }
  })

  it('does not require a location for online lessons', () => {
    expect(schema.safeParse({ ...complete(), learningMode: 'Online' }).success).toBe(true)
  })

  it('requires wording behind the "Other" subject', () => {
    const withoutText = schema.safeParse({ ...complete(), subjectIds: ['sub-other'] })
    expect(withoutText.success).toBe(false)

    const withText = schema.safeParse({
      ...complete(),
      subjectIds: ['sub-other'],
      subjectOther: 'Environmental Economics',
    })
    expect(withText.success).toBe(true)
  })

  it('requires wording behind the "Something else" goal', () => {
    expect(schema.safeParse({ ...complete(), learningGoal: 'other' }).success).toBe(false)
    expect(
      schema.safeParse({
        ...complete(),
        learningGoal: 'other',
        learningGoalOther: 'I want to learn to sail.',
      }).success,
    ).toBe(true)
  })

  it('never accepts a budget amount without a currency', () => {
    const result = schema.safeParse({ ...complete(), budgetCurrency: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((issue) => issue.path.includes('budgetCurrency'))).toBe(true)
  })

  it('accepts no budget at all', () => {
    expect(schema.safeParse({ ...complete(), budgetAmount: '', budgetCurrency: '' }).success).toBe(
      true,
    )
  })

  it('rejects a half-finished time range', () => {
    const half = schema.safeParse({
      ...complete(),
      preferredTimeRanges: [{ id: 'range-1', start: '16:00', end: '' }],
    })
    expect(half.success).toBe(false)

    const backwards = schema.safeParse({
      ...complete(),
      preferredTimeRanges: [{ id: 'range-1', start: '18:00', end: '16:00' }],
    })
    expect(backwards.success).toBe(false)

    const whole = schema.safeParse({
      ...complete(),
      preferredTimeRanges: [{ id: 'range-1', start: '16:00', end: '18:00' }],
    })
    expect(whole.success).toBe(true)
  })

  it('allows several subjects', () => {
    expect(
      schema.safeParse({ ...complete(), subjectIds: ['sub-maths', 'sub-physics', 'sub-english'] })
        .success,
    ).toBe(true)
  })

  it('requires at least one subject', () => {
    expect(schema.safeParse({ ...complete(), subjectIds: [] }).success).toBe(false)
  })
})

describe('toRequestPayload', () => {
  it('sends the amount and the currency as two separate fields', () => {
    const payload = toRequestPayload(complete())

    expect(payload.budgetAmount).toBe(450)
    expect(payload.budgetCurrency).toBe('ETB')
  })

  it('never sends an amount whose currency is missing', () => {
    const payload = toRequestPayload({ ...complete(), budgetAmount: '450', budgetCurrency: '' })

    expect(payload.budgetAmount).toBeUndefined()
    expect(payload.budgetCurrency).toBeUndefined()
  })

  it('omits blank optional fields instead of sending empty strings', () => {
    const payload = toRequestPayload(complete())

    for (const key of ['telegram', 'email', 'subjectOther', 'additionalInfo', 'preferredLocation', 'tutorProfileId'] as const) {
      expect(payload).not.toHaveProperty(key)
    }
  })

  it('sends every chosen subject, not just the first', () => {
    const payload = toRequestPayload({
      ...complete(),
      subjectIds: ['sub-maths', 'sub-physics', 'sub-english'],
    })

    expect(payload.subjectIds).toEqual(['sub-maths', 'sub-physics', 'sub-english'])
  })

  it('renders time ranges for the admin and drops half-typed ones', () => {
    const payload = toRequestPayload({
      ...complete(),
      preferredDayNames: ['Monday', 'Wednesday'],
      preferredTimeRanges: [
        { id: 'a', start: '16:00', end: '18:00' },
        { id: 'b', start: '', end: '' },
      ],
    })

    expect(payload.preferredDayNames).toEqual(['Monday', 'Wednesday'])
    expect(payload.preferredTimeRanges).toEqual(['16:00–18:00'])
  })

  it('does not decide a currency for the client', () => {
    // The only place the browser learns a default currency is from the country,
    // and it still has to be chosen on the form. The payload builder has no idea
    // what the country's currency is — it sends what is on the form.
    const payload = toRequestPayload({ ...complete(), budgetAmount: '450', budgetCurrency: 'USD' })

    expect(payload.budgetCurrency).toBe('USD')
  })
})