import { Link } from 'react-router-dom'

import { Container } from '@/components/layout/PageShell'
import { Reveal } from '@/components/ui/Reveal'

import { ArrowRightIcon, CheckIcon } from './HowItWorksIcons'
import { HERO_TRUST_POINTS } from './howItWorksContent'

import './HowItWorks.css'

/**
 * The last thing on the page: two doors, and nothing else.
 *
 * Set as an inset panel on white rather than as a full-bleed navy band, so the
 * page ends on the brand's darkest colour with the footer's own dark chrome
 * directly beneath it — one continuous navy edge instead of a band that stops
 * and restarts.
 *
 * The three lines under the buttons are the same honest claims as the hero's.
 * No count, no rating, no promise about results: at the moment someone decides
 * whether to trust the page, invented precision is the one thing that loses
 * them.
 */
export function HowItWorksCta() {
  return (
    <section aria-labelledby="hiw-cta-heading" className="bg-white pb-16 sm:pb-20 lg:pb-24">
      <Container>
        <Reveal className="relative isolate overflow-hidden rounded-3xl bg-brand-800 px-6 py-14 sm:px-12 sm:py-16 lg:px-16">
          {/*
            Restrained brand texture: one soft wash and the growth arc, which
            repeats the hero's rising line so the page's opening and closing
            gestures are the same shape. Decorative, behind the copy, and faded
            out towards the left so nothing crosses a line of text.
          */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_130%_at_85%_0%,#0d4f80_0%,#0b5f9f_45%,#104269_100%)]"
          />
          <svg
            aria-hidden="true"
            viewBox="0 0 420 260"
            preserveAspectRatio="xMaxYMax meet"
            className="pointer-events-none absolute -right-6 -bottom-2 -z-10 h-auto w-[58%] opacity-50 sm:right-4 sm:w-[46%]"
          >
            <path
              className="tt-arc"
              d="M40 250C120 226 180 176 250 108"
              fill="none"
              stroke="#8acdf7"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path d="M282 76 218 122l28 8 20 28Z" fill="#f5801f" />
            <circle cx="40" cy="250" r="8" fill="#8acdf7" />
          </svg>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-brand-800 via-brand-800/80 to-transparent"
          />

          <div className="relative max-w-2xl">
            <h2
              id="hiw-cta-heading"
              className="text-3xl font-bold tracking-[-0.025em] text-white sm:text-4xl"
            >
              Ready to find your tutor?
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-brand-100">
              Send the request in about two minutes. A person reads it, and you will hear back
              about the next step.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/request-tutor"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-accent-500 px-7 py-3.5 text-base font-semibold text-white transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-accent-400 hover:shadow-[0_16px_32px_-16px_rgba(245,128,31,0.95)]"
              >
                Request a tutor
                <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center justify-center rounded-xl border border-brand-500/60 px-7 py-3.5 text-base font-semibold text-white transition-[background-color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-white hover:bg-white/10"
              >
                About Tedor Tutors
              </Link>
            </div>

            <ul className="mt-9 grid gap-2.5">
              {HERO_TRUST_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-brand-200">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
