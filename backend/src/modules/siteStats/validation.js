import { z } from 'zod'

/**
 * Validation for the homepage statistics overrides.
 *
 * The allow-list is exactly the four figures the homepage band renders. A key
 * that is not on this list is a typo or an attempt to invent a new metric, and
 * `.strict()` turns both into a 400 rather than a silently ignored field.
 */

/**
 * The four figures, in the order the homepage shows them.
 *
 * Written out in one place and imported by the service so that the write path,
 * the read path and the admin UI cannot drift into disagreeing about which
 * metrics exist.
 */
export const STAT_KEYS = ['approvedTutors', 'subjects', 'universities', 'countries']

/**
 * Ceiling for an override.
 *
 * Large enough that nobody will hit it by accident, small enough that a
 * mistyped keypress cannot put a nine-digit figure on the homepage. The
 * homepage itself has no ceiling because it only ever prints what the database
 * counted.
 */
export const MAX_OVERRIDE = 1000000

/**
 * One override value.
 *
 * `null` is meaningful and is how an admin says "stop overriding this one, use
 * the live count" — which is why it is allowed rather than being confused with
 * an absent key.
 *
 * Zero is NOT allowed. The homepage deliberately renders wording instead of a
 * zero (`statDisplayValue` in the frontend), so an override of 0 would produce
 * either a rejected save or a card that silently disagrees with its own number.
 */
const overrideValue = z
  .number({ error: 'must be a number' })
  .int('must be a whole number')
  .min(1, 'must be at least 1')
  .max(MAX_OVERRIDE, `must be at most ${MAX_OVERRIDE}`)

/**
 * The patch body.
 *
 * Every key is optional so a save touches only what the admin changed, and
 * `null` is distinct from `undefined`: sending `null` clears an override,
 * omitting the key leaves it exactly as it was.
 */
export const updateStatsSchema = z
  .object({
    approvedTutors: overrideValue.nullable().optional(),
    subjects: overrideValue.nullable().optional(),
    universities: overrideValue.nullable().optional(),
    countries: overrideValue.nullable().optional(),
  })
  .strict()
  .refine(
    (value) => STAT_KEYS.some((key) => value[key] !== undefined),
    'Provide at least one statistic to update.',
  )
