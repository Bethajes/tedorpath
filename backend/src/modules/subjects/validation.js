import { z } from 'zod'

/**
 * Zod schema for GET /api/subjects query parameters.
 *
 * Every parameter is optional: the endpoint is called both bare
 * (`/api/subjects`) and with an explicit filter (`/api/subjects?active=true`).
 */
export const listSubjectsQuerySchema = z.object({
  /**
   * `active=true`  — only active subjects (the default, for pickers)
   * `active=false` — only deactivated subjects (admin tooling)
   * `active=all`   — both (admin tooling)
   */
  active: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((value) => {
      if (value === 'all') return 'all'
      if (value === 'false') return 'inactive'
      return 'active'
    })
    .pipe(z.enum(['active', 'inactive', 'all'])),
})

/**
 * Parse and validate query parameters for GET /api/subjects.
 *
 * @returns {{ ok: true, data: object } | { ok: false, fields: Array<{field: string, message: string}> }}
 */
export function validateListSubjectsQuery(query) {
  const result = listSubjectsQuerySchema.safeParse(query ?? {})

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
