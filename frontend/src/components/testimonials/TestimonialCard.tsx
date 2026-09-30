import { useState } from 'react'

import { cn } from '@/lib/cn'
import type { Testimonial } from './testimonialData'

/**
 * One learner experience, shaped like a marketplace review.
 *
 * TRUST RULES ENFORCED HERE. This card is where invented social proof would
 * otherwise enter the site, so three things are refused at render time rather
 * than trusted to the data file:
 *
 *   1. No demo entry can be badged "Verified". A "Verified learner" chip is a
 *      claim that a real person stands behind the words, and no placeholder
 *      does. `isVerified && !isDemo` decides the badge, so flipping `isVerified`
 *      by accident in the data file does not put the chip on screen.
 *   2. No rating is invented. Stars render only when `rating` is present and
 *      usable; there is no default, no floor of "at least one star", and no
 *      aggregate score. Demo entries may carry a rating because they are
 *      labelled "Sample" in the same breath; real entries must wait for the API.
 *   3. No count. Not "1 of 5", not a review total, not an average. The section's
 *      sense of scale comes from the number of cards the reader can see.
 *
 * The badge text is also deliberately not a claim about screening: "Verified
 * learner" says the review is real and held by the platform. It must never read
 * as "background checked" or "university verified" — see VerificationSteps for
 * what review actually covers.
 *
 * Markup is a <figure>/<blockquote>/<figcaption> so the quote is announced as a
 * quotation. The rows render this card twice over for a seamless loop, and the
 * second copy is `aria-hidden` by the row rather than by this component.
 */

const STAR_PATH =
  'M10 1.9l2.47 5.2 5.53.77-4 4 .96 5.63L10 14.9l-4.96 2.6.96-5.63-4-4 5.53-.77z'

/**
 * Card surface tints.
 *
 * Three near-white values on a 3-step cycle: mostly white, a cool brand-50, and
 * a warm accent-50. Orange appears on roughly one card in three and only as a
 * background wash or a quote mark — the accent is a highlight in this design
 * system, not a surface colour, and tinting every card would spend it.
 */
const TONE_CLASSES = {
  plain: 'bg-white',
  cool: 'bg-brand-50/70',
  warm: 'bg-accent-50/70',
} as const

const QUOTE_MARK_CLASSES = {
  plain: 'text-ink-200',
  cool: 'text-brand-200',
  warm: 'text-accent-300',
} as const

type Tone = keyof typeof TONE_CLASSES

/**
 * Up to two initials for the avatar fallback.
 *
 * Returns '' for a name with no letters at all, in which case the caller renders
 * a person glyph instead of an empty circle — the same pattern as TutorCard's
 * avatar.
 */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''

  const first = words[0][0] ?? ''
  const last = words.length > 1 ? (words[words.length - 1][0] ?? '') : ''
  return (first + last).toUpperCase()
}

function Avatar({ testimonial }: { testimonial: Testimonial }) {
  const [broken, setBroken] = useState(false)
  const initials = initialsOf(testimonial.name)
  const photo = testimonial.avatar

  if (photo && !broken) {
    return (
      <img
        src={photo}
        // The name is already the adjacent text, so repeating it here would be
        // read twice. A blank alt keeps the image out of the reading order.
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className="h-11 w-11 shrink-0 rounded-full border border-ink-200 bg-white object-cover"
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-white text-sm font-semibold text-brand-700"
    >
      {initials ? (
        initials
      ) : (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="10" cy="6.5" r="3.25" />
          <path d="M3.75 17c.9-3.4 3.2-5.25 6.25-5.25S15.35 13.6 16.25 17" strokeLinecap="round" />
        </svg>
      )}
    </span>
  )
}

/**
 * The star row.
 *
 * Rendered only for a usable `rating`. `fill="currentColor"` is set per star
 * rather than on the row, so a 4.2 rounded rating cannot be drawn as five full
 * stars, and the filled count is the whole number we were actually given.
 * `aria-hidden` because the row is followed by the rating in words, which is
 * what a screen reader should read instead of five identical glyphs.
 */
function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <svg
          key={index}
          width="13"
          height="13"
          viewBox="0 0 20 20"
          fill={index < rating ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
          className={index < rating ? 'text-accent-500' : 'text-ink-200'}
        >
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  )
}

export interface TestimonialCardProps {
  testimonial: Testimonial
  className?: string
  /** Overrides the surface tint. Rows set this so the cycle spans both. */
  tone?: Tone
}

export function TestimonialCard({ testimonial, className, tone = 'plain' }: TestimonialCardProps) {
  // Trust rule 1: demo content is never badged as verified. See the note above.
  const showVerified = testimonial.isVerified && !testimonial.isDemo
  const meta = [testimonial.subject, testimonial.location].filter(Boolean).join(' • ')

  return (
    <figure
      className={cn(
        // Width and height live in testimonials.css, not here: they are part of
        // the stream's layout (they change at breakpoints, and the
        // reduced-motion layout replaces them), and having them in two places
        // would let the two disagree.
        'tw-card flex shrink-0 flex-col rounded-2xl border border-ink-200 p-6',
        'shadow-[0_1px_3px_rgba(18,26,36,0.05)]',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {/* Decorative: a small quote mark. No meaning beyond "this is a quote". */}
      <svg
        aria-hidden="true"
        viewBox="0 0 32 24"
        className={cn('h-4 w-6 shrink-0', QUOTE_MARK_CLASSES[tone])}
        fill="currentColor"
      >
        <path d="M0 24V13.7C0 5.9 4.6 1.2 12.6 0l1.5 3.6c-4.4 1-6.7 3.5-6.8 7.3H14V24H0zm18 0V13.7C18 5.9 22.6 1.2 30.6 0L32 3.6c-4.4 1-6.7 3.5-6.8 7.3H32V24H18z" />
      </svg>

      <blockquote className="mt-4 flex-1">
        <p className="text-[0.95rem] leading-relaxed text-ink-700">{testimonial.quote}</p>
      </blockquote>

      {/* Trust rule 2: no default rating. Absent data renders nothing. */}
      {testimonial.rating ? (
        <p className="mt-5 flex items-center gap-2">
          <Stars rating={testimonial.rating} />
          <span className="text-xs font-medium text-ink-500">
            {testimonial.rating} out of 5
          </span>
        </p>
      ) : null}

      <figcaption className="mt-5 flex items-start gap-3 border-t border-ink-200/70 pt-5">
        <Avatar testimonial={testimonial} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="block truncate text-sm font-semibold text-ink-900">
            {testimonial.name}
          </span>
          <span className="mt-0.5 block text-sm text-ink-500">{meta}</span>

          {/* Only rendered when there is a badge to put in it, so a real
              unverified review does not carry a reserved strip of empty space. */}
          {showVerified || testimonial.isDemo ? (
            <span className="mt-2 flex flex-wrap gap-1.5">
              {showVerified ? (
                <span className="tw-badge inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[0.7rem] font-semibold text-brand-700 ring-1 ring-inset ring-brand-200">
                  <svg
                    aria-hidden="true"
                    width="11"
                    height="11"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 8.5l3.2 3.2L13 5" />
                  </svg>
                  Verified learner
                </span>
              ) : null}

              {testimonial.isDemo ? (
                <span className="tw-badge inline-flex items-center rounded-full bg-ink-100 px-2 py-0.5 text-[0.7rem] font-medium text-ink-600 ring-1 ring-inset ring-ink-200">
                  Sample
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
      </figcaption>
    </figure>
  )
}
