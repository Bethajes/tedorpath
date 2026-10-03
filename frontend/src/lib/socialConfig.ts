/**
 * Social profile links for the footer.
 *
 * Configuration rather than constants, for the same reason as `contactConfig`:
 * these are deployment details. A developer running the app locally should not be
 * pushed at somebody else's account, and a half-configured deployment should
 * show no dead links.
 *
 * ─── HOW TO SET THESE ────────────────────────────────────────────────────────
 *
 * Fill in `url` below for each platform you have. Anything left as an empty
 * string renders as a muted, non-clickable slot — deliberately visible, so the
 * row does not reflow when you add one — but it is never a link, so there is
 * nothing for a visitor to click and fail on.
 *
 * OR set environment variables, which take precedence and need no code change:
 *
 *   VITE_SOCIAL_TIKTOK=https://www.tiktok.com/@yourhandle
 *   VITE_SOCIAL_FACEBOOK=https://facebook.com/yourpage
 *   VITE_SOCIAL_INSTAGRAM=https://instagram.com/yourhandle
 *   VITE_SOCIAL_TELEGRAM=https://t.me/yourhandle
 *   VITE_SOCIAL_LINKEDIN=https://linkedin.com/company/yourcompany
 *   VITE_SOCIAL_X=https://x.com/yourhandle
 *
 * Accept a bare handle too — `t.me/yourhandle` and `@yourhandle` are normalised
 * below — because typing the full URL six times is the easiest way to get one
 * wrong.
 */

export type SocialPlatformId =
  | 'tiktok'
  | 'facebook'
  | 'instagram'
  | 'telegram'
  | 'linkedin'
  | 'x'

export interface SocialPlatform {
  id: SocialPlatformId
  /** The visible label, and the accessible name of the icon. */
  label: string
  /**
   * The profile URL, or `null` when this platform is not configured.
   *
   * EMPTY BY DESIGN. These are placeholders to be replaced, not guesses: a
   * plausible-looking `facebook.com/tedor-tutors` would either 404 or, worse,
   * belong to a stranger. An empty slot renders muted and is not a link.
   */
  url: string | null
}

/** Read at call time — see the note on `telegramHandle` in `contactConfig`. */
function readEnv(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** The declared URLs. Replace these, or set the env variables above. */
const DECLARED: Record<SocialPlatformId, string> = {
  // ↓↓↓ REPLACE THESE with your real profile URLs ↓↓↓
  tiktok: '@tedorpath0',
  facebook: 'https://web.facebook.com/profile.php?id=61595039309878',
  instagram: '@Tedor_Path',
  telegram: 'https://t.me/Tedor_Tutors',
  linkedin:
    'https://www.linkedin.com/in/tedor-undefined-8a44a9440?utm_source=share_via&utm_content=profile&utm_medium=member_android',
  x: '@Tedorpath',
  // ↑↑↑ REPLACE THESE with your real profile URLs ↑↑↑
}

/**
 * The base URL each platform lives on.
 *
 * Used to turn a bare handle into a working link, so a value written as
 * `t.me/yourhandle` or `@yourhandle` still produces a correct URL instead of a
 * broken relative path.
 */
const PLATFORM_HOSTS: Record<SocialPlatformId, string> = {
  tiktok: 'https://www.tiktok.com/@',
  facebook: 'https://www.facebook.com/',
  instagram: 'https://www.instagram.com/',
  telegram: 'https://t.me/',
  linkedin: 'https://www.linkedin.com/company/',
  x: 'https://x.com/',
}

/** The env variable checked for each platform, if set. */
const ENV_KEYS: Record<SocialPlatformId, string> = {
  tiktok: 'VITE_SOCIAL_TIKTOK',
  facebook: 'VITE_SOCIAL_FACEBOOK',
  instagram: 'VITE_SOCIAL_INSTAGRAM',
  telegram: 'VITE_SOCIAL_TELEGRAM',
  linkedin: 'VITE_SOCIAL_LINKEDIN',
  x: 'VITE_SOCIAL_X',
}

/** Display order in the footer. */
const ORDER: SocialPlatformId[] = [
  'tiktok',
  'facebook',
  'instagram',
  'telegram',
  'linkedin',
  'x',
]

/**
 * Normalises whatever was configured into a safe absolute URL.
 *
 * Returns `null` for anything unusable, which is what makes the empty
 * placeholder safe: a blank string cannot become a link.
 *
 * Three shapes are accepted, because these are values a person types:
 *
 *   `https://x.com/tedor`   used as written
 *   `x.com/tedor`           given an `https://` scheme
 *   `@tedor` / `tedor`      prefixed with the platform host
 *
 * `URL` cannot distinguish the second from the third on its own — it reads
 * `x.com/tedor` as a path — so the host is detected before parsing.
 *
 * A bare handle has its whitespace removed. No platform handle can contain a
 * space, but "tedor path" is a natural thing to type for a page called
 * "Tedor Path" — and without this it would be silently percent-encoded into
 * `facebook.com/tedor%20path`, which 404s rather than failing visibly.
 *
 * Only `http:` and `https:` survive. A configured value is operator input, but
 * it still ends up in an `href` on every page, so a `javascript:` or `data:` URL
 * must never get through. Any other scheme is REJECTED outright rather than
 * being treated as a bare handle — reinterpreting `javascript:alert(1)` as
 * `x.com/javascript:alert(1)` would be harmless by luck, but silently turning a
 * rejected value into a strange working link is worse than refusing it.
 */
export function socialUrl(id: SocialPlatformId, raw?: string): string | null {
  // Each source is trimmed before the chain is evaluated, so a whitespace-only
  // value is treated exactly like an empty one. Without the trim, `'   '` would
  // be truthy and short-circuit the `||` chain to an empty string, so a blank
  // value would clear the platform instead of falling back to the declared URL.
  const fromEnv = readEnv(import.meta.env[ENV_KEYS[id]])
  const fromArgument = readEnv(raw)
  const configured = fromEnv || fromArgument || readEnv(DECLARED[id])

  if (!configured) return null

  // Internal whitespace collapsed to nothing. Applied only to the bare-handle
  // branch below — a full URL is left alone, since a space there is a typo the
  // caller should see rather than have patched over.
  const handle = configured.replace(/\s+/g, '')

  let candidate: string

  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(configured)

  if (scheme) {
    if (!/^https?$/i.test(scheme[1])) return null
    candidate = configured
  } else if (HAVE_SCHEME.test(handle)) {
    // Starts with `//`.
    candidate = `https:${handle}`
  } else if (namesAKnownHost(handle)) {
    // A full address with the scheme left off, e.g. `x.com/tedor`. Only when the
    // host is one of ours — see KNOWN_HOSTS.
    candidate = `https://${handle.replace(/^\/+/, '')}`
  } else {
    // A bare handle.
    candidate = `${PLATFORM_HOSTS[id]}${handle.replace(/^@/, '')}`
  }

  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    return null
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null

  return parsed.toString()
}

/** `//host/path` — scheme-relative. */
const HAVE_SCHEME = /^\/\//

/**
 * Hostnames these six platforms are actually reached on.
 *
 * Used instead of "does this look like a domain". A generic rule — anything
 * with a dot and a TLD — reads `tedor.tutors` or `tedor.path` as a hostname and
 * produces `https://tedor.tutors/`, which is a dead link on a different site.
 * Dots are common and legal in social page names, so the only safe test is
 * whether the value names a host we know.
 */
const KNOWN_HOSTS = [
  'tiktok.com',
  'facebook.com',
  'fb.com',
  'fb.me',
  'instagram.com',
  't.me',
  'telegram.me',
  'linkedin.com',
  'x.com',
  'twitter.com',
]

/** True when `value` starts with a known platform host, with or without www. */
function namesAKnownHost(value: string): boolean {
  const host = value.split(/[/?#]/, 1)[0].replace(/^www\./i, '').toLowerCase()
  return KNOWN_HOSTS.includes(host)
}

/**
 * Every platform, configured or not, in display order.
 *
 * `url` is `null` for a platform with nothing set. Callers render a muted slot
 * rather than omitting it, so the row keeps its shape and the operator can see
 * which ones still need filling in.
 */
export function socialPlatforms(): SocialPlatform[] {
  return ORDER.map((id) => ({
    id,
    label: LABELS[id],
    url: socialUrl(id),
  }))
}

/** True when at least one platform has a URL. */
export function hasSocialLinks(): boolean {
  return socialPlatforms().some((platform) => platform.url !== null)
}

const LABELS: Record<SocialPlatformId, string> = {
  tiktok: 'TikTok',
  facebook: 'Facebook',
  instagram: 'Instagram',
  telegram: 'Telegram',
  linkedin: 'LinkedIn',
  x: 'X',
}
