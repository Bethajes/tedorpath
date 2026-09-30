import { Router } from 'express'

import { listSubjectsHandler } from './controller.js'

/**
 * Public subject reference data.
 *
 * No authentication required — the subjects a tutor can pick from are not
 * private, and the unauthenticated tutor directory filters need them too.
 */
export const subjectsRouter = Router()

subjectsRouter.get('/', listSubjectsHandler)
