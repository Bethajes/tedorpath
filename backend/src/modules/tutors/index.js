import { Router } from 'express'

import { getTutorHandler, listTutorsHandler } from './controller.js'

/**
 * Public tutor directory routes.
 *
 * No authentication required — the directory is public.
 */
export const tutorsRouter = Router()

tutorsRouter.get('/', listTutorsHandler)
tutorsRouter.get('/:id', getTutorHandler)
