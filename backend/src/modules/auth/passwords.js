import { randomBytes } from 'node:crypto'

import argon2 from 'argon2'

/**
 * Password hashing.
 *
 * Argon2id is the current recommendation (OWASP): it is memory-hard, so
 * cracking a stolen list of hashes is expensive even with GPUs, and it is
 * resistant to both time-memory trade-off and side-channel attacks.
 *
 * The parameters below are the OWASP baseline (19 MiB, 2 passes, 1 lane). They
 * are stored inside every hash, so they can be raised later without a data
 * migration — `needsRehash` reports when an old hash should be upgraded, and
 * the login flow re-hashes it on a successful sign-in.
 */
const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
}

/** Never store or log this: the plaintext password only ever exists in a request. */
export async function hashPassword(password) {
  return argon2.hash(password, HASH_OPTIONS)
}

/**
 * Checks a password against a stored hash.
 *
 * A missing or unparseable hash reads as "wrong password" rather than throwing,
 * so a corrupted row can never turn a sign-in attempt into a 500.
 */
export async function verifyPassword(storedHash, password) {
  if (!storedHash) return false
  try {
    return await argon2.verify(storedHash, password)
  } catch {
    return false
  }
}

/** True when a stored hash was made with weaker parameters than we use now. */
export function needsRehash(storedHash) {
  try {
    return argon2.needsRehash(storedHash, HASH_OPTIONS)
  } catch {
    return true
  }
}

let decoyHash

/**
 * Burns the same CPU time as a real password check without checking anything.
 *
 * Without this, a sign-in for an unknown email would return far faster than one
 * for a known email, and the response time alone would reveal which addresses
 * have accounts. Called on the "no such user" path so both take ~equally long.
 */
export async function verifyDecoyPassword() {
  decoyHash ??= await hashPassword(randomBytes(32).toString('hex'))
  await verifyPassword(decoyHash, 'not-the-password')
}
