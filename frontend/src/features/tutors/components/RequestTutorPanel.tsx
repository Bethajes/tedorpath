import { Link } from 'react-router-dom'

import type { TutorFilters } from '../tutors.types'
import { buildTutorRequestHrefFromFilters } from '../tutorRequestHref'

export interface RequestTutorPanelProps {
  /** The directory's current filters, carried into the request form as prefill. */
  filters: TutorFilters
}

/**
 * The escape hatch for a parent who cannot find a suitable tutor in the list.
 *
 * The directory can only show tutors who have already applied and been approved.
 * A parent whose needs are unusual — a subject with no approved tutor, a level
 * nobody teaches, a language, a budget, a deadline — is not served by that list,
 * and the empty state is the only place the request form is currently offered
 * from. Someone looking at three tutors that are all wrong was never offered a
 * way to say so, which is why this panel is on the page unconditionally rather
 * than only when the result count is zero.
 *
 * The form it links to is the same one a specific tutor's profile links to; the
 * filters are passed along so the parent does not retype the search they have
 * already done.
 */
export function RequestTutorPanel({ filters }: RequestTutorPanelProps) {
  const href = buildTutorRequestHrefFromFilters(filters)

  return (
    <aside
      aria-labelledby="request-tutor-panel-heading"
      className="mb-6 rounded-2xl border border-brand-200 bg-brand-50/60 p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2
            id="request-tutor-panel-heading"
            className="text-base font-semibold text-ink-900 sm:text-lg"
          >
            Can't find the right tutor?
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
            Tell us what you need — subject, level, budget and how you want to
            learn — and our team will review your request and match you with a
            tutor.
          </p>
        </div>

        <Link
          to={href}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-[0.95rem] font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          Post a Tutor Request
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 8h11" />
            <path d="M9 4l4 4-4 4" />
          </svg>
        </Link>
      </div>
    </aside>
  )
}
