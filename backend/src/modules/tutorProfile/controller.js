import {
  validateCreateTutorProfile,
  validateUpdateTutorProfile,
} from './validation.js'
import {
  createTutorProfile,
  updateTutorProfile,
  getMyTutorProfile,
  submitTutorProfile,
} from './service.js'

/**
 * TutorProfile controller layer.
 *
 * Handles HTTP requests and responses for tutor profile management.
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */

/**
 * Create a new tutor profile.
 *
 * Requirements: 6.1, 6.2
 * POST /api/tutor-profile
 */
export async function createTutorProfileHandler(req, res) {
  try {
    const userId = req.user.id

    const validation = validateCreateTutorProfile(req.body)
    if (!validation.ok) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid profile data.',
          fields: validation.fields,
        },
      })
    }

    const result = await createTutorProfile(userId, validation.data)

    if (!result.success) {
      switch (result.code) {
        case 'PROFILE_ALREADY_EXISTS':
          return res.status(409).json({
            success: false,
            error: {
              code: result.code,
              message: result.message,
            },
          })
        case 'VALIDATION_ERROR':
          return res.status(422).json({
            success: false,
            error: {
              code: result.code,
              message: result.message,
              fields: result.fields,
            },
          })
        default:
          return res.status(500).json({
            success: false,
            error: {
              code: result.code,
              message: result.message,
            },
          })
      }
    }

    return res.status(201).json({
      success: true,
      data: result.data,
    })
  } catch (error) {
    console.error('Error in createTutorProfileHandler:', error)
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    })
  }
}

/**
 * Update the authenticated user's tutor profile.
 *
 * Requirements: 6.3, 6.4
 * PATCH /api/tutor-profile
 */
export async function updateTutorProfileHandler(req, res) {
  try {
    const userId = req.user.id

    const validation = validateUpdateTutorProfile(req.body)
    if (!validation.ok) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid profile data.',
          fields: validation.fields,
        },
      })
    }

    // Don't proceed if there's no data to update
    if (Object.keys(validation.data).length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_DATA',
          message: 'No fields provided for update.',
        },
      })
    }

    const result = await updateTutorProfile(userId, validation.data)

    if (!result.success) {
      switch (result.code) {
        case 'FORBIDDEN':
          return res.status(403).json({
            success: false,
            error: {
              code: result.code,
              message: result.message,
            },
          })
        case 'VALIDATION_ERROR':
          return res.status(422).json({
            success: false,
            error: {
              code: result.code,
              message: result.message,
              fields: result.fields,
            },
          })
        case 'PROFILE_NOT_FOUND':
          return res.status(404).json({
            success: false,
            error: {
              code: result.code,
              message: result.message,
            },
          })
        default:
          return res.status(500).json({
            success: false,
            error: {
              code: result.code,
              message: result.message,
            },
          })
      }
    }

    return res.status(200).json({
      success: true,
      data: result.data,
    })
  } catch (error) {
    console.error('Error in updateTutorProfileHandler:', error)
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    })
  }
}

/**
 * Get the authenticated user's tutor profile.
 *
 * Requirements: 6.5
 * GET /api/tutor-profile/me
 */
export async function getMyTutorProfileHandler(req, res) {
  try {
    const userId = req.user.id

    const result = await getMyTutorProfile(userId)

    if (!result.success) {
      switch (result.code) {
        case 'PROFILE_NOT_FOUND':
          return res.status(404).json({
            success: false,
            error: {
              code: result.code,
              message: result.message,
            },
          })
        default:
          return res.status(500).json({
            success: false,
            error: {
              code: result.code,
              message: result.message,
            },
          })
      }
    }

    return res.status(200).json({
      success: true,
      data: result.data,
    })
  } catch (error) {
    console.error('Error in getMyTutorProfileHandler:', error)
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    })
  }
}

/**
 * Submit a tutor profile for review.
 *
 * Requirements: 6.6, 6.7
 * POST /api/tutor-profile/submit
 */
export async function submitTutorProfileHandler(req, res) {
  try {
    const userId = req.user.id

    const result = await submitTutorProfile(userId)

    if (!result.success) {
      switch (result.code) {
        case 'PROFILE_NOT_FOUND':
          return res.status(404).json({
            success: false,
            error: {
              code: result.code,
              message: result.message,
            },
          })
        case 'ALREADY_UNDER_REVIEW':
        case 'ALREADY_APPROVED':
        case 'INVALID_STATUS':
          return res.status(400).json({
            success: false,
            error: {
              code: result.code,
              message: result.message,
            },
          })
        case 'INCOMPLETE_PROFILE':
          return res.status(422).json({
            success: false,
            error: {
              code: result.code,
              message: result.message,
              fields: result.fields,
            },
          })
        default:
          return res.status(500).json({
            success: false,
            error: {
              code: result.code,
              message: result.message,
            },
          })
      }
    }

    return res.status(200).json({
      success: true,
      data: result.data,
    })
  } catch (error) {
    console.error('Error in submitTutorProfileHandler:', error)
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    })
  }
}