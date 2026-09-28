import { Router } from 'express'

import { requireAdmin } from '../../middleware/adminAuth.js'

import {
  getRequest,
  getStats,
  listRequests,
  patchRequest,
  removeRequest,
} from './controller.js'

/**
 * Admin routes. Every route sits behind `requireAdmin`, so the whole surface
 * is closed by default and the guard cannot be forgotten on a new endpoint.
 */
export const adminRequestsRouter = Router()

adminRequestsRouter.use(requireAdmin)

adminRequestsRouter.get('/stats', getStats)
adminRequestsRouter.get('/tutor-requests', listRequests)
adminRequestsRouter.get('/tutor-requests/:id', getRequest)
adminRequestsRouter.patch('/tutor-requests/:id', patchRequest)
adminRequestsRouter.delete('/tutor-requests/:id', removeRequest)
