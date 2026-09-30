import 'dotenv/config'

/**
 * Central place for reading environment variables.
 *
 * The process should fail fast on a missing DATABASE_URL rather than throwing
 * a confusing driver error on the first request.
 */

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const env = {
  get nodeEnv() {
    return process.env.NODE_ENV ?? 'development'
  },
  get isProduction() {
    return this.nodeEnv === 'production'
  },
  get port() {
    const raw = process.env.PORT
    if (!raw) return 4000
    const parsed = Number.parseInt(raw, 10)
    if (Number.isNaN(parsed)) {
      throw new Error(`PORT must be a number, received "${raw}"`)
    }
    return parsed
  },
  get databaseUrl() {
    return requireEnv('DATABASE_URL')
  },
  /** Allowed browser origins. An empty list means "no cross-origin access". */
  get corsOrigins() {
    return (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  },
  /**
   * Shared secret for the admin API.
   *
   * This is a development stand-in for real authentication, NOT a login
   * system: it is a single static token with no users, roles, sessions or
   * expiry. It exists so the admin endpoints are not publicly readable while
   * proper authentication is still to be built.
   *
   * It must only ever live in the backend environment. Anything prefixed
   * `VITE_` is inlined into the browser bundle and is therefore public.
   */
  get adminApiToken() {
    return process.env.ADMIN_API_TOKEN ?? ''
  },
  /**
   * How long a newly issued sign-in session stays valid.
   *
   * Sessions are opaque random tokens stored hashed, so there is no signing
   * secret to keep and nothing to rotate here: revocation is a database write
   * and expiry is a timestamp on the row.
   */
  get sessionTtlDays() {
    const raw = process.env.SESSION_TTL_DAYS
    if (!raw) return 30
    const parsed = Number.parseInt(raw, 10)
    if (Number.isNaN(parsed) || parsed <= 0) {
      throw new Error('SESSION_TTL_DAYS must be a positive whole number of days')
    }
    return parsed
  },
  /**
   * Google sign-in (OAuth 2.0 / OpenID Connect).
   *
   * Both belong in the backend environment and nowhere else: everything named
   * `VITE_*` is inlined into the browser bundle. Leaving `googleClientId` empty
   * simply switches the provider off — the sign-in buttons stay in the UI and
   * the endpoint answers with a clear "not configured" rather than pretending.
   */
  get googleClientId() {
    return process.env.GOOGLE_CLIENT_ID?.trim() ?? ''
  },
  /**
   * Whether to *offer* Google sign-in.
   *
   * Requires a client id, and can be switched off explicitly with
   * `GOOGLE_AUTH_ENABLED=false` while the OAuth client is still being set up.
   * That matters: the sign-in page only shows a provider the server says it can
   * handle, so a half-configured integration disappears from the UI instead of
   * sending visitors to a Google error page.
   */
  get googleAuthEnabled() {
    const flag = process.env.GOOGLE_AUTH_ENABLED?.trim().toLowerCase()
    if (flag === 'false' || flag === '0' || flag === 'off' || flag === 'no') return false
    return Boolean(this.googleClientId)
  },
  /**
   * Optional. PKCE means a public client does not need a secret, but a
   * confidential "Web application" client is issued one and Google will refuse
   * the token exchange without it.
   */
  get googleClientSecret() {
    return process.env.GOOGLE_CLIENT_SECRET?.trim() ?? ''
  },
  /**
   * Optional. Defaults to this server's own origin + /api/auth/google/callback.
   * Set it when the API sits behind a proxy, where the request's host is not
   * the address the browser will come back to. It has to match a redirect URI
   * registered in the Google Cloud console exactly.
   */
  get googleRedirectUri() {
    return process.env.GOOGLE_REDIRECT_URI?.trim() ?? ''
  },
  /**
   * Where the browser goes once sign-in finishes.
   *
   * Google sends the callback to this server, but the visitor has to end up back
   * on the website, so the redirect target has to be the app's public origin.
   * Set it when the API is on a different host from the frontend; otherwise the
   * first entry of CORS_ORIGINS is used, which is the frontend in practice.
   */
  get frontendUrl() {
    return process.env.FRONTEND_URL?.trim().replace(/\/+$/, '') ?? ''
  },
  /**
   * Where uploaded profile photos are written and served from.
   *
   * Defaults to `uploads/` beside the backend so a fresh clone works with no
   * configuration at all. The directory is served as read-only static content
   * and is created on demand.
   *
   * This is deliberately local disk: it suits a single-node deployment and
   * keeps the app runnable with no external services. A multi-instance
   * deployment needs shared storage (S3 or equivalent) instead — the stored
   * value in the database is a URL, so only `storage.js` has to change.
   */
  get uploadDir() {
    return process.env.UPLOAD_DIR?.trim() || 'uploads'
  },
  /**
   * Refuses to serve admin routes unless a token is configured when running in
   * production, so a misconfigured deploy fails loudly instead of exposing
   * client personal data.
   */
  assertAdminConfigured() {
    if (this.isProduction && !this.adminApiToken) {
      throw new Error(
        'ADMIN_API_TOKEN must be set to run in production. The admin API is disabled without it.',
      )
    }
  },
}
