/** Small shared validators used by the request form's Zod schema. */

export const PHONE_PATTERN = /^[0-9+()\-\s]+$/

/** Accepts an empty string (optional field) or a plausible email address. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Telegram handles start with `@`; anything else is treated as a typed name. */
export const TELEGRAM_PATTERN = /^@?[A-Za-z0-9_]{4,32}$/

export function normalizeTelegram(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`
}
