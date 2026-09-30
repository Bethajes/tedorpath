/**
 * How tutors reach the Tedor team while their profile is under review.
 *
 * Configuration rather than constants because these are deployment details: a
 * real deployment will have its own handles, and a developer running the app
 * locally should not be pushed at a contact that is not theirs. Both are
 * optional — an unset value means the matching button is not rendered at all,
 * so a half-configured deployment shows one channel rather than a dead link.
 *
 * Values are stored without a scheme (a Telegram handle, a phone number) and the
 * link is built here, so the same value works for a link, a label and a
 * `tel:`/`https:` target without three separate strings to keep in sync.
 * Requirements: 32.1, 32.2, 32.5
 */

function readEnv(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * The configured Telegram handle, e.g. `@Tedor_Team`.
 *
 * Read at module load for anything that wants the raw configured value.
 */
export const TELEGRAM_CONTACT = readEnv(import.meta.env.VITE_CONTACT_TELEGRAM)

/** The configured WhatsApp number, e.g. `+447700900123`. */
export const WHATSAPP_CONTACT = readEnv(import.meta.env.VITE_CONTACT_WHATSAPP)

/**
 * The Telegram handle, read at call time.
 *
 * A component must use this rather than the module-level constant: build-time
 * env is resolved when this file is first imported, so a value read once at
 * import cannot be changed afterwards — which makes it untestable and would
 * leave a stale handle rendered after a configuration change.
 */
export function telegramHandle(): string {
  return readEnv(import.meta.env.VITE_CONTACT_TELEGRAM)
}

/** The WhatsApp number, read at call time. See `telegramHandle`. */
export function whatsappNumber(): string {
  return readEnv(import.meta.env.VITE_CONTACT_WHATSAPP)
}

/** True when at least one contact channel is configured. */
export const HAS_CONTACT_DETAILS = Boolean(TELEGRAM_CONTACT || WHATSAPP_CONTACT)

/**
 * Build a Telegram deep link.
 *
 * `https://t.me/<handle>` opens a chat with the account. A leading `@` is
 * dropped so the same value works whether it was written as `@Tedor_Team` or
 * `Tedor_Team`.
 *
 * There is deliberately no `?start=` parameter: that only pre-fills a message
 * for links opened from a Telegram *bot's* share flow, so on a plain public
 * handle like this one it would be ignored, and the tutor would land in an
 * empty chat either way. The status page tells them what to attach before the
 * button, which is what actually gets the documents sent.
 */
export function telegramLink(handle: string = telegramHandle()): string | null {
  if (!handle) return null
  const bare = handle.replace(/^@/, '')
  if (!bare) return null
  return `https://t.me/${encodeURIComponent(bare)}`
}

/** Build a WhatsApp click-to-chat link. Returns null when not configured. */
export function whatsappLink(number: string = whatsappNumber()): string | null {
  if (!number) return null

  // Strip formatting a human may paste in, and WhatsApp requires digits with an
  // optional leading plus — no spaces, dashes or brackets.
  const digits = number.replace(/[^\d+]/g, '')
  if (!/\+?\d{5,}/.test(digits)) return null

  return `https://wa.me/${digits.replace(/^\+/, '')}`
}
