import type { StepIconId } from './howItWorksContent'

/**
 * Line icons for /how-it-works.
 *
 * One 24×24 grid, 1.7 stroke, `currentColor` so a tile can colour them — the
 * same convention as `components/home/SubjectIcon.tsx`, and for the same
 * reason: the site adds no icon dependency. The step icons are kept out of
 * `howItWorksContent.ts` so that file stays copy and nothing but copy.
 */

/**
 * The three step illustrations, keyed by the ids in the content file.
 *
 * Module-private: `StepIcon` is the only thing a caller needs, and exporting a
 * constant from a file of components breaks fast refresh.
 */
const STEP_ICONS: Record<StepIconId, React.ReactNode> = {
  /* A request form: a sheet with lines still to be filled in. */
  request: (
    <>
      <path d="M6 3.5h9.5L19 7v13.5H6z" />
      <path d="M15 3.5V7h4" />
      <path d="M9 11h7" />
      <path d="M9 14.5h4.5" />
    </>
  ),
  /* A match: one profile chosen from several, and the confirmation mark. */
  match: (
    <>
      <rect x="2.5" y="5.5" width="8" height="10" rx="2.4" />
      <circle cx="6.5" cy="9.4" r="1.7" />
      <path d="M4.3 13.6c0-1.2 1-2 2.2-2s2.2.8 2.2 2" />
      <path d="M12.4 10.5h2.9" />
      <circle cx="18" cy="10.5" r="3.5" />
      <path d="M16.2 10.6l1.4 1.4 2.5-2.7" />
    </>
  ),
  /* A lesson: the session itself, on a screen, wherever it happens. */
  lesson: (
    <>
      <rect x="2.5" y="4" width="19" height="13.5" rx="2.6" />
      <circle cx="12" cy="9.6" r="2.5" />
      <path d="M6.6 15.4c.2-2 2.5-3.2 5.4-3.2s5.2 1.2 5.4 3.2" />
      <path d="M8.6 21h6.8" />
      <path d="M12 17.5V21" />
    </>
  ),
}

/**
 * One step's illustration, on the shared 24×24 grid.
 *
 * The tile around it is the caller's, so the same icon works in a light card and
 * a dark one: everything is `currentColor`.
 */
export function StepIcon({ id, className }: { id: StepIconId; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {STEP_ICONS[id]}
    </svg>
  )
}

/** The brand's own arrow, used on every link that leads somewhere. */
export function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3.5 12h17" />
      <path d="M14 5.5 20.5 12 14 18.5" />
    </svg>
  )
}

/** A tick, for lists of things that are true. */
export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12.5 9.5 17 19 7" />
    </svg>
  )
}

/** A shield with a tick: review, and the promise that follows it. */
export function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3 19.2 5.7v5.5c0 4.4-3 8.5-7.2 9.8-4.2-1.3-7.2-5.4-7.2-9.8V5.7Z" />
      <path d="M8.7 12.1 11.2 14.6 16 9.4" />
    </svg>
  )
}

/** A clock, for the "how long does this take" line under each step. */
export function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.4V12l3 1.9" />
    </svg>
  )
}

/** The FAQ's disclosure chevron. Rotated by the parent's `group-open`. */
export function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />
    </svg>
  )
}
