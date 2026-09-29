import { z } from 'zod'

import { EMAIL_PATTERN } from '../../lib/validators.js'

/**
 * Validation for the authentication endpoints.
 *
 * This is the security boundary: the controller trusts nothing that reaches it,
 * including the role. Both schemas are `strict()`, so an unexpected key — a
 * `role` of "ADMIN", say — is rejected outright rather than quietly ignored,
 * which makes an attempt to escalate visible in the logs instead of silent.
 */

export const PASSWORD_MIN_LENGTH = 8
/** Long enough to stop a password being used as a memory-exhaustion vector. */
export const PASSWORD_MAX_LENGTH = 128
export const NAME_MIN_LENGTH = 2
export const NAME_MAX_LENGTH = 80

/**
 * Canonical form of an email address.
 *
 * Stored lowercase and trimmed so `John.Doe@Gmail.com` and `john.doe@gmail.com`
 * are one account, not two. Applied to every write path; uniqueness of the
 * column then does the rest of the work.
 */
export function normalizeEmail(value) {
  return value.trim().toLowerCase()
}

const email = z
  .string({ message: 'Enter your email address.' })
  .trim()
  .min(3, 'Enter your email address.')
  .max(320, 'Email addresses cannot be longer than 320 characters.')
  .refine((value) => EMAIL_PATTERN.test(value), 'Enter a valid email address.')
  .transform(normalizeEmail)

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(NAME_MIN_LENGTH, `Your name must be at least ${NAME_MIN_LENGTH} characters.`)
      .max(NAME_MAX_LENGTH, `Your name cannot be longer than ${NAME_MAX_LENGTH} characters.`),
    email,
    // Deliberately only a length rule. Composition rules (one capital, one
    // digit, one symbol) push people towards predictable substitutions without a
    // proven security benefit, and length is what actually matters.
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Your password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
      .max(
        PASSWORD_MAX_LENGTH,
        `Your password cannot be longer than ${PASSWORD_MAX_LENGTH} characters.`,
      ),
  })
  .strict()

/**
 * Sign-in input.
 *
 * A short password is not rejected here: the policy is enforced at
 * registration, and failing a sign-in on length would leak the policy while
 * telling the user nothing useful. An empty password still fails early with a
 * message worth reading.
 */
export const loginSchema = z
  .object({
    email,
    password: z
      .string()
      .min(1, 'Enter your password.')
      .max(PASSWORD_MAX_LENGTH, 'Enter your password.'),
  })
  .strict()

/**
 * @returns {{ ok: true, data: object } | { ok: false, fields: Array<{field: string, message: string}> }}
 */
function toResult(schema, body) {
  const result = schema.safeParse(body)

  if (result.success) {
    return { ok: true, data: result.data }
  }

  return {
    ok: false,
    fields: result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '_',
      message: issue.message,
    })),
  }
}

export function validateRegister(body) {
  return toResult(registerSchema, body)
}

export function validateLogin(body) {
  return toResult(loginSchema, body)
}
