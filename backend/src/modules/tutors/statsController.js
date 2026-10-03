/*
 * Imported from `modules/siteStats`, not from `./service.js`.
 *
 * Both modules export a `getPublicStats` and they do not agree: the copy in the
 * tutors module counts live records only, while the one in `siteStats` resolves
 * the admin's overrides on top of those counts. Reading the wrong one is silent —
 * the endpoint still answers 200 with plausible numbers — and it means an
 * override an admin has published never reaches a visitor.
 */
import { getPublicStats as getPublicStatsFromDb } from '../siteStats/service.js'

/**
 * GET /api/public/stats
 *
 * Public aggregate counts for the homepage. No authentication required: the
 * numbers are the same ones a visitor can already infer by browsing the public
 * directory, and none of them identify a tutor.
 *
 * The counts themselves live in `modules/siteStats`, which also resolves the
 * admin's overrides, so this handler is only the public doorway to them.
 *
 * This lives in the tutors module because every count is derived from tutor
 * records, but it is mounted at /api/public rather than /api/tutors: it is a
 * platform-wide summary, not a directory record, and appending it to the
 * directory's `/:id` routes would make the two look interchangeable.
 *
 * There is no query string to validate — the response does not depend on the
 * request — so unlike the directory endpoints this handler has no 400 path.
 *
 * Requirements: 4.2, 4.4
 */
export async function getPublicStats(_req, res) {
  try {
    const stats = await getPublicStatsFromDb()

    res.status(200).json({ success: true, data: stats })
  } catch (error) {
    console.error('[tutors] failed to load public stats:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
    })
  }
}
