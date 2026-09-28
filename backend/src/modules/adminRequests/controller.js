import {
  deleteTutorRequest,
  getRequestStats,
  getTutorRequest,
  listTutorRequests,
  updateTutorRequest,
} from './service.js'
import { idParamSchema, listQuerySchema, updateRequestSchema } from './validation.js'

/**
 * HTTP layer for the admin API.
 *
 * Errors are logged for operators and reduced to generic messages for
 * clients. Requests contain client personal data, so nothing identifying is
 * written to the log here.
 */

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

export function listRequests(req, res) {
  const parsed = parseOrRespond(listQuerySchema, req.query, res)
  if (!parsed.ok) return

  listTutorRequests(parsed.data)
    .then((result) => {
      res.status(200).json({ success: true, data: result })
    })
    .catch((error) => {
      console.error('[admin] failed to list requests:', error)
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unable to load tutor requests.' },
      })
    })
}

export function getStats(_req, res) {
  getRequestStats()
    .then((stats) => {
      res.status(200).json({ success: true, data: stats })
    })
    .catch((error) => {
      console.error('[admin] failed to load stats:', error)
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unable to load statistics.' },
      })
    })
}

export function getRequest(req, res) {
  const parsed = parseOrRespond(idParamSchema, req.params.id, res)
  if (!parsed.ok) return

  getTutorRequest(parsed.data)
    .then((record) => {
      if (!record) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Tutor request not found.' },
        })
        return
      }
      res.status(200).json({ success: true, data: record })
    })
    .catch((error) => {
      console.error('[admin] failed to load request:', error)
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unable to load this tutor request.' },
      })
    })
}

export function patchRequest(req, res) {
  const idParsed = parseOrRespond(idParamSchema, req.params.id, res)
  if (!idParsed.ok) return

  const bodyParsed = parseOrRespond(updateRequestSchema, req.body ?? {}, res)
  if (!bodyParsed.ok) return

  updateTutorRequest(idParsed.data, bodyParsed.data)
    .then((record) => {
      res.status(200).json({ success: true, data: record })
    })
    .catch((error) => {
      // Prisma throws when the id is well-formed but absent.
      if (error?.code === 'P2025') {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Tutor request not found.' },
        })
        return
      }
      console.error('[admin] failed to update request:', error)
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unable to update this tutor request.' },
      })
    })
}

export function removeRequest(req, res) {
  const parsed = parseOrRespond(idParamSchema, req.params.id, res)
  if (!parsed.ok) return

  deleteTutorRequest(parsed.data)
    .then((deleted) => {
      if (!deleted) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Tutor request not found.' },
        })
        return
      }
      res.status(200).json({ success: true, data: { deleted: true } })
    })
    .catch((error) => {
      console.error('[admin] failed to delete request:', error)
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unable to delete this tutor request.' },
      })
    })
}
