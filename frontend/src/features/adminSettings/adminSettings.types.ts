/**
 * Types for the homepage statistics settings screen.
 *
 * The admin response carries THREE numbers per figure, and the screen is only
 * useful because they are told apart:
 *
 *   `live`      — what the database counts right now. Read-only, recomputed on
 *                 every request, and the reason the screen cannot be used to
 *                 quietly redefine the marketplace.
 *   `overrides` — what an admin has set, or `null` where they have not. `null`
 *                 is a real state meaning "use the live count", not a missing
 *                 value.
 *   `showing`   — what a visitor sees right now: the override where there is
 *                 one, the live count otherwise. Returned by the server so the
 *                 preview is the server's answer rather than the browser's
 *                 arithmetic.
 *
 * The four keys mirror the fields of `PublicStats`, so a figure that is not one
 * of these four cannot be edited here.
 */

/** The four figures the homepage band renders. Mirrors the backend allow-list. */
export const SITE_STAT_KEYS = [
  'approvedTutors',
  'subjects',
  'universities',
  'countries',
] as const

export type SiteStatKey = (typeof SITE_STAT_KEYS)[number]

/** Homepage wording for each figure, so the screen quotes the real label. */
export const SITE_STAT_LABELS: Record<SiteStatKey, string> = {
  approvedTutors: 'Approved tutors',
  subjects: 'Subjects taught',
  universities: 'University backgrounds',
  countries: 'Countries represented',
}

/**
 * What each figure means and why it might legitimately differ from the count.
 *
 * Shown on the screen because an override with no stated reason is a number
 * nobody can check later.
 */
export const SITE_STAT_HINTS: Record<SiteStatKey, string> = {
  approvedTutors:
    'Tutors whose profiles are live in the public directory right now.',
  subjects: 'Subjects currently active in the catalogue and open to visitors.',
  universities: 'Distinct institutions written in approved tutors’ education fields.',
  countries: 'Distinct locations written in approved tutor profiles.',
}

/** Mirrors the backend's MAX_OVERRIDE so the browser can refuse first. */
export const MAX_SITE_STAT_OVERRIDE = 1_000_000

export interface SiteStatsSettings {
  /** Live database counts. Never editable. */
  live: Record<SiteStatKey, number>
  /** Admin-set values; `null` where the live count is being used. */
  overrides: Record<SiteStatKey, number | null>
  /** What the public endpoint is currently serving. */
  showing: Record<SiteStatKey, number>
  /** ISO timestamp of the last override change, or `null` if never. */
  updatedAt: string | null
}

/**
 * The patch body.
 *
 * `null` clears an override; omitting a key leaves it untouched. The two are
 * different operations and the API distinguishes them, so the type has to.
 */
export type SiteStatsUpdate = Partial<Record<SiteStatKey, number | null>>

/**
 * Reads an override field out of a submit event.
 *
 * Blank input means "no override" rather than "override by zero": the field is
 * reused for both, and a zero there is meaningless because the homepage renders
 * wording instead of a zero.
 */
export function parseOverrideField(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null

  const value = Number(trimmed)
  return Number.isInteger(value) && value > 0 ? value : null
}
