import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ActivityFeed, LearnerSignals } from '@/components/admin/ActivityFeed'
import { AttentionGrid, QuickActions, type AttentionItem } from '@/components/admin/AttentionPanels'
import { SubjectBreakdown, VerificationSummary } from '@/components/admin/Breakdowns'
import { KpiRow, type KpiCard } from '@/components/admin/KpiCards'
import { TrendChart } from '@/components/admin/TrendChart'
import { AdminPageHeader, AdminShell } from '@/components/layout/AdminShell'
import { Alert, Button, Select } from '@/components/ui'
import { fetchDashboard } from '@/features/adminAnalytics/adminAnalytics.api'
import {
  TREND_WINDOWS,
  type DashboardOverview,
  type TrendWindowDays,
} from '@/features/adminAnalytics/adminAnalytics.types'
import { fetchAdminRequests } from '@/features/adminRequests/adminRequests.api'
import { STATUS_STYLES } from '@/features/adminRequests/components/StatusBadge'
import type { AdminRequestListItem, AdminStatus } from '@/features/adminRequests/types'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatWhen } from '@/lib/formatDate'
import { useAsyncData } from '@/lib/useAsyncData'

/**
 * The admin dashboard.
 *
 * Its whole job is to answer one question: what is waiting for me? Everything
 * below is arranged around that — the counts that need a decision come first, the
 * places an admin goes next come next, and the trends and breakdowns come last
 * because they are context rather than a to-do list.
 *
 * ON WHAT THESE NUMBERS ARE
 *
 * Every figure comes from `GET /api/admin/dashboard`, which counts rows in
 * `tutor_requests` and `tutor_profiles`. There is no growth percentage, no
 * conversion rate, no average response time and no rating on this page, because
 * the platform records none of those — a back office that shows a figure nobody
 * can trace to a row is worse than one that shows fewer.
 *
 * Where a number needs a definition to mean anything — "learners" most of all —
 * the definition is printed next to it rather than left to the reader.
 */

/** How many rows the latest-requests list shows. */
const RECENT_LIMIT = 6

/**
 * How long a request may sit in NEW before the dashboard counts it as a
 * follow-up.
 *
 * Sent to the server rather than applied in the browser, so the count and the
 * rule printed beside it are computed from the same pair of values.
 */
const FOLLOW_UP_DAYS = 7

interface DashboardData {
  overview: DashboardOverview
  recent: AdminRequestListItem[]
}

function describeError(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Your admin session is no longer valid. Please sign in again.'
  }
  return 'Unable to load the dashboard. Please try again.'
}

export function AdminDashboardPage() {
  const [days, setDays] = useState<TrendWindowDays>(30)

  const { data, loading, error, reload } = useAsyncData<DashboardData>(
    async () => {
      // One request for the aggregates, one for the rows. They cannot be the
      // same call by design: the dashboard endpoint returns counts only, so it
      // never carries a learner's name in a payload of otherwise anonymous
      // numbers. Running them together keeps the page to a single loading state.
      const [overview, recent] = await Promise.all([
        fetchDashboard(days, FOLLOW_UP_DAYS),
        fetchAdminRequests({ page: 1, limit: RECENT_LIMIT }),
      ])

      return { overview, recent: recent.items }
    },
    [days],
    describeError,
  )

  const overview = data?.overview ?? null

  return (
    <AdminShell attention={attentionCounts(overview)}>
      <AdminPageHeader
        title="Dashboard"
        description="Learner requests and tutor applications that need a decision, counted from the database."
        actions={
          <div className="flex items-center gap-2">
            <label htmlFor="trend-window" className="sr-only">
              Trend window
            </label>
            <Select
              id="trend-window"
              value={String(days)}
              onChange={(event) => setDays(Number(event.target.value) as TrendWindowDays)}
              className="w-auto"
            >
              {TREND_WINDOWS.map((window) => (
                <option key={window.days} value={window.days}>
                  Last {window.label}
                </option>
              ))}
            </Select>
            <Button variant="outline" onClick={reload} disabled={loading}>
              Refresh
            </Button>
          </div>
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

      {loading && !data ? <DashboardSkeleton /> : null}

      {overview ? (
        <div className="space-y-8">
          <KpiRow cards={kpiCards(overview)} />

          <section aria-labelledby="needs-attention">
            <SectionHeading
              id="needs-attention"
              title="Needs attention"
              description="The four queues where somebody is blocked on a person in this room."
            />
            <AttentionGrid items={attentionItems(overview)} />
          </section>

          <section aria-labelledby="quick-actions">
            <SectionHeading id="quick-actions" title="Quick actions" />
            <QuickActions />
          </section>

          <section aria-labelledby="trends">
            <SectionHeading
              id="trends"
              title="Volume"
              description={`Records created each day, ${overview.trends.from} to ${overview.trends.to}.`}
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <TrendChart title="Learner requests per day" points={overview.trends.requests} tone="brand" />
              <TrendChart
                title="Tutor applications per day"
                points={overview.trends.applications}
                tone="accent"
              />
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ActivityFeed entries={overview.activity} className="lg:col-span-2" />
            <div className="space-y-4">
              <LearnerSignals learners={overview.learners} />
              <VerificationSummary counts={overview.verification} />
              <SubjectBreakdown rows={overview.subjects} />
            </div>
          </div>

          <LatestRequests items={data?.recent ?? null} />
        </div>
      ) : null}
    </AdminShell>
  )
}

/**
 * The five KPI cards.
 *
 * Each hint says what is counted rather than what the number implies, because
 * "Approved tutors" could mean approved this month or approved ever, and only one
 * of those is true.
 */
function kpiCards(data: DashboardOverview): KpiCard[] {
  return [
    {
      key: 'requests',
      label: 'Learner requests',
      value: data.requests.total,
      icon: 'requests',
      to: '/admin/requests',
      hint: 'every request ever submitted',
      tone: 'brand',
    },
    {
      key: 'tutorApplications',
      label: 'Tutor applications',
      value: data.applications.total,
      icon: 'tutors',
      to: '/admin/tutors',
      hint: 'every tutor profile on the platform',
      tone: 'brand',
    },
    {
      key: 'approvedTutors',
      label: 'Approved tutors',
      value: data.applications.APPROVED,
      icon: 'check',
      to: '/admin/tutors?status=APPROVED',
      hint: 'profiles visible in the public directory',
      tone: 'emerald',
    },
    {
      key: 'pendingReviews',
      label: 'Pending reviews',
      value: data.applications.PENDING_REVIEW,
      icon: 'clock',
      to: '/admin/tutors?status=PENDING_REVIEW',
      hint: 'applications awaiting a decision',
      tone: 'amber',
      actionable: true,
    },
    {
      key: 'learners',
      label: 'Learner accounts',
      value: data.learners.registered,
      icon: 'sparkle',
      to: '/admin/requests',
      hint: `client sign-ups; ${data.learners.requestedRecently} requested a tutor in the last ${data.learners.windowDays} days`,
      tone: 'accent',
    },
  ]
}

/**
 * The four attention panels.
 *
 * The follow-up count is derived from `createdAt` on the server rather than
 * stored as a flag, so it cannot go stale: a request that ages past the threshold
 * appears without anything having to record that it aged.
 */
function attentionItems(data: DashboardOverview): AttentionItem[] {
  return [
    {
      key: 'new-requests',
      label: 'New requests',
      count: data.requests.NEW,
      detail: 'waiting for a first reply',
      to: '/admin/requests?status=NEW',
      cta: 'See new requests',
      icon: 'requests',
      tone: 'blue',
      clearLabel: 'Every learner request has had a reply',
    },
    {
      key: 'pending-applications',
      label: 'Applications to review',
      count: data.applications.PENDING_REVIEW,
      detail: 'waiting for a moderation decision',
      to: '/admin/tutors?status=PENDING_REVIEW',
      cta: 'Start reviewing',
      icon: 'tutors',
      tone: 'amber',
      clearLabel: 'No applications are waiting for review',
    },
    {
      key: 'missing-documents',
      label: 'Missing documents',
      count: data.applications.NEEDS_INFORMATION,
      detail: 'tutors waiting on paperwork you asked for',
      to: '/admin/tutors?status=NEEDS_INFORMATION',
      cta: 'Chase documents',
      icon: 'document',
      tone: 'orange',
      clearLabel: 'Nobody is waiting on documents',
    },
    {
      key: 'follow-ups',
      label: 'Follow-ups',
      count: data.matching.stale,
      detail: `new for over ${data.matching.staleDays} days with no reply`,
      to: '/admin/requests?status=NEW',
      cta: 'Open the stale ones',
      icon: 'clock',
      tone: 'ink',
      clearLabel: `Nothing has been waiting over ${data.matching.staleDays} days`,
    },
  ]
}

/**
 * The counts behind the header's notification bell.
 *
 * `undefined` while loading rather than three zeroes, so the bell does not claim
 * "nothing waiting" before the numbers have arrived.
 */
function attentionCounts(data: DashboardOverview | null) {
  if (!data) return undefined

  return {
    newRequests: data.requests.NEW,
    pendingApplications: data.applications.PENDING_REVIEW,
    needsInformation: data.applications.NEEDS_INFORMATION,
  }
}

function SectionHeading({
  id,
  title,
  description,
}: {
  id: string
  title: string
  description?: string
}) {
  return (
    <div className="mb-4">
      <h2 id={id} className="text-lg font-semibold text-ink-900">
        {title}
      </h2>
      {description ? <p className="mt-0.5 text-sm text-ink-600">{description}</p> : null}
    </div>
  )
}

/**
 * Placeholder rows while the first load runs.
 *
 * Shaped like the real cards so the page does not jump when they land. Bars
 * rather than a spinner because a spinner says "something is happening" and a
 * skeleton says "here is what is coming".
 */
function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard" className="space-y-8">
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <li key={index} className="h-36 animate-pulse rounded-xl border border-ink-200 bg-white shadow-sm" />
        ))}
      </ul>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <li key={index} className="h-40 animate-pulse rounded-xl border border-ink-200 bg-white" />
        ))}
      </ul>
    </div>
  )
}

/**
 * The most recent requests, so the dashboard is also a way into the queue.
 *
 * A request with no reply is tinted, because that is the row an admin is most
 * likely to have to open next.
 */
function LatestRequests({ items }: { items: AdminRequestListItem[] | null }) {
  return (
    <section aria-labelledby="recent-requests">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SectionHeading id="recent-requests" title="Latest requests" />
        <Link to="/admin/requests" className="shrink-0 text-sm font-medium text-brand-700 hover:underline">
          View all requests
        </Link>
      </div>

      {items && items.length === 0 ? (
        <div className="rounded-xl border border-ink-200 bg-white px-5 py-8 text-center shadow-sm">
          <p className="text-sm font-medium text-ink-900">No learner requests yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-600">
            When someone submits the tutor request form it will appear here with their subject, level
            and contact details.
          </p>
        </div>
      ) : null}

      {items && items.length > 0 ? (
        <ul className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-sm">
          {items.map((item) => (
            <LatestRequestRow key={item.id} item={item} />
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function LatestRequestRow({ item }: { item: AdminRequestListItem }) {
  const isNew = item.status === 'NEW'
  const style = STATUS_STYLES[item.status as AdminStatus]
  const { label: when, title } = formatWhen(item.createdAt)

  return (
    <li className={cn('px-5 py-3.5', isNew && 'bg-blue-50/40')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/admin/requests/${item.id}`}
            className="font-medium text-ink-900 hover:text-brand-700 hover:underline"
          >
            {item.fullName}
          </Link>
          <p className="text-sm text-ink-600">
            {item.subject} · {item.educationLevel} · {item.learningMode}
          </p>
          {/*
            Named here because the dashboard is where an admin decides whether
            anything needs opening at all. A request already routed to a tutor is
            a different job from a cold one.
          */}
          {item.tutor ? (
            <p className="mt-1 text-sm">
              <span className="text-ink-500">For </span>
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
          <time dateTime={item.createdAt} title={title} className="text-xs text-ink-500">
            {when}
          </time>
          {style ? (
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide',
                style.className,
              )}
            >
              {style.label}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  )
}
