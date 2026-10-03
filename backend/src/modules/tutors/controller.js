import { readCountryCookie } from '../auth/cookies.js'
import { countryFromHeaders } from '../../lib/requestCountry.js'

import { getTutorById, isKnownMarket, listTutors, resolveMarket } from './service.js'
import { validateListTutorsQuery } from './validation.js'

/**
 * GET /api/tutors
 *
 * Public tutor directory. Returns only APPROVED profiles.
 * Requirements: 4.1–4.11
 */
/**
 * The market to price this request in, worked out from who is asking.
 *
 * Shared by both public handlers so the directory and a profile reached from it
 * cannot price the same tutor differently — which is the failure that made the
 * market switcher necessary in the first place.
 *
 * The order lives in `resolveMarket`. This only gathers the inputs, because
 * collecting them in two places is how the two would come to disagree.
 *
 * `?market=` still wins when present and valid. Nothing in the interface offers it
 * any more; it is here so a link that already carries one keeps showing what it
 * showed when it was shared.
 */
async function marketFor(req, requested) {
  return resolveMarket({
    requested,
    // Set by optionalAuth when a session cookie is present, absent otherwise.
    savedCountry: req.user?.countryCode ?? null,
    rememberedCountry: readCountryCookie(req),
    requestCountry: countryFromHeaders(req),
  })
}

export async function listTutorsHandler(req, res) {
  const result = validateListTutorsQuery(req.query)

  if (!result.ok) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid query parameters.',
        fields: result.fields,
      },
    })
    return
  }

  try {
    // Rejected rather than quietly defaulted. On a profile link a stale
    // `?market=` is ignored, but on the directory a visitor who asked to be shown
    // something they cannot be shown should be told, not handed a different set
    // of tutors as though it were what they asked for.
    if (result.data.market && !(await isKnownMarket(result.data.market))) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters.',
          fields: [
            {
              field: 'market',
              message: `We do not offer prices in ${result.data.market}.`,
            },
          ],
        },
      })
    }

    // No `?market=` is the normal case now, and the common one: the price shown is
    // decided by who is asking rather than by anything they have to pass.
    const { market } = await marketFor(req, result.data.market)

    const { items, pagination } = await listTutors({ ...result.data, market })

    res.status(200).json({
      success: true,
      data: {
        items,
        pagination,
        // Echoed so the client can label a price in a summary or a share link
        // without hardcoding which currency it is looking at. It is not a control:
        // nothing in the interface reads it back to change anything.
        market,
      },
    })
  } catch (error) {
    console.error('[tutors] failed to list tutors:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      },
    })
  }
}

/**
 * GET /api/tutors/:id
 *
 * Public tutor profile. Returns 404 for non-existent or non-APPROVED profiles.
 *
 * `market` is read from the query rather than validated as strictly as the
 * directory's, because this endpoint is linked to from a profile card that
 * carries the visitor's market through in the URL. An unrecognised value falls
 * back to the default inside the service rather than 400-ing a page view over a
 * stale link.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export async function getTutorHandler(req, res) {
  const { id } = req.params

  try {
    const { market } = await marketFor(req, req.query.market)
    const profile = await getTutorById(id, market)

    if (!profile) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tutor not found.' },
      })
      return
    }

    res.status(200).json({ success: true, data: profile })
  } catch (error) {
    console.error('[tutors] failed to get tutor by id:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
    })
  }
}
