import { getSettings, updateOverrides } from './service.js'
import { updateStatsSchema } from './validation.js'

/**
 * HTTP layer for the homepage statistics overrides.
 *
 * Errors are logged for operators and reduced to generic messages for clients,
 * matching the rest of the admin API. Nothing identifying is written to the log:
 * the queries behind this endpoint read aggregate counts, not people.
 */

/** A malformed body is a 400 here: there is no "well-formed but not allowed" case. */
function parseOrRespond(schema, value, res) {
  const result = schema.safeParse(value)

  if (result.success) return { ok: true, data: result.data }

  res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request.',
      fields: result.error.issues.map((issue) => ({
        field: issue.path.join('.') || '_',
        message: issue.message,
      })),
    },
  })
  return { ok: false }
}

/**
 * GET /api/admin/site-stats
 *
 * The live counts, the stored overrides and what each figure currently resolves
 * to, so the screen can show the comparison rather than asking the admin to
 * remember what the count was.
 */
export function getSiteStats(_req, res) {
  getSettings()
    .then((settings) => {
      res.status(200).json({ success: true, data: settings })
    })
    .catch((error) => {
      console.error('[admin] failed to load site statistics:', error)
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unable to load the homepage statistics.' },
      })
    })
}

/**
 * PATCH /api/admin/site-stats
 *
 * Partial by design: only the keys in the body are written, so an admin
 * adjusting one figure cannot accidentally reset the other three. `null` clears
 * an override and hands that figure back to the live count.
 *
 * Returns the same shape as the GET, so the screen updates from the server's
 * answer rather than from what it hoped it saved.
 */
export function patchSiteStats(req, res) {
  const parsed = parseOrRespond(updateStatsSchema, req.body ?? {}, res)
  if (!parsed.ok) return

  updateOverrides(parsed.data)
    .then((settings) => {
      res.status(200).json({ success: true, data: settings })
    })
    .catch((error) => {
      console.error('[admin] failed to update site statistics:', error)
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unable to save the homepage statistics.' },
      })
    })
}
