import { countryFromHeaders } from '../../lib/requestCountry.js'
import { getOnboardingConfig } from './service.js'
import { resolveMarket } from '../tutors/service.js'

/**
 * GET /api/onboarding/config
 *
 * HTTP layer for the wizard's reference data.
 *
 * Read-only and public: the wizard is the first thing an anonymous visitor
 * sees, so there is nothing here to authenticate.
 */
export async function getOnboardingConfigHandler(req, res) {
  try {
    const config = await getOnboardingConfig()

    res.status(200).json({ success: true, data: config })
  } catch (error) {
    console.error('[onboarding] failed to load configuration:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'We could not load the form configuration. Please try again.',
      },
    })
  }
}

/**
 * GET /api/onboarding/market
 *
 * Which market this visitor's tutor prices should be shown in.
 *
 * Public, and it reveals nothing useful: the answer is a market code, and the
 * country that produced it is a two-letter code the caller already sent or the CDN
 * already knew.
 *
 * This exists because a tutor states one price per market, and every surface that
 * shows a price has to know which one — before anyone has filled in a form. It
 * answers with a market, not with a choice: there is no way to change the market
 * through the interface, and this endpoint is not that.
 */
export async function getMarketHandler(req, res) {
  // Set by optionalAuth when a session cookie is present, absent otherwise. Same
  // resolution the directory uses, so the label a client shows and the price it
  // fetches cannot disagree.
  const savedCountry = req.user?.countryCode ?? null
  const requestCountry = countryFromHeaders(req)

  const { market, source } = await resolveMarket({ savedCountry, requestCountry })

  res.status(200).json({
    success: true,
    data: {
      market,
      /*
       * Which of the three answers decided this.
       *
       * Reported so the resolution can be tested and debugged from outside, not so
       * the interface can mention it. A learner is never told that a price was
       * chosen by their network — showing "$20" without a paragraph about why is
       * the entire requirement.
       */
      source,
      // The saved country when there is one, otherwise the header's. Null is a real
      // answer meaning "we do not know", and is deliberately not collapsed into a
      // default here.
      country: savedCountry ?? requestCountry,
      // True whenever the market came from something other than the fallback, so a
      // caller can tell "we know" from "we guessed" without re-deriving the order.
      detected: source !== 'default',
    },
  })
}