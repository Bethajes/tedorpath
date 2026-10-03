import { Link } from 'react-router-dom'

import { clientTelegramLink, CLIENT_TELEGRAM_CONTACT } from '@/lib/contactConfig'

import { SUCCESS_HEADING, SUCCESS_MESSAGE } from './tutorRequest.constants'

/**
 * What a client sees once their request has been sent.
 *
 * The Telegram button is here on purpose. A client who has just filled in eleven
 * steps is told we will contact them, and without a way to reach us they have
 * nothing to do but wait — so the confirmation is also where we hand them a
 * channel. It is a real handle we publish, not a booking link, and it opens a
 * chat rather than a booking flow: we cannot promise a specific tutor or a time
 * before anyone has read the request, and a page that implied otherwise would be
 * promising something this product does not do yet.
 */
export function TutorRequestSuccess() {
  const telegram = clientTelegramLink()

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

      <div className="mx-auto mt-7 max-w-md rounded-xl border border-emerald-200 bg-white p-5 text-left">
        <p className="text-sm font-semibold text-ink-900">Need to add something?</p>
        <p className="mt-1.5 text-sm text-ink-600">
          If you want to send the details of a particular subject, a deadline or a tutor you have
          already found, message us on Telegram and quote your request.
        </p>

        <a
          href={telegram}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          Message {CLIENT_TELEGRAM_CONTACT} on Telegram
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>

      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
        >
          Back to home
        </Link>
        <Link
          to="/tutors"
          className="inline-flex items-center justify-center rounded-lg border border-emerald-300 bg-white px-5 py-2.5 text-sm font-medium text-emerald-900 transition-colors hover:bg-emerald-50"
        >
          Browse tutors
        </Link>
      </div>
    </div>
  )
}