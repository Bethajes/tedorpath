/**
 * Admin tutor review queue — `/admin/tutors`
 *
 * Lists all tutor applications with filtering, search and pagination.
 * Mirrors the structure of AdminRequestsPage but targets the tutor moderation
 * queue rather than client requests.
 *
 * Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7, 23.8, 23.9
 */

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AdminPageHeader, AdminShell } from '@/components/layout/AdminShell'
import { Alert, Button, Input, Select } from '@/components/ui'
import { fetchAdminTutors } from '@/features/adminTutors/adminTutors.api'
import { TutorsTable } from '@/features/adminTutors/components/TutorsTable'
import {
  PROFILE_STATUS_LABELS,
  STATUS_FILTERS,
  type StatusFilter,
} from '@/features/adminTutors/adminTutors.types'
import { ApiError } from '@/lib/api'
import { useAsyncData } from '@/lib/useAsyncData'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

/** The status the queue opens on, overridable from the URL. */
const DEFAULT_STATUS: StatusFilter = 'PENDING_REVIEW'

/**
 * Reads the opening status filter from the query string.
 *
 * The dashboard links here with `?status=NEEDS_INFORMATION` so a count on that
 * page lands on the matching slice of the queue. An unrecognised value falls
 * back to the default rather than blanking the table.
 */
function initialStatus(params: URLSearchParams): StatusFilter {
  const requested = params.get('status')
  return requested && (STATUS_FILTERS as readonly string[]).includes(requested)
    ? (requested as StatusFilter)
    : DEFAULT_STATUS
}

function describeError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    return 'Your admin session is no longer valid. Please sign in again.'
  }
  return 'Unable to load tutor applications. Please try again.'
}

export function AdminTutorsPage() {
  const [searchParams] = useSearchParams()

  // `search` is the raw input value; `query` is the debounced value sent to
  // the API. Separating them prevents a request on every keystroke.
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>(() => initialStatus(searchParams))
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  const { data, loading, error, reload } = useAsyncData(
    () => fetchAdminTutors({ page, limit: PAGE_SIZE, status, search: query }),
    [page, status, query],
    describeError,
  )

  // Changing filter or search should return to page 1.
  const handleStatusChange = useCallback((value: StatusFilter) => {
    setStatus(value)
    setPage(1)
  }, [])

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    setPage(1)
  }, [])

  const items = data?.items ?? null
  const pagination = data?.pagination ?? null

  const resultDescription =
    pagination && pagination.total > 0
      ? `${pagination.total} application${pagination.total === 1 ? '' : 's'} match the current filters.`
      : 'Review and process tutor applications.'

  return (
    <AdminShell>
      <AdminPageHeader
        title="Tutors"
        description={resultDescription}
        actions={
          <Button variant="outline" onClick={reload} disabled={loading}>
            Refresh
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tutor-search" className="text-sm font-medium text-slate-800">
            Search
          </label>
          <Input
            id="tutor-search"
            type="search"
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Applicant name or headline"
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
            <option value="all">All</option>
            {STATUS_FILTERS.filter((s) => s !== 'all').map((value) => (
              <option key={value} value={value}>
                {PROFILE_STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Error state */}
      {error ? (
        <Alert tone="error" className="mb-5">
          <p>{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
            Try again
          </Button>
        </Alert>
      ) : null}

      {/* Loading state */}
      {loading ? (
        <p
          role="status"
          className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm"
        >
          Loading tutor applications…
        </p>
      ) : null}

      {/* Empty state */}
      {!loading && items && items.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          {query || status !== 'all'
            ? 'No tutor applications match your search or filter.'
            : 'No tutor applications yet.'}
        </p>
      ) : null}

      {/* Table */}
      {!loading && items && items.length > 0 ? <TutorsTable items={items} /> : null}

      {/* Pagination */}
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
