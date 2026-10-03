import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { AdminIcon } from '@/components/admin/icons'
import { AdminPageHeader, AdminShell } from '@/components/layout/AdminShell'
import { Alert, Button, Input, Select } from '@/components/ui'
import { fetchAdminRequests } from '@/features/adminRequests/adminRequests.api'
import { STATUS_STYLES } from '@/features/adminRequests/components/StatusBadge'
import {
  ADMIN_STATUSES,
  type AdminRequestListItem,
  type AdminStatus,
} from '@/features/adminRequests/types'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatWhen } from '@/lib/formatDate'
import { useAsyncData } from '@/lib/useAsyncData'

/**
 * Matching — `/admin/matching`
 *
 * Which learner requests have a tutor attached and which do not.
 *
 * This is the one queue where the interesting fact is a relationship between two
 * rows rather than a status, so it gets its own screen instead of being squeezed
 * into the requests table. A request with no tutor is a learner the platform has
 * not answered yet.
 *
 * IT IS NOT AN ASSIGNMENT TOOL. Matching a learner to a tutor is a judgement made
 * from the request and the profile — subject, level, mode, availability — and the
 * existing admin API can record that a tutor was chosen (`tutorProfileId`) but
 * not who chose them or why. Rather than build a half-version of that here, this
 * screen shows the current state and sends the admin to the request to decide.
 * The one thing it will not do is claim a match it cannot record.
 */

/** Rows fetched per page of the queue behind the tabs. */
const PAGE_SIZE = 25

type Tab = 'unmatched' | 'matched'

function describeError(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Your admin session is no longer valid. Please sign in again.'
  }
  return 'Unable to load the matching queue. Please try again.'
}

export function AdminMatchingPage() {
  const [tab, setTab] = useState<Tab>('unmatched')
  const [status, setStatus] = useState<AdminStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, loading, error, reload } = useAsyncData(
    () =>
      fetchAdminRequests({
        page,
        limit: PAGE_SIZE,
        status,
        search: search.trim() || undefined,
      }),
    [page, status, search],
    describeError,
  )

  // Split client-side from the fetched page rather than making two requests:
  // the endpoint cannot filter on `tutorProfileId`, and the summary counts come
  // from the dashboard endpoint so both tabs are measured the same way.
  const rows = data?.items ?? null
  const grouped = useMemo(() => {
    const items = rows ?? []
    return {
      unmatched: items.filter((item) => item.tutorProfileId === null),
      matched: items.filter((item) => item.tutorProfileId !== null),
    }
  }, [rows])

  const visible = tab === 'unmatched' ? grouped.unmatched : grouped.matched

  return (
    <AdminShell>
      <AdminPageHeader
        title="Matching"
        description="Every live learner request, split by whether a tutor has been attached. Cancelled requests are excluded — nobody is waiting on those."
      />

      {error ? (
        <Alert tone="error" className="mb-5">
          <p>{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
            Try again
          </Button>
        </Alert>
      ) : null}

      <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-ink-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-800">Show</span>
          <div role="tablist" aria-label="Matching state" className="flex gap-1 rounded-lg bg-ink-100 p-1">
            <TabButton active={tab === 'unmatched'} onClick={() => changeTab('unmatched')}>
              No tutor yet
            </TabButton>
            <TabButton active={tab === 'matched'} onClick={() => changeTab('matched')}>
              Tutor attached
            </TabButton>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="matching-status" className="text-sm font-medium text-ink-800">
            Status
          </label>
          <Select
            id="matching-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as AdminStatus | 'all')
              setPage(1)
            }}
          >
            <option value="all">All</option>
            {ADMIN_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_STYLES[value].label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="matching-search" className="text-sm font-medium text-ink-800">
            Search
          </label>
          <Input
            id="matching-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Name, subject or contact"
          />
        </div>
      </div>

      {/*
        Stated plainly, because the tab counts look like totals and are not.
        They describe the rows in the current page of the filtered queue, not the
        whole platform.
      */}
      {rows ? (
        <p className="mb-3 text-sm text-ink-600">
          Showing {visible.length} of {rows.length} loaded{' '}
          {rows.length === 1 ? 'request' : 'requests'} on this page.
        </p>
      ) : null}

      {loading ? (
        <div role="status" aria-label="Loading requests" className="space-y-2">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-xl border border-ink-200 bg-white" />
          ))}
        </div>
      ) : null}

      {!loading && rows && visible.length === 0 ? (
        <EmptyState tab={tab} filtered={Boolean(search.trim()) || status !== 'all'} />
      ) : null}

      {!loading && visible.length > 0 ? (
        <ul className="space-y-3">
          {visible.map((item) => (
            <MatchRow key={item.id} item={item} />
          ))}
        </ul>
      ) : null}

      {data && data.pagination.totalPages > 1 ? (
        <nav
          aria-label="Pagination"
          className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3 shadow-sm"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-ink-600">
            Page {page} of {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.pagination.totalPages}
            onClick={() => setPage((current) => Math.min(data.pagination.totalPages, current + 1))}
          >
            Next
          </Button>
        </nav>
      ) : null}
    </AdminShell>
  )

  /** Tab switches also reset the page: the new tab starts from the newest rows. */
  function changeTab(next: Tab) {
    setTab(next)
    setPage(1)
  }
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900',
      )}
    >
      {children}
    </button>
  )
}

function MatchRow({ item }: { item: AdminRequestListItem }) {
  const { label: when, title } = formatWhen(item.createdAt)
  const style = STATUS_STYLES[item.status as AdminStatus]

  return (
    <li className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to={`/admin/requests/${item.id}`}
            className="font-semibold text-ink-900 hover:text-brand-700 hover:underline"
          >
            {item.fullName}
          </Link>
          <p className="text-sm text-ink-600">
            {item.subject} · {item.educationLevel} · {item.learningMode}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
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
          <time dateTime={item.createdAt} title={title} className="text-xs text-ink-500">
            {when}
          </time>
        </div>
      </div>

      <div className="mt-3 border-t border-ink-100 pt-3">
        {item.tutor ? (
          <p className="flex items-center gap-2 text-sm">
            <AdminIcon name="check" className="h-4 w-4 shrink-0 fill-emerald-600" />
            <span className="text-ink-600">Matched with</span>
            <Link
              to={`/admin/tutors/${item.tutor.id}`}
              className="font-medium text-brand-700 hover:underline"
            >
              {item.tutor.displayName}
            </Link>
            <span className="truncate text-ink-500">— {item.tutor.headline}</span>
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-ink-600">
            <AdminIcon name="alert" className="h-4 w-4 shrink-0 fill-amber-500" />
            No tutor attached yet.
            <Link
              to={`/admin/requests/${item.id}`}
              className="font-medium text-brand-700 hover:underline"
            >
              Open the request
            </Link>
          </p>
        )}
      </div>
    </li>
  )
}

function EmptyState({ tab, filtered }: { tab: Tab; filtered: boolean }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white px-5 py-10 text-center shadow-sm">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
        <AdminIcon name={tab === 'unmatched' ? 'check' : 'matching'} className="h-6 w-6" />
      </span>
      <p className="mt-3 text-sm font-medium text-ink-900">
        {filtered
          ? 'Nothing matches these filters'
          : tab === 'unmatched'
            ? 'Every live request has a tutor attached'
            : 'No request has a tutor attached yet'}
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-600">
        {filtered
          ? 'Try a different status or clear the search box.'
          : tab === 'unmatched'
            ? 'Nothing is waiting on a match right now.'
            : 'A tutor is attached to a request from the request detail screen.'}
      </p>
    </div>
  )
}
