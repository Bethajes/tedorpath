import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Container, PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'

import { buildTutorSearchParams, listTutors } from './tutors.api'
import { DEFAULT_TUTOR_PAGE_SIZE, TUTOR_SORT_OPTIONS } from './tutors.types'
import type { TutorCardDTO, TutorFilters, TutorPagination, TutorSortOption } from './tutors.types'
import { TutorCard } from './components/TutorCard'
import { FilterPanel } from './components/FilterPanel'
import { EmptyState } from './components/EmptyState'
import { useAsyncData } from '@/lib/useAsyncData'

function filtersFromParams(params: URLSearchParams): TutorFilters {
  const filters: TutorFilters = {}
  const q = params.get('q')
  if (q) filters.q = q
  const subject = params.get('subject')
  if (subject) filters.subject = subject
  const level = params.get('level')
  if (level) filters.studentLevel = level as TutorFilters['studentLevel']
  const mode = params.get('mode')
  if (mode) filters.mode = mode as TutorFilters['mode']
  const location = params.get('location')
  if (location) filters.location = location
  const minRate = params.get('minRate')
  if (minRate !== null && minRate !== '') {
    const n = Number(minRate)
    if (Number.isFinite(n)) filters.minRate = n
  }
  const maxRate = params.get('maxRate')
  if (maxRate !== null && maxRate !== '') {
    const n = Number(maxRate)
    if (Number.isFinite(n)) filters.maxRate = n
  }
  const sort = params.get('sort') as TutorSortOption | null
  if (sort && (TUTOR_SORT_OPTIONS as readonly string[]).includes(sort)) {
    filters.sort = sort
  }
  return filters
}

function pageFromParams(params: URLSearchParams): number {
  const raw = params.get('page')
  const n = raw ? parseInt(raw, 10) : 1
  return Number.isFinite(n) && n >= 1 ? n : 1
}

const SORT_LABELS: Record<TutorSortOption, string> = {
  recommended: 'Recommended',
  price_asc: 'Price: Low to high',
  price_desc: 'Price: High to low',
  newest: 'Newest',
}

function CardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="h-56 rounded-2xl border border-ink-200 bg-white animate-pulse"
    />
  )
}

interface PaginationProps {
  pagination: TutorPagination
  onPageChange: (page: number) => void
}

function Pagination({ pagination, onPageChange }: PaginationProps) {
  const { page, totalPages } = pagination
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        Previous
      </Button>
      <span className="text-sm text-ink-600" aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        Next
      </Button>
    </nav>
  )
}

/**
 * Public tutor directory at `/tutors`.
 *
 * URL search params are the source of truth for filter / sort / page state.
 * Deep-links like `/tutors?subject=mathematics` work out of the box.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8
 */
export function TutorDirectoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = filtersFromParams(searchParams)
  const page = pageFromParams(searchParams)
  const sort = filters.sort ?? 'recommended'

  const [drawerOpen, setDrawerOpen] = useState(false)

  const fetchTutors = useCallback(
    () => listTutors({ ...filters, sort }, page, DEFAULT_TUTOR_PAGE_SIZE),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams.toString()],
  )

  const { data, loading, error } = useAsyncData(
    fetchTutors,
    [searchParams.toString()],
    (err) => (err instanceof Error ? err.message : 'Could not load tutors. Please try again.'),
  )

  function applyFilters(next: TutorFilters) {
    const base = buildTutorSearchParams({ ...next, sort: next.sort ?? sort }, 1, DEFAULT_TUTOR_PAGE_SIZE)
    setSearchParams(base, { replace: true })
  }

  function applySort(nextSort: TutorSortOption) {
    const base = buildTutorSearchParams({ ...filters, sort: nextSort }, 1, DEFAULT_TUTOR_PAGE_SIZE)
    setSearchParams(base, { replace: true })
  }

  function applyPage(nextPage: number) {
    const base = buildTutorSearchParams({ ...filters, sort }, nextPage, DEFAULT_TUTOR_PAGE_SIZE)
    setSearchParams(base, { replace: true })
  }

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const q = (fd.get('q') as string | null) ?? ''
    applyFilters({ ...filters, q: q || undefined, sort })
  }

  const hasActiveFilters =
    Boolean(filters.subject) ||
    Boolean(filters.studentLevel) ||
    Boolean(filters.mode) ||
    Boolean(filters.location) ||
    filters.minRate !== undefined ||
    filters.maxRate !== undefined ||
    Boolean(filters.q)

  const items: TutorCardDTO[] = data?.items ?? []
  const pagination = data?.pagination

  return (
    <PageShell>
      <Container>
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-ink-900 sm:text-4xl">
            Find a Tutor
          </h1>
          <p className="mt-2 text-lg text-ink-600">
            Browse approved tutors and find the right match for you.
          </p>
        </header>

        <form onSubmit={handleSearchSubmit} role="search" className="mb-6 flex gap-2">
          <label htmlFor="tutor-search" className="sr-only">
            Search tutors
          </label>
          <input
            id="tutor-search"
            name="q"
            type="search"
            defaultValue={filters.q ?? ''}
            key={filters.q ?? ''}
            placeholder="Search by name, subject or keyword"
            aria-label="Search tutors"
            className="flex-1 rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <Button type="submit" variant="primary" size="sm" aria-label="Submit search">
            Search
          </Button>
        </form>

        <div className="mb-4 flex items-center justify-between md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDrawerOpen(true)}
            aria-expanded={drawerOpen}
            aria-controls="filter-drawer"
          >
            Filters
            {hasActiveFilters && (
              <span
                aria-label="Filters active"
                className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white"
              >
                •
              </span>
            )}
          </Button>
          <div className="flex items-center gap-2">
            <label htmlFor="sort-select" className="text-sm text-ink-600">
              Sort:
            </label>
            <select
              id="sort-select"
              value={sort}
              onChange={(e) => applySort(e.target.value as TutorSortOption)}
              aria-label="Sort tutors"
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-900"
            >
              {TUTOR_SORT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{SORT_LABELS[opt]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-8">
          <FilterPanel
            filters={filters}
            onChange={applyFilters}
            isOpen={drawerOpen}
            onClose={() => setDrawerOpen(false)}
          />

          <div className="min-w-0 flex-1">
            <div className="mb-5 hidden items-center justify-between md:flex">
              {pagination && (
                <p className="text-sm text-ink-500" aria-live="polite">
                  {pagination.total === 0
                    ? 'No tutors found'
                    : `${pagination.total} tutor${pagination.total === 1 ? '' : 's'} found`}
                </p>
              )}
              <div className="flex items-center gap-2">
                <label htmlFor="sort-select-desktop" className="text-sm text-ink-600">
                  Sort:
                </label>
                <select
                  id="sort-select-desktop"
                  value={sort}
                  onChange={(e) => applySort(e.target.value as TutorSortOption)}
                  aria-label="Sort tutors"
                  className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-900"
                >
                  {TUTOR_SORT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{SORT_LABELS[opt]}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {loading && (
              <div
                aria-busy="true"
                aria-label="Loading tutors"
                className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
              >
                {Array.from({ length: DEFAULT_TUTOR_PAGE_SIZE }).map((_, i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            )}

            {!loading && !error && items.length > 0 && (
              <ul aria-label="Tutors" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((tutor) => (
                  <li key={tutor.id}>
                    <TutorCard tutor={tutor} />
                  </li>
                ))}
              </ul>
            )}

            {!loading && !error && items.length === 0 && data !== null && (
              <EmptyState isFiltered={hasActiveFilters} />
            )}

            {pagination && !loading && (
              <Pagination pagination={pagination} onPageChange={applyPage} />
            )}
          </div>
        </div>
      </Container>
    </PageShell>
  )
}
