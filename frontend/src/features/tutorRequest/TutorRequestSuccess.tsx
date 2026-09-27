import { Link } from 'react-router-dom'

import { SUCCESS_HEADING, SUCCESS_MESSAGE } from './tutorRequest.constants'

export function TutorRequestSuccess() {
  return (
    <div
      className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-10 text-center sm:px-10"
      role="status"
    >
      <span
        aria-hidden="true"
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-2xl font-bold text-white"
      >
        &check;
      </span>

      <h2 className="mt-5 text-2xl font-bold tracking-tight text-emerald-900">
        {SUCCESS_HEADING}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-emerald-900/90">{SUCCESS_MESSAGE}</p>

      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
        >
          Back to home
        </Link>
        <Link
          to="/contact"
          className="inline-flex items-center justify-center rounded-lg border border-emerald-300 bg-white px-5 py-2.5 text-sm font-medium text-emerald-900 transition-colors hover:bg-emerald-50"
        >
          Contact us
        </Link>
      </div>
    </div>
  )
}
