import { cn } from '@/lib/cn'

/**
 * The Tedor geometry that sits behind the people.
 *
 * Two shapes — a clipped wedge and one orange bar — placed in the air the
 * composition deliberately leaves rather than in a pattern. They are what stops
 * the right-hand column from reading as three photographs in a column, but they
 * are set at low contrast on purpose: the geometry is meant to support the
 * photography, and at any more presence it would start competing with the
 * learning-path graphic, which is the thing the eye should reach after the
 * faces. A third shape — the tilted outline — belongs in the gap between the
 * two people, so `HeroVisual` lays that one out as a flex item instead.
 *
 * Purely decorative. `aria-hidden` on the wrapper hides them all from
 * assistive technology in one place, and `pointer-events: none` in the
 * stylesheet keeps them from swallowing a hover meant for a frame.
 */
export function HeroAccent({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('hv-accents', className)}>
      <span className="hv-accent hv-accent--wedge" />
      <span className="hv-accent hv-accent--bar" />
    </div>
  )
}
