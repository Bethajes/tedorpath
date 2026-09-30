import { getPublicStats as getPublicStatsFromDb } from './service.js'

/**
 * GET /api/public/stats
 *
 * Public aggregate counts for the homepage. No authentication required: the
 * numbers are the same ones a visitor can already infer by browsing the public
 * directory, and none of them identify a tutor.
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
