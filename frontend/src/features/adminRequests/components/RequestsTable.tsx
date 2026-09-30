import { Link } from 'react-router-dom'

import { formatWhen } from '@/lib/formatDate'

import type { AdminRequestListItem } from '../types'
import { StatusBadge } from './StatusBadge'

/**
 * Which tutor the client asked for.
 *
 * The most actionable fact about a request that came from a tutor's profile:
 * it is already routed, and an admin triaging the queue needs to see that before
 * they decide who to assign. Rendered as a dash rather than hidden when there is
 * no tutor, so a column of mostly dashes is visibly "not chosen" instead of
 * looking like a column that failed to load.
 */
function RequestedTutorCell({ item }: { item: AdminRequestListItem }) {
  if (!item.tutor) {
    return <span className="text-slate-400">—</span>
  }

  return (
    <Link
      to={`/admin/tutors/${item.tutor.id}`}
      className="font-medium text-brand-700 hover:underline"
    >
      {item.tutor.displayName}
    </Link>
  )
}

/** Desktop table plus a mobile card list. Both render the same records. */
export function RequestsTable({ items }: { items: AdminRequestListItem[] }) {
  return (
    <>
      {/* Desktop: real table, horizontally scrollable if the viewport is tight. */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full min-w-[60rem] border-collapse text-left text-sm">
          <caption className="sr-only">Tutor requests, newest first</caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <th scope="col" className="px-4 py-3 font-semibold">Client</th>
              <th scope="col" className="px-4 py-3 font-semibold">Requested Tutor</th>
              <th scope="col" className="px-4 py-3 font-semibold">Subject</th>
              <th scope="col" className="px-4 py-3 font-semibold">Education Level</th>
              <th scope="col" className="px-4 py-3 font-semibold">Learning Mode</th>
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              <th scope="col" className="px-4 py-3 font-semibold">Created</th>
              <th scope="col" className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <th scope="row" className="px-4 py-3 font-medium text-slate-900">
                  {item.fullName}
                </th>
                <td className="px-4 py-3">
                  <RequestedTutorCell item={item} />
                </td>
                <td className="px-4 py-3 text-slate-700">{item.subject}</td>
                <td className="px-4 py-3 text-slate-700">{item.educationLevel}</td>
                <td className="px-4 py-3 text-slate-700">{item.learningMode}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {formatWhen(item.createdAt).label}
                </td>
                <td className="px-4 py-3">
                  <Link
                    to={`/admin/requests/${item.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: card per request. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{item.fullName}</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  {item.subject} · {item.educationLevel}
                </p>
              </div>
              <StatusBadge status={item.status} />
            </div>

            {/* Shown on mobile too: a request routed to a tutor must not lose
                that fact just because the screen is small. */}
            <div className="mt-3">
              <p className="text-sm text-slate-500">Requested tutor</p>
              <p className="mt-0.5 text-sm">
                <RequestedTutorCell item={item} />
              </p>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <div>
                <dt className="text-slate-500">Learning mode</dt>
                <dd className="text-slate-800">{item.learningMode}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Created</dt>
                <dd className="text-slate-800">{formatWhen(item.createdAt).label}</dd>
              </div>
            </dl>
            <Link
              to={`/admin/requests/${item.id}`}
              className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800"
            >
              View request
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
