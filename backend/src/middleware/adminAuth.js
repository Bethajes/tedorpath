import { timingSafeEqual } from 'node:crypto'

import { env } from '../config/env.js'

/**
 * Guard for the admin API.
 *
 * DEVELOPMENT-ONLY ACCESS MECHANISM — NOT AUTHENTICATION.
 *
 * There is no user system yet. This checks one shared secret, supplied as
 * `Authorization: Bearer <token>` or `X-Admin-Token: <token>`, so the admin
 * endpoints are not publicly readable and the boundary can be tested. It has
 * no users, roles, sessions, expiry or audit trail, and anyone holding the
 * token has full access.
 *
 * REPLACEMENT PLAN: replace this middleware with real staff authentication
 * (staff accounts + hashed passwords, or an identity provider) before this is
 * deployed publicly. The rest of the admin module does not need to change —
 * the controllers only ever see an already-authenticated request.
 *
 * The token is read from the backend environment only. It is never exposed to
 * the browser bundle, and the admin UI asks the operator to enter it at
 * runtime rather than shipping it in `VITE_*` variables.
 */

/** Constant-time comparison that tolerates differing lengths. */
function safeEqual(a, b) {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  if (left.length !== right.length) {
    // Still perform a comparison to keep timing roughly uniform.
    timingSafeEqual(left, left)
    return false
  }
  return timingSafeEqual(left, right)
}

function readToken(req) {
  const header = req.get('authorization')
  if (header && /^Bearer\s+/i.test(header)) {
    return header.replace(/^Bearer\s+/i, '').trim()
  }
  const custom = req.get('x-admin-token')
  return custom ? custom.trim() : ''
}

export function requireAdmin(req, res, next) {
  // Defence in depth: even if configuration changes at runtime, production
  // without a token serves no admin data at all.
  if (env.isProduction && !env.adminApiToken) {
    res.status(503).json({
      success: false,
      error: { code: 'ADMIN_DISABLED', message: 'The admin API is not available.' },
    })
    return
  }

  const expected = env.adminApiToken
  const provided = readToken(req)

  // No token configured (non-production): the guard is a no-op so local
  // development is not blocked, but this must never happen in production,
  // which is handled above.
  if (!expected) {
    next()
    return
  }

  if (!provided || !safeEqual(provided, expected)) {
    // Deliberately vague: never reveal whether a token was close.
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'A valid admin access token is required.' },
    })
    return
  }

  next()
}
