import { Router } from 'express'

import { getTutorHandler, listTutorsHandler } from './controller.js'
import { getPublicStats } from './statsController.js'

/**
 * Public tutor directory routes.
 *
 * No authentication required — the directory is public.
 */
export const tutorsRouter = Router()

tutorsRouter.get('/', listTutorsHandler)
tutorsRouter.get('/:id', getTutorHandler)

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
