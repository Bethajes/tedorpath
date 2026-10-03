import { Router } from 'express'

import { optionalAuth } from '../auth/middleware.js'

import { getMarketHandler, getOnboardingConfigHandler } from './controller.js'

/**
 * Reference data for the public "Request a Tutor" wizard.
 *
 * No authentication: countries, currencies, timezones, curricula and subject
 * names are the public vocabulary of the marketplace, and the wizard has to be
 * reachable before anyone has an account.
 */
export const onboardingRouter = Router()

onboardingRouter.get('/config', getOnboardingConfigHandler)

/**
 * Which market this visitor's tutor prices should be shown in, resolved from the
 * country on their account if they have one and from the country the hosting
 * platform reports otherwise.
 *
 * `optionalAuth`, not open: a saved country outranks a network header, and reading
 * it needs the session. It never rejects, so this stays as reachable for a signed-
 * out visitor as it was.
 */
onboardingRouter.get('/market', optionalAuth, getMarketHandler)