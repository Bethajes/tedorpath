import { Router } from 'express'

import { optionalAuth } from '../auth/middleware.js'

import { createTutorRequestHandler } from './controller.js'

/**
 * Routes for the public tutor-request form.
 *
 * `optionalAuth` never blocks the request: it attaches `req.user` when the
 * visitor happens to be signed in, so their request is linked to their account.
 * Browsers send the session cookie to a same-origin /api automatically, so
 * signed-in and anonymous visitors use the exact same form and endpoint.
 */
export const tutorRequestsRouter = Router()

tutorRequestsRouter.post('/', optionalAuth, createTutorRequestHandler)
