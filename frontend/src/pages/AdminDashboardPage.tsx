import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { AdminPageHeader, AdminShell } from '@/components/layout/AdminShell'
import { Alert, Button } from '@/components/ui'
import { fetchAdminRequests, fetchAdminStats } from '@/features/adminRequests/adminRequests.api'
import { StatsCards } from '@/features/adminRequests/components/StatsCards'
import { StatusBadge } from '@/features/adminRequests/components/StatusBadge'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatWhen } from '@/lib/formatDate'
import { useAsyncData } from '@/lib/useAsyncData'

import type { AdminRequestListItem, AdminStats } from '@/features/adminRequests/types'

/** How many rows the two lists below the counts show. */
const RECENT_LIMIT = 5

/**
 * The dashboard's job is to answer one question: what is waiting for me?
 *
 * It previously showed counts and a list of the five most recent requests, with
 * no distinction between them — so a request that had just arrived looked
 * exactly like one an admin had been ignoring for a fortnight, and the only way
 * to notice anything new was to read every row. The two pieces below fix that:
 * anything awaiting a first response is lifted into a panel of its own with a
 * relative timestamp, and every count is a link into the filtered queue.
 */
export function AdminDashboardPage() {
  const { data, loading, error, reload } = useAsyncData(
    async () => {
      const [stats, list] = await Promise.all([
        fetchAdminStats(),
        fetchAdminRequests({ page: 1, limit: RECENT_LIMIT }),
      ])
      return { stats, recent: list.items }
    },
    [],
    describeError,
  )

  const recent = data?.recent ?? null

  return (
    <AdminShell>
      <AdminPageHeader
        title="Dashboard"
        description="Learner requests and tutor applications that need a decision."
        actions={
          <Button variant="outline" onClick={reload} disabled={loading}>
            Refresh
          </Button>
        }
      />

      {error ? (
        <Alert tone="error" className="mb-5">
          <p>{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
            Try again
          </Button>
        </Alert>
      ) : null}

      {loading ? (
        <p
          role="status"
          className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm"
        >
          Loading dashboard…
        </p>
      ) : null}

      {data && !loading ? <StatsCards stats={data.stats} /> : null}

      {data && !loading ? <NeedsAttention stats={data.stats} /> : null}

      <section className="mt-8" aria-labelledby="recent-requests">
        <SectionHeader
          id="recent-requests"
          title="Latest requests"
          to="/admin/requests"
          linkLabel="View all requests"
        />

        {!loading && recent && recent.length === 0 ? (
          <EmptyPanel
            title="No learner requests yet"
            body="When someone submits the tutor request form, it will appear here with their subject, level and contact details."
          />
        ) : null}

        {recent && recent.length > 0 ? (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {recent.map((item) => (
              <RequestRow key={item.id} item={item} />
            ))}
          </ul>
        ) : null}
      </section>
    </AdminShell>
  )
}

/**
 * The two queues, side by side, showing only what is waiting on a decision.
 *
 * A tutor application and a learner request are unrelated records that both
 * need an admin, and on a page of request-only figures the applications were
 * completely invisible. Rendering them together makes "is there anything for
 * me?" a single glance, which is the only reason to have a dashboard at all.
 *
 * Deliberately counts only, with no row list: the requests themselves are in the
 * feed below, and repeating them here would put the same request on the screen
 * twice.
 */
function NeedsAttention({ stats }: { stats: AdminStats }) {
  const applications = stats.tutorApplications
  const pendingApplications = applications?.PENDING_REVIEW ?? 0
  const newRequests = stats.NEW
  const nothingWaiting = pendingApplications === 0 && newRequests === 0

  return (
    <section className="mt-8" aria-labelledby="needs-attention">
      <SectionHeader id="needs-attention" title="Waiting for a decision" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WaitingCard
          heading="Learner requests"
          count={newRequests}
          countLabel="waiting for a first reply"
          clearLabel="All learner requests have had a reply"
          to="/admin/requests?status=NEW"
          cta="See all new requests"
          tone="blue"
        />

        <WaitingCard
          heading="Tutor applications"
          count={pendingApplications}
          countLabel="waiting for review"
          clearLabel="No applications waiting for review"
          to="/admin/tutors?status=PENDING_REVIEW"
          cta="Start reviewing"
          tone="amber"
          note={
            applications && applications.NEEDS_INFORMATION > 0 ? (
              <>
                {applications.NEEDS_INFORMATION}{' '}
                {applications.NEEDS_INFORMATION === 1 ? 'tutor is' : 'tutors are'} waiting on
                documents you asked for.
              </>
            ) : null
          }
        />
      </div>

      {nothingWaiting ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Nothing is waiting for you right now.
        </p>
      ) : null}
    </section>
  )
}

function WaitingCard({
  heading,
  count,
  countLabel,
  clearLabel,
  to,
  cta,
  tone,
  note,
}: {
  heading: string
  count: number
  countLabel: string
  clearLabel: string
  to: string
  cta: string
  tone: 'blue' | 'amber'
  note?: ReactNode
}) {
  const active = count > 0
  const border = active ? (tone === 'blue' ? 'border-blue-200' : 'border-amber-200') : 'border-slate-200'
  const chip = active
    ? tone === 'blue'
      ? 'bg-blue-100 text-blue-800'
      : 'bg-amber-100 text-amber-800'
    : 'bg-slate-100 text-slate-500'

  return (
    <div className={cn('flex flex-col rounded-xl border bg-white p-5 shadow-sm', border)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{heading}</h3>
          <p className="mt-0.5 text-sm text-slate-600">
            {active ? `${count} ${countLabel}` : clearLabel}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums',
            chip,
          )}
        >
          {count}
        </span>
      </div>

      {note ? (
        <p className="mt-4 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm text-orange-900">
          {note}
        </p>
      ) : (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">
          {active
            ? 'Open the queue to work through them one at a time.'
            : 'New submissions show up here the moment they arrive.'}
        </p>
      )}

      <Link to={to} className="mt-4 text-sm font-medium text-brand-700 hover:underline">
        {cta}
      </Link>
    </div>
  )
}

function RequestRow({ item }: { item: AdminRequestListItem }) {
  const isNew = item.status === 'NEW'

  return (
    <li className={cn('px-4 py-3', isNew && 'bg-blue-50/40')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/admin/requests/${item.id}`}
            className="font-medium text-slate-900 hover:text-brand-700 hover:underline"
          >
            {item.fullName}
          </Link>
          <p className="text-sm text-slate-600">
            {item.subject} · {item.educationLevel} · {item.learningMode}
          </p>
          {/*
            Named here because the dashboard is where an admin decides whether
            anything needs opening at all. A request that is already routed to a
            tutor is a different job from a cold one, and that difference was
            invisible until the request had been opened.
          */}
          {item.tutor ? (
            <p className="mt-1 text-sm">
              <span className="text-slate-500">For </span>
              <Link
                to={`/admin/tutors/${item.tutor.id}`}
                className="font-medium text-brand-700 hover:underline"
              >
                {item.tutor.displayName}
              </Link>
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <When iso={item.createdAt} />
          <StatusBadge status={item.status} />
        </div>
      </div>
    </li>
  )
}

/**
 * A timestamp as "5 minutes ago", with the exact date on hover.
 *
 * The relative form is the useful one in a queue — it is what separates a
 * request that arrived a moment ago from one that has been sitting for a week —
 * and the absolute date stays available for when it has to be quoted.
 */
function When({ iso }: { iso: string }) {
  const { label, title } = formatWhen(iso)

  return (
    <time dateTime={iso} title={title} className="whitespace-nowrap text-xs text-slate-500">
      {label}
    </time>
  )
}

function SectionHeader({
  id,
  title,
  to,
  linkLabel,
}: {
  id: string
  title: string
  to?: string
  linkLabel?: string
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="text-lg font-semibold text-slate-900">
        {title}
      </h2>
      {to && linkLabel ? (
        <Link to={to} className="shrink-0 text-sm font-medium text-brand-700 hover:underline">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  )
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center shadow-sm">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{body}</p>
    </div>
  )
}

function describeError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    return 'Your admin session is no longer valid. Please sign in again.'
  }
  return 'Unable to load the dashboard. Please try again.'
}
