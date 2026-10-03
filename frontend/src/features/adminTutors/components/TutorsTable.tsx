/**
 * The moderation queue table.
 *
 * One row per profile, carrying just enough to decide which review to open.
 *
 * The row is not a link itself — the name is the link, and the real links inside
 * stay real links for keyboard and middle-click users. Wrapping a whole table
 * row in an anchor would break table semantics.
 *
 * No photo: the list endpoint does not send `profilePhotoUrl` (it is a
 * detail-only field), and a queue of initials plus names is what the list is
 * shaped for anyway.
 *
 * Requirements: 23.2, 23.3
 */

import { Link } from 'react-router-dom'

import { formatDate } from '@/lib/formatDate'
import { cn } from '@/lib/cn'

import type { AdminTutorListItem, ProfileStatus } from '../adminTutors.types'
import { PROFILE_STATUS_LABELS } from '../adminTutors.types'

/** Up to three subjects are shown; the rest live on the review page. */
const MAX_SUBJECT_BADGES = 3

const STATUS_BADGE_CLASSES: Record<ProfileStatus, string> = {
  DRAFT: 'bg-ink-100 text-ink-700',
  PENDING_REVIEW: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  SUSPENDED: 'bg-ink-200 text-ink-800',
  REJECTED: 'bg-red-100 text-red-800',
  NEEDS_INFORMATION: 'bg-orange-100 text-orange-800',
}

export function StatusBadge({ status }: { status: ProfileStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium',
        STATUS_BADGE_CLASSES[status],
      )}
    >
      {PROFILE_STATUS_LABELS[status]}
    </span>
  )
}

/** Truncates a headline for a single-line cell without cutting mid-word. */
function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  const cut = value.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/**
 * A tutor's rates, for the moderation queue.
 *
 * Both markets, joined. A moderator approving a profile needs to see that an
 * international rate exists at all, and a row showing only one of the two would
 * hide exactly that.
 *
 * "—" only when neither is offered. A rate of 0 is a real price — a free first
 * lesson — so it must never collapse into "not set".
 */
function formatRates(item: {
  hourlyRateEtb: number | null
  hourlyRateUsd: number | null
}): string {
  const parts: string[] = []
  if (item.hourlyRateEtb != null) parts.push(`${item.hourlyRateEtb} ETB`)
  if (item.hourlyRateUsd != null) parts.push(`${item.hourlyRateUsd} USD`)

  return parts.length > 0 ? `${parts.join(' · ')}/hr` : '—'
}

export function TutorsTable({ items }: { items: AdminTutorListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white shadow-sm">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <caption className="sr-only">
          Tutor applications, newest first. Each row links to the review workspace.
        </caption>
        <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-600">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">Applicant</th>
            <th scope="col" className="px-4 py-3 font-semibold">Subjects</th>
            <th scope="col" className="px-4 py-3 font-semibold">Mode</th>
            <th scope="col" className="px-4 py-3 font-semibold">Location</th>
            <th scope="col" className="px-4 py-3 font-semibold">Rate</th>
            <th scope="col" className="px-4 py-3 font-semibold">Submitted</th>
            <th scope="col" className="px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {items.map((item) => {
            const reviewHref = `/admin/tutors/${item.id}`
            const extraSubjects = item.subjects.length - MAX_SUBJECT_BADGES

            return (
              <tr key={item.id} className="align-top transition-colors hover:bg-ink-50">
                <th scope="row" className="px-4 py-3 font-normal">
                  <div className="flex items-start gap-3">
                    {/* The list endpoint deliberately does not send the photo
                        (it is a detail-only field), so the queue shows an initial
                        rather than a thumbnail. The full photo is on the review
                        page. */}
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-200 text-sm font-semibold text-ink-600"
                    >
                      {item.displayName.trim().charAt(0).toUpperCase() || '?'}
                    </span>
                    <div className="min-w-0">
                      <Link
                        to={reviewHref}
                        className="block font-semibold text-ink-900 hover:text-brand-700 hover:underline"
                      >
                        {item.displayName}
                      </Link>
                      {item.headline ? (
                        <p className="mt-0.5 max-w-[22rem] text-xs text-ink-600">
                          {truncate(item.headline, 80)}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-ink-500">{item.user.email}</p>
                    </div>
                  </div>
                </th>

                <td className="px-4 py-3">
                  {item.subjects.length === 0 ? (
                    <span className="text-ink-400">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {item.subjects.slice(0, MAX_SUBJECT_BADGES).map((subject) => (
                        <span
                          key={subject.id}
                          className="whitespace-nowrap rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-700"
                        >
                          {subject.name}
                        </span>
                      ))}
                      {extraSubjects > 0 ? (
                        <span className="whitespace-nowrap text-xs text-ink-500">
                          +{extraSubjects} more
                        </span>
                      ) : null}
                    </div>
                  )}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-ink-700">
                  {item.teachingMode.replace(/_/g, ' ').toLowerCase()}
                </td>
                <td className="px-4 py-3 text-ink-700">{item.location || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-700">
                  {formatRates(item)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-600">
                  {formatDate(item.createdAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge status={item.profileStatus} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
