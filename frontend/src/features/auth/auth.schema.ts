import { z } from 'zod'

import { EMAIL_PATTERN } from '@/lib/validators'

/**
 * Client-side validation for the authentication forms.
 *
 * This exists to give immediate, friendly feedback while typing. The API
 * validates everything again and is the authority — these rules mirror
 * `backend/src/modules/auth/validation.js` and are deliberately identical to
 * it, so a visitor is never told something is fine here and rejected there.
 */

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

export const PASSWORD_HINT = `At least ${PASSWORD_MIN_LENGTH} characters. A short phrase you will remember beats a scrambled word.`

const email = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .refine((value) => EMAIL_PATTERN.test(value), 'Enter a valid email address.')

/** Length only. No composition rules — see the server-side note on why. */
const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Your password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Your password cannot be longer than ${PASSWORD_MAX_LENGTH} characters.`)

export const loginSchema = z.object({
  email,
  // Not held to the length policy: this field answers "is this the password
  // you meant to type", and the API decides whether it is the right one.
  password: z.string().min(1, 'Enter your password.'),
})

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Please enter your full name.')
      .max(80, 'Please keep your name under 80 characters.'),
    email,
    password,
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The two passwords do not match.',
  })

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>
