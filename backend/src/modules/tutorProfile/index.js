import { Router } from 'express'
import { requireAuth } from '../auth/middleware.js'
import {
  createTutorProfileHandler,
  updateTutorProfileHandler,
  getMyTutorProfileHandler,
  submitTutorProfileHandler,
} from './controller.js'

/**
 * TutorProfile router.
 *
 * All routes require authentication.
 * Requirements: 6.1–6.7
 */
export const tutorProfileRouter = Router()

// All routes require authentication
tutorProfileRouter.use(requireAuth)

/**
 * POST /api/tutor-profile
 * Create a new tutor profile for the authenticated user.
 */
tutorProfileRouter.post('/', createTutorProfileHandler)

/**
 * PATCH /api/tutor-profile
 * Update the authenticated user's tutor profile.
 */
tutorProfileRouter.patch('/', updateTutorProfileHandler)

/**
 * GET /api/tutor-profile/me
 * Get the authenticated user's full tutor profile (including draft fields).
 */
tutorProfileRouter.get('/me', getMyTutorProfileHandler)

/**
 * POST /api/tutor-profile/submit
 * Submit the authenticated user's tutor profile for review.
 */
tutorProfileRouter.post('/submit', submitTutorProfileHandler)