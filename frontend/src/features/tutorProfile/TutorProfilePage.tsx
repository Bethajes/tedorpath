import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Container, PageShell } from '@/components/layout/PageShell'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAuth } from '@/features/auth/useAuth'
import { getTutor } from '@/features/tutors/tutors.api'
import { TEACHING_MODE_LABELS } from '@/features/tutors/tutors.types'
import {
  primaryRate,
} from '@/features/tutors/formatRate'
import type { TutorDetailDTO } from '@/features/tutors/tutors.types'
import { ApiError, resolveImageUrl } from '@/lib/api'
import { cn } from '@/lib/cn'
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
 * The link a visitor uses to ask this tutor for a lesson.
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
 * Rendered as a `<Link>`, not a `<button>` with `navigate()`: right-clicking to
 * open the request form in a new tab works, and the target is a real href.
 *
 * The two placements are the same link with different wording — "Request This
 * Tutor" under the header, "Request a Tutor" in the side panel. They are worded
 * differently on purpose: two links with identical names are two identical
 * links to a screen-reader user with no way to tell which is which, and the
 * page is read out loud more often than it is clicked.
 */
function RequestTutorLink({
  tutor,
  variant,
  className,
}: {
  tutor: TutorDetailDTO
  variant: 'primary' | 'panel'
  className?: string
}) {
  const { status } = useAuth()

  const target = `/request-tutor?tutorId=${encodeURIComponent(tutor.id)}`
  const signedIn = status === 'authenticated'

  return (
    <Link
      to={signedIn ? target : '/login'}
      state={signedIn ? undefined : { from: target }}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        variant === 'primary'
          ? 'bg-brand-600 px-5 py-3 text-base text-white shadow-sm hover:bg-brand-700'
          : 'w-full bg-brand-600 px-4 py-2.5 text-sm text-white hover:bg-brand-700',
        className,
      )}
    >
      {variant === 'primary' ? 'Request This Tutor' : 'Request a Tutor'}
    </Link>
  )
}

/**
 * The facts the tutor supplied, as a description list, in the header.
 *
 * A `<dl>` because these are name/value pairs rather than prose, and because
 * assistive technology announces the term with its definition. Optional facts
 * (location, rate, languages) are omitted entirely when absent — an empty
 * "Location" row would be a claim that there is no location, which is not the
 * same as the tutor not having set one.
 *
 * The languages value is a list rather than a comma-joined string: a screen
 * reader can count and navigate the items, and "Amharic, English" read as one
 * run of text gives no way to tell how many languages there are.
 * Requirements: 31.1, 31.3
 */
function ProfileFacts({ tutor }: { tutor: TutorDetailDTO }) {
  // Derived once so the row below does not repeat the condition, and so the
  // formatter's "is there a price at all" answer is the single test used for it.
  const rate = primaryRate(tutor)

  return (
    <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:max-w-2xl sm:grid-cols-3">
      <div>
        <dt className="font-medium text-ink-500">Teaching mode</dt>
        <dd className="text-ink-900">{TEACHING_MODE_LABELS[tutor.teachingMode]}</dd>
      </div>

      {tutor.location ? (
        <div>
          <dt className="font-medium text-ink-500">Location</dt>
          <dd className="text-ink-900">{tutor.location}</dd>
        </div>
      ) : null}

      {/*
        One price, in the visitor's own market.

        This profile used to print the tutor's price for the other market in a
        second row labelled "also teaches for". On a detail page that reads as
        more informative, and it is: but it also invites the question "which of
        these two do I pay?", which a learner cannot answer and should not have
        to. The market selector above the profile is the answer to "show me the
        other one", and it changes every price on the page at once.
      */}
      {rate ? (
        <div>
          <dt className="font-medium text-ink-500">
            Hourly rate in {tutor.hourlyRateCurrency}
          </dt>
          <dd className="text-ink-900">{rate} per hour</dd>
        </div>
      ) : null}

      {tutor.languages.length > 0 ? (
        <div>
          <dt className="font-medium text-ink-500">Languages</dt>
          <dd className="mt-1">
            <ul aria-label="Languages" className="flex flex-wrap gap-1.5">
              {tutor.languages.map((language) => (
                <li
                  key={language}
                  className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-700"
                >
                  {language}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      ) : null}
    </dl>
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
 *
 * The order is deliberate: who this is, then the one action a visitor came for,
 * then the detail. The request call to action is repeated in the side panel
 * because on a long profile the one under the header is a long scroll away, and
 * a visitor who has just finished reading is exactly the person who wants it.
 *
 * Requirements: 31.1, 31.2, 31.4, 31.5, 31.6, 31.7
 */
export function TutorProfileView({ tutor }: { tutor: TutorDetailDTO }) {
  return (
    <>
      <header className="flex flex-col items-start gap-5 sm:flex-row sm:items-start">
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

          <ProfileFacts tutor={tutor} />

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <RequestTutorLink tutor={tutor} variant="primary" />
            {/*
              An in-page link rather than another request: subjects are the one
              thing a visitor checks before deciding to get in touch, and it is
              already on this page, so a full navigation would be a step back.
            */}
            <a
              href="#subjects"
              className="text-sm font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800"
            >
              View subjects
            </a>
          </div>
        </div>
      </header>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <ProseSection
            title="About"
            value={tutor.bio}
            emptyMessage="This tutor has not added a bio yet."
          />
          <div id="subjects">
            <ChipListCard
              title="Subjects"
              values={tutor.subjects.map((subject) => subject.name)}
              listLabel="Subjects"
              emptyMessage="No subjects listed yet."
            />
          </div>
          <ChipListCard
            title="Student levels"
            values={tutor.studentLevels}
            listLabel="Student levels"
            emptyMessage="No student levels listed yet."
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

        <aside className="w-full lg:shrink-0">
          <div className="lg:sticky lg:top-24">
            <Card>
              <CardHeader>
                <CardTitle>Interested in this tutor?</CardTitle>
              </CardHeader>
              <CardBody>
                <RequestTutorLink tutor={tutor} variant="panel" />
                <p className="mt-3 text-sm text-ink-600">
                  Tell us what you need to learn and {tutor.displayName} will receive your request.
                </p>
              </CardBody>
            </Card>
          </div>
        </aside>
      </div>
    </>
  )
}

export function TutorProfilePage() {
  const { id = '' } = useParams()

  /*
   * One fetch, no market parameter, and no waiting for anything first.
   *
   * This page used to hold its mount until a market had been resolved, because the
   * rate the server sends depends on it — so it fetched, got a price, and if the
   * market then landed differently it fetched again. Two requests for one page
   * view, and a price on screen that was not the price being displayed.
   *
   * None of that is needed now. The server resolves the market from the same
   * account, cookie and network it resolved the directory's with, and sends one
   * rate. So the page asks once and renders it, which is also why a card no longer
   * has to carry `?market=` onward to stop the two pages disagreeing.
   */
  return <LoadedTutorProfile id={id} />
}

/**
 * The profile itself.
 *
 * A separate component purely for its name at the call site above: there is
 * nothing to wait for any more, and a component called `Loaded` would be
 * claiming a two-phase render that no longer exists.
 */
function LoadedTutorProfile({ id }: { id: string }) {
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
