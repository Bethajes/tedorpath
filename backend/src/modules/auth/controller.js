import {
  clearSessionCookie,
  readSessionCookie,
  setSessionCookie,
} from './cookies.js'
import { needsRehash, hashPassword, verifyDecoyPassword, verifyPassword } from './passwords.js'
import {
  createSession,
  createLoginFlow,
  createUserWithCredentials,
  consumeLoginFlow,
  findCredentialsUserByEmail,
  isUniqueViolation,
  pruneExpiredSessions,
  resolveGoogleUser,
  revokeSessionByToken,
  toPublicUser,
  updatePasswordHash,
} from './service.js'
import {
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  fetchGoogleProfile,
  flowExpiresAt,
  generateCodeChallenge,
  generateState,
  hashState,
  isGoogleAuthEnabled,
  resolveAppUrl,
  resolveRedirectUri,
} from './google.js'
import { validateLogin, validateRegister } from './validation.js'

/**
 * HTTP layer for /api/auth.
 *
 * What a client is allowed to learn is decided here. A failed sign-in returns
 * one message whether the address is unknown, the password is wrong, or the
 * account has no password yet, so this endpoint cannot be used to discover who
 * has an account.
 */

/**
 * The single response for every failed sign-in. One code, one message, one
 * status — deliberately identical across causes.
 */
const INVALID_CREDENTIALS = {
  code: 'INVALID_CREDENTIALS',
  message: 'Invalid email or password.',
}

function fail(res, status, code, message, fields) {
  res.status(status).json({
    success: false,
    error: fields ? { code, message, fields } : { code, message },
  })
}

/** Reports a validation failure using the shape the tutor-request form expects. */
function failValidation(res, fields) {
  fail(res, 400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', fields)
}

/**
 * Registers a new account and signs the new user in.
 *
 * Only the outcome is ever logged: an address is personal data, and a rejected
 * registration that logged its input would put a failed sign-in attempt into
 * the logs in plain text.
 */
export async function registerHandler(req, res) {
  const result = validateRegister(req.body)

  if (!result.ok) {
    failValidation(res, result.fields)
    return
  }

  const { name, email, password } = result.data

  let user
  try {
    user = await createUserWithCredentials({ name, email, password })
  } catch (error) {
    // Two requests for the same address can race past the check below, so the
    // unique index is the real authority on duplicates.
    if (isUniqueViolation(error)) {
      fail(res, 409, 'EMAIL_ALREADY_REGISTERED', 'An account with that email already exists.')
      return
    }
    console.error('[auth] failed to register user:', error)
    fail(res, 500, 'INTERNAL_ERROR', 'We could not create your account. Please try again.')
    return
  }

  try {
    await issueSession(req, res, user.id)
  } catch (error) {
    console.error('[auth] registered user but could not start a session:', error)
    fail(res, 500, 'INTERNAL_ERROR', 'Your account was created, but we could not sign you in.')
    return
  }

  res.status(201).json({ success: true, data: { user: toPublicUser(user) } })
}

export async function loginHandler(req, res) {
  const result = validateLogin(req.body)

  if (!result.ok) {
    failValidation(res, result.fields)
    return
  }

  const { email, password } = result.data
  const record = await findCredentialsUserByEmail(email)

  // An unknown address still pays the cost of a hash check, so the response
  // time does not tell an attacker which addresses are registered.
  if (!record?.passwordHash) {
    await verifyDecoyPassword()
    fail(res, 401, INVALID_CREDENTIALS.code, INVALID_CREDENTIALS.message)
    return
  }

  const valid = await verifyPassword(record.passwordHash, password)
  if (!valid) {
    fail(res, 401, INVALID_CREDENTIALS.code, INVALID_CREDENTIALS.message)
    return
  }

  // Parameters have been raised since this password was set: upgrade the hash
  // now that we hold the plaintext, at no extra cost to the user.
  if (record.accountId && needsRehash(record.passwordHash)) {
    try {
      await updatePasswordHash(record.accountId, await hashPassword(password))
    } catch (error) {
      // Never fail a valid sign-in over a maintenance task.
      console.error('[auth] could not upgrade password hash:', error)
    }
  }

  try {
    await issueSession(req, res, record.user.id)
  } catch (error) {
    console.error('[auth] failed to start a session:', error)
    fail(res, 500, 'INTERNAL_ERROR', 'We could not sign you in. Please try again.')
    return
  }

  res.status(200).json({ success: true, data: { user: toPublicUser(record.user) } })
}

/**
 * Revokes the current session and clears the cookie.
 *
 * Always succeeds: signing out with an expired or already-revoked cookie is
 * the normal end state of a normal session, not a failure.
 */
export async function logoutHandler(req, res) {
  const token = readSessionCookie(req)

  try {
    await revokeSessionByToken(token)
  } catch (error) {
    // The cookie is cleared regardless, so the browser stops sending it.
    console.error('[auth] failed to revoke session:', error)
  }

  clearSessionCookie(res)
  res.status(200).json({ success: true, data: { loggedOut: true } })
}

/** Reports the signed-in user. Reached only behind `requireAuth`. */
export function meHandler(req, res) {
  res.status(200).json({ success: true, data: { user: toPublicUser(req.user) } })
}

/**
 * Reports the sign-in methods this server is configured for.
 *
 * Public and unauthenticated on purpose: it is what the sign-in page reads to
 * decide whether to offer "Continue with Google", and it contains nothing but
 * provider ids.
 */
export function providersHandler(_req, res) {
  const providers = []
  if (isGoogleAuthEnabled()) providers.push('GOOGLE')

  res.status(200).json({ success: true, data: { providers } })
}

// --- Google -----------------------------------------------------------------

/**
 * Starts Google sign-in.
 *
 * A plain redirect: the browser leaves the app entirely, so there is no
 * token, no popup and no client-side OAuth code to get wrong. The `state` and
 * the PKCE challenge are generated here and remembered server-side.
 */
export async function googleStartHandler(req, res) {
  if (!isGoogleAuthEnabled()) {
    fail(res, 503, 'GOOGLE_NOT_CONFIGURED', 'Google sign-in is not configured on this server.')
    return
  }

  try {
    const state = generateState()
    const { verifier, challenge } = generateCodeChallenge()

    await createLoginFlow({
      provider: 'GOOGLE',
      stateHash: hashState(state),
      codeVerifier: verifier,
      expiresAt: flowExpiresAt(),
    })

    res.redirect(302, buildAuthorizationUrl({
      state,
      challenge,
      redirectUri: resolveRedirectUri(req),
    }))
  } catch (error) {
    console.error('[auth] could not start a google sign-in:', error)
    res.redirect(302, `${resolveAppUrl(req)}/login?authError=start_failed`)
  }
}

/**
 * Completes Google sign-in.
 *
 * Every failure ends the same way: back to /login with a code the page knows
 * how to explain, never a Google error string passed through to the user.
 */
export async function googleCallbackHandler(req, res) {
  const code = typeof req.query.code === 'string' ? req.query.code : ''
  const state = typeof req.query.state === 'string' ? req.query.state : ''
  const site = resolveAppUrl(req)

  /** Back to the sign-in page on the website, with a code it can explain. */
  const backToLogin = (reason) => res.redirect(302, `${site}/login?authError=${reason}`)

  if (typeof req.query.error === 'string') {
    backToLogin(encodeURIComponent(mapGoogleError(req.query.error)))
    return
  }

  if (!code || !state) {
    backToLogin('missing_code')
    return
  }

  let user
  try {
    // Single use: a replayed callback finds no flow.
    const flow = await consumeLoginFlow('GOOGLE', hashState(state))
    if (!flow) {
      backToLogin('invalid_state')
      return
    }

    const accessToken = await exchangeCodeForTokens({
      code,
      codeVerifier: flow.codeVerifier,
      redirectUri: resolveRedirectUri(req),
    })
    const profile = await fetchGoogleProfile(accessToken)

    const resolved = await resolveGoogleUser(profile)
    user = resolved.user

    await issueSession(req, res, user.id)
  } catch (error) {
    console.error('[auth] google sign-in failed:', error?.code ?? error)
    backToLogin(error?.code ?? 'google_failed')
    return
  }

  res.redirect(302, `${site}/`)
}

/** Google's error codes, reduced to something worth showing a visitor. */
function mapGoogleError(code) {
  if (code === 'access_denied') return 'cancelled'
  if (code === 'consent_required' || code === 'interaction_required') return 'consent_required'
  return 'google_failed'
}

/**
 * Issues a new session and sets it on the response.
 *
 * Any session already presented by this browser is revoked first, so a token
 * that was somehow fixed in advance cannot survive the sign-in.
 */
async function issueSession(req, res, userId) {
  await revokeSessionByToken(readSessionCookie(req))
  const { token, session } = await createSession(userId)
  setSessionCookie(res, token, session.expiresAt)
  await pruneExpiredSessions(userId)
}
