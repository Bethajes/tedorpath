import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Container, PageShell } from '@/components/layout/PageShell'
import { TutorRequestWizard } from '@/features/tutorRequest/TutorRequestWizard'
import { TutorRequestSuccess } from '@/features/tutorRequest/TutorRequestSuccess'
import { primaryRate } from '@/features/tutors/formatRate'
import { getTutor } from '@/features/tutors/tutors.api'
import type { TutorDetailDTO } from '@/features/tutors/tutors.types'
import { parseTutorRequestPrefill } from '@/lib/tutorRequestQuery'

/**
 * How the chosen tutor is being resolved, so the panel below knows what to say.
 *
 * `loading` is not an error state: a tutor whose page is slow to load should not
 * show the visitor a warning about the tutor they just chose. Only a confirmed
 * failure becomes `unavailable`, and even then the request is still submitted
 * with the id — the tutor is real, the admin just cannot show a name for them
 * right now.
 */
type TutorState =
  | { kind: 'none' }
  | { kind: 'loading' }
  | { kind: 'ready'; tutor: TutorDetailDTO }
  | { kind: 'unavailable' }

/** The outcome of a fetch, tagged with the id it was for. */
interface TutorResolution {
  forId: string
  state: Exclude<TutorState, { kind: 'loading' }>
}

export function RequestTutorPage() {
  const [searchParams] = useSearchParams()
  const { subject, educationLevel, learningMode, tutorProfileId } =
    parseTutorRequestPrefill(searchParams.toString())

  const [resolution, setResolution] = useState<TutorResolution | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // The wizard owns the flow once it has loaded; the page owns the tutor's
  // identity, which the wizard carries through to the API as an id.
  const loadTutor = useCallback(() => {
    if (!tutorProfileId) return

    let cancelled = false

    // No market is sent or needed: the server prices this tutor for whoever is
    // asking, using the same account, cookie and network it priced the directory
    // with, so this panel and the profile page next door cannot disagree.
    getTutor(tutorProfileId)
      .then((tutor) => {
        if (!cancelled) setResolution({ forId: tutorProfileId, state: { kind: 'ready', tutor } })
      })
      .catch(() => {
        // A 404 here means the profile is no longer public — suspended, rejected
        // or deleted. The request can still be sent: the admin decides who ends
        // up teaching the client, and silently dropping the tutor would be a
        // worse answer than saying the name is unavailable.
        if (!cancelled) {
          setResolution({ forId: tutorProfileId, state: { kind: 'unavailable' } })
        }
      })

    return () => {
      cancelled = true
    }
    // Just the id. The market used to be a dependency here, because the panel
    // asked for one and had to be re-fetched when it resolved — two loads of the
    // same tutor to settle on which of two prices to show, and a brief window
    // showing neither.
  }, [tutorProfileId])

  // Fetching in an effect is synchronising with an external system (our API).
  useEffect(() => {
    loadTutor()
  }, [loadTutor])

  /*
   * Derived during render rather than reset in an effect.
   *
   * Writing "loading" from the effect would mean a moment — between the id
   * changing and the fetch resolving — where the panel still showed the
   * *previous* tutor's name, so a visitor who followed two profiles in a row
   * could be told they were requesting the wrong person. Deriving it from the
   * id makes that state unreachable.
   */
  const tutorState: TutorState = !tutorProfileId
    ? { kind: 'none' }
    : resolution?.forId === tutorProfileId
      ? resolution.state
      : { kind: 'loading' }

  /*
   * The rate to name here is the one for the visitor's own market.
   *
   * This panel is shown before they have chosen a country on the wizard below it,
   * so it is resolved from the same signals every other tutor surface uses. Once
   * they pick Ethiopia in step 1 the market is remembered and the directory they
   * go to next prices in birr too.
   */
  const clientRate = tutorState.kind === 'ready' ? primaryRate(tutorState.tutor) : null

  const carriedOver: { label: string; value: string }[] = []
  if (subject) carriedOver.push({ label: 'Subject', value: subject })
  if (educationLevel) carriedOver.push({ label: 'Level', value: educationLevel })
  if (learningMode) carriedOver.push({ label: 'Learning mode', value: learningMode })

  if (submitted) {
    return (
      <PageShell>
        <Container className="max-w-3xl">
          <TutorRequestSuccess />
        </Container>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <Container className="max-w-3xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-ink-900 sm:text-4xl">
            Request a Tutor
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-ink-600">
            Answer a few short questions and our team will review your request and get back to you.
            We will ask for your country first, so we can show you the right subjects, currency and
            lesson times.
          </p>

          {/*
            Named prominently, and not editable. A client who came from a tutor's
            profile has already chosen who they want; letting the choice look
            like another dropdown would invite them to change the thing that
            matters most about the request.
          */}
          {tutorState.kind === 'ready' ? (
            <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50/60 p-5">
              <p className="text-sm font-semibold text-ink-900">
                You are requesting {tutorState.tutor.displayName}
              </p>
              <p className="mt-1 text-sm text-ink-600">
                {tutorState.tutor.headline}
                {clientRate ? ` · ${clientRate} per hour` : ''}
              </p>
              <Link
                to={`/tutors/${tutorState.tutor.id}`}
                className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline"
              >
                View their profile
              </Link>
            </div>
          ) : null}

          {tutorState.kind === 'loading' ? (
            <p
              role="status"
              className="mt-6 rounded-2xl border border-ink-200 bg-ink-50 p-5 text-sm text-ink-600"
            >
              Loading the tutor you selected…
            </p>
          ) : null}

          {tutorState.kind === 'unavailable' ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm font-semibold text-amber-900">
                The tutor you selected is no longer available
              </p>
              <p className="mt-1 text-sm text-amber-900">
                Your request will still be sent and our team will find you a suitable tutor.
              </p>
            </div>
          ) : null}

          {carriedOver.length > 0 ? (
            <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50/60 p-5">
              <p className="text-sm font-semibold text-ink-900">
                We carried over your choices
              </p>
              <p className="mt-1 text-sm text-ink-600">
                Change anything in the steps below before you send the request.
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {carriedOver.map((item) => (
                  <li
                    key={item.label}
                    className="rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-sm"
                  >
                    <span className="text-ink-500">{item.label}:</span>{' '}
                    <span className="font-medium text-ink-900">{item.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </header>

        <TutorRequestWizard onSubmitted={() => setSubmitted(true)} />
      </Container>
    </PageShell>
  )
}

