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
}
