import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { after, before, describe, it } from 'node:test'

import { createApp } from '../src/app.js'
import { closePrisma, prisma } from '../src/lib/prisma.js'

/**
 * Authentication API tests.
 *
 * Like the admin tests, these drive the real Express app against the real
 * PostgreSQL database, so they exercise the same code path as production:
 * real Argon2id hashing, real sessions, real cookies.
 *
 * Run with: npm test   (or: node --test tests/)
 *
 * Records are created with unique addresses and removed in `after`, so
 * repeated runs leave no trace and cannot collide with each other.
 */

const PASSWORD = 'a-strong-enough-password'
const TOKEN_PATTERN = /tedor_session=([^;]+)/

/** Emails created by these tests, removed at the end. Cascade clears their
 *  accounts and sessions. */
const createdEmails = []
const createdRequestIds = []

let server
let baseUrl

/** Unique address per call so a re-run never collides with the last one. */
function uniqueEmail(prefix = 'auth') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

before(async () => {
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (createdRequestIds.length) {
    await prisma.tutorRequest.deleteMany({ where: { id: { in: createdRequestIds } } })
  }
  if (createdEmails.length) {
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } })
  }
  await new Promise((resolve) => server.close(resolve))
  await closePrisma()
})

async function api(path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }

  return {
    status: response.status,
    body: payload,
    setCookie: response.headers.getSetCookie(),
  }
}

/** The `name=value` part of a session cookie, ready to send back. */
function sessionCookie(response) {
  const match = response.setCookie.map((cookie) => cookie.split(';')[0]).join('; ')
  return match || undefined
}

/** Registers a user and returns the response plus their session cookie. */
async function registerUser(overrides = {}) {
  const email = overrides.email ?? uniqueEmail()
  createdEmails.push(email.trim().toLowerCase())

  const response = await api('/api/auth/register', {
    method: 'POST',
    body: { name: 'Ada Lovelace', email, password: PASSWORD, ...overrides },
  })

  return { response, email, cookie: sessionCookie(response) }
}

function tutorRequestPayload(overrides = {}) {
  return {
    fullName: 'Grace Hopper',
    phone: '0912345678',
    subject: 'Mathematics',
    educationLevel: 'University',
    learningMode: 'Online',
    helpDescription: 'I need help with calculus for my exam.',
    ...overrides,
  }
}

describe('POST /api/auth/register', () => {
  it('creates a CLIENT account and starts a session', async () => {
    const { response, email, cookie } = await registerUser({ name: 'Ada Lovelace' })

    assert.equal(response.status, 201)
    assert.equal(response.body.success, true)
    assert.deepEqual(
      {
        name: response.body.data.user.name,
        email: response.body.data.user.email,
        role: response.body.data.user.role,
      },
      { name: 'Ada Lovelace', email, role: 'CLIENT' },
    )
    assert.ok(response.body.data.user.id, 'the response should identify the new user')
    assert.ok(cookie, 'a session cookie should be set')
  })

  it('never returns the password or its hash', async () => {
    const { response } = await registerUser()
    const serialised = JSON.stringify(response.body)

    assert.equal(serialised.includes('password'), false)
    assert.equal(serialised.includes('argon2'), false)
    assert.equal(serialised.includes(PASSWORD), false)
  })

  it('stores the password as an Argon2id hash, never as plaintext', async () => {
    const { response, email } = await registerUser()

    const account = await prisma.account.findFirst({
      where: { user: { email }, provider: 'CREDENTIALS' },
      select: { passwordHash: true, providerAccountId: true },
    })

    assert.ok(account?.passwordHash)
    assert.match(account.passwordHash, /^\$argon2id\$/)
    assert.equal(account.passwordHash.includes(PASSWORD), false)
    assert.equal(account.providerAccountId, email)
    assert.equal(response.status, 201)
  })

  it('sets an HttpOnly, SameSite=Lax session cookie', async () => {
    const { response } = await registerUser()
    const header = response.setCookie.find((cookie) => cookie.startsWith('tedor_session='))

    assert.ok(header, 'the session cookie should be present')
    assert.match(header, /HttpOnly/)
    assert.match(header, /SameSite=Lax/)
    assert.match(header, /Path=\//)
  })

  it('stores only a hash of the session token', async () => {
    const { cookie } = await registerUser()
    const token = TOKEN_PATTERN.exec(cookie)[1]

    const session = await prisma.session.findFirst({
      where: { tokenHash: createHash('sha256').update(token).digest('hex') },
      select: { tokenHash: true, revokedAt: true, expiresAt: true },
    })

    assert.ok(session, 'the session row should be findable by the hash of the cookie')
    assert.equal(session.tokenHash.includes(token), false)
    assert.equal(session.revokedAt, null)
    assert.ok(session.expiresAt.getTime() > Date.now())
  })

  it('rejects a duplicate email, including a differently cased one', async () => {
    const { email } = await registerUser()

    const second = await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Someone Else', email: email.toUpperCase(), password: PASSWORD },
    })

    assert.equal(second.status, 409)
    assert.equal(second.body.error.code, 'EMAIL_ALREADY_REGISTERED')

    const users = await prisma.user.count({ where: { email } })
    assert.equal(users, 1, 'the duplicate registration must not create a second user')
  })

  it('rejects an invalid email address', async () => {
    for (const email of ['not-an-email', 'missing@domain', 'two@@example.com', '@example.com']) {
      const response = await api('/api/auth/register', {
        method: 'POST',
        body: { name: 'Ada', email, password: PASSWORD },
      })

      assert.equal(response.status, 400, `${email} should be rejected`)
      assert.equal(response.body.error.code, 'VALIDATION_ERROR')
      assert.ok(response.body.error.fields.some((field) => field.field === 'email'))
    }
  })

  it('rejects a weak or oversized password', async () => {
    const short = await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Ada', email: uniqueEmail(), password: 'short12' },
    })
    assert.equal(short.status, 400)
    assert.ok(short.body.error.fields.some((field) => field.field === 'password'))

    const tooLong = await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Ada', email: uniqueEmail(), password: 'a'.repeat(129) },
    })
    assert.equal(tooLong.status, 400)
    assert.ok(tooLong.body.error.fields.some((field) => field.field === 'password'))
  })

  it('rejects a missing name', async () => {
    const response = await api('/api/auth/register', {
      method: 'POST',
      body: { email: uniqueEmail(), password: PASSWORD },
    })

    assert.equal(response.status, 400)
    assert.ok(response.body.error.fields.some((field) => field.field === 'name'))
  })

  it('ignores an attempt to choose a role', async () => {
    const email = uniqueEmail('escalation')
    createdEmails.push(email)

    const response = await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Aspirant', email, password: PASSWORD, role: 'ADMIN' },
    })

    // The unknown key is rejected outright, which makes the attempt visible
    // rather than silently dropped.
    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')

    // And nothing was created with a privileged role.
    const privileged = await prisma.user.count({ where: { role: { in: ['ADMIN', 'TUTOR'] } } })
    assert.equal(privileged, 0)

    // Even the legitimate path only ever produces CLIENT.
    const { response: created } = await registerUser()
    assert.equal(created.body.data.user.role, 'CLIENT')
  })

  it('rejects any other unexpected field', async () => {
    const response = await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Ada', email: uniqueEmail(), password: PASSWORD, isAdmin: true },
    })

    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
  })
})

describe('POST /api/auth/login', () => {
  it('signs a user in with valid credentials', async () => {
    const { email } = await registerUser()

    const response = await api('/api/auth/login', {
      method: 'POST',
      body: { email, password: PASSWORD },
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.data.user.email, email)
    assert.equal(response.body.data.user.role, 'CLIENT')
    assert.equal(JSON.stringify(response.body).includes('password'), false)
    assert.ok(sessionCookie(response), 'a session cookie should be set')
  })

  it('matches the email case-insensitively in both directions', async () => {
    const mixed = `Mixed.Case-${Date.now()}@Example.COM`
    createdEmails.push(mixed.toLowerCase())

    await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Mixed Case', email: mixed, password: PASSWORD },
    })

    // Stored lowercase...
    const stored = await prisma.user.findUnique({ where: { email: mixed.toLowerCase() } })
    assert.ok(stored, 'the address should have been stored normalized')

    // ...and sign-in works with either casing.
    for (const attempt of [mixed, mixed.toLowerCase(), mixed.toUpperCase()]) {
      const response = await api('/api/auth/login', {
        method: 'POST',
        body: { email: attempt, password: PASSWORD },
      })
      assert.equal(response.status, 200, `sign-in should accept ${attempt}`)
      assert.equal(response.body.data.user.email, mixed.toLowerCase())
    }
  })

  it('rejects a wrong password', async () => {
    const { email } = await registerUser()

    const response = await api('/api/auth/login', {
      method: 'POST',
      body: { email, password: 'not-the-password' },
    })

    assert.equal(response.status, 401)
    assert.equal(response.body.error.code, 'INVALID_CREDENTIALS')
  })

  it('answers an unknown email exactly like a wrong password', async () => {
    const { email } = await registerUser()

    const wrongPassword = await api('/api/auth/login', {
      method: 'POST',
      body: { email, password: 'not-the-password' },
    })
    const unknownEmail = await api('/api/auth/login', {
      method: 'POST',
      body: { email: uniqueEmail('nobody'), password: 'not-the-password' },
    })

    // Identical status, code and message: this endpoint must not be usable to
    // discover which addresses have accounts.
    assert.equal(unknownEmail.status, wrongPassword.status)
    assert.deepEqual(unknownEmail.body.error, wrongPassword.body.error)
  })

  it('rejects an account that has no password yet', async () => {
    const email = uniqueEmail('google-only')
    createdEmails.push(email)

    // A Google-only account: correct shape, no credentials account. This is what
    // the next step will create for real.
    const user = await prisma.user.create({ data: { email, name: 'Google User' } })
    await prisma.account.create({
      data: { userId: user.id, provider: 'GOOGLE', providerAccountId: `google-${user.id}` },
    })

    const response = await api('/api/auth/login', {
      method: 'POST',
      body: { email, password: PASSWORD },
    })

    assert.equal(response.status, 401)
    assert.equal(response.body.error.code, 'INVALID_CREDENTIALS')
  })

  it('revokes a session the browser already had, so a token cannot be fixed in advance', async () => {
    const { email, cookie: firstCookie } = await registerUser()

    const response = await api('/api/auth/login', {
      method: 'POST',
      body: { email, password: PASSWORD },
      cookie: firstCookie,
    })
    assert.equal(response.status, 200)

    const me = await api('/api/auth/me', { cookie: firstCookie })
    assert.equal(me.status, 401, 'the pre-existing session should no longer work')
  })
})

describe('GET /api/auth/me', () => {
  it('returns the signed-in user', async () => {
    const { response, email, cookie } = await registerUser()
    const userId = response.body.data.user.id

    const me = await api('/api/auth/me', { cookie })

    assert.equal(me.status, 200)
    assert.equal(me.body.success, true)
    assert.equal(me.body.data.user.id, userId)
    assert.equal(me.body.data.user.email, email)
    assert.equal(me.body.data.user.role, 'CLIENT')
    assert.equal('accounts' in me.body.data.user, false)
  })

  it('rejects a request with no session', async () => {
    const response = await api('/api/auth/me')

    assert.equal(response.status, 401)
    assert.equal(response.body.success, false)
    assert.equal(response.body.error.code, 'UNAUTHORIZED')
  })

  it('rejects an expired session', async () => {
    const { cookie } = await registerUser()
    const token = TOKEN_PATTERN.exec(cookie)[1]
    const tokenHash = createHash('sha256').update(token).digest('hex')

    await prisma.session.updateMany({
      where: { tokenHash },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    const response = await api('/api/auth/me', { cookie })
    assert.equal(response.status, 401)
  })

  it('rejects a revoked session', async () => {
    const { cookie } = await registerUser()
    const token = TOKEN_PATTERN.exec(cookie)[1]
    const tokenHash = createHash('sha256').update(token).digest('hex')

    await prisma.session.updateMany({ where: { tokenHash }, data: { revokedAt: new Date() } })

    const response = await api('/api/auth/me', { cookie })
    assert.equal(response.status, 401)
  })

  it('rejects a tampered or unknown token', async () => {
    const { cookie } = await registerUser()

    for (const token of [
      'tedor_session=not-a-real-token',
      'tedor_session=',
      `tedor_session=${cookie.split('=')[1].split(';')[0].slice(0, -1)}x`,
    ]) {
      const response = await api('/api/auth/me', { cookie: token })
      assert.equal(response.status, 401, `${token} should not authenticate`)
    }
  })
})

describe('POST /api/auth/logout', () => {
  it('revokes the session and clears the cookie', async () => {
    const { cookie } = await registerUser()
    const token = TOKEN_PATTERN.exec(cookie)[1]
    const tokenHash = createHash('sha256').update(token).digest('hex')

    const response = await api('/api/auth/logout', { method: 'POST', cookie })

    assert.equal(response.status, 200)
    assert.equal(response.body.data.loggedOut, true)

    const cleared = response.setCookie.find((entry) => entry.startsWith('tedor_session='))
    assert.match(cleared, /Max-Age=0/)
    assert.match(cleared, /HttpOnly/)

    const session = await prisma.session.findUnique({ where: { tokenHash } })
    assert.ok(session.revokedAt, 'the session row should be marked revoked')

    const me = await api('/api/auth/me', { cookie })
    assert.equal(me.status, 401, 'the cookie must stop working after signing out')
  })

  it('is safe to call with no session at all', async () => {
    for (const cookie of [undefined, 'tedor_session=stale', 'other=1']) {
      const response = await api('/api/auth/logout', { method: 'POST', cookie })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.loggedOut, true)
    }
  })

  it('is safe to call twice', async () => {
    const { cookie } = await registerUser()

    assert.equal((await api('/api/auth/logout', { method: 'POST', cookie })).status, 200)
    assert.equal((await api('/api/auth/logout', { method: 'POST', cookie })).status, 200)
  })
})

describe('GET /api/auth/providers', () => {
  it('is public, and lists a provider only once it is really usable', async () => {
    const originalId = process.env.GOOGLE_CLIENT_ID
    const originalFlag = process.env.GOOGLE_AUTH_ENABLED

    try {
      // No client id at all.
      delete process.env.GOOGLE_CLIENT_ID
      delete process.env.GOOGLE_AUTH_ENABLED
      const missing = await api('/api/auth/providers')
      assert.equal(missing.status, 200, 'the sign-in page must be able to read this')
      assert.deepEqual(missing.body.data.providers, [], 'no button without a client id')

      // A client id, but the provider explicitly switched off while the OAuth
      // client is still being set up.
      process.env.GOOGLE_CLIENT_ID = 'enabled-client-id.apps.googleusercontent.com'
      process.env.GOOGLE_AUTH_ENABLED = 'false'
      const off = await api('/api/auth/providers')
      assert.deepEqual(off.body.data.providers, [], 'no button while Google is switched off')

      // A client id and no objection: offered.
      delete process.env.GOOGLE_AUTH_ENABLED
      const on = await api('/api/auth/providers')
      assert.deepEqual(on.body.data.providers, ['GOOGLE'])
    } finally {
      if (originalId === undefined) delete process.env.GOOGLE_CLIENT_ID
      else process.env.GOOGLE_CLIENT_ID = originalId
      if (originalFlag === undefined) delete process.env.GOOGLE_AUTH_ENABLED
      else process.env.GOOGLE_AUTH_ENABLED = originalFlag
    }
  })

  it('refuses to start a flow for a provider that is switched off', async () => {
    const originalId = process.env.GOOGLE_CLIENT_ID
    const originalFlag = process.env.GOOGLE_AUTH_ENABLED

    try {
      process.env.GOOGLE_AUTH_ENABLED = 'false'
      const response = await api('/api/auth/google')

      assert.equal(response.status, 503)
      assert.equal(response.body.error.code, 'GOOGLE_NOT_CONFIGURED')
    } finally {
      if (originalId === undefined) delete process.env.GOOGLE_CLIENT_ID
      else process.env.GOOGLE_CLIENT_ID = originalId
      if (originalFlag === undefined) delete process.env.GOOGLE_AUTH_ENABLED
      else process.env.GOOGLE_AUTH_ENABLED = originalFlag
    }
  })

  it('reveals nothing but provider ids', async () => {
    const response = await api('/api/auth/providers')
    const ids = response.body.data.providers

    for (const id of ids) {
      assert.ok(['GOOGLE', 'PHONE', 'TELEGRAM'].includes(id), `unexpected provider: ${id}`)
    }

    const serialised = JSON.stringify(response.body).toLowerCase()
    for (const forbidden of ['secret', 'client_id', 'clientid', 'token', 'password']) {
      assert.equal(serialised.includes(forbidden), false, `must not mention ${forbidden}`)
    }
  })
})

describe('data protection', () => {
  it('keeps password hashes away from every account except credentials', async () => {
    const email = uniqueEmail('guarded')
    createdEmails.push(email)
    const user = await prisma.user.create({ data: { email, name: 'Guarded' } })

    await assert.rejects(
      () =>
        prisma.account.create({
          data: {
            userId: user.id,
            provider: 'GOOGLE',
            providerAccountId: 'google-subject',
            passwordHash: '$argon2id$fake',
          },
        }),
      'the database should refuse a password hash on a federated account',
    )
  })

  it('does not let a session cookie authenticate the admin API', async () => {
    const { cookie } = await registerUser()

    // A normal user's session is not staff access: the admin surface keeps its
    // own guard, and user roles are never consulted for it.
    const response = await api('/api/admin/stats', { cookie })

    if (process.env.ADMIN_API_TOKEN) {
      assert.equal(response.status, 401)
    } else {
      assert.equal(response.status, 200, 'the admin API is open when no token is configured')
    }
  })
})

describe('tutor requests alongside authentication', () => {
  it('links a request from a signed-in visitor to their account', async () => {
    const { cookie } = await registerUser()

    const response = await api('/api/tutor-requests', {
      method: 'POST',
      body: tutorRequestPayload(),
      cookie,
    })
    assert.equal(response.status, 201)
    createdRequestIds.push(response.body.data.id)

    const stored = await prisma.tutorRequest.findUnique({
      where: { id: response.body.data.id },
      select: { userId: true },
    })
    assert.ok(stored.userId, 'the request should reference the signed-in user')
  })

  it('still accepts an anonymous request, with no user attached', async () => {
    const response = await api('/api/tutor-requests', {
      method: 'POST',
      body: tutorRequestPayload({ fullName: 'Anon Visitor' }),
    })

    assert.equal(response.status, 201, 'login must not be required to ask for a tutor')
    createdRequestIds.push(response.body.data.id)

    const stored = await prisma.tutorRequest.findUnique({
      where: { id: response.body.data.id },
      select: { userId: true },
    })
    assert.equal(stored.userId, null)
  })

  it('ignores a session cookie that is not valid', async () => {
    const response = await api('/api/tutor-requests', {
      method: 'POST',
      body: tutorRequestPayload({ fullName: 'Forged Cookie' }),
      cookie: 'tedor_session=obviously-not-valid',
    })

    assert.equal(response.status, 201)
    createdRequestIds.push(response.body.data.id)
  })
})
