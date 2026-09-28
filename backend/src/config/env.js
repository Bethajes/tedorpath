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
