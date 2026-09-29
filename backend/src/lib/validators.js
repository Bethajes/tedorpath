/**
 * Input patterns shared by more than one module.
 *
 * These live here (rather than inside a feature) so the tutor-request form and
 * the authentication endpoints can never drift into disagreeing about what a
 * valid email address or Telegram handle looks like.
 */

/** Deliberately permissive: the only authority on deliverability is a real email. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const PHONE_PATTERN = /^[0-9+()\-\s]+$/

export const TELEGRAM_PATTERN = /^@?[A-Za-z0-9_]{4,32}$/
