import { useCallback, useEffect, useState } from 'react'

import { AdminPageHeader, AdminShell } from '@/components/layout/AdminShell'
import { Alert, Button, Input, Select } from '@/components/ui'
import { fetchAdminRequests } from '@/features/adminRequests/adminRequests.api'
import { RequestsTable } from '@/features/adminRequests/components/RequestsTable'
import { STATUS_FILTERS, type StatusFilter } from '@/features/adminRequests/types'
import { ApiError } from '@/lib/api'
import { useAsyncData } from '@/lib/useAsyncData'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  NEW: 'New',
  CONTACTED: 'Contacted',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

function describeError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    return 'Your admin session is no longer valid. Please sign in again.'
  }
  return 'Unable to load tutor requests. Please try again.'
}

export function AdminRequestsPage() {
  // `search` is the raw input; `query` is the debounced value actually sent.
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  const { data, loading, error, reload } = useAsyncData(
    () => fetchAdminRequests({ page, limit: PAGE_SIZE, status, search: query }),
    [page, status, query],
    describeError,
  )

  // Changing a filter should return to the first page.
  const handleStatusChange = useCallback((value: StatusFilter) => {
    setStatus(value)
    setPage(1)
  }, [])

  const items = data?.items ?? null
  const pagination = data?.pagination ?? null

  return (
    <AdminShell>
      <AdminPageHeader
        title="Tutor Requests"
        description={
          pagination && pagination.total > 0
            ? `${pagination.total} request${pagination.total === 1 ? '' : 's'} match the current filters.`
            : 'Search, filter and open incoming tutor requests.'
        }
        actions={
          <Button variant="outline" onClick={reload} disabled={loading}>
            Refresh
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="request-search" className="text-sm font-medium text-slate-800">
            Search
          </label>
          <Input
            id="request-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, phone, email or subject"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status-filter" className="text-sm font-medium text-slate-800">
            Status
          </label>
          <Select
            id="status-filter"
            value={status}
            onChange={(event) => handleStatusChange(event.target.value as StatusFilter)}
          >
            {STATUS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {FILTER_LABELS[value]}
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
        <p
          role="status"
          className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm"
        >
          Loading tutor requests…
        </p>
      ) : null}

      {!loading && items && items.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          {query || status !== 'all'
            ? 'No tutor requests match your search or filter.'
            : 'No tutor requests yet.'}
        </p>
      ) : null}

      {!loading && items && items.length > 0 ? <RequestsTable items={items} /> : null}

      {!loading && pagination && pagination.totalPages > 1 ? (
        <nav
          aria-label="Pagination"
          className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-slate-600">
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
