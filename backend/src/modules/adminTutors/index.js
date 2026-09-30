import { Router } from 'express'

import { requireAdmin } from '../../middleware/adminAuth.js'

import { getTutor, listTutors, patchTutorStatus, patchTutorVerification } from './controller.js'

/**
 * Admin tutor moderation routes.
 *
 * Mounted under the existing `/api/admin` prefix. Every route sits behind
 * `requireAdmin`, so the whole surface is closed by default and the guard
 * cannot be forgotten on a new endpoint.
 *
 * `/verification` is a separate path rather than a field on `/status` so that
 * saving a document check can never be a side effect of a moderation decision.
 * Requirements: 7.1, 7.2, 7.3
 */
export const adminTutorsRouter = Router()

adminTutorsRouter.use(requireAdmin)

adminTutorsRouter.get('/tutors', listTutors)
adminTutorsRouter.get('/tutors/:id', getTutor)
adminTutorsRouter.patch('/tutors/:id/status', patchTutorStatus)
adminTutorsRouter.patch('/tutors/:id/verification', patchTutorVerification)
