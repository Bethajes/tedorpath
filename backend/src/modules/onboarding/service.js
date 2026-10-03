import { prisma } from '../../lib/prisma.js'
import { defaultMarket, listMarkets } from '../tutors/service.js'

/**
 * Reference data for the adaptive "Request a Tutor" wizard.
 *
 * One endpoint, one round trip. The wizard is a sequence of steps where each
 * one narrows what the next can offer — country picks a currency, a timezone
 * and an education system; a level picks the suggested subjects — so serving
 * the pieces separately would turn the first three screens into a waterfall.
 * The whole configuration is small (a few dozen rows of each kind), it changes
 * only when an operator changes it, and the wizard fetches it once per visit,
 * so the response is not split for performance reasons.
 *
 * Nothing here is private: countries, currencies, timezones, curricula and
 * subject names are the vocabulary of the public marketplace. Only active rows
 * are returned, because an option an operator has switched off must disappear
 * from every picker rather than be offered and then rejected on submit.
 */

/** Columns read for each part of the configuration. */
const CURRENCY_SELECT = { code: true, name: true, symbol: true, decimals: true }

const COUNTRY_SELECT = {
  code: true,
  name: true,
  currencyCode: true,
  timezone: true,
  sortOrder: true,
  educationSystem: { select: { code: true } },
}

const LEVEL_SELECT = {
  code: true,
  name: true,
  stage: true,
  aliases: true,
  sortOrder: true,
  educationSystemId: true,
  subjects: { select: { subjectId: true } },
}

const LEVEL_SUBJECT_SELECT = { id: true, name: true, slug: true, category: true, description: true }

/**
 * Timezones the wizard offers as suggestions.
 *
 * Taken from the countries the marketplace actually serves rather than from a
 * bundled copy of the IANA database: the form still accepts any valid timezone
 * the visitor types, but the list it suggests is derived from real rows here,
 * so a suggestion can never name a country the platform does not support.
 * Sorted for a stable response.
 */
function timezonesFrom(countries) {
  return [...new Set(countries.map((country) => country.timezone))].sort((a, b) =>
    a.localeCompare(b),
  )
}

/**
 * Read the whole onboarding configuration.
 *
 * The `educationSystemId` used to group levels is internal and is replaced by
 * the system's code in the response: the browser should address configuration by
 * the same stable identifiers a stored request uses, never by a database id.
 *
 * @returns {Promise<{
 *   markets: Array<{code: string, name: string, currencyName: string, symbol: string, decimals: number, isDefault: boolean}>,
 *   defaultMarketCode: string,
 *   currencies: Array<{code: string, name: string, symbol: string, decimals: number}>,
 *   countries: Array<{code: string, name: string, currencyCode: string, timezone: string, educationSystemCode: string}>,
 *   educationSystems: Array<{code: string, name: string, description: string|null, levels: Array<{code: string, name: string, stage: string, aliases: string[], subjectIds: string[]}>}>,
 *   learningGoals: Array<{code: string, name: string, description: string|null}>,
 *   subjects: Array<{id: string, name: string, slug: string, category: string, description: string|null}>,
 *   timezones: string[]
 * }>}
 */
export async function getOnboardingConfig() {
  const [markets, currencies, countries, systems, levels, learningGoals, subjects] =
    await Promise.all([
      // Resolved through the tutors service rather than queried again here, so the
      // market list the wizard's budget selector builds from is provably the same
      // one the directory filters and prices with.
      listMarkets(),
      prisma.currency.findMany({
      where: { active: true },
      select: CURRENCY_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    }),
    prisma.country.findMany({
      where: { active: true },
      select: COUNTRY_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.educationSystem.findMany({
      select: { id: true, code: true, name: true, description: true },
      orderBy: [{ code: 'asc' }],
    }),
    prisma.educationLevel.findMany({
      where: { active: true },
      select: LEVEL_SELECT,
      orderBy: [{ educationSystemId: 'asc' }, { sortOrder: 'asc' }],
    }),
    prisma.learningGoal.findMany({
      where: { active: true },
      select: { code: true, name: true, description: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.subject.findMany({
      where: { active: true },
      select: LEVEL_SUBJECT_SELECT,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
  ])

  const levelsBySystem = new Map(systems.map((system) => [system.id, []]))
  for (const level of levels) {
    levelsBySystem.get(level.educationSystemId)?.push({
      code: level.code,
      name: level.name,
      stage: level.stage,
      aliases: level.aliases,
      // Suggestion order is the catalogue's own order (category, then name),
      // which is what `subjects` below is already sorted by, so the wizard can
      // render the two lists without re-sorting.
      subjectIds: level.subjects.map((row) => row.subjectId),
    })
  }

  const fallback = await defaultMarket()

  return {
    // The markets a tutor can price in, and which one serves an unmarked visitor.
    // Both travel together so a client can never have to guess which entry of the
    // list is the fallback.
    markets,
    defaultMarketCode: fallback.code,
    currencies,
    countries: countries.map(({ educationSystem, ...country }) => ({
      ...country,
      educationSystemCode: educationSystem.code,
    })),
    educationSystems: systems.map((system) => ({
      code: system.code,
      name: system.name,
      description: system.description,
      levels: levelsBySystem.get(system.id) ?? [],
    })),
    learningGoals,
    subjects,
    timezones: timezonesFrom(countries),
  }
}