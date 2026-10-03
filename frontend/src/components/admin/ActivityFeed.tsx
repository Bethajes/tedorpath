import { Link } from 'react-router-dom'

import { AdminIcon, type AdminIconName } from '@/components/admin/icons'
import { PROFILE_STATUS_LABELS, type ProfileStatus } from '@/features/adminTutors/adminTutors.types'
import { STATUS_STYLES } from '@/features/adminRequests/components/StatusBadge'
import type { AdminStatus } from '@/features/adminRequests/types'
import { cn } from '@/lib/cn'
import { formatWhen } from '@/lib/formatDate'

import type { ActivityEntry } from '@/features/adminAnalytics/adminAnalytics.types'

/**
 * Recent Activity.
 *
 * This is NOT an audit log, and the wording is built around that difference.
 *
 * The schema records the current status of a request or a profile and when the
 * row was last written. It does not record who changed it, or what it was
 * before. So every entry says what the timestamps can prove — a record arrived,
 * or a record was written to — and never claims an approval, a rejection or a
 * reply happened, because nothing in the database would let anyone check that.
 *
 * `isNew` comes from `createdAt === updatedAt`, which is the strongest signal
 * available that a row has never been touched since it was written.
 */
export function ActivityFeed({
  entries,
  className,
}: {
  entries: ActivityEntry[]
  className?: string
}) {
  return (
    <section
      className={cn('rounded-xl border border-ink-200 bg-white shadow-sm', className)}
      aria-labelledby="activity-heading"
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <h2 id="activity-heading" className="text-sm font-semibold text-ink-900">
          Recent activity
        </h2>
        <span className="text-xs text-ink-500">newest first</span>
      </div>

      {entries.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-500">
          Nothing has been created yet. This feed fills up as requests and applications arrive.
        </p>
      ) : (
        <ol className="divide-y divide-ink-100">
          {entries.map((entry) => (
            <ActivityRow key={entry.id} entry={entry} />
          ))}
        </ol>
      )}
    </section>
  )
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const isRequest = entry.kind === 'request'
  const href = isRequest ? `/admin/requests/${entry.entityId}` : `/admin/tutors/${entry.entityId}`
  const { label: when, title } = formatWhen(entry.occurredAt)

  /*
   * The verb is chosen from `isNew` alone. "Application submitted" and
   * "Application updated" are both things the timestamps prove; "Application
   * approved" would not be, because the schema records no history and no actor.
   *
   * Assembled as one string rather than nested spans so it announces as a
   * sentence instead of a sequence of fragments.
   */
  const verb = isRequest
    ? entry.isNew
      ? 'sent a new tutor request'
      : 'updated a tutor request'
    : entry.isNew
      ? 'submitted a tutor application'
      : 'updated a tutor profile'

  return (
    <li>
      <Link
        to={href}
        className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-ink-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600"
      >
        <span
          className={cn(
            'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg',
            isRequest ? 'bg-blue-50 text-blue-600' : 'bg-brand-50 text-brand-700',
          )}
        >
          <AdminIcon name={isRequest ? 'requests' : 'tutors'} className="h-4 w-4" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm text-ink-800">
            <span className="font-semibold text-ink-900">{entry.actor}</span>{' '}
            {verb} — <span className="text-ink-600">{entry.headline}</span>
          </span>

          <span className="mt-1 flex flex-wrap items-center gap-2">
            <StatusPill kind={entry.kind} status={entry.status} />
            {!entry.signedIn && isRequest ? (
              <span className="text-xs text-ink-500">no account</span>
            ) : null}
          </span>
        </span>

        <time
          dateTime={entry.occurredAt}
          title={title}
          className="mt-0.5 shrink-0 whitespace-nowrap text-xs text-ink-500"
        >
          {when}
        </time>
      </Link>
    </li>
  )
}

/**
 * The status chip.
 *
 * Reuses the two badge palettes the queues already use, so a request seen in the
 * feed and the same request seen in the table are the same colour. The request
 * palette is imported rather than duplicated — `STATUS_STYLES` is already the
 * single definition for it.
 */
function StatusPill({
  kind,
  status,
}: {
  kind: ActivityEntry['kind']
  status: string
}) {
  if (kind === 'request') {
    const style = STATUS_STYLES[status as AdminStatus]
    if (!style) return null

    return (
      <span
        className={cn(
          'rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide',
          style.className,
        )}
      >
        {style.label}
      </span>
    )
  }

  const label = PROFILE_STATUS_LABELS[status as ProfileStatus]
  if (!label) return null

  return (
    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[0.65rem] font-semibold text-ink-700">
      {label}
    </span>
  )
}

/**
 * The two figures behind the "Active Learners" card, side by side.
 *
 * Both are shown because they answer different questions and the platform can
 * only answer one of them properly: there is no per-visitor session tracking, so
 * "active" cannot mean "active in the last seven days". Rather than pick the
 * flattering reading, both are on the page with the definition attached.
 */
export function LearnerSignals({
  learners,
}: {
  learners: { registered: number; requestedRecently: number; windowDays: number }
}) {
  const rows: { label: string; value: number; hint: string; icon: AdminIconName }[] = [
    {
      label: 'Learner accounts',
      value: learners.registered,
      hint: 'every client account on the platform',
      icon: 'tutors',
    },
    {
      label: `Requests in ${learners.windowDays} days`,
      value: learners.requestedRecently,
      hint: 'the freshest demand signal the request table holds',
      icon: 'requests',
    },
  ]

  return (
    <section
      className="rounded-xl border border-ink-200 bg-white p-5 shadow-sm"
      aria-labelledby="learners-heading"
    >
      <h2 id="learners-heading" className="text-sm font-semibold text-ink-900">
        Learners
      </h2>
      {/*
        Stated plainly because the platform has no way to measure this directly.
        There is no session-per-visitor table, so "active learners" as a market
        term cannot be computed — only these two counts can.
      */}
      <p className="mt-1 text-xs leading-relaxed text-ink-500">
        There is no visitor tracking on this platform, so an &ldquo;active learner&rdquo; count cannot
        be measured directly. These are the two figures the records do support.
      </p>

      <dl className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-600">
              <AdminIcon name={row.icon} className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <dt className="text-sm font-medium text-ink-800">{row.label}</dt>
              <dd className="text-xs text-ink-500">{row.hint}</dd>
            </div>
            <span className="ml-auto shrink-0 text-lg font-bold text-ink-900 tabular-nums">
              {row.value}
            </span>
          </div>
        ))}
      </dl>
    </section>
  )
}
