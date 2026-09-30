/**
 * Formatting for the timestamps the admin area shows.
 *
 * An absolute date answers "when was this?" but not the question an admin
 * actually has about a queue item, which is "is this new, and how new?". Two
 * requests both dated "29 Sep 2026" may be five minutes apart, so the list
 * cannot make one of them look urgent. `formatRelative` is what carries that.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

/**
 * Past this age a relative time stops being useful — "47 days ago" is harder to
 * place in the mind than a date — so the absolute form takes over.
 */
const RELATIVE_CUTOFF_DAYS = 7

const relative = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' })

/** Formats an ISO timestamp as a short date, e.g. "27 Sep 2026". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * How long ago something happened, e.g. "5 minutes ago".
 *
 * `now` is injectable so the output is deterministic in tests rather than
 * depending on when the suite happens to run.
 *
 * The floor is deliberate: anything under a minute reads as "just now" rather
 * than "0 seconds ago", which looks like a bug to whoever sees it.
 */
export function formatRelative(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!iso) return '—'
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return '—'

  const elapsed = now.getTime() - then.getTime()

  // A timestamp in the future means clock skew or a bad write, not something to
  // describe as "-3 hours ago".
  if (elapsed < 0) return 'just now'
  if (elapsed < MINUTE_MS) return 'just now'

  if (elapsed < HOUR_MS) {
    return relative.format(-Math.round(elapsed / MINUTE_MS), 'minute')
  }

  if (elapsed < DAY_MS) {
    return relative.format(-Math.round(elapsed / HOUR_MS), 'hour')
  }

  const days = Math.round(elapsed / DAY_MS)
  if (days <= RELATIVE_CUTOFF_DAYS) {
    return relative.format(-days, 'day')
  }

  return formatDate(iso)
}

/**
 * Both forms at once, for a `title` attribute.
 *
 * The visible text is the relative one because that is the useful signal; the
 * exact timestamp stays reachable on hover for when an admin needs to cite it.
 */
export function formatWhen(
  iso: string | null | undefined,
  now: Date = new Date(),
): { label: string; title: string } {
  return {
    label: formatRelative(iso, now),
    title: formatDate(iso),
  }
}
