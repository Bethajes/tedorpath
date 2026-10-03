import { z } from 'zod'

/**
 * Validation for the admin analytics endpoints.
 *
 * Narrow on purpose. These endpoints are read-only, so the only things a client
 * can influence are how many rows come back and how far back the time series
 * reaches — both bounded so a single request cannot ask the database to scan
 * the whole table and serialise it.
 */

/** Longest window the trend series will ever cover. */
export const MAX_WINDOW_DAYS = 365

/** Most rows the activity feed or matching queue will return in one request. */
export const MAX_LIMIT = 100
export const DEFAULT_LIMIT = 20

/**
 * Query-string integer. An absent value falls back to `fallback`; anything
 * present must parse as an integer inside the allowed range, otherwise the
 * request is rejected rather than silently clamped.
 */
function queryInt(fallback, { min, max, label }) {
  return z
    .string()
    .optional()
    .transform((value) => (value === undefined || value === '' ? String(fallback) : value))
    .pipe(
      z.coerce
        .number({ error: `${label} must be a number.` })
        .int(`${label} must be a whole number.`)
        .min(min, `${label} must be at least ${min}.`)
        .max(max, `${label} must be at most ${max}.`),
    )
}

export const windowQuerySchema = z
  .object({
    days: queryInt(30, { min: 1, max: MAX_WINDOW_DAYS, label: 'days' }),
    /**
     * How long a request may sit in NEW before the dashboard counts it as a
     * follow-up. Settable rather than hard-coded so the UI can show the exact
     * rule it is applying instead of implying one.
     */
    staleDays: queryInt(7, { min: 1, max: 365, label: 'staleDays' }),
  })
  .transform((value) => ({ days: value.days, staleDays: value.staleDays }))

export const activityQuerySchema = z
  .object({
    limit: queryInt(DEFAULT_LIMIT, { min: 1, max: MAX_LIMIT, label: 'limit' }),
  })
  .transform((value) => ({ limit: value.limit }))

export const matchingQuerySchema = z
  .object({
    limit: queryInt(DEFAULT_LIMIT, { min: 1, max: MAX_LIMIT, label: 'limit' }),
    /**
     * `unmatched` is the default because that is the queue that needs work: a
     * request with no tutor is one a learner is waiting on.
     */
    matched: z.enum(['all', 'matched', 'unmatched']).optional().default('unmatched'),
  })
  .transform((value) => ({ limit: value.limit, matched: value.matched }))

/** How many days make a learner "active". Exposed to the UI so it can say so. */
export const ACTIVE_LEARNER_WINDOW_DAYS = 30

export const LIMITS = { MAX_WINDOW_DAYS, MAX_LIMIT, DEFAULT_LIMIT }
