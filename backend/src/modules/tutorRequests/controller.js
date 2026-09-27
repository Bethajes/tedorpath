import { createTutorRequest } from './service.js'
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
    const { id } = await createTutorRequest(result.data)

    res.status(201).json({
      success: true,
      data: { id },
    })
  } catch (error) {
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
