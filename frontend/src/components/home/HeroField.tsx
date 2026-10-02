import { cn } from '@/lib/cn'

import './HeroField.css'

/**
 * The empty half of the hero, drawn on.
 *
 * The hero's left half is type and the search card, its right half is three
 * photographs, and between and around them is a great deal of navy doing
 * nothing. This fills that air with the subject matter of the marketplace at
 * hairline weight: a small graph of nodes, a DNA helix, a code fragment,
 * compass-and-triangle geometry and a circuit trace. Five marks, each smaller
 * than a thumbnail, none of them a picture of anything.
 *
 * THE RULES THIS LAYER KEEPS, IN ORDER OF IMPORTANCE.
 *
 *   1. Nothing here may compete with the three things the visitor came for: the
 *      headline, the photographs and the search card. So the layer sits at
 *      `z-index: -1` — behind the content rather than over it, the same trick
 *      `.tt-grid` and `.tt-fade` use — and every mark is placed in air the
 *      composition deliberately leaves: the channel between the two columns, the
 *      strip to the right of the photographs, the band under the top edge.
 *   2. Low contrast. `brand-200` at roughly a sixth of full strength, against a
 *      surface the brand's own blueprint grid is already drawing at 9%. The
 *      effect is meant to be noticed on the second look, not the first.
 *   3. Slow. The longest loop here is two and a half minutes. Nothing pulses
 *      faster than a breath, because a field of fast marks is a screensaver and
 *      this is a page someone is reading.
 *   4. No arrows, no cards, no illustration, no label, and nothing that states a
 *      fact. These are the marks a learning and technology marketplace is
 *      *about*, never a claim about the marketplace — see the same constraint
 *      `HeroAccent` and the photograph labels work under.
 *
 * WHERE THE MOTION COMES FROM. Three independent layers, so no two marks ever
 * move as a group: an idle drift loop per mark (`.hf-float`), a movement inside
 * the marks themselves — a trace that travels, a triangle that turns, a node
 * that breathes — and a scroll-linked parallax on the whole field, which is what
 * gives the marks depth rather than letting them read as wallpaper. The
 * parallax is scroll-driven CSS behind `@supports`, so it needs no JavaScript
 * and no observer: where it is unsupported the field simply drifts in place.
 *
 * Phone screens get two of the five marks, in the band above the headline. The
 * stacked layout has no channel and no side gutters, so anything more would be
 * sitting on the copy — which is the one thing this layer must never do.
 *
 * Purely decorative: `aria-hidden` on the wrapper hides all of it from
 * assistive technology in one place, and `pointer-events: none` in the
 * stylesheet keeps it from swallowing a hover meant for a photograph.
 */
export function HeroField({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('hf', className)}>
      {/* A small graph: the marketplace, drawn as a handful of connected points. */}
      <span className="hf-float hf-float--nodes">
        <svg
          className="hf-mark hf-mark--nodes"
          viewBox="0 0 160 96"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        >
          <path d="M10 74 52 52 96 66 140 30" />
          <path d="m96 66 22 22" />
          <circle className="hf-breathe" cx="96" cy="66" r="8" />
          <circle cx="10" cy="74" r="2.2" fill="currentColor" stroke="none" />
          <circle cx="52" cy="52" r="2.8" fill="currentColor" stroke="none" />
          <circle cx="96" cy="66" r="3.2" fill="currentColor" stroke="none" />
          <circle cx="140" cy="30" r="2.2" fill="currentColor" stroke="none" />
          <circle cx="118" cy="88" r="1.8" fill="currentColor" stroke="none" />
        </svg>
      </span>

      {/* The helix. One full turn every half of its own height, rungs at hairline. */}
      <span className="hf-float hf-float--dna">
        <svg
          className="hf-mark hf-mark--dna"
          viewBox="0 0 40 80"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        >
          <g strokeWidth="0.8" opacity="0.7">
            <path d="M13.6 5h12.8M13.6 15h12.8M13.6 25h12.8M13.6 35h12.8" />
            <path d="M13.6 45h12.8M13.6 55h12.8M13.6 65h12.8M13.6 75h12.8" />
          </g>
          <path d="M20 0 25.3 4 28.6 8 28.6 12 25.3 16 20 20 14.7 24 11.4 28 11.4 32 14.7 36 20 40" />
          <path d="M20 40 25.3 44 28.6 48 28.6 52 25.3 56 20 60 14.7 64 11.4 68 11.4 72 14.7 76 20 80" />
        </svg>
      </span>

      {/* A closing tag and a cursor. The only literal code on the site. */}
      <span className="hf-float hf-float--code">
        <svg
          className="hf-mark hf-mark--code"
          viewBox="0 0 64 40"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m23 10-10 10 10 10M45 10l10 10-10 10" />
          <path d="m37 6-6 28" />
          <rect className="hf-caret" x="3" y="13" width="1.8" height="14" fill="currentColor" stroke="none" />
        </svg>
      </span>

      {/* Circle, inscribed triangle, right angle, centre: geometry, not a chart. */}
      <span className="hf-float hf-float--math">
        <svg
          className="hf-mark hf-mark--math"
          viewBox="0 0 80 80"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="40" cy="40" r="30" />
          <path d="M40 10 14 55h52Z" />
          <path d="M22 55v-8h-8" />
          <circle cx="40" cy="40" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      </span>

      {/* One right-angled trace with two pads and a branch, and light running along it. */}
      <span className="hf-float hf-float--circuit">
        <svg
          className="hf-mark hf-mark--circuit"
          viewBox="0 0 120 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path className="hf-trace" d="M4 44h32V20h48v24h32" />
          <path d="M60 44V34" opacity="0.7" />
          <circle cx="4" cy="44" r="3.2" />
          <circle cx="116" cy="44" r="3.2" />
          <circle className="hf-breathe" cx="60" cy="32" r="6" />
          <circle cx="60" cy="32" r="2" fill="currentColor" stroke="none" />
        </svg>
      </span>
    </div>
  )
}
