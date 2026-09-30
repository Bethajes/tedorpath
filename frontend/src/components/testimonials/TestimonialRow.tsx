import { useEffect, useRef } from 'react'

import { TestimonialCard } from './TestimonialCard'
import './testimonials.css'
import type { Testimonial } from './testimonialData'

/**
 * One horizontal stream of cards, travelling continuously.
 *
 * The list is rendered twice: once for the reader, and once more, hidden from
 * assistive technology, so the `-50%` translation in `testimonials.css` lands on
 * an identical frame and the loop never shows a join. The duplicate is a real
 * cost — twice the DOM, twice the text for a screen reader to skip past — and it
 * is worth it only because it is the cheapest seamless loop there is: one
 * animated element, no JavaScript, no measurement, no resize observer.
 *
 * `reverse` flips the direction. The section renders one row each way so the
 * pair reads as a stream rather than as one belt that has been cut in half.
 *
 * `step` is the section's shared step counter, and it is what the previous /
 * next buttons drive. Advancing does not reimplement the animation — it nudges
 * the existing CSS one forward by a whole number of card widths, by setting a
 * negative `animation-delay` and restarting it. That is a few lines executed on a
 * click rather than a per-frame loop, so the rule that animation belongs in CSS
 * still holds.
 *
 * Nothing here reads `prefers-reduced-motion` from JavaScript. The media query
 * in the stylesheet removes the animation and re-flows the cards into a static
 * grid, which is both cheaper and correct before hydration — a JS branch would
 * briefly show a moving row to someone who asked for stillness. The caller does
 * check the preference, but only to decide whether the buttons are worth
 * rendering: with every card already laid out in a grid there is nothing for
 * them to scroll to.
 */

/** The three near-white card surfaces, cycled so a long row is not one colour. */
const TONES = ['plain', 'cool', 'warm'] as const

export interface TestimonialRowProps {
  testimonials: readonly Testimonial[]
  /** Travel left, as the first row does. Right, as the second does. */
  reverse?: boolean
  /**
   * How many card-widths the stream has been advanced. Applied as a negative
   * `animation-delay`, so changing it nudges the row and lets it carry on.
   */
  step?: number
}

export function TestimonialRow({
  testimonials,
  reverse = false,
  step = 0,
}: TestimonialRowProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const setRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const track = trackRef.current
    const set = setRef.current
    if (!track || !set || step === 0) return

    const cards = Array.from(set.children) as HTMLElement[]
    if (cards.length < 2) return

    // Measured rather than assumed. The card width is a stylesheet decision that
    // changes at two breakpoints, so anything hard-coded here would drift from
    // what is on screen the first time the breakpoint moved.
    const stepWidth = cards[1].offsetLeft - cards[0].offsetLeft
    const total = set.offsetWidth
    const duration = Number.parseFloat(getComputedStyle(track).animationDuration)
    if (!stepWidth || !total || !Number.isFinite(duration) || duration <= 0) return

    // Wrapped to the number of whole cards in a set, so pressing "next" forty
    // times lands on the same place as pressing it once. Without this the delay
    // would grow without bound and eventually be larger than the animation
    // period, where browsers clamp it and the row silently stops responding.
    const perSet = Math.max(1, Math.round(total / stepWidth))
    const offsetPx = (((step % perSet) + perSet) % perSet) * stepWidth

    // Restart the animation to adopt the new delay: clearing the shorthand
    // drops animation-delay with it, so the delay is written back afterwards.
    // The forced reflow in between is what makes the browser treat it as a new
    // animation rather than a no-op change to the current one.
    track.style.animation = 'none'
    track.style.animationDelay = '0s'
    void track.offsetWidth
    track.style.animation = ''
    track.style.animationDelay = `${-((offsetPx / total) * duration).toFixed(3)}s`
  }, [step])

  if (testimonials.length === 0) return null

  // Keyed per copy: the same testimonial id legitimately appears twice in the
  // DOM, once in each set. `hidden` marks the duplicate as the decorative copy
  // that the stylesheet removes for reduced-motion visitors, so they do not read
  // the whole section twice.
  const set = (copy: string, hidden: boolean) => (
    <ul className="tw-set" aria-hidden={hidden ? 'true' : undefined} ref={hidden ? undefined : setRef}>
      {testimonials.map((testimonial, index) => (
        <li key={`${copy}-${testimonial.id}`}>
          <TestimonialCard
            testimonial={testimonial}
            // Cycling the tint across the whole set is what stops a long row from
            // reading as one colour. Deliberately deterministic rather than
            // random, so a card keeps its surface between renders.
            tone={TONES[index % TONES.length]}
          />
        </li>
      ))}
    </ul>
  )

  return (
    <div className="tw-row" data-reverse={reverse}>
      <div className="tw-track" ref={trackRef}>
        {set('a', false)}
        {/* Purely decorative duplication: the list is already fully exposed by
            the copy above it. */}
        {set('b', true)}
      </div>
    </div>
  )
}
