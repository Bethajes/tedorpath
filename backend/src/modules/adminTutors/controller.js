import {
  getTutorProfileAdmin,
  listTutorProfiles,
  updateTutorProfileStatus,
} from './service.js'
import { idParamSchema, listQuerySchema, updateStatusSchema } from './validation.js'

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
 */
function parseStatusOrRespond(body, res) {
  const result = updateStatusSchema.safeParse(body ?? {})

  if (result.success) return { ok: true, data: result.data }

  res.status(422).json({
    success: false,
    error: {
      code: 'INVALID_STATUS',
      message: 'Invalid moderation status.',
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
