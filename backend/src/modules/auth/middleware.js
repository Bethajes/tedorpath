import { findSessionByToken } from './service.js'
import { readSessionCookie } from './cookies.js'

/**
 * Session authentication.
 *
 * This is a completely separate mechanism from the admin API's shared token
 * (see src/middleware/adminAuth.js). Nothing here grants staff access: the
 * `role` on the user is only ever used for display, and the admin routes still
 * require the admin token.
 *
 * The contract is that `req.user` exists if and only if the request carried a
 * valid, unexpired, unrevoked session cookie.
 */

/**
 * Resolves the session on a request, if there is one.
 *
 * A database error is treated as "no session" rather than propagated: an
 * unauthenticated visitor should not be able to turn a database blip into a
 * stack trace.
 */
async function loadSession(req) {
  try {
    return await findSessionByToken(readSessionCookie(req))
  } catch (error) {
    console.error('[auth] failed to read session:', error)
    return null
  }
}

/** Rejects the request unless it carries a valid session. */
export async function requireAuth(req, res, next) {
  const session = await loadSession(req)

  if (!session) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Sign in to continue.' },
    })
    return
  }

  req.session = session
  req.user = session.user
  next()
}

/**
 * Attaches the user when a session is present but never rejects.
 *
 * For endpoints that work for everyone but behave better for a signed-in
 * visitor — the public tutor-request form, for example, links the request to
 * the account when there is one and stays anonymous when there is not.
 */
export async function optionalAuth(req, _res, next) {
  const session = await loadSession(req)

  if (session) {
    req.session = session
    req.user = session.user
  }

  next()
}
