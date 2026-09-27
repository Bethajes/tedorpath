import { Router } from 'express'

import { createTutorRequestHandler } from './controller.js'

/** Routes for the public tutor-request form. */
export const tutorRequestsRouter = Router()

tutorRequestsRouter.post('/', createTutorRequestHandler)
