import { Router } from 'express'

import { requireAdmin } from '../../middleware/adminAuth.js'

import { getTutor, listTutors, patchTutorStatus } from './controller.js'

/**
 * Admin tutor moderation routes.
 *
 * Mounted under the existing `/api/admin` prefix. Every route sits behind
 * `requireAdmin`, so the whole surface is closed by default and the guard
 * cannot be forgotten on a new endpoint.
 *
 * Requirements: 7.1, 7.2, 7.3
 */
export const adminTutorsRouter = Router()

adminTutorsRouter.use(requireAdmin)

adminTutorsRouter.get('/tutors', listTutors)
adminTutorsRouter.get('/tutors/:id', getTutor)
adminTutorsRouter.patch('/tutors/:id/status', patchTutorStatus)
