import { Router } from 'express'

import { requireAdmin } from '../../middleware/adminAuth.js'

import { getSiteStats, patchSiteStats } from './controller.js'

/**
 * Admin routes for the homepage statistics overrides.
 *
 * Mounted under the existing `/api/admin` prefix, behind `requireAdmin`, so the
 * whole surface is closed by default and the guard cannot be forgotten on a
 * future endpoint.
 *
 * This writes numbers that appear on the public homepage, so it is deliberately
 * the smallest admin surface in the app: four integers, one key each, no free
 * text and no path to create a metric that does not exist.
 */
export const adminSiteStatsRouter = Router()

adminSiteStatsRouter.use(requireAdmin)

adminSiteStatsRouter.get('/site-stats', getSiteStats)
adminSiteStatsRouter.patch('/site-stats', patchSiteStats)
