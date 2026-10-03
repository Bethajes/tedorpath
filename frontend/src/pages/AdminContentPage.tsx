import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { AdminPageHeader, AdminShell } from '@/components/layout/AdminShell'
import { Alert, Button, Input } from '@/components/ui'
import { fetchAdminTutors } from '@/features/adminTutors/adminTutors.api'
import { fetchPublicSubjects } from '@/features/subjects/subjects.api'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useAsyncData } from '@/lib/useAsyncData'

/**
 * Content — `/admin/content`
 *
 * The subjects offered in the public catalogue, and how many approved tutors
 * teach each one.
 *
 * WHAT THIS PAGE CANNOT DO, stated on the page rather than hidden:
 *
 * `GET /api/subjects` is a read-only endpoint. There is no admin endpoint that
 * creates, renames, reorders or deactivates a subject, so none of those controls
 * exist here — a disabled button next to a working one is worse than saying the
 * feature is not built. The tutor counts come from the existing tutor list, which
 * means they are counts of profiles, not of a subject↔tutor index the platform
 * maintains.
 */

interface SubjectRow {
  id: string
  name: string
  slug: string
  category: string
}

function describeError(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Your admin session is no longer valid. Please sign in again.'
  }
  return 'Unable to load the subject catalogue. Please try again.'
}

export function AdminContentPage() {
  const [search, setSearch] = useState('')

  const { data, loading, error, reload } = useAsyncData<{
    subjects: SubjectRow[]
    tutorCounts: Map<string, number>
  }>(
    async () => {
      const [subjects, tutors] = await Promise.all([
        fetchPublicSubjects(),
        // One page of every profile, so the counts are over the whole set rather
        // than the first twenty. `status=all` is what makes this possible.
        fetchAdminTutors({ page: 1, limit: 100, status: 'all' }),
      ])

      const counts = new Map<string, number>()
      for (const tutor of tutors.items) {
        for (const subject of tutor.subjects) {
          counts.set(subject.id, (counts.get(subject.id) ?? 0) + 1)
        }
      }

      return { subjects, tutorCounts: counts }
    },
    [],
    describeError,
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return data?.subjects ?? []

    return (data?.subjects ?? []).filter(
      (subject) =>
        subject.name.toLowerCase().includes(term) ||
        subject.category.toLowerCase().includes(term),
    )
  }, [data, search])

  const grouped = useMemo(() => {
    const byCategory = new Map<string, SubjectRow[]>()
    for (const subject of filtered) {
      const list = byCategory.get(subject.category) ?? []
      list.push(subject)
      byCategory.set(subject.category, list)
    }
    return [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  return (
    <AdminShell>
      <AdminPageHeader
        title="Content"
        description="The subjects a visitor can pick when requesting a tutor. Counts show how many tutor profiles teach each one."
      />

      <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-ink-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="content-search" className="text-sm font-medium text-ink-800">
            Search
          </label>
          <Input
            id="content-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Subject name or category"
          />
        </div>
        <div className="flex items-end">
          <Button variant="outline" onClick={reload} disabled={loading} fullWidth>
            Refresh
          </Button>
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
        <div role="status" aria-label="Loading subjects" className="space-y-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-xl border border-ink-200 bg-white" />
          ))}
        </div>
      ) : null}

      {!loading && filtered.length === 0 ? (
        <div className="rounded-xl border border-ink-200 bg-white px-5 py-10 text-center shadow-sm">
          <p className="text-sm font-medium text-ink-900">
            {search.trim() ? 'No subjects match that search' : 'No subjects in the catalogue'}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-600">
            {search.trim()
              ? 'Try a different name or category.'
              : 'Subjects are added by the seed script; there is no admin screen for creating them yet.'}
          </p>
        </div>
      ) : null}

      {!loading && grouped.length > 0 ? (
        <div className="space-y-6">
          {grouped.map(([category, subjects]) => (
            <section key={category}>
              <h2 className="mb-2 text-sm font-semibold tracking-wide text-ink-500 uppercase">
                {category}
              </h2>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {subjects.map((subject) => (
                  <SubjectCard
                    key={subject.id}
                    subject={subject}
                    tutorCount={data?.tutorCounts.get(subject.id) ?? 0}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      {/*
        The read-only boundary, on the page. An operator will try to add a subject
        the moment they look at this list, and "there is no endpoint for that" is a
        better answer than a control that silently does nothing.
      */}
      <section className="mt-8 rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-ink-900">Editing subjects</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-600">
          The subject catalogue is read-only over the API. There is no endpoint to create, rename,
          reorder or deactivate a subject, so this screen does not offer controls that could not
          work. Changes to the catalogue are made by the seed script.
        </p>
        <p className="mt-3 text-xs text-ink-500">
          The homepage figure for &ldquo;Subjects taught&rdquo; counts active subjects, and can be
          adjusted separately in{' '}
          <Link to="/admin/site-stats" className="font-medium text-brand-700 hover:underline">
            Settings
          </Link>
          .
        </p>
      </section>
    </AdminShell>
  )
}

function SubjectCard({
  subject,
  tutorCount,
}: {
  subject: SubjectRow
  tutorCount: number
}) {
  return (
    <li className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink-900">{subject.name}</p>
          <p className="truncate text-xs text-ink-500">{subject.slug}</p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums',
            tutorCount > 0 ? 'bg-brand-50 text-brand-800' : 'bg-ink-100 text-ink-500',
          )}
        >
          {tutorCount} {tutorCount === 1 ? 'tutor' : 'tutors'}
        </span>
      </div>
    </li>
  )
}
