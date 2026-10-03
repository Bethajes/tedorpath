import { useState } from 'react'
import { Link } from 'react-router-dom'

import { SubjectBreakdown, VerificationSummary } from '@/components/admin/Breakdowns'
import { TrendChart } from '@/components/admin/TrendChart'
import { AdminPageHeader, AdminShell } from '@/components/layout/AdminShell'
import { Alert, Button, Select } from '@/components/ui'
import { fetchDashboard } from '@/features/adminAnalytics/adminAnalytics.api'
import {
  TREND_WINDOWS,
  type DashboardOverview,
  type TrendWindowDays,
} from '@/features/adminAnalytics/adminAnalytics.types'
import { ApiError } from '@/lib/api'
import { useAsyncData } from '@/lib/useAsyncData'

/**
 * Analytics — `/admin/analytics`
 *
 * Volume over time and the breakdowns, with no cross-team vanity metrics.
 *
 * WHAT THIS PAGE DELIBERATELY DOES NOT SHOW, and why:
 *
 * - No conversion rate (requests → completed). The request table records a
 *   status, and a request that gets no reply looks identical to one that was
 *   rejected for a reason nobody logged. A conversion figure computed from those
 *   two states would be measuring the admin's workload, not the marketplace.
 * - No average response time. `updatedAt` moves whenever an admin saves a note,
 *   so the gap between created and updated is not a reply time.
 * - No growth percentage. The platform has no snapshot of its own totals, so a
 *   comparison would need a stored figure nobody has checked.
 *
 * Everything that is here is a count of rows in a range, drawn directly from the
 * records.
 */

function describeError(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Your admin session is no longer valid. Please sign in again.'
  }
  return 'Unable to load analytics. Please try again.'
}

export function AdminAnalyticsPage() {
  const [days, setDays] = useState<TrendWindowDays>(30)

  const { data, loading, error, reload } = useAsyncData<DashboardOverview>(
    () => fetchDashboard(days),
    [days],
    describeError,
  )

  return (
    <AdminShell
      attention={
        data
          ? {
              newRequests: data.requests.NEW,
              pendingApplications: data.applications.PENDING_REVIEW,
              needsInformation: data.applications.NEEDS_INFORMATION,
            }
          : undefined
      }
    >
      <AdminPageHeader
        title="Analytics"
        description="How much has come in, and what it consists of. Every figure below is counted from the records themselves."
        actions={
          <div className="flex items-center gap-2">
            <label htmlFor="analytics-window" className="sr-only">
              Date range
            </label>
            <Select
              id="analytics-window"
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

      {loading && !data ? <AnalyticsSkeleton /> : null}

      {data ? (
        <div className="space-y-8">
          <section aria-labelledby="volume">
            <h2 id="volume" className="mb-1 text-lg font-semibold text-ink-900">
              Volume per day
            </h2>
            <p className="mb-4 text-sm text-ink-600">
              {data.trends.from} to {data.trends.to}. Days with nothing recorded show as zero rather
              than being skipped.
            </p>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <TrendChart title="Learner requests" points={data.trends.requests} tone="brand" />
              <TrendChart title="Tutor applications" points={data.trends.applications} tone="accent" />
            </div>
          </section>

          <section aria-labelledby="totals">
            <h2 id="totals" className="mb-1 text-lg font-semibold text-ink-900">
              Totals to date
            </h2>
            <p className="mb-4 text-sm text-ink-600">
              All-time counts. Not filtered by the date range above, because these are the standing
              totals the queues are worked against.
            </p>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <CountTable
                title="Learner requests by status"
                to="/admin/requests"
                rows={[
                  { label: 'New', value: data.requests.NEW, status: 'NEW' },
                  { label: 'Contacted', value: data.requests.CONTACTED, status: 'CONTACTED' },
                  { label: 'In progress', value: data.requests.IN_PROGRESS, status: 'IN_PROGRESS' },
                  { label: 'Completed', value: data.requests.COMPLETED, status: 'COMPLETED' },
                  { label: 'Cancelled', value: data.requests.CANCELLED, status: 'CANCELLED' },
                ]}
                total={data.requests.total}
              />
              <CountTable
                title="Tutor applications by status"
                to="/admin/tutors"
                rows={[
                  { label: 'Under review', value: data.applications.PENDING_REVIEW, status: 'PENDING_REVIEW' },
                  { label: 'Needs information', value: data.applications.NEEDS_INFORMATION, status: 'NEEDS_INFORMATION' },
                  { label: 'Approved', value: data.applications.APPROVED, status: 'APPROVED' },
                  { label: 'Draft', value: data.applications.DRAFT, status: 'DRAFT' },
                  { label: 'Suspended', value: data.applications.SUSPENDED, status: 'SUSPENDED' },
                  { label: 'Rejected', value: data.applications.REJECTED, status: 'REJECTED' },
                ]}
                total={data.applications.total}
              />
            </div>
          </section>

          <section aria-labelledby="breakdowns">
            <h2 id="breakdowns" className="mb-1 text-lg font-semibold text-ink-900">
              What it consists of
            </h2>
            <p className="mb-4 text-sm text-ink-600">
              Drawn from the free text people actually wrote, and from the document-check state on
              each tutor profile.
            </p>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SubjectBreakdown rows={data.subjects} />
              <VerificationSummary counts={data.verification} />
            </div>
          </section>
        </div>
      ) : null}
    </AdminShell>
  )
}

/** A status table where every row links into that status in its queue. */
function CountTable({
  title,
  rows,
  total,
  to,
}: {
  title: string
  rows: { label: string; value: number; status: string }[]
  total: number
  to: string
}) {
  const peak = rows.reduce((max, row) => Math.max(max, row.value), 0)

  return (
    <figure className="rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink-900">{title}</span>
        <span className="text-xs text-ink-500">
          <span className="font-semibold text-ink-900 tabular-nums">{total}</span> in total
        </span>
      </figcaption>

      <ul className="mt-4 space-y-2.5">
        {rows.map((row) => (
          <li key={row.status}>
            <Link
              to={`${to}?status=${row.status}`}
              className="group block rounded-lg px-1 py-0.5 hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-ink-700 group-hover:text-ink-900">{row.label}</span>
                <span className="font-semibold text-ink-900 tabular-nums">{row.value}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full bg-brand-500"
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

function AnalyticsSkeleton() {
  return (
    <div role="status" aria-label="Loading analytics" className="space-y-4">
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <li key={index} className="h-52 animate-pulse rounded-xl border border-ink-200 bg-white" />
        ))}
      </ul>
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <li key={index} className="h-64 animate-pulse rounded-xl border border-ink-200 bg-white" />
        ))}
      </ul>
    </div>
  )
}
