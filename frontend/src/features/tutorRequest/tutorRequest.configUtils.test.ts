import { describe, expect, it } from 'vitest'

import {
  defaultCurrencyFor,
  defaultTimezoneFor,
  defaultsForCountry,
  educationLevelsFor,
  findCountry,
  findEducationLevel,
  formatMoney,
  joinList,
  otherSubjectsFor,
  resolveLevelLabel,
  resolveSubjectName,
  suggestedSubjectsFor,
} from './tutorRequest.configUtils'
import type { OnboardingConfig } from './tutorRequest.config'

/**
 * The adaptive behaviour, tested without rendering anything.
 *
 * These are the decisions the whole form hangs on: a country picks a currency, a
 * timezone and a curriculum; a level picks the subjects it suggests. If any of
 * them silently returned the wrong thing, the form would offer a client options
 * that do not apply to them — which is the specific failure this design was
 * meant to remove.
 *
 * The fixture is a miniature of the real response: two countries on two different
 * curricula, which is what makes the "country matters" assertions meaningful.
 */
const config: OnboardingConfig = {
  currencies: [
    { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br', decimals: 2 },
    { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0 },
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
        {
          code: 'int-primary',
          name: 'Primary School',
          stage: 'Primary',
          aliases: ['Elementary School'],
          subjectIds: ['sub-english'],
        },
        {
          code: 'int-high',
          name: 'High School',
          stage: 'Senior Secondary',
          aliases: ['Senior Secondary'],
          subjectIds: ['sub-english', 'sub-maths'],
        },
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
        {
          code: 'eth-university',
          name: 'University or College',
          stage: 'Higher Education',
          aliases: ['University'],
          subjectIds: ['sub-maths', 'sub-programming'],
        },
      ],
    },
  ],
  learningGoals: [],
  subjects: [
    { id: 'sub-maths', name: 'Mathematics', slug: 'mathematics', category: 'School Subjects', description: null },
    { id: 'sub-physics', name: 'Physics', slug: 'physics', category: 'School Subjects', description: null },
    { id: 'sub-english', name: 'English', slug: 'english', category: 'School Subjects', description: null },
    { id: 'sub-programming', name: 'Programming', slug: 'programming', category: 'Technology', description: null },
    { id: 'sub-other', name: 'Other', slug: 'other', category: 'Other', description: null },
  ],
  timezones: ['Africa/Addis_Ababa', 'America/New_York'],
}

describe('the country decides the curriculum', () => {
  it('offers Ethiopian grades to Ethiopia', () => {
    const codes = educationLevelsFor(config, 'ET').map((level) => level.code)

    expect(codes).toContain('eth-grade-9-10')
    expect(codes).not.toContain('int-high')
  })

  it('offers generic levels to everyone else', () => {
    const codes = educationLevelsFor(config, 'US').map((level) => level.code)

    expect(codes).toEqual(['int-primary', 'int-high'])
  })

  it('offers nothing for a country it does not know', () => {
    // Not "everything". Showing a curriculum that may not apply is how someone
    // ends up being asked for help with a level their country does not have.
    expect(educationLevelsFor(config, 'ZZ')).toEqual([])
    expect(educationLevelsFor(config, '')).toEqual([])
  })

  it('keeps the levels in the order the curriculum lists them', () => {
    expect(educationLevelsFor(config, 'US').map((level) => level.name)).toEqual([
      'Primary School',
      'High School',
    ])
  })

  it('finds a level across every curriculum', () => {
    expect(findEducationLevel(config, 'eth-university')?.name).toBe('University or College')
    expect(findEducationLevel(config, 'missing')).toBeUndefined()
  })
})

describe('the country decides the currency and the timezone', () => {
  it('defaults an Ethiopian budget to ETB', () => {
    expect(defaultCurrencyFor(config, 'ET')?.code).toBe('ETB')
  })

  it('defaults everyone else to their own currency', () => {
    expect(defaultCurrencyFor(config, 'US')?.code).toBe('USD')
  })

  it('defaults the scheduling timezone from the country', () => {
    expect(defaultTimezoneFor(config, 'ET')).toBe('Africa/Addis_Ababa')
    expect(defaultTimezoneFor(config, 'US')).toBe('America/New_York')
  })

  it('returns nothing rather than a guess for an unknown country', () => {
    expect(defaultCurrencyFor(config, 'ZZ')).toBeUndefined()
    expect(defaultTimezoneFor(config, 'ZZ')).toBe('')
    expect(findCountry(config, 'ZZ')).toBeUndefined()
  })

  it('reports both defaults together, and no amount', () => {
    expect(defaultsForCountry(config, 'ET')).toEqual({
      currencyCode: 'ETB',
      timezone: 'Africa/Addis_Ababa',
    })
  })

  it('matches a country code whatever case it arrives in', () => {
    expect(defaultCurrencyFor(config, 'et')?.code).toBe('ETB')
  })
})

describe('the level decides which subjects are suggested', () => {
  it('suggests the subjects linked to that level', () => {
    const suggested = suggestedSubjectsFor(config, 'ET', 'eth-grade-9-10').map((s) => s.name)

    expect(suggested).toEqual(['Mathematics', 'Physics'])
  })

  it('suggests something different for a different level', () => {
    const primary = suggestedSubjectsFor(config, 'US', 'int-primary').map((s) => s.name)
    const high = suggestedSubjectsFor(config, 'US', 'int-high').map((s) => s.name)

    expect(primary).toEqual(['English'])
    expect(high).toEqual(['English', 'Mathematics'])
  })

  it('suggests nothing for a level that was never chosen', () => {
    expect(suggestedSubjectsFor(config, 'ET', '')).toEqual([])
  })

  it('skips a suggestion whose subject is not in the catalogue', () => {
    // A dangling link must not become a dead chip the visitor can tick and the
    // server will reject.
    const broken: OnboardingConfig = {
      ...config,
      educationSystems: config.educationSystems.map((system) =>
        system.code === 'ETH'
          ? {
              ...system,
              levels: system.levels.map((level) =>
                level.code === 'eth-grade-9-10'
                  ? { ...level, subjectIds: ['sub-maths', 'sub-deleted'] }
                  : level,
              ),
            }
          : system,
      ),
    }

    expect(suggestedSubjectsFor(broken, 'ET', 'eth-grade-9-10').map((s) => s.id)).toEqual([
      'sub-maths',
    ])
  })

  it('offers the rest of the catalogue so a suggestion is never a limit', () => {
    const suggested = suggestedSubjectsFor(config, 'ET', 'eth-grade-9-10')
    const rest = otherSubjectsFor(config, suggested).map((s) => s.name)

    expect(rest).toEqual(['English', 'Programming', 'Other'])
  })
})

describe('links built against older wording still resolve', () => {
  it('matches a level by its code, its name and its aliases', () => {
    expect(resolveLevelLabel(config, 'eth-grade-9-10')).toBe('eth-grade-9-10')
    expect(resolveLevelLabel(config, 'Grades 9–10')).toBe('eth-grade-9-10')
    expect(resolveLevelLabel(config, 'Grade 9')).toBe('eth-grade-9-10')
  })

  it('resolves the wording the homepage has always linked to', () => {
    // The discovery pages have linked `?level=University` since before levels
    // moved into the database. It must keep working.
    expect(resolveLevelLabel(config, 'University')).toBe('eth-university')
  })

  it('ignores case', () => {
    expect(resolveLevelLabel(config, 'university')).toBe('eth-university')
  })

  it('reports an unknown label as unchosen rather than guessing', () => {
    expect(resolveLevelLabel(config, 'Postdoctoral Research')).toBe('')
    expect(resolveLevelLabel(config, '')).toBe('')
  })

  it('resolves a subject name to its id', () => {
    expect(resolveSubjectName(config, 'Mathematics')).toBe('sub-maths')
    expect(resolveSubjectName(config, '  physics  ')).toBe('sub-physics')
    expect(resolveSubjectName(config, 'Astrophysics')).toBe('')
  })
})

describe('display helpers', () => {
  it('always shows the currency code beside an amount', () => {
    expect(formatMoney(450, config.currencies[0])).toBe('450.00 ETB')
  })

  it('uses the currency\'s own number of decimals', () => {
    expect(formatMoney(1200, config.currencies[2])).toBe('1,200 JPY')
  })

  it('falls back to the bare number when there is no currency', () => {
    expect(formatMoney(10, undefined)).toBe('10.00')
  })

  it('joins a list the way the admin screens read it', () => {
    expect(joinList([])).toBe('')
    expect(joinList(['Monday'])).toBe('Monday')
    expect(joinList(['Monday', 'Wednesday'])).toBe('Monday and Wednesday')
    expect(joinList(['Monday', 'Wednesday', 'Friday'])).toBe(
      'Monday, Wednesday and Friday',
    )
  })
})