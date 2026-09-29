import { z } from 'zod'

/**
 * Validation for the admin tutor moderation API.
 *
 * The admin may move a profile between moderation states and set the
 * verification flag; it may never edit the content the tutor wrote. Keeping
 * the writable set this narrow is the whole point of the allow-list.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

/** Every state a profile can be in. Mirrors the Prisma ProfileStatus enum. */
export const PROFILE_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'SUSPENDED',
  'REJECTED',
]

/**
 * The states an admin may move a profile *to*.
 *
 * Deliberately narrower than PROFILE_STATUSES: a moderation decision is one of
 * these three. DRAFT and PENDING_REVIEW belong to the tutor's own workflow and
 * are never set by an admin, so offering them here would let the admin forge a
 * submission or quietly return an approved tutor to draft.
 */
export const MODERATION_STATUSES = ['APPROVED', 'REJECTED', 'SUSPENDED']

/** Mirrors the Prisma VerificationStatus enum. */
export const VERIFICATION_STATUSES = ['UNVERIFIED', 'VERIFIED']

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

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

export const listQuerySchema = z.object({
  page: queryInt(1, { min: 1, max: 100_000, label: 'page' }),
  limit: queryInt(DEFAULT_LIMIT, { min: 1, max: MAX_LIMIT, label: 'limit' }),
  // 'all' keeps the filter optional in the query string without a sentinel
  // value leaking into the database query.
  status: z.enum(['all', ...PROFILE_STATUSES]).optional().default('all'),
})

/**
 * The moderation payload.
 *
 * `verificationStatus` is optional and defaults to nothing at all — it is NOT
 * given a value here. Requirement 7.5 makes verification an explicit act: an
 * admin who sends only `status: 'APPROVED'` must leave verificationStatus
 * exactly as it was, and the service distinguishes "absent" from "UNVERIFIED"
 * by testing for `undefined`. Defaulting it in the schema would silently
 * unverify every already-verified tutor the first time they were approved.
 */
export const updateStatusSchema = z
  .object({
    status: z.enum(MODERATION_STATUSES, {
      error: `Status must be one of: ${MODERATION_STATUSES.join(', ')}.`,
    }),
    verificationStatus: z.enum(VERIFICATION_STATUSES).optional(),
  })
  .strict()

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const idParamSchema = z.string().refine((value) => UUID_PATTERN.test(value), {
  message: 'Tutor profile id must be a valid UUID.',
})

export const LIMITS = { DEFAULT_LIMIT, MAX_LIMIT }
