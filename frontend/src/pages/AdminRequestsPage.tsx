import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AdminPageHeader, AdminShell } from '@/components/layout/AdminShell'
import { Alert, Button, Input, Select } from '@/components/ui'
import { fetchAdminRequests } from '@/features/adminRequests/adminRequests.api'
import { RequestsTable } from '@/features/adminRequests/components/RequestsTable'
import { STATUS_STYLES } from '@/features/adminRequests/components/StatusBadge'
import { STATUS_FILTERS, type AdminStatus, type StatusFilter } from '@/features/adminRequests/types'
import { ApiError } from '@/lib/api'
import { useAsyncData } from '@/lib/useAsyncData'

/**
 * Learner requests — `/admin/requests`
 *
 * The queue an admin works through first: somebody submitted a form and is
 * waiting for a reply.
 *
 * URL-DRIVEN FILTERS, and that is the reason this page reads `useSearchParams`
 * rather than keeping its own state. Every count on the dashboard links here with
 * a status already attached (`/admin/requests?status=NEW`), the notification bell
 * does the same, and the header's global search links with a query. A filter that
 * lived only in component state would ignore all of those and silently show the
 * whole queue instead of the slice that was asked for — which is the most
 * confusing possible failure, because the page looks like it worked.
 *
 * The URL is also shareable: an admin can send a colleague a link to exactly the
 * filtered view they are looking at.
 *
 * The search box is debounced so a request is not sent on every keystroke, and
 * the debounced value is what lands in the URL — so the URL settles on the term
 * that was actually searched rather than on every intermediate one.
 */

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

/** The status the queue opens on when the URL does not name one. */
const DEFAULT_STATUS: StatusFilter = 'all'

/** Reads the opening status from the query string, ignoring anything unknown. */
function initialStatus(params: URLSearchParams): StatusFilter {
  const requested = params.get('status')
  return requested && (STATUS_FILTERS as readonly string[]).includes(requested)
    ? (requested as StatusFilter)
    : DEFAULT_STATUS
}

function describeError(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Your admin session is no longer valid. Please sign in again.'
  }
  return 'Unable to load tutor requests. Please try again.'
}

export function AdminRequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const status = initialStatus(searchParams)
  const query = searchParams.get('q') ?? ''

  const [page, setPage] = useState(1)
  // `search` is what the box shows; `query` is what has been sent. Separating
  // them is what stops a request on every keystroke.
  const [search, setSearch] = useState(query)

  // A back/forward navigation changes the URL without touching `search`, so the
  // box has to follow the URL rather than the other way round.
  //
  // Adjusted during render rather than in an effect: this is React's documented
  // pattern for "reset state when an input changes", and it avoids the extra
  // render pass an effect would cost on every navigation.
  const [lastQuery, setLastQuery] = useState(query)
  if (query !== lastQuery) {
    setLastQuery(query)
    setSearch(query)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = search.trim()
      // Only write when it differs, so clearing the box to its current value does
      // not push a history entry.
      if (next === query) return
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current)
          if (next) params.set('q', next)
          else params.delete('q')
          params.delete('page')
          return params
        },
        { replace: true },
      )
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [search, query, setSearchParams])

  const { data, loading, error, reload } = useAsyncData(
    () => fetchAdminRequests({ page, limit: PAGE_SIZE, status, search: query || undefined }),
    [page, status, query],
    describeError,
  )

  const handleStatusChange = useCallback(
    (value: StatusFilter) => {
      setPage(1)
      setSearchParams((current) => {
        const params = new URLSearchParams(current)
        if (value === 'all') params.delete('status')
        else params.set('status', value)
        params.delete('page')
        return params
      })
    },
    [setSearchParams],
  )

  const items = data?.items ?? null
  const pagination = data?.pagination ?? null
  const filtered = query !== '' || status !== 'all'

  const resultDescription = pagination
    ? pagination.total > 0
      ? `${pagination.total} request${pagination.total === 1 ? '' : 's'} match the current filters.`
      : filtered
        ? 'No requests match these filters.'
        : 'Review and reply to learner tutor requests.'
    : 'Review and reply to learner tutor requests.'

  return (
    <AdminShell>
      <AdminPageHeader
        title="Learner requests"
        description={resultDescription}
        actions={
          <Button variant="outline" onClick={reload} disabled={loading}>
            Refresh
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-ink-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="request-search" className="text-sm font-medium text-ink-800">
            Search
          </label>
          <Input
            id="request-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, phone, email, Telegram handle or subject"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="status-filter" className="text-sm font-medium text-ink-800">
            Status
          </label>
          <Select
            id="status-filter"
            value={status}
            onChange={(event) => handleStatusChange(event.target.value as StatusFilter)}
          >
            {STATUS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {value === 'all' ? 'All' : STATUS_STYLES[value as AdminStatus].label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error ? (
        <Alert tone="error" className="mb-5">
          <p>{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
            Try again
          </Button>
        </Alert>
      ) : null}

      {loading ? (
        <div role="status" aria-label="Loading tutor requests" className="space-y-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-xl border border-ink-200 bg-white" />
          ))}
        </div>
      ) : null}

      {!loading && items && items.length === 0 ? (
        <p className="rounded-xl border border-ink-200 bg-white p-6 text-sm text-ink-600 shadow-sm">
          {filtered
            ? 'No tutor requests match your search or filter.'
            : 'No tutor requests yet.'}
        </p>
      ) : null}

      {!loading && items && items.length > 0 ? <RequestsTable items={items} /> : null}

      {!loading && pagination && pagination.totalPages > 1 ? (
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
            Page {page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
          >
            Next
          </Button>
        </nav>
      ) : null}
    </AdminShell>
  )
}
