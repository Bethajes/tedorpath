import cors from 'cors'
import express from 'express'
import path from 'node:path'

import { env } from './config/env.js'
import { adminAnalyticsRouter } from './modules/adminAnalytics/index.js'
import { adminRequestsRouter } from './modules/adminRequests/index.js'
import { adminTutorsRouter } from './modules/adminTutors/index.js'
import { authRouter } from './modules/auth/index.js'
import { onboardingRouter } from './modules/onboarding/index.js'
import { adminSiteStatsRouter } from './modules/siteStats/index.js'
import { subjectsRouter } from './modules/subjects/index.js'
import { uploadsRouter } from './modules/uploads/index.js'
import { tutorProfileRouter } from './modules/tutorProfile/index.js'
import { tutorRequestsRouter } from './modules/tutorRequests/index.js'
import { publicRouter, tutorsRouter } from './modules/tutors/index.js'
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
      // Sessions are carried in an HttpOnly cookie, so a cross-origin request
      // from an allow-listed frontend has to be allowed to send it. This is only
      // safe because the origin above is an explicit allow-list: the cors
      // package refuses to pair `*` with credentials, and we never ask for it.
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '100kb' }))

  app.use('/api/health', healthRouter)
  app.use('/api/auth', authRouter)
  // Reference data the public request wizard loads on entry: countries,
  // currencies, timezones, curricula and subjects.
  app.use('/api/onboarding', onboardingRouter)
  app.use('/api/tutor-requests', tutorRequestsRouter)
  app.use('/api/tutors', tutorsRouter)
  app.use('/api/public', publicRouter)
  app.use('/api/subjects', subjectsRouter)
  app.use('/api/tutor-profile', tutorProfileRouter)
  // Uploaded profile photos. Mounted before the 404 fallback below so stored
  // URLs keep resolving.
  app.use('/api/tutor-profile', uploadsRouter)

  // Uploaded images, served straight from disk. `nosniff` matters here: it
  // stops a browser from re-interpreting a file whose extension says image but
  // whose content is something else.
  app.use(
    '/api/uploads',
    express.static(path.resolve(env.uploadDir), {
      index: false,
      dotfiles: 'deny',
      maxAge: '30d',
      setHeaders(res) {
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.setHeader('Content-Disposition', 'inline')
      },
    }),
  )
  // Admin surface. Not public: guarded by requireAdmin (see
  // src/middleware/adminAuth.js) and disabled in production unless
  // ADMIN_API_TOKEN is configured.
  app.use('/api/admin', adminRequestsRouter)
  app.use('/api/admin', adminTutorsRouter)
  app.use('/api/admin', adminSiteStatsRouter)
  // Read-only dashboard aggregates. Registered last so the queue routers above
  // keep first refusal on their own paths.
  app.use('/api/admin', adminAnalyticsRouter)

  // Unmatched /api paths answer with the standard error envelope. Express's
  // default 404 is an HTML page, which a JSON client cannot parse — it reports
  // "unexpected response" instead of the real cause (a wrong or missing route).
  app.use('/api', (_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Endpoint not found.' },
    })
  })

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
