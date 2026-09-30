import { createHash, randomBytes } from 'node:crypto'

import { env } from '../../config/env.js'

/**
 * Google sign-in (OpenID Connect authorization code flow, with PKCE).
 *
 * Design notes worth knowing before changing anything here:
 *
 * - **The browser never sees any of this.** The frontend links to
 *   `/api/auth/google` and the API drives the whole conversation, so the client
 *   id, the client secret and the PKCE verifier all stay on the server.
 * - **PKCE on every request.** A code verifier is generated per attempt and
 *   only its SHA-256 challenge is sent to Google, so an intercepted callback
 *   cannot be replayed. The verifier is kept server-side (see LoginFlow).
 * - **`state` is a CSRF token**, stored hashed. Without it, an attacker could
 *   start a flow with their own Google account and have it attached to a
 *   victim's browser session.
 * - **Identity comes from the userinfo endpoint**, not from decoding an id
 *   token. The access token was obtained by us, for our client, with our code
 *   verifier, so a call to Google's userinfo endpoint is authenticated without
 *   needing to verify a JWT signature.
 */

const AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

/** Just enough to identify the person. No Drive, no Gmail, no contacts. */
const SCOPES = ['openid', 'email', 'profile']

/** Five minutes is generous for a redirect; the row is single-use anyway. */
const FLOW_TTL_MS = 5 * 60 * 1000

/**
 * Overridable endpoints. Tests point these at a local stub so the whole flow —
 * redirect, exchange, userinfo — can be exercised without calling Google.
 */
function tokenUrl() {
  return process.env.GOOGLE_TOKEN_URL ?? TOKEN_URL
}

function userinfoUrl() {
  return process.env.GOOGLE_USERINFO_URL ?? USERINFO_URL
}

export function isGoogleAuthEnabled() {
  return env.googleAuthEnabled
}

/**
 * The origin a browser request actually arrived on.
 *
 * `changeOrigin` on the dev proxy (and most reverse proxies) rewrites the Host
 * header to the API's own, which would make the API believe every visitor is
 * calling it directly. When a proxy forwards the original host we use that
 * instead: it is the origin the visitor sees, and therefore the only origin
 * their browser will send a cookie for.
 */
function requestOrigin(req) {
  const forwardedHost = req.get('x-forwarded-host')
  if (forwardedHost) {
    const proto = req.get('x-forwarded-proto') || req.protocol
    return `${proto}://${forwardedHost.split(',')[0].trim()}`
  }
  return `${req.protocol}://${req.get('host')}`
}

/**
 * Where the OAuth callback has to be served from.
 *
 * This is the subtlest part of the feature, and getting it wrong produces a
 * sign-in that *looks* perfect and does nothing:
 *
 * - The session cookie is set by whichever origin answers the callback, and a
 *   browser only sends cookies back to the origin that stored them. So the
 *   callback must be answered by the **same origin the app is served from**.
 * - Behind a same-origin proxy — the Vite dev server, or nginx in front of both
 *   — that is the forwarded host. The browser asks
 *   `http://localhost:5173/api/auth/google/callback`, the proxy forwards it, and
 *   the cookie lands on the app's own origin where the app can read it.
 * - When the API has its own host (frontend and API deployed separately) there
 *   is no proxy: the callback is answered by the API, the cookie belongs to the
 *   API domain, and the app sends it back with `credentials: 'include'`. That
 *   works too.
 *
 * `GOOGLE_REDIRECT_URI` overrides this, and has to be registered in the Google
 * Cloud console exactly.
 */
export function resolveRedirectUri(req) {
  if (env.googleRedirectUri) return env.googleRedirectUri
  return `${requestOrigin(req)}/api/auth/google/callback`
}

/**
 * The public origin of the website — where a visitor is sent once sign-in is
 * finished.
 *
 * Google returns the browser to the API, so redirecting to `/` here would leave
 * them on the API's own host. The forwarded host wins (it is where the app
 * really is), then `FRONTEND_URL`, then the first allowed CORS origin.
 */
export function resolveAppUrl(req) {
  if (req.get('x-forwarded-host')) return requestOrigin(req)
  if (env.frontendUrl) return env.frontendUrl
  const [firstOrigin] = env.corsOrigins
  if (firstOrigin) return firstOrigin.replace(/\/+$/, '')
  return requestOrigin(req)
}

/** Random, unguessable `state`. Only its hash is stored. */
export function generateState() {
  return randomBytes(32).toString('base64url')
}

export function hashState(state) {
  return createHash('sha256').update(state).digest('hex')
}

/** PKCE secret, and the challenge derived from it. */
export function generateCodeChallenge() {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

/** The URL the browser is sent to, which starts the conversation with Google. */
export function buildAuthorizationUrl({ state, challenge, redirectUri }) {
  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    // Makes Google ask which account to use, so somebody with a personal and a
    // work account can pick the one they meant to link.
    prompt: 'select_account',
  })

  return `${AUTHORIZATION_URL}?${params.toString()}`
}

export function flowExpiresAt() {
  return new Date(Date.now() + FLOW_TTL_MS)
}

/**
 * Swaps an authorization code for an access token.
 *
 * The client secret is optional: with PKCE a public client does not need one.
 * When the OAuth client is a confidential "Web application", Google issues a
 * secret and requires it here — if exchanges fail with `invalid_client`, that
 * secret is what is missing.
 */
export async function exchangeCodeForTokens({ code, codeVerifier, redirectUri }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: env.googleClientId,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
  })

  if (env.googleClientSecret) {
    body.set('client_secret', env.googleClientSecret)
  }

  const response = await fetch(tokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    // Google's error text can echo our own parameters, so it is logged for the
    // operator and never returned to the browser.
    console.error('[auth] google token exchange failed:', response.status, payload?.error)
    const error = new Error('Google rejected the sign-in.')
    error.code = 'GOOGLE_EXCHANGE_FAILED'
    throw error
  }

  if (!payload?.access_token) {
    console.error('[auth] google token response had no access_token')
    const error = new Error('Google rejected the sign-in.')
    error.code = 'GOOGLE_EXCHANGE_FAILED'
    throw error
  }

  return payload.access_token
}

/**
 * Reads the authenticated identity.
 *
 * `sub` is the stable, never-reused identifier for the Google account and is
 * what we key the linked Account row on. `email_verified` matters: it is the
 * only thing that lets us trust that this person owns that address, and
 * therefore that they may be matched to an existing Tedor account.
 */
export async function fetchGoogleProfile(accessToken) {
  const response = await fetch(userinfoUrl(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    console.error('[auth] google userinfo request failed:', response.status)
    const error = new Error('Google did not return an account.')
    error.code = 'GOOGLE_PROFILE_FAILED'
    throw error
  }

  const profile = await response.json().catch(() => null)

  if (typeof profile?.sub !== 'string' || profile.sub === '') {
    const error = new Error('Google did not return an account.')
    error.code = 'GOOGLE_PROFILE_FAILED'
    throw error
  }

  return {
    providerAccountId: profile.sub,
    email: typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : '',
    emailVerified: profile.email_verified === true || profile.email_verified === 'true',
    name: typeof profile.name === 'string' && profile.name.trim() ? profile.name.trim() : '',
    image: typeof profile.picture === 'string' ? profile.picture : null,
  }
}
