import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Container, PageShell } from '@/components/layout/PageShell'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAuth } from '@/features/auth/useAuth'
import { getTutor } from '@/features/tutors/tutors.api'
import { TEACHING_MODE_LABELS } from '@/features/tutors/tutors.types'
import type { TutorDetailDTO } from '@/features/tutors/tutors.types'
import { ApiError, resolveImageUrl } from '@/lib/api'
import { useAsyncData } from '@/lib/useAsyncData'
import { NotFoundPage } from '@/pages/NotFoundPage'

/**
 * A single tutor's public profile, at `/tutors/:id`.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 12.1, 12.2, 12.3
 *
 * Everything rendered here comes from `GET /api/tutors/:id`. There are no
 * reviews, ratings, hours-taught totals or satisfaction scores (Requirement
 * 10.4): the API has no model behind any of them, and a plausible-looking
 * number on a profile is the single most misleading thing this page could show.
 *
 * The page itself is public (Requirement 12.1) — reading a profile never
 * requires an account. Only the "Request This Tutor" action does, and it
 * handles that itself rather than wrapping the page in a guard.
 */

const GENERIC_LOAD_ERROR = 'We could not load this tutor profile. Please try again.'

/**
 * Fetch the profile, folding a 404 into `null`.
 *
 * `getTutor` answers NOT_FOUND both for an id that was never valid and for a
 * profile that exists but is not APPROVED, and Requirement 10.2 sends both to
 * the 404 page. Returning `null` rather than throwing keeps that distinction
 * out of the render: the page just has nothing to show and hands over to
 * `NotFoundPage`. Every other failure still propagates to `useAsyncData` so the
 * visitor gets a message and a retry instead of a dead end.
 */
async function loadTutorProfile(id: string): Promise<TutorDetailDTO | null> {
  try {
    return await getTutor(id)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/** Up to two initials for the placeholder photo. Empty when there are no letters. */
function initialsOf(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''

  const first = words[0][0] ?? ''
  const last = words.length > 1 ? (words[words.length - 1][0] ?? '') : ''
  return (first + last).toUpperCase()
}

/**
 * The tutor's photo, or an initials tile when there is none.
 *
 * Both branches expose the same accessible name so the page reads identically
 * whether or not the tutor uploaded a picture (Requirement 10.5). A stored URL
 * can also stop resolving after the fact, so the fallback is triggered by the
 * load failing and not only by the field being null — otherwise the browser
 * would show its own broken-image glyph.
 */
function ProfilePhoto({
  displayName,
  photoUrl,
}: {
  displayName: string
  photoUrl: string | null
}) {
  const [photoBroken, setPhotoBroken] = useState(false)
  const label = `${displayName} profile photo`
  // Uploaded photos are stored as a path relative to the API origin, so it has
  // to be resolved before it can be used as an `img src`.
  const src = photoBroken ? null : resolveImageUrl(photoUrl)

  if (src) {
    return (
      <img
        src={src}
        alt={label}
        onError={() => setPhotoBroken(true)}
        className="h-28 w-28 shrink-0 rounded-full border border-ink-200 bg-ink-100 object-cover sm:h-32 sm:w-32"
      />
    )
  }

  const initials = initialsOf(displayName)

  return (
    <div
      role="img"
      aria-label={`${label} placeholder`}
      className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-2xl font-semibold text-brand-700 sm:h-32 sm:w-32"
    >
      {initials ? (
        <span aria-hidden="true">{initials}</span>
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          className="h-12 w-12"
        >
          <circle cx="12" cy="8.5" r="3.4" />
          <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
        </svg>
      )}
    </div>
  )
}

/**
 * One labelled block of the tutor's own words.
 *
 * A section is rendered even when the tutor left it empty, saying so plainly.
 * Hiding it would leave a visitor wondering whether the page had simply failed
 * to load that part; "not provided yet" answers the question the empty space
 * raises, without inventing a placeholder value (Requirement 10.4).
 */
function ProseSection({
  title,
  value,
  emptyMessage,
}: {
  title: string
  value: string | null
  emptyMessage: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody>
        {value ? (
          <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-ink-700">{value}</p>
        ) : (
          <p className="text-[0.95rem] text-ink-500">{emptyMessage}</p>
        )}
      </CardBody>
    </Card>
  )
}

/** A titled list of short values, or a plain note when the list is empty. */
function ChipListCard({
  title,
  values,
  listLabel,
  emptyMessage,
}: {
  title: string
  values: string[]
  listLabel: string
  emptyMessage: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody>
        {values.length > 0 ? (
          <ul aria-label={listLabel} className="flex flex-wrap gap-1.5">
            {values.map((value) => (
              <li
                key={value}
                className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-700"
              >
                {value}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[0.95rem] text-ink-500">{emptyMessage}</p>
        )}
      </CardBody>
    </Card>
  )
}

/**
 * "Request This Tutor", which is the one thing on this page a visitor cannot
 * do anonymously.
 *
 * Signed in, it goes straight to the request form with this tutor preselected.
 * Signed out, it goes to `/login` carrying the destination in the router's
 * `state.from` — the same shape `RequireAuth` and `LoginPage` already read, so
 * signing in lands on `/request-tutor?tutorId=<id>` (Requirements 12.2, 12.3).
 *
 * While the session is still being checked the visitor is treated as signed
 * out. That is the safe direction: `LoginPage` redirects an already-signed-in
 * visitor straight to `state.from`, so the worst case is a brief detour
 * through a page they are immediately forwarded off.
 *
 * It is a `<Link>`, not a `<button>` with `navigate()`: right-clicking to open
 * the request form in a new tab works, and the target is a real href.
 */
function RequestTutorCta({ tutor }: { tutor: TutorDetailDTO }) {
  const { status } = useAuth()

  const target = `/request-tutor?tutorId=${encodeURIComponent(tutor.id)}`
  const signedIn = status === 'authenticated'

  return (
    <div className="mt-6 rounded-2xl border border-ink-200 bg-ink-50 p-5">
      <Link
        to={signedIn ? target : '/login'}
        state={signedIn ? undefined : { from: target }}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
      >
        Request This Tutor
      </Link>
      <p className="mt-3 text-sm text-ink-600">
        {signedIn
          ? `Tell us what you need and ${tutor.displayName} will receive your request.`
          : 'Sign in to request this tutor, and we will take you straight to the form.'}
      </p>
    </div>
  )
}

/** Facts the tutor supplied, as a description list. */
function ProfileFacts({ tutor }: { tutor: TutorDetailDTO }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardBody>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-medium text-ink-500">Teaching mode</dt>
            <dd className="text-ink-900">{TEACHING_MODE_LABELS[tutor.teachingMode]}</dd>
          </div>

          {tutor.location && (
            <div>
              <dt className="font-medium text-ink-500">Location</dt>
              <dd className="text-ink-900">{tutor.location}</dd>
            </div>
          )}

          {tutor.hourlyRate !== null && (
            <div>
              <dt className="font-medium text-ink-500">Hourly rate</dt>
              <dd className="text-ink-900">
                {/*
                  No currency symbol: the API sends a bare number and no currency
                  field, so printing "$" or "ETB" here would be inventing data.
                  A rate of 0 is a real price and is shown like any other.
                */}
                {tutor.hourlyRate} per hour
              </dd>
            </div>
          )}
        </dl>
      </CardBody>
    </Card>
  )
}

/** The profile itself. Only reached with data in hand. */
function TutorProfile({ tutor }: { tutor: TutorDetailDTO }) {
  return (
    <PageShell>
      <Container className="max-w-5xl">
        <TutorProfileView tutor={tutor} />
      </Container>
    </PageShell>
  )
}

/**
 * Everything a visitor reads about one tutor, and nothing else.
 *
 * Split out from the page's loading, error and 404 states so the markup can be
 * checked on its own, without a fetch and without the shared header and footer
 * standing between a query and the content it is about.
 */
export function TutorProfileView({ tutor }: { tutor: TutorDetailDTO }) {
  return (
    <>
      <header className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <ProfilePhoto displayName={tutor.displayName} photoUrl={tutor.profilePhotoUrl} />

        <div className="min-w-0">
          {/*
            The display name is the page's <h1>: it is what the visitor came
            to read, and every section below is an <h2> under it, so the
            heading order never skips a level (Requirement 10.5).
          */}
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-ink-900 sm:text-4xl">
            {tutor.displayName}
          </h1>
          <p className="mt-2 text-lg text-ink-600">{tutor.headline}</p>
        </div>
      </header>

      <RequestTutorCta tutor={tutor} />

      <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          <ProseSection
            title="About"
            value={tutor.bio}
            emptyMessage="This tutor has not added a bio yet."
          />
          <ProseSection
            title="Experience"
            value={tutor.experience}
            emptyMessage="This tutor has not listed their experience yet."
          />
          <ProseSection
            title="Education"
            value={tutor.education}
            emptyMessage="This tutor has not listed their education yet."
          />
          <ProseSection
            title="Availability"
            value={tutor.availability}
            emptyMessage="This tutor has not listed their availability yet."
          />
        </div>

        <aside className="w-full space-y-6 lg:w-72 lg:shrink-0">
          <ProfileFacts tutor={tutor} />
          <ChipListCard
            title="Subjects"
            values={tutor.subjects.map((subject) => subject.name)}
            listLabel="Subjects"
            emptyMessage="No subjects listed yet."
          />
          <ChipListCard
            title="Student levels"
            values={tutor.studentLevels}
            listLabel="Student levels"
            emptyMessage="No student levels listed yet."
          />
          <ChipListCard
            title="Languages"
            values={tutor.languages}
            listLabel="Languages"
            emptyMessage="No languages listed yet."
          />
        </aside>
      </div>
    </>
  )
}

export function TutorProfilePage() {
  const { id = '' } = useParams()

  const load = useCallback(() => loadTutorProfile(id), [id])

  const { data, loading, error, reload } = useAsyncData<TutorDetailDTO | null>(
    load,
    [id],
    (err) => (err instanceof Error ? err.message : GENERIC_LOAD_ERROR),
  )

  // Requirement 10.2: a tutor that does not exist, or whose profile is not
  // APPROVED, gets the site's 404 page — the same one the router shows for an
  // unknown URL, so there is nothing to invent and nothing to leak.
  if (!loading && !error && data === null) {
    return <NotFoundPage />
  }

  if (loading) {
    return (
      <PageShell>
        <Container className="max-w-5xl">
          <p role="status" className="py-16 text-center text-sm text-ink-500">
            Loading tutor profile…
          </p>
        </Container>
      </PageShell>
    )
  }

  if (error || !data) {
    return (
      <PageShell>
        <Container className="max-w-xl">
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error ?? GENERIC_LOAD_ERROR}
          </div>
          <button
            type="button"
            onClick={reload}
            className="mt-4 rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-[0.95rem] font-medium text-ink-800 transition-colors hover:bg-ink-50"
          >
            Try again
          </button>
        </Container>
      </PageShell>
    )
  }

  return <TutorProfile tutor={data} />
}
