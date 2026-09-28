import { z } from 'zod'

/**
 * Validation for the admin API.
 *
 * Keeps the allow-list narrow on purpose: the admin may change workflow state
 * and internal notes, never the details the client submitted.
 */

export const TUTOR_REQUEST_STATUSES = [
  'NEW',
  'CONTACTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]

export const STATUS_FILTER_VALUES = ['all', ...TUTOR_REQUEST_STATUSES]

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const MAX_ADMIN_NOTES = 5000

/**
 * Query-string integer. An absent value falls back to `fallback`; anything
 * present must parse as an integer inside the allowed range, otherwise the
 * request is rejected with 400 rather than silently clamped.
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

export const listQuerySchema = z
  .object({
    page: queryInt(1, { min: 1, max: 100_000, label: 'page' }),
    limit: queryInt(DEFAULT_LIMIT, { min: 1, max: MAX_LIMIT, label: 'limit' }),
    status: z.enum(STATUS_FILTER_VALUES).optional().default('all'),
    q: z
      .string()
      .trim()
      .max(120, 'Search term is too long.')
      .optional()
      .default(''),
  })
  .transform((value) => ({
    page: value.page,
    limit: value.limit,
    status: value.status,
    search: value.q,
  }))

/** Only status and adminNotes are writable — client fields are immutable. */
export const updateRequestSchema = z
  .object({
    status: z.enum(TUTOR_REQUEST_STATUSES).optional(),
    adminNotes: z
      .string()
      .trim()
      .max(MAX_ADMIN_NOTES, `Admin notes must be at most ${MAX_ADMIN_NOTES} characters.`)
      .nullable()
      .optional(),
  })
  .refine(
    (value) => value.status !== undefined || value.adminNotes !== undefined,
    'Provide at least one of "status" or "adminNotes".',
  )
  .strict()

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const idParamSchema = z.string().refine((value) => UUID_PATTERN.test(value), {
  message: 'Request id must be a valid UUID.',
})

export const LIMITS = { DEFAULT_LIMIT, MAX_LIMIT, MAX_ADMIN_NOTES }
