import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Container } from '@/components/layout/PageShell'
import { TutorCard } from '@/features/tutors/components/TutorCard'
import { listTutors } from '@/features/tutors/tutors.api'
import type { TutorCardDTO } from '@/features/tutors/tutors.types'

/**
 * A sample of real, approved tutor profiles.
 *
 * The section has nothing of its own: no curated picks, no hardcoded names, no
 * placeholder cards. Every tutor shown is whatever the public directory
 * returns, so the homepage cannot show a profile the directory would not.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8
 */

/** A full 3x2 desktop grid, one card per column on mobile. Requirement 6.7, 6.8. */
const FEATURED_LIMIT = 6

const EMPTY_STATE_MESSAGE = 'Tutor profiles are being reviewed. Check back soon.'

export function FeaturedTutors() {
  // `undefined` is "still loading", `[]` is "loaded and there is nobody to show".
  // The two are kept apart so the section does not flash the empty state at a
  // visitor whose request has simply not come back yet.
  const [tutors, setTutors] = useState<TutorCardDTO[] | undefined>(undefined)

  useEffect(() => {
    let active = true

    // The server filters to APPROVED profiles itself, so there is no client-side
    // status check to forget to keep in step with the backend.
    listTutors({}, 1, FEATURED_LIMIT)
      .then((result) => {
        if (active) setTutors(result.items)
      })
      .catch(() => {
        // A failed directory request is shown exactly like an empty directory:
        // to a visitor these are the same situation — nobody to show right now.
        if (active) setTutors([])
      })

    return () => {
      active = false
    }
  }, [])

  const hasTutors = tutors !== undefined && tutors.length > 0

  return (
    <section className="section-y bg-white" aria-labelledby="featured-tutors-heading">
      <Container>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <div className="max-w-2xl">
            <h2 id="featured-tutors-heading" className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
              Tutors you can start with
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-600">
              Every profile below belongs to a tutor whose application our team has reviewed and
              approved. Browse the full directory to see the rest.
            </p>
          </div>

          <Link
            to="/tutors"
            className="group inline-flex shrink-0 items-center gap-2 self-start text-base font-medium text-brand-700 transition-colors hover:text-brand-800 sm:self-auto"
          >
            View all tutors
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform duration-150 group-hover:translate-x-0.5"
            >
              <path d="M2 8h11" />
              <path d="M9 4l4 4-4 4" />
            </svg>
          </Link>
        </div>

        {hasTutors ? (
          <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tutors.map((tutor) => (
              <li key={tutor.id} className="h-full">
                {/* The existing directory card, unmodified apart from asking for
                    the compact layout: reusing it is what keeps the homepage and
                    the directory from drifting apart. Three across is what
                    Requirement 6.7 fixes for this section. */}
                <TutorCard tutor={tutor} variant="grid" />
              </li>
            ))}
          </ul>
        ) : tutors !== undefined ? (
          // Requirement 6.5: an honest empty state, shown identically for zero
          // results and for a failed request. No skeleton, no sample card.
          <div className="mt-12 rounded-2xl border border-dashed border-ink-300 bg-white p-10 text-center sm:p-14">
            <p className="text-lg font-medium text-ink-800">{EMPTY_STATE_MESSAGE}</p>
            <p className="mx-auto mt-2 max-w-md text-[0.95rem] leading-relaxed text-ink-600">
              We publish a profile only after a person on our team has reviewed it, so the
              directory fills up as applications are approved.
            </p>
            <Link
              to="/tutors"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-base font-medium text-white transition-colors hover:bg-brand-700"
            >
              Browse all tutors
            </Link>
          </div>
        ) : null}
      </Container>
    </section>
  )
}
