import { env } from '../../config/env.js'

/**
 * Session cookie handling.
 *
 * The raw session token lives here and nowhere else the browser can read it:
 * it is sent as an HttpOnly cookie, so JavaScript (including anything an XSS
 * payload might run) cannot get at it, and the database only ever stores its
 * SHA-256 digest.
 *
 * Cookies are parsed by hand rather than pulled in as a dependency. The format
 * is small, fixed and well understood, and this keeps the auth surface
 * auditable in one file.
 */

export const SESSION_COOKIE_NAME = 'tedor_session'

/** Real cookies are a few hundred bytes; anything larger is an attack. */
const MAX_COOKIE_HEADER_BYTES = 8192

/**
 * Parses a `Cookie` header into a plain object.
 *
 * Malformed pairs are skipped rather than throwing, and a percent-decoding
 * failure falls back to the raw value, so a hostile header cannot crash a
 * request.
 */
export function parseCookies(header) {
  const cookies = {}
  if (typeof header !== 'string' || header.length > MAX_COOKIE_HEADER_BYTES) return cookies

  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=')
    if (separator < 1) continue

    const name = pair.slice(0, separator).trim()
    if (!name) continue

    const raw = pair.slice(separator + 1).trim()
    try {
      cookies[name] = decodeURIComponent(raw)
    } catch {
      cookies[name] = raw
    }
  }

  return cookies
}

/** The session token from the request's cookies, or an empty string. */
export function readSessionCookie(req) {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE_NAME] ?? ''
}

function serialize(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`]

  if (typeof options.maxAge === 'number') parts.push(`Max-Age=${Math.floor(options.maxAge)}`)
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`)
  parts.push(`Path=${options.path ?? '/'}`)

  // Never readable from JavaScript.
  parts.push('HttpOnly')
  // Blocks cross-site request forgery while still being sent on ordinary
  // top-level navigations, which is all a session cookie needs.
  parts.push('SameSite=Lax')
  // Production is served over HTTPS, so the cookie must never travel in the
  // clear. Local development runs on http://localhost, where Secure would make
  // the browser drop the cookie entirely, so it is conditional.
  if (env.isProduction) parts.push('Secure')

  return parts.join('; ')
}

/** Issues the session cookie. */
export function setSessionCookie(res, token, expiresAt) {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
  res.append('Set-Cookie', serialize(SESSION_COOKIE_NAME, token, { maxAge, expires: expiresAt }))
}

/**
 * Clears the session cookie.
 *
 * The attributes have to match the ones used when setting it, otherwise the
 * browser treats this as a different cookie and the original survives.
 */
export function clearSessionCookie(res) {
  res.append('Set-Cookie', serialize(SESSION_COOKIE_NAME, '', { maxAge: 0, expires: new Date(0) }))
}
