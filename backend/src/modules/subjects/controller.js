import { listSubjects } from './service.js'
import { validateListSubjectsQuery } from './validation.js'

/**
 * GET /api/subjects
 *
 * Public subject list used by the onboarding subject picker and the directory
 * filter panel. Returns a flat array of options; the clients group by `category`
 * when they need to.
 */
export async function listSubjectsHandler(req, res) {
  const validation = validateListSubjectsQuery(req.query)

  if (!validation.ok) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid query parameters.',
        fields: validation.fields,
      },
    })
    return
  }

  try {
    const subjects = await listSubjects(validation.data)

    res.status(200).json({ success: true, data: subjects })
  } catch (error) {
    console.error('[subjects] failed to list subjects:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      },
    })
  }
}
