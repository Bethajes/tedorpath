import { Router } from 'express'

import { requireAdmin } from '../../middleware/adminAuth.js'

import { getActivityFeed, getDashboard } from './controller.js'

/**
 * Admin analytics routes.
 *
 * Mounted under the existing `/api/admin` prefix, behind `requireAdmin`, so the
 * whole surface is closed by default and the guard cannot be forgotten on a
 * future endpoint.
 *
 * Read-only. Nothing here writes, and nothing here can change a request, a
 * profile or a published statistic — a dashboard that could edit its own figures
 * would be a second way to be wrong about them.
 */
export const adminAnalyticsRouter = Router()

adminAnalyticsRouter.use(requireAdmin)

adminAnalyticsRouter.get('/dashboard', getDashboard)
adminAnalyticsRouter.get('/activity', getActivityFeed)
