import {
  getTutorProfileAdmin,
  listTutorProfiles,
  updateTutorProfileStatus,
  updateTutorVerification,
} from './service.js'
import {
  idParamSchema,
  listQuerySchema,
  updateStatusSchema,
  updateVerificationSchema,
} from './validation.js'

/**
 * HTTP layer for admin tutor moderation.
 *
 * Errors are logged for operators and reduced to generic messages for clients.
 * Nothing identifying is written to the log: the queries behind these
 * endpoints read personal data.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

/** A malformed path or query value is a 400, matching the rest of the admin API. */
function parseOrRespond(schema, value, res) {
  const result = schema.safeParse(value)
  if (result.success) return { ok: true, data: result.data }

  res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request.',
      fields: result.error.issues.map((issue) => ({
        field: issue.path.join('.') || '_',
        message: issue.message,
      })),
    },
  })
  return { ok: false }
}

/**
 * The moderation payload is validated separately because Requirement 7.4 names
 * the status code explicitly: an unusable `status` is 422, not 400. The value
 * is well-formed JSON and reaches the right handler — it just is not a state
 * this admin is allowed to set.
 *
 * The response code is not fixed, though. A rejection with no reason and a
 * request for information with no message are both 422s, but the admin UI needs
 * to tell them apart, so the schema tags those two issues with their own
 * `errorCode` (REJECTION_REASON_REQUIRED / ADMIN_MESSAGE_REQUIRED) and the
 * first one present becomes the response code. Everything else is a plain
 * INVALID_STATUS.
 * Requirements: 22.1, 22.2
 */
function parseStatusOrRespond(body, res) {
  const result = updateStatusSchema.safeParse(body ?? {})

  if (result.success) return { ok: true, data: result.data }

  const specific = result.error.issues.find(
    (issue) => typeof issue.params?.errorCode === 'string',
  )
  const code = specific?.params.errorCode ?? 'INVALID_STATUS'
  const message = specific
    ? specific.message
    : 'Invalid moderation status.'

  res.status(422).json({
    success: false,
    error: {
      code,
      message,
      fields: result.error.issues.map((issue) => ({
        field: issue.path.join('.') || '_',
        message: issue.message,
      })),
    },
  })
  return { ok: false }
}

/** Prisma throws P2025 when the id is well-formed but the row is gone. */
function isMissingRow(error) {
  return typeof error?.code === 'string' && error.code === 'P2025'
}

export function listTutors(req, res) {
  const parsed = parseOrRespond(listQuerySchema, req.query, res)
  if (!parsed.ok) return

  listTutorProfiles(parsed.data)
    .then((result) => {
      res.status(200).json({ success: true, data: result })
    })
    .catch((error) => {
      console.error('[admin] failed to list tutor profiles:', error)
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unable to load tutor profiles.' },
      })
    })
}

export function getTutor(req, res) {
  const parsed = parseOrRespond(idParamSchema, req.params.id, res)
  if (!parsed.ok) return

  getTutorProfileAdmin(parsed.data)
    .then((profile) => {
      if (!profile) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Tutor profile not found.' },
        })
        return
      }
      res.status(200).json({ success: true, data: profile })
    })
    .catch((error) => {
      console.error('[admin] failed to load tutor profile:', error)
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unable to load this tutor profile.' },
      })
    })
}

export function patchTutorStatus(req, res) {
  const idParsed = parseOrRespond(idParamSchema, req.params.id, res)
  if (!idParsed.ok) return

  const bodyParsed = parseStatusOrRespond(req.body, res)
  if (!bodyParsed.ok) return

  updateTutorProfileStatus(idParsed.data, bodyParsed.data)
    .then((profile) => {
      res.status(200).json({ success: true, data: profile })
    })
    .catch((error) => {
      if (isMissingRow(error)) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Tutor profile not found.' },
        })
        return
      }
      console.error('[admin] failed to update tutor profile status:', error)
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unable to update this tutor profile.' },
      })
    })
}

/**
 * Saves verification notes, checklist state and verification status.
 *
 * A malformed body is a 400 here rather than the 422 used by the status
 * endpoint: unlike a status, none of these fields is a moderation decision, so
 * there is no "well-formed but not allowed" case to distinguish.
 * Requirements: 26.3, 27.3, 27.4, 27.5
 */
export function patchTutorVerification(req, res) {
  const idParsed = parseOrRespond(idParamSchema, req.params.id, res)
  if (!idParsed.ok) return

  const bodyParsed = parseOrRespond(updateVerificationSchema, req.body, res)
  if (!bodyParsed.ok) return

  updateTutorVerification(idParsed.data, bodyParsed.data)
    .then((profile) => {
      res.status(200).json({ success: true, data: profile })
    })
    .catch((error) => {
      if (isMissingRow(error)) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Tutor profile not found.' },
        })
        return
      }
      console.error('[admin] failed to update tutor verification:', error)
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unable to update this tutor profile.' },
      })
    })
}
