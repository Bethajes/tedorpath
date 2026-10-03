import { setCountryCookie } from '../auth/cookies.js'
import {
  REFERENCE_NOT_FOUND,
  TUTOR_PROFILE_NOT_FOUND,
  createTutorRequest,
} from './service.js'
import { validateTutorRequest } from './validation.js'

/**
 * HTTP layer for POST /api/tutor-requests.
 *
 * Keeps personal data out of the logs: only the new id is ever logged.
 */
export async function createTutorRequestHandler(req, res) {
  const result = validateTutorRequest(req.body)

  if (!result.ok) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid tutor request.',
        fields: result.fields,
      },
    })
    return
  }

  try {
    // `req.user` is set by optionalAuth. It is null for an anonymous visitor,
    // which is still a fully supported way to ask for a tutor — the form simply
    // does not link the request to an account.
    const { id } = await createTutorRequest(result.data, { userId: req.user?.id ?? null })

    res.status(201).json({
      success: true,
      data: { id },
    })
  } catch (error) {
    // A reference from the wizard that is well-formed but names nothing is the
    // client's problem, not ours: the catalogue changed under a form they had
    // open since before it did. Reported in the same shape as a schema error so
    // the step that owns the field can highlight it.
    if (error?.code === TUTOR_PROFILE_NOT_FOUND) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid tutor request.',
          fields: [
            { field: 'tutorProfileId', message: 'The selected tutor profile does not exist.' },
          ],
        },
      })
      return
    }

    if (error?.code === REFERENCE_NOT_FOUND) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid tutor request.',
          fields: [{ field: error.field, message: error.message }],
        },
      })
      return
    }

    // Log the real cause for operators, but never leak it to the client.
    console.error('[tutor-requests] failed to store request:', error)

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong while submitting your request. Please try again.',
      },
    })
  }
}