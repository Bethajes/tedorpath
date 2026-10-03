import { createHash, randomBytes } from 'node:crypto'

import { env } from '../../config/env.js'
import { prisma } from '../../lib/prisma.js'

import { hashPassword } from './passwords.js'

/**
 * Data access for users, the login methods attached to them, and sessions.
 *
 * Two rules hold everywhere in this file:
 *
 *  1. User rows are read through `PUBLIC_USER_SELECT`, so a password hash can
 *     never be part of a user object that leaves the service.
 *  2. Emails are only ever stored normalized (see validation.js), which is
 *     what makes the unique index case-insensitive in practice.
 */

/** 32 random bytes → 256 bits of entropy, the same order as a strong API key. */
const SESSION_TOKEN_BYTES = 32

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * The only user fields that may ever be serialised. A hash is not in this
 * list, so it cannot be returned by accident.
 */
export const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  image: true,
  createdAt: true,
  // Coarse — a two-letter country, not an address. Present because the public tutor
  // routes read it to decide which of a tutor's prices to show, and they resolve
  // their market through `optionalAuth`, which only carries what this select lists.
  //
  // It is deliberately not in `toPublicUser`, so `/api/auth/me` does not start
  // telling a signed-in client where it thinks its owner lives. The client does not
  // need it: it asks `/api/onboarding/market`, which resolves the market and hands
  // back a market code, and a country the account owner did not choose by hand is
  // not something the interface should be reading back.
  countryCode: true,
}

/** Prisma's "unique constraint failed" code. Checked by shape so a version
 *  bump in the client cannot break the duplicate-email path. */
function isUniqueViolation(error) {
  return typeof error?.code === 'string' && error.code === 'P2002'
}

/** Shapes a user for the API. Keep in step with PUBLIC_USER_SELECT. */
export function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    image: user.image ?? null,
    createdAt: user.createdAt,
  }
}

export function generateSessionToken() {
  return randomBytes(SESSION_TOKEN_BYTES).toString('base64url')
}

/**
 * The database stores only this digest. A stolen database dump therefore
 * cannot be replayed as a live session; the raw token exists solely in the
 * visitor's HttpOnly cookie.
 */
export function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Creates a user together with their email/password login method.
 *
 * `role` is set here and only here, and never from the request body: public
 * registration produces a CLIENT and nothing else. The two rows are written in
 * one transaction so a user can never end up without a way to sign in.
 */
export async function createUserWithCredentials({ name, email, password }) {
  const passwordHash = await hashPassword(password)

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, role: 'CLIENT' },
      select: PUBLIC_USER_SELECT,
    })

    await tx.account.create({
      data: {
        userId: user.id,
        provider: 'CREDENTIALS',
        // The normalized email identifies a credentials account, so the
        // (provider, providerAccountId) unique index also prevents a second
        // password login being attached to the same address.
        providerAccountId: email,
        passwordHash,
      },
    })

    return user
  })
}

export { isUniqueViolation }

/**
 * Looks up a user by email together with their password hash.
 *
 * The two are returned as separate values rather than as one record, so a
 * caller that logs or returns the user cannot drag the hash along with it.
 * Returns null when the address is unknown, or when it exists but has no
 * password (a future Google-only account).
 */
export async function findCredentialsUserByEmail(email) {
  const record = await prisma.user.findUnique({
    where: { email },
    select: {
      ...PUBLIC_USER_SELECT,
      accounts: {
        where: { provider: 'CREDENTIALS' },
        select: { id: true, passwordHash: true },
      },
    },
  })

  if (!record) return null

  const { accounts, ...user } = record
  return { user, passwordHash: accounts[0]?.passwordHash ?? null, accountId: accounts[0]?.id ?? null }
}

/** Issues a session and returns the raw token, which is only ever given to the cookie. */
export async function createSession(userId) {
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + env.sessionTtlDays * MILLISECONDS_PER_DAY)

  const session = await prisma.session.create({
    data: { userId, tokenHash: hashSessionToken(token), expiresAt },
    select: { id: true, expiresAt: true },
  })

  return { token, session }
}

/**
 * Resolves a session token.
 *
 * Returns null — never throws — for a token that is unknown, already revoked,
 * or past its expiry, so every caller can treat "no session" the same way.
 */
export async function findSessionByToken(token) {
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      user: { select: PUBLIC_USER_SELECT },
    },
  })

  if (!session || session.revokedAt) return null
  if (session.expiresAt.getTime() <= Date.now()) return null

  return session
}

/**
 * Revokes the session behind a token. Idempotent: signing out twice, or with a
 * stale cookie, is not an error.
 */
export async function revokeSessionByToken(token) {
  if (!token) return false

  const { count } = await prisma.session.updateMany({
    where: { tokenHash: hashSessionToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  })

  return count > 0
}

/**
 * Drops this user's sessions that have already expired.
 *
 * Called when a session is issued so a long-lived account does not accumulate
 * them. Revoked rows are kept deliberately: they are the record that a sign-out
 * happened.
 */
export async function pruneExpiredSessions(userId) {
  await prisma.session.deleteMany({
    where: { userId, expiresAt: { lt: new Date() } },
  })
}

/** Replaces an old hash after a successful sign-in, when the parameters have moved on. */
export async function updatePasswordHash(accountId, passwordHash) {
  await prisma.account.update({
    where: { id: accountId },
    data: { passwordHash },
  })
}

// --- OAuth sign-in flows ----------------------------------------------------

/**
 * Records an OAuth attempt so its callback can be verified later.
 *
 * `stateHash` and `codeVerifier` stay on the server so the client can neither
 * forge the CSRF token nor complete the exchange itself.
 */
export async function createLoginFlow({ provider, stateHash, codeVerifier, expiresAt }) {
  await pruneExpiredLoginFlows()
  return prisma.loginFlow.create({ data: { provider, stateHash, codeVerifier, expiresAt } })
}

/**
 * Fetches and immediately deletes the flow behind a `state`.
 *
 * Deleting on read is what makes `state` single-use: replaying a callback URL
 * finds nothing. Returns null for an unknown or expired state.
 */
export async function consumeLoginFlow(provider, stateHash) {
  const flow = await prisma.loginFlow.findFirst({
    where: { provider, stateHash },
    select: { id: true, codeVerifier: true, expiresAt: true },
  })

  if (!flow) return null

  await prisma.loginFlow.delete({ where: { id: flow.id } })

  if (flow.expiresAt.getTime() <= Date.now()) return null
  return flow
}

export async function pruneExpiredLoginFlows() {
  await prisma.loginFlow.deleteMany({ where: { expiresAt: { lt: new Date() } } })
}

// --- Federated (Google) accounts -------------------------------------------

/** The user a provider identity is already attached to, if any. */
export async function findUserByProviderAccount(provider, providerAccountId) {
  const account = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    select: { user: { select: PUBLIC_USER_SELECT } },
  })

  return account?.user ?? null
}

async function attachProviderAccount({ userId, provider, providerAccountId }) {
  return prisma.account.create({
    data: { userId, provider, providerAccountId },
    select: { id: true },
  })
}

/** Google names can exceed the column, and may be missing entirely. */
function toDisplayName(name, email) {
  const trimmed = (name ?? '').trim()
  if (trimmed) return trimmed.slice(0, 80)
  return (email.split('@')[0] || 'Tedor user').slice(0, 80)
}

/**
 * Turns a verified Google identity into a Tedor user, creating or linking as
 * needed, and returns the user.
 *
 * The rule that matters: an account is only ever linked by **verified** email.
 * Google owns the addresses on its own accounts, so a verified email is proof
 * of the same person — that is what lets somebody who signed up with a
 * password later add "Continue with Google" without ending up with two
 * accounts. An unverified address proves nothing, so it is refused outright
 * rather than used to claim someone's email.
 *
 * The provider identifier (`sub`) is the primary key of the link, so the same
 * Google account can only ever belong to one Tedor user.
 */
export async function resolveGoogleUser(profile) {
  if (!profile.email || !profile.emailVerified) {
    const error = new Error('Google did not verify an email address for this account.')
    error.code = 'GOOGLE_EMAIL_UNVERIFIED'
    throw error
  }

  const existing = await findUserByProviderAccount('GOOGLE', profile.providerAccountId)
  if (existing) return { user: existing, created: false }

  const byEmail = await prisma.user.findUnique({
    where: { email: profile.email },
    select: { ...PUBLIC_USER_SELECT, emailVerifiedAt: true },
  })

  if (byEmail) {
    // Sign-in number two for somebody who already has an account: link the
    // provider to them rather than creating a rival record.
    try {
      await attachProviderAccount({
        userId: byEmail.id,
        provider: 'GOOGLE',
        providerAccountId: profile.providerAccountId,
      })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      // Another request linked this Google account first; use that user.
      const linked = await findUserByProviderAccount('GOOGLE', profile.providerAccountId)
      if (linked) return { user: linked, created: false }
      throw error
    }

    // Google has vouched for the address, so record that even if an earlier
    // self-registered account had not verified it.
    await prisma.user.update({
      where: { id: byEmail.id },
      data: { emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date() },
    })

    return { user: { ...byEmail, emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date() }, created: false }
  }

  // First time we have seen this person.
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: profile.email,
        name: toDisplayName(profile.name, profile.email),
        image: profile.image ?? null,
        role: 'CLIENT',
        emailVerifiedAt: new Date(),
      },
      select: { ...PUBLIC_USER_SELECT, emailVerifiedAt: true },
    })

    await tx.account.create({
      data: { userId: created.id, provider: 'GOOGLE', providerAccountId: profile.providerAccountId },
    })

    return created
  })

  return { user, created: true }
}
