import { useRef } from 'react'
import { Link } from 'react-router-dom'

import { Container } from '@/components/layout/PageShell'
import { HeroVisual } from './HeroVisual'
import { TutorSearchCard } from './TutorSearchCard'

/**
 * Factual, checkable reasons to start here — deliberately no numbers.
 *
 * Nothing here is a statistic. The strip below the hero carries the real counts
 * from the API, and a trust point that quietly implied a scale claim would
 * undercut it. Requirement 2.8.
 */
const TRUST_POINTS = [
  'Reviewed by our team, not an algorithm',
  'Online or in person, wherever you are',
  'School, university, professional skills and exam preparation',
]

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null)

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-gradient-to-b from-brand-50/70 via-white to-white">
      <Container className="grid items-center gap-12 py-14 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-brand-700 ring-1 ring-brand-200">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-500" />
            International Tutoring Marketplace
          </p>

          <h1 className="mt-5 text-[2.5rem] font-bold leading-[1.08] tracking-[-0.03em] text-ink-900 sm:text-[3.25rem] lg:text-[3.5rem]">
            Find the right tutor.
            <br />
            Move toward your goals.
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600">
            Connect with carefully reviewed tutors across mathematics, science, languages,
            technology, university courses, and more — online or in person.
          </p>

          {/*
            The search card IS the primary call to action, not a widget sitting
            below one. Its submit button is labelled "Find a Tutor" and it
            navigates to the directory with the chosen filters as query
            parameters, which is the behaviour Requirements 2.3 and 2.5 fix.
            Adding a second, separate "Find a Tutor" button above it would have
            meant two routes to the same place, only one of which carried the
            visitor's answers.
          */}
          <div className="mt-8 max-w-xl">
            <TutorSearchCard />
          </div>

          <p className="mt-5 text-[0.95rem] text-ink-600">
            Teaching something? Applications are reviewed before a profile goes live.
          </p>
          <div className="mt-3">
            <Link
              to="/become-a-tutor"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-300 bg-white px-5 py-3 text-[0.95rem] font-medium text-ink-800 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
            >
              Become a Tutor
            </Link>
          </div>

          <ul className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
            {TRUST_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2 text-sm text-ink-600">
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 shrink-0">
                  <circle cx="9" cy="9" r="9" fill="#eff8fe" />
                  <path d="M5 9.2l2.6 2.6L13 6.5" stroke="#0f78c4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:pl-2">
          {/*
            The right-hand composition: the learning-path graphic, unchanged and
            still the subject, arranged with the human frames around it.
            `HeroVisual` passes the section ref straight through, so the parallax
            still reads the pointer anywhere in the hero — as does all of the
            animation and reduced-motion handling inside the graphic itself
            (Requirements 2.6, 2.9).
          */}
          <HeroVisual parallaxHost={sectionRef} />
        </div>
      </Container>
    </section>
  )
}
