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

  /**
   * Teaching language — case-insensitive match against a tutor's `languages`
   * array.
   *
   * Free text rather than an enum because the array is tutor-authored: the
   * onboarding form accepts a comma-separated list, so the set of values in the
   * database is whatever tutors type and a fixed enum would silently exclude
   * everyone who wrote "amharic" in a different case. Requirements: 30.2, 30.4
   */
  language: z.string().trim().max(50).optional(),

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

  /**
   * Which market's rate the visitor is shopping in.
   *
   * Shape-checked as three letters here and checked against the `markets` table in
   * the service, because the offered markets are data: a third one has to work
   * without this file being edited.
   *
   * A visitor's market, not a tutor's: `minRate=10` means ten birr to someone in
   * Addis and ten dollars to someone in London, and the filter would be answering
   * a different question for each of them otherwise.
   */
  market: z
    .string()
    .trim()
    .toUpperCase()
    .length(3, 'Market must be a three-letter code such as ETB or USD.')
    .optional(),

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
