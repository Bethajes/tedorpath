import { getTutorById, listTutors } from './service.js'
import { validateListTutorsQuery } from './validation.js'

/**
 * GET /api/tutors
 *
 * Public tutor directory. Returns only APPROVED profiles.
 * Requirements: 4.1–4.11
 */
export async function listTutorsHandler(req, res) {
  const result = validateListTutorsQuery(req.query)

  if (!result.ok) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid query parameters.',
        fields: result.fields,
      },
    })
    return
  }

  try {
    const { items, pagination } = await listTutors(result.data)

    res.status(200).json({
      success: true,
      data: { items, pagination },
    })
  } catch (error) {
    console.error('[tutors] failed to list tutors:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      },
    })
  }
}

/**
 * GET /api/tutors/:id
 *
 * Public tutor profile. Returns 404 for non-existent or non-APPROVED profiles.
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export async function getTutorHandler(req, res) {
  const { id } = req.params

  try {
    const profile = await getTutorById(id)

    if (!profile) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tutor not found.' },
      })
      return
    }

    res.status(200).json({ success: true, data: profile })
  } catch (error) {
    console.error('[tutors] failed to get tutor by id:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
    })
  }
}
