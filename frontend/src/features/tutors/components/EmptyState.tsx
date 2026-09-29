import { Link } from 'react-router-dom'

/**
 * Shown in the tutor directory when the current search/filter state returns
 * zero results.
 *
 * Requirements: 8.2
 *
 * The message varies depending on whether filters are active so visitors
 * understand why the list is empty and what they can do about it.
 */
export interface EmptyStateProps {
  /** When true, the empty state is due to active filters, not a truly empty directory. */
  isFiltered?: boolean
}

export function EmptyState({ isFiltered = false }: EmptyStateProps) {
  const message = isFiltered
    ? 'No tutors match these filters. Try adjusting or clearing your search criteria.'
    : 'No tutors available yet. Be the first to join or submit a request and we\'ll find the right match for you.'

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {/* Illustration */}
      <div
        aria-hidden="true"
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-brand-50"
      >
        <svg
          viewBox="0 0 48 48"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-10 w-10 text-brand-400"
        >
          <circle cx="20" cy="18" r="7" />
          <path d="M6 40a14 14 0 0 1 28 0" />
          <path d="M34 22l8 8" />
          <path d="M42 22l-8 8" />
        </svg>
      </div>

      <h2 className="text-xl font-semibold text-ink-900">Find the right tutor</h2>

      <p className="mt-2 max-w-sm text-sm text-ink-500">{message}</p>

      <Link
        to="/request-tutor"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-[0.95rem] font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
      >
        Request a Tutor
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
  )
}
