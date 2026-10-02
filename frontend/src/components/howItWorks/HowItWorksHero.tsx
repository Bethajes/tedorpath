import { Link } from 'react-router-dom'

import { heroPhoto, heroPhotoSrc } from '@/components/home/heroPhotos'
import { Container } from '@/components/layout/PageShell'
import { Reveal } from '@/components/ui/Reveal'

import { ArrowRightIcon, CheckIcon } from './HowItWorksIcons'
import { HERO_TRUST_POINTS } from './howItWorksContent'

import './HowItWorks.css'

/**
 * The opening of /how-it-works: the promise, the two ways in, and the people
 * the promise is about.
 *
 * The right-hand column is a composition rather than a single photograph — a
 * learner, the tutor who meets them, and a small card showing the request being
 * read by a person. It reuses the same photographs, alt text and crops as the
 * homepage hero (`components/home/heroPhotos.ts`) rather than loading a second
 * set of near-identical images: the people on this page are the people on the
 * homepage, and the crop that works in one composition works here.
 *
 * The orange dart on the rising line is the logo's own gesture, and it points
 * down the page: the hero is the top of an argument, not a poster.
 */
export function HowItWorksHero() {
  const learner = heroPhoto('learner')
  const tutor = heroPhoto('tutor')

  return (
    <section className="tt-hero">
      {/* Blueprint grid, behind everything and clipped to the top of the panel. */}
      <div aria-hidden="true" className="tt-grid" />

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

      {/* The handoff to the white section below. */}
      <div aria-hidden="true" className="tt-fade" />

      {/*
        The larger bottom padding is not decoration: it reserves the room
        `.tt-fade` dissolves into, so the hand-off into the white section below
        never washes out the trust points.
      */}
      <Container className="relative grid items-center gap-14 pb-24 pt-14 sm:pb-32 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-36 lg:pt-24">
        <div>
          <Reveal>
            <p className="inline-flex items-center gap-2.5 rounded-full border border-ink-700 bg-ink-900/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-200 backdrop-blur">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-500" />
              How it works
            </p>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-6 text-[2.6rem] font-bold leading-[1.06] tracking-[-0.035em] text-white sm:text-6xl lg:text-[4.1rem]">
              Finding a tutor is{' '}
              <span className="bg-gradient-to-r from-brand-300 via-brand-400 to-accent-300 bg-clip-text text-transparent">
                simple &amp; fast
              </span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-300">
              Tedor Tutors takes the guesswork out of finding expert help. Three steps and you
              are learning — no long searches, no cold emails, no wasted time.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/request-tutor"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-accent-500 px-7 py-3.5 text-base font-semibold text-white shadow-[0_14px_30px_-14px_rgba(245,128,31,0.9)] transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:bg-accent-400 hover:shadow-[0_18px_36px_-14px_rgba(245,128,31,0.95)]"
              >
                Get started — it&apos;s free
                <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link
                to="/tutors"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink-700 px-7 py-3.5 text-base font-semibold text-ink-100 transition-[background-color,border-color,color,transform] duration-200 hover:-translate-y-0.5 hover:border-brand-600 hover:bg-ink-800 hover:text-white"
              >
                Browse tutors
              </Link>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <ul className="mt-9 grid gap-3 sm:grid-cols-1">
              {HERO_TRUST_POINTS.map((point) => (
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

        {/*
          The people. Three elements in one grid column — the learner, the tutor
          in a ring, and the request card — overlapped with percentage margins so
          the whole composition rescales as one unit and cannot leave its column
          at any width. See the overlap note in HowItWorks.css.
        */}
        <Reveal delay={200} className="hiw-visual">
          <span aria-hidden="true" className="tt-shape tt-shape--square" />
          <span aria-hidden="true" className="tt-shape tt-shape--bar" />

          <figure className="hiw-visual-main">
            <div className="tt-photo aspect-[4/5]">
              <img
                src={heroPhotoSrc(learner)}
                alt={learner.alt}
                width={400}
                height={500}
                loading="eager"
                decoding="async"
                style={{ objectPosition: learner.objectPosition }}
              />
            </div>
            <figcaption className="tt-chip">
              <span aria-hidden="true" className="tt-chip-dot" />
              {learner.label}
            </figcaption>
          </figure>

          <figure className="hiw-visual-card" aria-hidden="true">
            <div className="hiw-rail">
              <p className="hiw-rail-row">
                <span className="hiw-rail-dot" />
                Request received
              </p>
              <p className="hiw-rail-row">
                <span className="hiw-rail-dot" />
                Read by our team
              </p>
              <p className="hiw-rail-row hiw-rail-row--current">
                <span className="hiw-rail-dot" />
                Tutor proposed
              </p>
            </div>
          </figure>

          <figure className="hiw-visual-badge">
            <div className="tt-photo tt-photo--round aspect-square">
              <img
                src={heroPhotoSrc(tutor)}
                alt={tutor.alt}
                width={400}
                height={500}
                loading="lazy"
                decoding="async"
                style={{ objectPosition: tutor.objectPosition }}
              />
            </div>
          </figure>
        </Reveal>
      </Container>
    </section>
  )
}
