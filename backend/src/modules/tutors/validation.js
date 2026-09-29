import { z } from 'zod'

/**
 * Zod schema for GET /api/tutors query parameters.
 *
 * All params are optional; defaults are applied here so the service always
 * receives well-typed values.
 */

export const TEACHING_MODES = ['ONLINE', 'IN_PERSON', 'BOTH']
export const SORT_OPTIONS = ['recommended', 'price_asc', 'price_desc', 'newest']

export const listTutorsQuerySchema = z.object({
  /** Full-text search across displayName, headline, subject names */
  q: z.string().trim().max(200).optional(),

  /** Subject slug — exact match */
  subject: z.string().trim().max(100).optional(),

  /** Student level — exact match */
  level: z.string().trim().max(100).optional(),

  /** Teaching mode */
  mode: z.enum(['ONLINE', 'IN_PERSON', 'BOTH']).optional(),

  /** Case-insensitive contains on location */
  location: z.string().trim().max(120).optional(),

  /** Minimum hourly rate */
  minRate: z
    .string()
    .optional()
    .transform((v) => (v !== undefined && v !== '' ? parseFloat(v) : undefined))
    .pipe(z.number().min(0).optional()),

  /** Maximum hourly rate */
  maxRate: z
    .string()
    .optional()
    .transform((v) => (v !== undefined && v !== '' ? parseFloat(v) : undefined))
    .pipe(z.number().min(0).optional()),

  /** Sort order */
  sort: z.enum(['recommended', 'price_asc', 'price_desc', 'newest']).default('recommended'),

  /** Page number (1-based) */
  page: z
    .string()
    .optional()
    .transform((v) => (v !== undefined && v !== '' ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1).default(1)),

  /** Page size — capped at 100 */
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined && v !== '' ? parseInt(v, 10) : 12))
    .pipe(z.number().int().min(1).max(100).default(12)),
})

/**
 * Parse and validate query parameters for GET /api/tutors.
 *
 * @returns {{ ok: true, data: object } | { ok: false, fields: Array<{field: string, message: string}> }}
 */
export function validateListTutorsQuery(query) {
  const result = listTutorsQuerySchema.safeParse(query)

  if (result.success) {
    return { ok: true, data: result.data }
  }

  return {
    ok: false,
    fields: result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '_',
      message: issue.message,
    })),
  }
}
