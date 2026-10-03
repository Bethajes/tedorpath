import { Link } from 'react-router-dom'

import { cn } from '@/lib/cn'

import type { SubjectBreakdownRow } from '@/features/adminAnalytics/adminAnalytics.types'

/**
 * Most-requested subjects.
 *
 * Bars rather than a pie, because comparing lengths down a shared baseline is
 * something the eye does well and comparing angles is not.
 *
 * The width is a proportion of the largest row, not of the total, so the top bar
 * is always full and the differences between the leaders stay readable. The
 * number beside each bar is the absolute count, which is the figure an admin
 * would actually quote.
 */
export function SubjectBreakdown({
  rows,
  className,
}: {
  rows: SubjectBreakdownRow[]
  className?: string
}) {
  const peak = rows.reduce((max, row) => Math.max(max, row.count), 0)

  return (
    <figure
      className={cn('rounded-xl border border-ink-200 bg-white p-5 shadow-sm', className)}
    >
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink-900">Most requested subjects</span>
        <span className="text-xs text-ink-500">from the request form</span>
      </figcaption>

      {/*
        Free text a visitor typed, not a catalogue row, so two spellings of one
        subject stay separate rather than being silently merged.
      */}
      {rows.length === 0 ? (
        <p className="mt-4 rounded-lg bg-ink-50 px-3 py-6 text-center text-sm text-ink-500">
          No learner requests yet, so there is nothing to rank.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.subject}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium text-ink-800">{row.subject}</span>
                <span className="shrink-0 text-ink-600 tabular-nums">{row.count}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${peak > 0 ? (row.count / peak) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </figure>
  )
}

/**
 * The verification pipeline, as a set of linked counts.
 *
 * Every value here is a `verificationStatus` on a real profile row. There is no
 * "approval rate" and no "average turnaround" on this card, because neither is
 * recorded.
 */
export function VerificationSummary({
  counts,
  className,
}: {
  counts: {
    VERIFIED: number
    DOCUMENTS_REQUESTED: number
    DOCUMENTS_RECEIVED: number
    NEEDS_MORE_INFORMATION: number
    UNVERIFIED: number
  }
  className?: string
}) {
  const rows: { label: string; value: number; to: string; tone: string }[] = [
    {
      label: 'Verified',
      value: counts.VERIFIED,
      to: '/admin/tutors?status=APPROVED',
      tone: 'bg-emerald-500',
    },
    {
      label: 'Documents requested',
      value: counts.DOCUMENTS_REQUESTED,
      to: '/admin/tutors?status=APPROVED',
      tone: 'bg-amber-500',
    },
    {
      label: 'Documents received',
      value: counts.DOCUMENTS_RECEIVED,
      to: '/admin/tutors?status=APPROVED',
      tone: 'bg-brand-500',
    },
    {
      label: 'Needs more information',
      value: counts.NEEDS_MORE_INFORMATION,
      to: '/admin/tutors?status=NEEDS_INFORMATION',
      tone: 'bg-orange-500',
    },
    { label: 'Unverified', value: counts.UNVERIFIED, to: '/admin/tutors?status=PENDING_REVIEW', tone: 'bg-ink-400' },
  ]

  const total = rows.reduce((sum, row) => sum + row.value, 0)
  const peak = rows.reduce((max, row) => Math.max(max, row.value), 0)

  return (
    <figure
      className={cn('rounded-xl border border-ink-200 bg-white p-5 shadow-sm', className)}
    >
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink-900">Document checks</span>
        <span className="text-xs text-ink-500">across {total} profiles</span>
      </figcaption>

      <ul className="mt-4 space-y-2.5">
        {rows.map((row) => (
          <li key={row.label}>
            <Link
              to={row.to}
              className="group block rounded-lg px-1 py-0.5 hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-ink-700 group-hover:text-ink-900">{row.label}</span>
                <span className="shrink-0 font-semibold text-ink-900 tabular-nums">{row.value}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100">
                <div
                  className={cn('h-full rounded-full', row.tone)}
                  style={{ width: `${peak > 0 ? (row.value / peak) * 100 : 0}%` }}
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </figure>
  )
}
