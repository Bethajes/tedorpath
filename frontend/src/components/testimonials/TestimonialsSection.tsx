import { useState } from 'react'

import { Container } from '@/components/layout/PageShell'
import { SectionHeading } from '@/components/sections/SectionHeading'
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
 * though the records below genuinely do come from Ethiopia and from four other
 * countries. InternationalSection says it two sections later, and claiming it
 * twice would only give the weaker statement the chance to be believed. The mix
 * of subjects, levels and locations in the stream does that work by being
 * visible rather than asserted.
 *
 * THE SECTION ENDS ON THE STREAM
 * -----------------------------
 * It used to close with the review claim and a local pair of doors — "Ready to
 * start learning?" with Find a Tutor and Become a Tutor. Both are gone.
 * TrustSection — on /about, not here — carries the review claim once, where it
 * has the four other defensible claims around it, and CTASection owns the call
 * to action at the foot of the page: a
 * second one here competed with it a few scrolls apart and the two read as a
 * single panel. The stream is the section's whole job, so it now ends there.
 *
 * TO GO LIVE
 * ----------
 * `TESTIMONIALS` becomes the result of `GET /api/testimonials` (see
 * testimonialData.ts). Nothing in this file changes: the row and the card are
 * already shaped for real records.
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
          <SectionHeading
            id="testimonials-heading"
            eyebrow="Learner stories"
            lede="Stories from learners and families who found support through Tedor."
            className="sm:flex-1"
          >
            Real learning. Real progress.
          </SectionHeading>

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
    </section>
  )
}
