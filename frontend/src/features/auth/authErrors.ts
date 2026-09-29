/**
 * Why a sign-in attempt that started at Google did not finish.
 *
 * The API sends the visitor back here with `?authError=<code>` rather than
 * showing Google's own error text, so this is the only place that decides what
 * a code means. Codes that are not recognised fall back to a generic message
 * rather than being shown raw.
 */
const MESSAGES: Record<string, string> = {
  cancelled: 'You cancelled Google sign-in, so nothing changed.',
  consent_required: 'Google needs your permission before we can sign you in.',
  missing_code: 'Google did not send us a sign-in code. Please try again.',
  invalid_state:
    'That sign-in link has expired or was already used. Please start again from Google.',
  start_failed: 'We could not start Google sign-in. Please try again in a moment.',
  google_failed: 'Google sign-in did not work. Please try again.',
  GOOGLE_EXCHANGE_FAILED: 'Google sign-in did not work. Please try again.',
  GOOGLE_EMAIL_UNVERIFIED:
    'Google has not verified an email address for that account. Sign in with your password instead, or use a Google account with a verified address.',
  GOOGLE_PROFILE_FAILED: 'Google did not share your account details. Please try again.',
  GOOGLE_NOT_CONFIGURED: 'Google sign-in is not set up on this server yet.',
}

const FALLBACK = 'Google sign-in did not work. Please try again.'

export function authErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null
  return MESSAGES[code] ?? FALLBACK
}
