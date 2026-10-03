import type {
  ConfigCountry,
  ConfigCurrency,
  ConfigEducationLevel,
  ConfigSubject,
  OnboardingConfig,
} from './tutorRequest.config'

/**
 * Reading the wizard's configuration.
 *
 * Every "which options apply here?" decision the form makes lives in this file
 * as a pure function over the configuration the server sent. Two reasons it is
 * not written inline in the components: the adaptive behaviour is the interesting
 * part of this form and deserves to be readable in one place, and a pure function
 * is testable without rendering anything.
 *
 * The rule the whole design rests on: country → currency, timezone and
 * curriculum; curriculum + level → suggested subjects. Everything else in the
 * wizard follows from those two steps, and nothing is hardcoded here — if a
 * country is not in the database it is not in the form.
 */

/** Finds a country by its ISO code. Case-insensitive, because both are stable. */
export function findCountry(config: OnboardingConfig, code: string): ConfigCountry | undefined {
  if (!code) return undefined
  const wanted = code.toUpperCase()
  return config.countries.find((country) => country.code === wanted)
}

/** Finds a currency by its ISO 4217 code. */
export function findCurrency(config: OnboardingConfig, code: string): ConfigCurrency | undefined {
  if (!code) return undefined
  const wanted = code.toUpperCase()
  return config.currencies.find((currency) => currency.code === wanted)
}

/** Finds a subject by its database id. */
export function findSubject(config: OnboardingConfig, id: string): ConfigSubject | undefined {
  return config.subjects.find((subject) => subject.id === id)
}

/** Finds a subject by name, case-insensitively. */
export function findSubjectByName(
  config: OnboardingConfig,
  name: string,
): ConfigSubject | undefined {
  const wanted = name.trim().toLowerCase()
  return config.subjects.find((subject) => subject.name.toLowerCase() === wanted)
}

/** The curriculum a country is configured with. */
function educationSystemFor(config: OnboardingConfig, countryCode: string) {
  const country = findCountry(config, countryCode)
  if (!country) return undefined
  return config.educationSystems.find((system) => system.code === country.educationSystemCode)
}

/**
 * The education levels offered for a country, in the configured order.
 *
 * Empty for an unknown country rather than falling back to "everything": a
 * visitor who has not chosen a country, or whose country is no longer
 * available, must not be shown a curriculum that may not apply to them.
 */
export function educationLevelsFor(
  config: OnboardingConfig,
  countryCode: string,
): ConfigEducationLevel[] {
  return educationSystemFor(config, countryCode)?.levels ?? []
}

/** A single level, by code. */
export function findEducationLevel(
  config: OnboardingConfig,
  code: string,
): ConfigEducationLevel | undefined {
  if (!code) return undefined
  for (const system of config.educationSystems) {
    const match = system.levels.find((level) => level.code === code)
    if (match) return match
  }
  return undefined
}

/**
 * The subjects usually taught at a level, in the order the catalogue uses.
 *
 * This is what makes step 3 contextual: the client picked a level in step 2, and
 * these are the subjects offered first because they are the ones that level
 * covers. `countryCode` is not consulted — a level identifies its own subjects,
 * and the country has already decided which levels exist in the first place. Ids
 * the level references but the catalogue does not contain are skipped rather
 * than rendered as an empty chip: a dangling suggestion would be a dead control
 * the visitor could tick and the server would reject.
 */
export function suggestedSubjectsFor(
  config: OnboardingConfig,
  _countryCode: string,
  levelCode: string,
): ConfigSubject[] {
  const level = findEducationLevel(config, levelCode)
  if (!level) return []

  return level.subjectIds
    .map((id) => findSubject(config, id))
    .filter((subject): subject is ConfigSubject => subject !== undefined)
}

/**
 * Subjects not already suggested, so the client can reach the rest of the
 * catalogue without the two lists hiding each other.
 */
export function otherSubjectsFor(
  config: OnboardingConfig,
  suggested: readonly ConfigSubject[],
): ConfigSubject[] {
  const suggestedIds = new Set(suggested.map((subject) => subject.id))
  return config.subjects.filter((subject) => !suggestedIds.has(subject.id))
}

/**
 * The currency a budget defaults to for a country.
 *
 * A default and nothing more. The step offers every currency the platform knows
 * about, because a client in Ethiopia may be paying a tutor abroad, and the
 * amount they type is stored in whatever currency they chose — never converted,
 * and never reinterpreted when the country changes.
 */
export function defaultCurrencyFor(
  config: OnboardingConfig,
  countryCode: string,
): ConfigCurrency | undefined {
  const country = findCountry(config, countryCode)
  if (!country) return undefined
  return findCurrency(config, country.currencyCode)
}

/** The timezone availability is scheduled in by default for a country. */
export function defaultTimezoneFor(config: OnboardingConfig, countryCode: string): string {
  return findCountry(config, countryCode)?.timezone ?? ''
}

/**
 * What choosing a country implies.
 *
 * The wizard shell is the only place that applies these, so a step never has to
 * know why the currency changed under it. The important rule is what is *not*
 * here: the budget amount. Changing country changes the default currency and
 * nothing else — the number the client typed is theirs, and rewriting it would
 * apply an exchange rate this product does not have.
 */
export function defaultsForCountry(
  config: OnboardingConfig,
  code: string,
): { currencyCode: string; timezone: string } {
  return {
    currencyCode: defaultCurrencyFor(config, code)?.code ?? '',
    timezone: defaultTimezoneFor(config, code),
  }
}

/**
 * Resolves a level label from a link built against older wording.
 *
 * The homepage has always linked `/request-tutor?level=University`, and level
 * names are free text an operator can reword at any time. Matching the code
 * first, then the name, then the configured aliases, means a rename never
 * silently breaks a link that is already in someone's browser history — and
 * equally, a value that matches nothing is reported as "not chosen" rather than
 * being forced into whatever happens to be first in the list.
 *
 * @returns the level's code, or '' when nothing matches
 */
export function resolveLevelLabel(config: OnboardingConfig, label: string): string {
  const wanted = label.trim()
  if (!wanted) return ''

  for (const system of config.educationSystems) {
    for (const level of system.levels) {
      if (level.code.toLowerCase() === wanted.toLowerCase()) return level.code
      if (level.name.toLowerCase() === wanted.toLowerCase()) return level.code
      if (level.aliases.some((alias) => alias.toLowerCase() === wanted.toLowerCase())) {
        return level.code
      }
    }
  }

  return ''
}

/** Resolves a subject name from a link to the subject's database id. */
export function resolveSubjectName(config: OnboardingConfig, name: string): string {
  return findSubjectByName(config, name)?.id ?? ''
}

/**
 * Formats an amount with its currency for display.
 *
 * The code is always shown next to the number. A symbol alone is ambiguous —
 * `$` is shared by a dozen countries — and a budget nobody can read back
 * correctly is worse than one that looks slightly technical.
 */
export function formatMoney(
  amount: number,
  currency: ConfigCurrency | undefined,
): string {
  if (!Number.isFinite(amount)) return ''
  const decimals = currency?.decimals ?? 2
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return currency ? `${formatted} ${currency.code}` : formatted
}

/**
 * How a day is written when days are joined into a sentence.
 *
 * Kept here so the review summary, the request summary and the hint text all
 * spell the same day the same way.
 */
export function joinList(values: readonly string[]): string {
  const unique = values.filter((value) => value.trim() !== '')
  if (unique.length === 0) return ''
  if (unique.length === 1) return unique[0]
  return `${unique.slice(0, -1).join(', ')} and ${unique.at(-1)}`
}