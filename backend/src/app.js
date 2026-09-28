import cors from 'cors'
import express from 'express'

import { env } from './config/env.js'
import { adminRequestsRouter } from './modules/adminRequests/index.js'
import { tutorRequestsRouter } from './modules/tutorRequests/index.js'
import { healthRouter } from './routes/health.js'

/**
 * Express app.
 *
 * The origin allow-list comes from CORS_ORIGINS so it can be tightened per
 * environment; a wildcard is never used implicitly.
 */
export function createApp() {
  const app = express()

  const allowedOrigins = env.corsOrigins
  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin/non-browser callers (curl, health checks) send no origin.
        if (!origin) {
          callback(null, true)
          return
        }
        callback(null, allowedOrigins.includes(origin))
      },
    }),
  )
  app.use(express.json({ limit: '100kb' }))

  app.use('/api/health', healthRouter)
  app.use('/api/tutor-requests', tutorRequestsRouter)
  // Admin surface. Not public: guarded by requireAdmin (see
  // src/middleware/adminAuth.js) and disabled in production unless
  // ADMIN_API_TOKEN is configured.
  app.use('/api/admin', adminRequestsRouter)

  // Malformed JSON bodies are handled here so they do not surface as a 500.
  app.use((error, _req, res, _next) => {
    if (error?.type === 'entity.parse.failed' || error instanceof SyntaxError) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Request body must be valid JSON.' },
      })
      return
    }
    console.error('[api] unhandled error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
    })
  })

  return app
}
