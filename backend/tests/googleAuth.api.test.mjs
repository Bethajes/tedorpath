import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { after, before, describe, it } from 'node:test'

import { createApp } from '../src/app.js'
import { closePrisma, prisma } from '../src/lib/prisma.js'

/**
 * Google sign-in tests.
 *
 * Google is not called. `GOOGLE_TOKEN_URL` and `GOOGLE_USERINFO_URL` are pointed
 * at a local stub for the duration of this file, so the whole conversation —
 * redirect, authorization code exchange, profile lookup, account linking,
 * session — runs for real without a network call or a real Google account.
 *
 * Everything else is production code: the real app, the real database, real
 * Argon2id hashes and real session cookies.
 *
 * Run with: npm test   (or: node --test tests/)
 */

const CLIENT_ID = 'test-client-id.apps.googleusercontent.com'
const CLIENT_SECRET = 'test-client-secret'

const createdEmails = []

/** Unique per run: a Google account stays bound to the first user it linked to. */
const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const sub = (label) => `google-sub-${label}-${RUN}`

let server
let baseUrl
let stub
let stubUrl

/** What the stubbed userinfo endpoint should answer with next. */
let profile = null
/** Authorization codes the stub was asked to redeem, so tests can assert on them. */
let redeemed = []

/** Minimal stand-in for Google's token and userinfo endpoints. */
function startStub() {
  return new Promise((resolve) => {
    const instance = createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1')

      if (url.pathname === '/token') {
        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          const params = new URLSearchParams(body)
          redeemed.push(params)

          if (params.get('code') === 'refused-code') {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'invalid_grant' }))
            return
          }

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ access_token: `stub-token-${params.get('code')}` }))
        })
        return
      }

      if (url.pathname === '/userinfo') {
        if (!profile) {
          res.writeHead(401, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'invalid_token' }))
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(profile))
        return
      }

      res.writeHead(404).end()
    })

    instance.listen(0, '127.0.0.1', () => resolve(instance))
  })
}

function uniqueEmail(prefix = 'google') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

/** A Google profile for `sub`, verified unless told otherwise. */
function googleProfile(sub, overrides = {}) {
  return {
    sub,
    email: uniqueEmail(),
    email_verified: true,
    name: 'Grace Hopper',
    picture: 'https://example.com/avatar.png',
    ...overrides,
  }
}

before(async () => {
  // These tests exercise the flow itself, so the provider is switched on
  // whatever the local .env says (it is often off while the redirect URI is
  // being registered in the Google console).
  process.env.GOOGLE_AUTH_ENABLED = 'true'
  process.env.GOOGLE_CLIENT_ID = CLIENT_ID
  process.env.GOOGLE_CLIENT_SECRET = CLIENT_SECRET
  process.env.GOOGLE_TOKEN_URL = 'http://127.0.0.1:0/token'
  process.env.GOOGLE_USERINFO_URL = 'http://127.0.0.1:0/userinfo'

  stub = await startStub()
  stubUrl = `http://127.0.0.1:${stub.address().port}`
  process.env.GOOGLE_TOKEN_URL = `${stubUrl}/token`
  process.env.GOOGLE_USERINFO_URL = `${stubUrl}/userinfo`

  // Where a real deployment would point this at the website.
  process.env.FRONTEND_URL = 'https://tedor.example'

  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await prisma.loginFlow.deleteMany({})
  if (createdEmails.length) {
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } })
  }
  await new Promise((resolve) => server.close(resolve))
  await new Promise((resolve) => stub.close(resolve))
  await closePrisma()
})

/** A request that does not follow the redirect, so the flow can be inspected. */
async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual', ...options })
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, body, location: response.headers.get('location'), headers: response.headers }
}

function sessionCookie(response) {
  const setCookie = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : []
  return setCookie.map((cookie) => cookie.split(';')[0]).join('; ') || undefined
}

/** Starts a flow and returns the parsed authorization URL Google would receive. */
async function startFlow() {
  const response = await api('/api/auth/google')
  assert.equal(response.status, 302)
  return new URL(response.location)
}

/** Runs a start → callback round trip and returns the callback response. */
async function completeFlow({ state, code = 'test-code', cookie } = {}) {
  return api(`/api/auth/google/callback?code=${code}&state=${state}`, { headers: cookie ? { cookie } : {} })
}

describe('GET /api/auth/google', () => {
  it('redirects to Google with the client id, scopes, state and a PKCE challenge', async () => {
    const url = await startFlow()

    assert.equal(url.origin, 'https://accounts.google.com')
    assert.equal(url.pathname, '/o/oauth2/v2/auth')
    assert.equal(url.searchParams.get('client_id'), CLIENT_ID)
    assert.equal(url.searchParams.get('response_type'), 'code')
    assert.equal(url.searchParams.get('scope'), 'openid email profile')
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
    assert.equal(url.searchParams.get('redirect_uri'), `${baseUrl}/api/auth/google/callback`)
    assert.equal(url.searchParams.get('prompt'), 'select_account')

    const state = url.searchParams.get('state')
    assert.ok(state && state.length >= 32, 'a high-entropy state should be sent')

    // The code challenge is the SHA-256 of a verifier the server kept to
    // itself; the verifier must never appear in the URL.
    const stored = await prisma.loginFlow.findUnique({
      where: { stateHash: createHash('sha256').update(state).digest('hex') },
      select: { codeVerifier: true, provider: true, expiresAt: true },
    })

    assert.ok(stored, 'the flow should be remembered server-side')
    assert.equal(stored.provider, 'GOOGLE')
    assert.ok(stored.expiresAt.getTime() > Date.now())
    assert.equal(
      createHash('sha256').update(stored.codeVerifier).digest('base64url'),
      url.searchParams.get('code_challenge'),
    )
    assert.equal(url.search.includes(stored.codeVerifier), false)
  })

  it('issues a different state and challenge every time', async () => {
    const [first, second] = [await startFlow(), await startFlow()]

    assert.notEqual(first.searchParams.get('state'), second.searchParams.get('state'))
    assert.notEqual(first.searchParams.get('code_challenge'), second.searchParams.get('code_challenge'))
  })

  it('asks for the callback on the origin the visitor is actually on', async () => {
    // The dev server proxies /api and forwards the original host (xfwd). The
    // session cookie is set by whoever answers the callback, so the callback has
    // to be served by the app's own origin — otherwise the cookie is stored for
    // the API's host and the app never sends it back.
    const proxied = await api('/api/auth/google', {
      headers: { 'x-forwarded-host': 'localhost:5173', 'x-forwarded-proto': 'http' },
    })

    const redirectUri = new URL(proxied.location).searchParams.get('redirect_uri')
    assert.equal(redirectUri, 'http://localhost:5173/api/auth/google/callback')
  })

  it('uses the API origin when there is no proxy in front of it', async () => {
    // Frontend and API on separate hosts in production: the callback is answered
    // by the API, and the app sends the cookie back with credentials: 'include'.
    const url = await startFlow()

    assert.equal(
      url.searchParams.get('redirect_uri'),
      `${baseUrl}/api/auth/google/callback`,
      'no forwarded host means the API answers the callback itself',
    )
  })

  it('never puts the client secret in a redirect', async () => {
    const response = await api('/api/auth/google')

    assert.equal(response.location.includes(CLIENT_SECRET), false)
    assert.equal(response.location.includes('client_secret'), false)
  })
})

describe('GET /api/auth/google/callback', () => {
  it('signs a new person in and creates their CLIENT account', async () => {
    profile = googleProfile(sub('new'))
    createdEmails.push(profile.email)

    const url = await startFlow()
    const response = await completeFlow({ state: url.searchParams.get('state') })

    assert.equal(response.status, 302)
    assert.equal(response.location, 'https://tedor.example/', 'the visitor lands on the website')

    const cookie = sessionCookie(response)
    assert.ok(cookie, 'a session cookie should be issued')

    const me = await api('/api/auth/me', { headers: { cookie } })
    assert.equal(me.status, 200)
    assert.equal(me.body.data.user.email, profile.email)
    assert.equal(me.body.data.user.name, 'Grace Hopper')
    assert.equal(me.body.data.user.role, 'CLIENT')
    assert.equal(me.body.data.user.image, 'https://example.com/avatar.png')

    const user = await prisma.user.findUnique({
      where: { email: profile.email },
      select: {
        role: true,
        emailVerifiedAt: true,
        accounts: { select: { provider: true, providerAccountId: true, passwordHash: true } },
      },
    })

    assert.equal(user.role, 'CLIENT', 'a Google sign-up must never grant a privileged role')
    assert.ok(user.emailVerifiedAt, 'a Google-verified address should be recorded as verified')
    assert.equal(user.accounts.length, 1)
    assert.equal(user.accounts[0].provider, 'GOOGLE')
    assert.equal(user.accounts[0].providerAccountId, sub('new'))
    assert.equal(user.accounts[0].passwordHash, null, 'a Google account must carry no password')
  })

  it('reuses the account on a second sign-in instead of duplicating it', async () => {
    profile = googleProfile(sub('repeat'))
    createdEmails.push(profile.email)

    const first = await completeFlow({ state: (await startFlow()).searchParams.get('state') })
    const firstCookie = sessionCookie(first)

    const second = await completeFlow({ state: (await startFlow()).searchParams.get('state') })
    const secondCookie = sessionCookie(second)

    assert.equal(first.location, 'https://tedor.example/')
    assert.equal(await prisma.user.count({ where: { email: profile.email } }), 1)

    // A second sign-in works even while the first session is still open.
    const me = await api('/api/auth/me', { headers: { cookie: secondCookie } })
    assert.equal(me.status, 200)
    assert.notEqual(firstCookie, secondCookie)
  })

  it('links a Google sign-in to an account that already has a password', async () => {
    const email = uniqueEmail('existing')
    createdEmails.push(email)

    const registered = await api('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Existing User', email, password: 'a-good-password' }),
    })
    assert.equal(registered.status, 201)
    const originalId = registered.body.data.user.id

    profile = googleProfile(sub('linking'), { email, name: 'Existing User' })

    const response = await completeFlow({ state: (await startFlow()).searchParams.get('state') })
    assert.equal(response.status, 302)

    // One user, now with two ways to sign in.
    assert.equal(await prisma.user.count({ where: { email } }), 1)

    const me = await api('/api/auth/me', { headers: { cookie: sessionCookie(response) } })
    assert.equal(me.body.data.user.id, originalId, 'it should be the same account, not a new one')

    const accounts = await prisma.account.findMany({
      where: { userId: originalId },
      select: { provider: true, passwordHash: true },
    })
    // Sorted in JS on purpose: Postgres orders enums by declaration order.
    const providers = accounts.map((a) => a.provider).sort()
    assert.deepEqual(providers, ['CREDENTIALS', 'GOOGLE'], 'one user, two ways to sign in')
    assert.match(accounts.find((a) => a.provider === 'CREDENTIALS').passwordHash, /^\$argon2id\$/)
    assert.equal(accounts.find((a) => a.provider === 'GOOGLE').passwordHash, null)

    // And the original password still works.
    const login = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'a-good-password' }),
    })
    assert.equal(login.status, 200)
  })

  it('matches the email case-insensitively when linking', async () => {
    profile = googleProfile(sub('case'))
    const email = profile.email
    createdEmails.push(email)

    const registered = await api('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Case Test', email: email.toUpperCase(), password: 'a-good-password' }),
    })
    assert.equal(registered.status, 201)

    const response = await completeFlow({ state: (await startFlow()).searchParams.get('state') })

    const me = await api('/api/auth/me', { headers: { cookie: sessionCookie(response) } })
    assert.equal(me.body.data.user.id, registered.body.data.user.id)
    assert.equal(await prisma.user.count({ where: { email } }), 1)
  })

  it('refuses to claim an address Google has not verified', async () => {
    profile = googleProfile(sub('unverified'), { email_verified: false })
    createdEmails.push(profile.email)

    const state = (await startFlow()).searchParams.get('state')
    const response = await completeFlow({ state })

    assert.equal(response.status, 302)
    assert.ok(response.location.startsWith('https://tedor.example/login?authError='), response.location) && assert.match(response.location, /authError=GOOGLE_EMAIL_UNVERIFIED/)
    assert.equal(await prisma.user.count({ where: { email: profile.email } }), 0)
    assert.equal(sessionCookie(response), undefined, 'no session for an unverified identity')
  })

  it('replays nothing: a state can only be used once', async () => {
    profile = googleProfile(sub('replay'))
    createdEmails.push(profile.email)

    const state = (await startFlow()).searchParams.get('state')

    const first = await completeFlow({ state })
    assert.equal(first.status, 302)
    assert.equal(first.location, 'https://tedor.example/')

    const second = await completeFlow({ state })
    assert.equal(second.status, 302)
    assert.match(second.location, /authError=invalid_state/)
  })

  it('rejects an unknown or tampered state', async () => {
    const response = await completeFlow({ state: 'never-issued' })
    assert.equal(response.status, 302)
    assert.ok(response.location.startsWith('https://tedor.example/login?authError='), response.location) && assert.match(response.location, /authError=invalid_state/)
  })

  it('rejects an expired flow', async () => {
    const state = (await startFlow()).searchParams.get('state')
    await prisma.loginFlow.updateMany({
      where: { stateHash: createHash('sha256').update(state).digest('hex') },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    const response = await completeFlow({ state })
    assert.ok(response.location.startsWith('https://tedor.example/login?authError='), response.location) && assert.match(response.location, /authError=invalid_state/)
  })

  it('sends the code, verifier and client credentials to the token endpoint', async () => {
    profile = googleProfile(sub('exchange'))
    createdEmails.push(profile.email)
    redeemed = []

    const state = (await startFlow()).searchParams.get('state')
    const response = await completeFlow({ state, code: 'the-code' })
    assert.equal(response.location, 'https://tedor.example/')

    const exchange = redeemed.at(-1)
    assert.equal(exchange.get('grant_type'), 'authorization_code')
    assert.equal(exchange.get('code'), 'the-code')
    assert.equal(exchange.get('client_id'), CLIENT_ID)
    assert.equal(exchange.get('redirect_uri'), `${baseUrl}/api/auth/google/callback`)
    assert.ok(exchange.get('code_verifier'), 'the PKCE verifier must be sent')
    assert.equal(exchange.get('client_secret'), CLIENT_SECRET)
  })

  it('returns the visitor to the login page when Google refuses the code', async () => {
    const state = (await startFlow()).searchParams.get('state')
    const response = await completeFlow({ state, code: 'refused-code' })

    assert.equal(response.status, 302)
    assert.ok(response.location.startsWith('https://tedor.example/login?authError='), response.location) && assert.match(response.location, /authError=GOOGLE_EXCHANGE_FAILED/)
    assert.equal(sessionCookie(response), undefined)
    assert.equal(
      response.location.includes('invalid_grant'),
      false,
      "Google's error text must not be passed to the browser",
    )
  })

  it('returns to the website rather than leaving the visitor on the API', async () => {
    profile = googleProfile(sub('landing'))
    createdEmails.push(profile.email)

    const state = (await startFlow()).searchParams.get('state')
    const response = await completeFlow({ state })

    assert.equal(response.location, 'https://tedor.example/')
    assert.equal(response.location.startsWith(baseUrl), false, 'not the API origin')
  })

  it('returns to the origin the visitor came from when it is forwarded', async () => {
    profile = googleProfile(sub('forwarded'))
    createdEmails.push(profile.email)

    const start = await api('/api/auth/google', {
      headers: { 'x-forwarded-host': 'localhost:5173', 'x-forwarded-proto': 'http' },
    })
    const state = new URL(start.location).searchParams.get('state')

    const response = await api(`/api/auth/google/callback?code=x&state=${state}`, {
      headers: { 'x-forwarded-host': 'localhost:5173', 'x-forwarded-proto': 'http' },
    })

    // Same origin the cookie was set on, so the app is actually signed in.
    assert.equal(response.location, 'http://localhost:5173/')
  })

  it('handles the visitor cancelling at the Google screen', async () => {
    const response = await api('/api/auth/google/callback?error=access_denied&state=whatever')

    assert.equal(response.status, 302)
    assert.ok(response.location.startsWith('https://tedor.example/login?authError='), response.location) && assert.match(response.location, /authError=cancelled/)
  })

  it('rejects a callback with no code and no state', async () => {
    for (const path of ['/api/auth/google/callback', '/api/auth/google/callback?code=x']) {
      const response = await api(path)
      assert.equal(response.status, 302)
      assert.ok(response.location.startsWith('https://tedor.example/login?authError='), response.location) && assert.match(response.location, /authError=missing_code/)
    }
  })

  it('leaves anonymous sign-in and the admin API untouched', async () => {
    const anonymous = await api('/api/auth/me')
    assert.equal(anonymous.status, 401)

    const admin = await api('/api/admin/stats')
    if (process.env.ADMIN_API_TOKEN) {
      assert.equal(admin.status, 401, 'a Google sign-in must not open the admin API')
    }
  })
})

describe('pruning', () => {
  it('clears out login flows that were never finished', async () => {
    const stale = await prisma.loginFlow.create({
      data: {
        provider: 'GOOGLE',
        stateHash: createHash('sha256').update(`stale-${Date.now()}`).digest('hex'),
        codeVerifier: 'stale-verifier',
        expiresAt: new Date(Date.now() - 1000),
      },
      select: { id: true },
    })

    // Starting a new flow prunes the expired ones.
    await startFlow()

    const found = await prisma.loginFlow.findUnique({ where: { id: stale.id } })
    assert.equal(found, null)
  })
})
