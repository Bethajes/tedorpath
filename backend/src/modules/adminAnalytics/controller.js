import { getActivity, getDashboardOverview } from './service.js'
import { activityQuerySchema, windowQuerySchema } from './validation.js'

/**
 * HTTP layer for the admin analytics endpoints.
 *
 * Errors are logged for operators and reduced to generic messages for clients,
 * matching the rest of the admin API. Nothing identifying is written to the log:
 * the queries behind these endpoints read aggregate counts and short summaries,
 * never the full personal data a request row holds.
 */

/** A malformed query string is a 400, matching the rest of the admin API. */
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
 * GET /api/admin/dashboard
 *
 * Everything the dashboard renders, in one response.
 *
 * `?days=` sets how far back the trend series reaches, defaulting to 30. It is
 * capped at 365 so one request cannot ask for the whole table.
 *
 * `?staleDays=` sets how long a request may sit in NEW before it counts as a
 * follow-up, and is echoed back inside `matching.staleDays` so the screen can
 * state the rule rather than assert a conclusion.
 */
export function getDashboard(req, res) {
  const parsed = parseOrRespond(windowQuerySchema, req.query, res)
  if (!parsed.ok) return

  getDashboardOverview(parsed.data.days, parsed.data.staleDays)
    .then((overview) => {
      res.status(200).json({ success: true, data: overview })
    })
    .catch((error) => {
      console.error('[admin] failed to load the dashboard overview:', error)
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unable to load the dashboard.' },
      })
    })
}

/**
 * GET /api/admin/activity
 *
 * The activity feed on its own, so the dashboard can refresh the feed without
 * re-running every aggregate.
 */
export function getActivityFeed(req, res) {
  const parsed = parseOrRespond(activityQuerySchema, req.query, res)
  if (!parsed.ok) return

  getActivity(parsed.data.limit)
    .then((items) => {
      res.status(200).json({ success: true, data: { items } })
    })
    .catch((error) => {
      console.error('[admin] failed to load the activity feed:', error)
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unable to load recent activity.' },
      })
    })
}
