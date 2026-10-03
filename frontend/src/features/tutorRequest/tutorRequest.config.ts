import { ApiError, getJson } from '@/lib/api'

/**
 * The wizard's reference data, from `GET /api/onboarding/config`.
 *
 * Everything the request form offers the visitor — countries, currencies,
 * timezones, education levels, subjects, learning goals — is read from the
 * database, not from a list in this file. Adding a country or a subject is a
 * data change an operator makes; it reaches the form on the next page load
 * without a deploy.
 *
 * The response is deliberately one document. The wizard's steps depend on each
 * other (a country picks a currency and a curriculum, a level picks the
 * suggested subjects), so serving the pieces separately would make the first
 * three screens a waterfall for no saving.
 */

/** An ISO 4217 currency. `decimals` is the number of minor-unit digits. */
export interface ConfigCurrency {
  code: string
  name: string
  symbol: string
  decimals: number
}

/** A country, with the defaults the form prefills from — never mandates. */
export interface ConfigCountry {
  /** ISO 3166-1 alpha-2, uppercase. */
  code: string
  name: string
  currencyCode: string
  /** IANA identifier, e.g. `Africa/Addis_Ababa`. */
  timezone: string
  educationSystemCode: string
}

/** One stage of a curriculum, with the subjects usually taught at it. */
export interface ConfigEducationLevel {
  /** Stable code the API exchanges, e.g. `eth-grade-9-10`. */
  code: string
  name: string
  /** Grouping for the picker, e.g. "Senior Secondary". Presentation only. */
  stage: string
  /** Wording this level also answers to, so older links keep resolving. */
  aliases: string[]
  /** Ids from `subjects`, in catalogue order. Suggestions, not a limit. */
  subjectIds: string[]
}

export interface ConfigEducationSystem {
  code: string
  name: string
  description: string | null
  levels: ConfigEducationLevel[]
}

export interface ConfigLearningGoal {
  code: string
  name: string
  description: string | null
}

export interface ConfigSubject {
  id: string
  name: string
  slug: string
  category: string
  description: string | null
}

export interface OnboardingConfig {
  currencies: ConfigCurrency[]
  countries: ConfigCountry[]
  educationSystems: ConfigEducationSystem[]
  learningGoals: ConfigLearningGoal[]
  subjects: ConfigSubject[]
  /** Timezones to suggest, derived from the countries above. */
  timezones: string[]
}

/**
 * Load the configuration.
 *
 * A failure here is fatal to the wizard rather than degraded: without the
 * country list there is no first step, and continuing would mean inventing
 * options in the browser — the one thing this design exists to avoid. The
 * caller shows the message and a retry rather than a broken form.
 */
export async function fetchOnboardingConfig(): Promise<OnboardingConfig> {
  try {
    return await getJson<OnboardingConfig>('/api/onboarding/config')
  } catch (error) {
    if (error instanceof ApiError) {
      throw new ApiError(
        error.status === 0 || error.code === 'NETWORK_ERROR'
          ? 'We could not reach the server to load the form. Check your connection and try again.'
          : error.message,
        error.status,
        error.code,
      )
    }
    throw error
  }
}