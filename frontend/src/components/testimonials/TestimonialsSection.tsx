import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Container } from '@/components/layout/PageShell'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'
import { splitIntoRows, TESTIMONIALS } from './testimonialData'
import type { Testimonial } from './testimonialData'
import { TestimonialRow } from './TestimonialRow'

/**
 * Learner experiences, as a two-row stream.
 *
 * WHY THIS IS SHAPED LIKE A MARKETPLACE STREAM
 * -------------------------------------------
 * Three cards in a grid read as three quotes, and "three" is a small number. Two
 * rows travelling in opposite directions read as a catalogue that keeps going,
 * which is the honest impression for a platform whose learner base is still
 * growing — and it gets there without inventing a single count. The scale is
 * communicated by the reader seeing more cards than fit on screen, not by a
 * figure we would be making up. See Requirement 14.1.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * -----------------------------
 * No review total, no average score, no "trusted by students worldwide", no
 * testimonial carousel with a count. Everything above the fold about the size of
 * this platform comes from StatsSection, which counts real database records.
 *
 * There is also no line about learners being spread across the world, even
 * though the demo data is deliberately international. InternationalSection says
 * it two sections later, and claiming it twice would only give the weaker
 * statement the chance to be believed. The mix of subjects, levels and delivery
 * modes in the stream does that work by being visible rather than asserted.
 *
 * TO GO LIVE
 * ----------
 * `TESTIMONIALS` becomes the result of `GET /api/testimonials` (see
 * testimonialData.ts). Nothing in this file changes: the row, the card and the
 * trust line are all already shaped for real records, and the demo array is
 * deleted rather than gradually overwritten.
 *
 * Requirements: 14.1, 14.2, 14.5
 */

export interface TestimonialsSectionProps {
  /**
   * Defaults to the bundled data. Exists so a future API-backed wrapper — and
   * the tests — can render a given list without touching the module.
   */
  testimonials?: readonly Testimonial[]
}

export function TestimonialsSection({ testimonials = TESTIMONIALS }: TestimonialsSectionProps) {
  // A single step counter drives both rows, so one pair of buttons advances the
  // whole stream rather than one row of it.
  const [step, setStep] = useState(0)
  const reducedMotion = usePrefersReducedMotion()

  if (testimonials.length === 0) return null

  const [firstRow, secondRow] = splitIntoRows(testimonials)

  return (
    <section className="section-y bg-ink-50" aria-labelledby="testimonials-heading">
      <Container>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <div className="max-w-2xl">
            <h2
              id="testimonials-heading"
              className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl"
            >
              Real learning. Real progress.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-600">
              Stories from learners and families who found support through Tedor.
            </p>
          </div>

          {/*
            Step controls for the stream.

            Hidden under reduced motion, and that is the only reason this
            component reads the preference from JavaScript: with the rows laid
            out as a static grid every card is already on the page, so a
            "scroll to the next one" button would have nothing to do and would
            be a control that lies about the state of the section.

            They are a convenience, not the only way through: the stream runs on
            its own, and the testimonials are in the DOM in reading order for
            anyone who never touches a button.
          */}
          {reducedMotion ? null : (
            <div className="flex shrink-0 gap-2.5 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setStep((value) => value - 1)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
              >
                <span className="sr-only">Previous testimonials</span>
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12.5 4.5 7 10l5.5 5.5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setStep((value) => value + 1)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
              >
                <span className="sr-only">Next testimonials</span>
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M7.5 4.5 13 10l-5.5 5.5" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </Container>

      {/*
        Full-bleed rather than inside the Container: a stream clipped at the
        container gutter looks like it ran out of cards. `.tw-row` clips its own
        overflow, so nothing here widens the page — the body's scroll width is
        untouched.
      */}
      <div className="mt-10 space-y-2 sm:mt-12 sm:space-y-3">
        <TestimonialRow testimonials={firstRow} step={step} />
        <TestimonialRow testimonials={secondRow} step={step} reverse />
      </div>

      <Container>
        <p className="mt-12 flex items-start justify-center gap-2.5 text-center text-[0.95rem] font-medium text-ink-600 sm:mt-14">
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 shrink-0 text-brand-600"
          >
            <path d="M4.5 10.5l3.5 3.5 7.5-8" />
          </svg>
          <span className="max-w-2xl text-left sm:text-center">
            Every tutor profile is reviewed before it appears publicly on Tedor Tutors.
          </span>
        </p>

        {/*
          A restrained close to the section, not a second full-width CTA panel:
          CTASection already does that job at the foot of the page. Two large
          competing panels a few scrolls apart would read as one, and the
          page-level one is the stronger of the two. This is the pair of doors
          repeated locally — find a tutor, or become one — for a visitor who is
          convinced by the stream and has not reached the end of the page.
        */}
        <div className="mt-14 flex flex-col items-center text-center">
          <h3 className="text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
            Ready to start learning?
          </h3>
          <p className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-ink-600">
            Tell us what you want to learn and we&apos;ll help you take the next step.
          </p>

          <div className="mt-7 flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
            <Link
              to="/tutors"
              className="group inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3.5 text-base font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              Find a Tutor
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

            <Link
              to="/become-a-tutor"
              className="text-base font-medium text-brand-700 underline-offset-4 transition-colors hover:text-brand-800 hover:underline"
            >
              Become a Tutor
            </Link>
          </div>
        </div>
      </Container>
    </section>
  )
}
