import { Link } from 'react-router-dom'

import { Container } from '@/components/layout/PageShell'
import { Reveal } from '@/components/ui/Reveal'

import { HeroField } from './HeroField'
import { HeroVisual } from './HeroVisual'
import { TutorSearchCard } from './TutorSearchCard'

import '../brand/surfaces.css'

/**
 * The homepage's first screen, and the surface the whole site's identity is
 * read from: deep navy, azure washes, the brand's own rising line finishing in an
 * orange dart, and the people it is all about.
 *
 * It is the same surface /how-it-works opens with — `tt-hero` and its geometry
 * are shared in `brand/surfaces.css` rather than restyled per page — so a visitor
 * who lands on either one sees the same brand rather than two pages that happen
 * to share a logo.
 *
 * The search card IS the primary call to action, not a widget sitting below one.
 * Its submit button is labelled "Find a Tutor" and it navigates to the directory
 * with the chosen filters as query parameters, which is the behaviour
 * Requirements 2.3 and 2.5 fix. Adding a second, separate "Find a Tutor" button
 * above it would have meant two routes to the same place, only one of which
 * carried the visitor's answers.
 *
 * The background is three layers deep, all of them behind the content: the
 * blueprint grid, `HeroField` (the subject matter drawn at hairline weight in the
 * air the composition leaves), and the rising brand line. None of them may
 * compete with the three things this screen is for.
 */
export function Hero() {
  return (
    <section className="tt-hero">
      <div aria-hidden="true" className="tt-grid" />

      {/*
        The subject matter, at hairline weight, in the air the composition leaves:
        nodes, a helix, a code fragment, geometry, a circuit trace. Sits with the
        grid and the brand line behind the content rather than over it, and is
        placed so that nothing crosses the headline, the photographs or the search
        card. See `HeroField.tsx`.
      */}
      <HeroField />

      {/* The rising line, finishing in the brand's orange dart. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 300"
        preserveAspectRatio="xMidYMax meet"
        className="tt-path"
      >
        <path
          className="tt-path-line"
          d="M-20 300C260 300 520 250 780 180 980 128 1130 74 1310 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M1352 8 1326.6 28.5 1319.6 3.5Z" fill="#f5801f" />
      </svg>

      {/* The handoff to the white section underneath. */}
      <div aria-hidden="true" className="tt-fade" />

      {/*
        Top padding is the hero's air; the bottom is larger on purpose — it
        reserves the room `.tt-fade` dissolves into, so the hand-off to the white
        section below never washes out the trust points.
      */}
      <Container className="relative grid items-center gap-14 pb-24 pt-14 sm:pb-32 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-36 lg:pt-20">
        <div>
          <Reveal>
            <p className="inline-flex items-center gap-2.5 rounded-full border border-ink-700 bg-ink-900/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-200 backdrop-blur">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-500" />
              International Tutoring Marketplace
            </p>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-6 text-[2.6rem] font-bold leading-[1.06] tracking-[-0.035em] text-white sm:text-6xl lg:text-[4.1rem]">
              Find the right tutor.
              <br />
              Move toward your{' '}
              <span className="bg-gradient-to-r from-brand-300 via-brand-400 to-accent-300 bg-clip-text text-transparent">
                goals.
              </span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-300">
              Connect with carefully reviewed tutors across mathematics, science, languages,
              technology, university courses, and more — online or in person.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-9 max-w-xl">
              <TutorSearchCard />
            </div>
          </Reveal>

          <Reveal delay={300}>
            <p className="text-[0.95rem] text-ink-300">
              Teaching something? Applications are reviewed before a profile goes live.
            </p>
            <div className="mt-4">
              <Link
                to="/become-a-tutor"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink-700 px-6 py-3 text-[0.95rem] font-semibold text-ink-100 transition-[background-color,border-color,color,transform] duration-200 hover:-translate-y-0.5 hover:border-brand-600 hover:bg-ink-800 hover:text-white"
              >
                Become a Tutor
              </Link>
            </div>
          </Reveal>

          <Reveal delay={360}>
            <ul className="mt-8 grid gap-3">
              {TRUST_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-[0.95rem] text-ink-300">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-300"
                  >
                    <CheckIcon className="h-3 w-3" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <div className="lg:pl-2">
          {/*
            The right-hand composition: three photographs of a learner, a tutor
            and a lesson, layered. The people are the argument on this side of
            the hero — there is no diagram, no panel and no card that is not a
            photograph competing with them (Requirements 2.6, 2.9).
          */}
          <Reveal delay={200}>
            <HeroVisual />
          </Reveal>
        </div>
      </Container>
    </section>
  )
}

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

/** A tick in a filled circle, matching the trust list's weight. */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12.5 9.5 17 19 7" />
    </svg>
  )
}
