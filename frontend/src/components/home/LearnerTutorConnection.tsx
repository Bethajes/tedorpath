import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Container } from '@/components/layout/PageShell'
import { Logo } from '@/components/brand/Logo'
import { resolveImageUrl } from '@/lib/api'
import { listTutors } from '@/features/tutors/tutors.api'
import type { TutorCardDTO } from '@/features/tutors/tutors.types'
import {
  CONNECTION_TUTOR_LIMIT,
  DEMO_TUTORS,
  LEARNER_GOALS,
  type ConnectionTutor,
} from '@/data/learningConnection'

import './LearnerTutorConnection.css'

/**
 * Learners on one side, tutors on the other, Tedor in the middle.
 *
 * The point of the composition is the middle. A learner arrives with a goal
 * rather than a subject, and a tutor is a person with a set of subjects and a
 * way of teaching — the two are not the same shape, and something has to sit
 * between them and do the thinking. Putting the logo there, on the path, with
 * the connections passing through it, is the honest version of "intelligent
 * matching": it says where the judgement happens without claiming an algorithm
 * makes it. Requirement 14.1 forbids implying automation the platform lacks, and
 * LearningJourney says the same thing in words.
 *
 * DATA. Real approved profiles from `GET /api/tutors` whenever the directory has
 * any. The demo set in `data/learningConnection.ts` is only reached when it
 * returns nothing, and every demo card is chipped "Sample". There is no third
 * case where a made-up tutor could be mistaken for a real one.
 *
 * The card shows what the directory actually sends — name, subjects, teaching
 * mode, location. It does NOT show a university or a qualification, because
 * `TutorCardDTO` does not carry one and the alternative would be to write a
 * credential nobody has verified. The academic-background story belongs to the
 * university rail, which is sourced separately.
 */

/** Up to two initials, matching TutorCard's fallback exactly. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const first = words[0][0] ?? ''
  const last = words.length > 1 ? (words[words.length - 1][0] ?? '') : ''
  return (first + last).toUpperCase()
}

/** First name only. "Abel Bekele Tesfaye" reads as "Abel" in a matching view. */
function firstNameOf(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName.trim()
}

/** Narrow an approved profile to the four fields this card is allowed to show. */
function toConnectionTutor(tutor: TutorCardDTO): ConnectionTutor {
  return {
    id: tutor.id,
    firstName: firstNameOf(tutor.displayName),
    subjects: tutor.subjects.map((subject) => subject.name).slice(0, 2),
    location: tutor.location,
    teachingMode:
      tutor.teachingMode === 'BOTH'
        ? 'Online and in person'
        : tutor.teachingMode === 'ONLINE'
          ? 'Online'
          : 'In person',
    photoUrl: resolveImageUrl(tutor.profilePhotoUrl),
    profilePath: `/tutors/${tutor.id}`,
    isDemo: false,
  }
}

const GOAL_ICONS: Record<string, React.ReactNode> = {
  cap: (
    <>
      <path d="M12 4 3 8.5l9 4.5 9-4.5Z" />
      <path d="M7 11v4.4c0 1.4 2.2 2.6 5 2.6s5-1.2 5-2.6V11" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.4" />
      <path d="M12 2v2.6M12 19.4V22" />
    </>
  ),
  code: (
    <>
      <path d="m8.5 8-4.5 4 4.5 4M15.5 8l4.5 4-4.5 4M13.4 5.5l-2.8 13" />
    </>
  ),
  book: (
    <>
      <path d="M4 5h5.5a3 3 0 0 1 3 3v11a2.5 2.5 0 0 0-2.5-2.5H4Z" />
      <path d="M20 5h-5.5a3 3 0 0 0-3 3v11a2.5 2.5 0 0 1 2.5-2.5H20Z" />
    </>
  ),
  chat: (
    <>
      <path d="M20.5 12.5c0 3.9-3.8 7-8.5 7-1 0-2-.15-2.9-.42L4 20.5l1.4-3.6A6.6 6.6 0 0 1 3.5 12.5c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7Z" />
      <path d="M9 12.2h6M12 9.4v5.6" />
    </>
  ),
}

function TutorPip({ tutor }: { tutor: ConnectionTutor }) {
  const initials = initialsOf(tutor.firstName)

  return (
    <Link
      to={tutor.profilePath}
      className="ltc-tutor group flex items-start gap-3 rounded-2xl border border-ink-200 bg-white p-4 text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_12px_28px_-22px_rgba(18,26,36,0.45)]"
    >
      {tutor.photoUrl ? (
        <img
          src={tutor.photoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-11 w-11 shrink-0 rounded-full border border-ink-200 bg-ink-100 object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-sm font-semibold text-brand-700"
        >
          {initials || '•'}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-ink-900">{tutor.firstName}</span>
          {tutor.isDemo ? (
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[0.68rem] font-medium text-ink-600 ring-1 ring-inset ring-ink-200">
              Sample
            </span>
          ) : null}
        </span>

        <span className="mt-0.5 block text-[0.85rem] leading-snug text-ink-700">
          {tutor.subjects.length > 0 ? tutor.subjects.join(' · ') : 'Tutor'}
        </span>

        <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[0.78rem] text-ink-500">
          <span>{tutor.teachingMode}</span>
          {tutor.location ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{tutor.location}</span>
            </>
          ) : null}
        </span>
      </span>
    </Link>
  )
}

export function LearnerTutorConnection() {
  // `undefined` = loading, `[]` = the directory is genuinely empty.
  const [tutors, setTutors] = useState<ConnectionTutor[] | undefined>(undefined)

  useEffect(() => {
    let active = true

    listTutors({}, 1, CONNECTION_TUTOR_LIMIT)
      .then((result) => {
        if (active) setTutors(result.items.map(toConnectionTutor))
      })
      .catch(() => {
        if (active) setTutors([])
      })

    return () => {
      active = false
    }
  }, [])

  // Only an empty directory reaches the demo set. One real profile is enough to
  // make the bridge real, and mixing the two would put a sample card beside a
  // genuine one.
  const usingDemo = tutors !== undefined && tutors.length === 0
  const shown = tutors ?? []
  const hasAnything = shown.length > 0 || usingDemo
  const pips = shown.length > 0 ? shown : DEMO_TUTORS

  return (
    <section className="section-y bg-white" aria-labelledby="connection-heading">
      <Container>
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-700">
            How it comes together
          </p>
          <h2
            id="connection-heading"
            className="mt-3 text-3xl font-bold tracking-[-0.02em] sm:text-4xl"
          >
            One platform. Different learning goals.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-600">
            Learners arrive with a goal. Tutors arrive with subjects and a way of teaching. Tedor is
            what sits between the two and finds the overlap.
          </p>
        </div>

        {hasAnything ? (
          <div className="relative mt-12 lg:mt-14">
            {/*
              The connections. Absolutely positioned behind the columns rather
              than drawn between measured DOM nodes, because measuring on resize
              would mean a ResizeObserver per line and this layout is fixed. The
              lines are decorative (`aria-hidden`), so nothing is lost if they do
              not line up perfectly with the cards on an unusual viewport — and
              they are hidden below `lg`, where the three columns stack and a
              horizontal connector would have nowhere to go.
            */}
            <svg
              aria-hidden="true"
              viewBox="0 0 1200 420"
              preserveAspectRatio="none"
              className="ltc-lines pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
            >
              {/* Learners converging into the node. */}
              {[70, 150, 230, 310, 390].map((y) => (
                <path
                  key={`in-${y}`}
                  className="ltc-flow"
                  d={`M330 ${y} C 460 ${y}, 500 210, 590 210`}
                  fill="none"
                  stroke="var(--color-brand-200)"
                  strokeWidth="1.5"
                  strokeDasharray="5 7"
                />
              ))}
              {/* The node fanning out to the tutors. */}
              {[120, 210, 300].map((y) => (
                <path
                  key={`out-${y}`}
                  className="ltc-flow"
                  d={`M610 210 C 700 210, 740 ${y}, 870 ${y}`}
                  fill="none"
                  stroke="var(--color-brand-100)"
                  strokeWidth="1.5"
                  strokeDasharray="5 7"
                />
              ))}
              <circle cx="600" cy="210" r="7" fill="var(--color-accent-500)" />
            </svg>

            <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-16">
              {/* Learners */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-500">
                  Learners arrive with
                </h3>
                <ul className="mt-5 space-y-2.5">
                  {LEARNER_GOALS.map((goal) => (
                    <li
                      key={goal.title}
                      className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-[18px] w-[18px]"
                        >
                          {GOAL_ICONS[goal.icon]}
                        </svg>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink-900">{goal.title}</span>
                        <span className="block text-[0.8rem] text-ink-500">{goal.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* The bridge */}
              <div className="flex items-center gap-4 lg:flex-col lg:gap-3">
                <span
                  aria-hidden="true"
                  className="hidden h-px flex-1 bg-gradient-to-r from-transparent to-brand-200 lg:block"
                />
                <span className="flex shrink-0 items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4 shadow-[0_10px_30px_-24px_rgba(15,120,196,0.6)]">
                  <Logo size="md" withWordmark={false} />
                  <span className="text-left lg:text-center">
                    <span className="block text-sm font-semibold text-brand-900">
                      Tedor Tutors
                    </span>
                    <span className="block text-[0.78rem] text-brand-700">
                      Matches goal to tutor
                    </span>
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="hidden h-px flex-1 bg-gradient-to-l from-transparent to-brand-100 lg:block"
                />
              </div>

              {/* Tutors */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-500">
                  Tutors bring
                </h3>
                <ul className="mt-5 space-y-2.5">
                  {pips.map((tutor) => (
                    <li key={tutor.id}>
                      <TutorPip tutor={tutor} />
                    </li>
                  ))}
                </ul>

                {usingDemo ? (
                  <p className="mt-4 rounded-xl border border-dashed border-ink-300 bg-ink-50 px-4 py-3 text-[0.82rem] leading-relaxed text-ink-600">
                    No approved tutor profiles are published yet, so these are sample entries.
                    A profile appears here only after our team reviews it.{' '}
                    <Link to="/tutors" className="font-medium text-brand-700 underline underline-offset-2">
                      Browse the directory
                    </Link>
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </Container>
    </section>
  )
}
