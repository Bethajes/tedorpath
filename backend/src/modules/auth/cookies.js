import { env } from '../../config/env.js'

/**
 * Cookie parsing and serialising.
 *
 * Hand-rolled rather than pulled from `cookie-parser`. There are exactly two
 * cookies in this application, both set here, both read here, and both with the
 * same attributes — a dependency would be a second place where those attributes
 * are decided, and the failure mode of getting them wrong is a browser silently
 * dropping a cookie rather than an error.
 */

/** Longest cookie header accepted, as a guard against a pathological request. */
const MAX_COOKIE_HEADER_BYTES = 8 * 1024

export const SESSION_COOKIE_NAME = 'tedor_session'

/**
 * Where an anonymous learner's country is kept.
 *
 * A signed-in learner's country lives on their account, which is better: it follows
 * them to another device and it survives the cookie being cleared. This exists only
 * for the ones with no account, and it is what lets the request wizard — reachable
 * before anyone signs up — still decide which of a tutor's prices the rest of the
 * site shows them.
 *
 * A two-letter country code rather than a market code, because the country is what
 * the learner actually chose. The platform turns that into a market, so changing
 * how markets map onto countries needs no migration for cookies already in browsers.
 */
export const COUNTRY_COOKIE_NAME = 'tedor_country'

/**
 * How long a remembered country lasts.
 *
 * A year, and deliberately long. What is being remembered is "this learner shops in
 * Ethiopian birr", which is not a preference that expires; the only thing that would
 * change it is the learner choosing elsewhere, which overwrites the cookie.
 */
export const COUNTRY_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

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

/**
 * The remembered country from the request's cookies, or null.
 *
 * Shape-checked and nothing more. The value is a country code, and the only thing
 * it is allowed to do downstream is be looked up in the market registry — so a
 * forged value can at worst name a country we treat as "somewhere else". It is
 * deliberately not trusted to be a real country here, and deliberately not allowed
 * to name a market: a cookie that could say "ETB" would be a second, unsigned
 * market selector, which is precisely what this whole change removes.
 */
export function readCountryCookie(req) {
  const raw = parseCookies(req.headers.cookie)[COUNTRY_COOKIE_NAME]
  if (typeof raw !== 'string') return null

  const code = raw.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : null
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
  // Production is served over HTTPS, so the cookie must never travel in
  // the clear. Local development runs on http://localhost, where Secure would make
  // the browser drop the cookie entirely, so it is conditional.
  if (env.isProduction) parts.push('Secure')

  return parts.join('; ')
}

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

/**
 * Remembers the country a learner said they are in.
 *
 * HttpOnly, so the browser's own copy of it cannot be edited from the page. That
 * matters more here than it would for a session cookie: this one decides which
 * price a learner is shown, and a value they could rewrite in the console would put
 * the market selector back in reach of anyone who opened devtools.
 */
export function setCountryCookie(res, countryCode) {
  res.append(
    'Set-Cookie',
    serialize(COUNTRY_COOKIE_NAME, countryCode.toUpperCase(), {
      maxAge: COUNTRY_COOKIE_MAX_AGE_SECONDS,
    }),
  )
}