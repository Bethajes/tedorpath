import { Router } from 'express'

import { optionalAuth } from '../auth/middleware.js'

import { getTutorHandler, listTutorsHandler } from './controller.js'
import { getPublicStats } from './statsController.js'

/**
 * Public tutor directory routes.
 *
 * No authentication required — the directory is public. `optionalAuth` rather than
 * no middleware at all: it never rejects, it only attaches the user when a session
 * happens to be present, and the saved country on that account is the strongest
 * signal the pricing code has about which of a tutor's rates to show.
 */
export const tutorsRouter = Router()

tutorsRouter.get('/', optionalAuth, listTutorsHandler)
tutorsRouter.get('/:id', optionalAuth, getTutorHandler)

/**
 * Public homepage statistics.
 *
 * Mounted at /api/public in app.js, so this handler answers
 * GET /api/public/stats. It is a separate router rather than a
 * `tutorsRouter.get('/stats', ...)` entry because the directory's `/:id`
 * route is a catch-all: a stats endpoint living under /api/tutors/stats would
 * be indistinguishable from a tutor lookup by id.
 */
export const publicRouter = Router()

publicRouter.get('/stats', getPublicStats)