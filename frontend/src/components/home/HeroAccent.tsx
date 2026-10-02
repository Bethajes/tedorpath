import { cn } from '@/lib/cn'

/**
 * The Tedor geometry behind the people.
 *
 * Three marks, all of them in the background and none of them worth looking at
 * directly: a soft brand wash that gives the stack some light to sit in, the
 * mark's own tilted outline, and one orange bar. Together they stop the
 * right-hand column from reading as three rectangles floating on a flat navy
 * surface — but they sit behind the photographs and at low contrast on purpose,
 * because the moment geometry competes with a face it becomes decoration for its
 * own sake.
 *
 * Each is placed in air the composition deliberately leaves rather than in a
 * pattern: the wash fills the stack, the outline sits above its top-left corner,
 * the bar in the gap at its lower left.
 *
 * Purely decorative. `aria-hidden` on the wrapper hides them from assistive
 * technology in one place, and `pointer-events: none` in the stylesheet keeps
 * them from swallowing a hover meant for a photograph.
 */
export function HeroAccent({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('hv-accents', className)}>
      <span className="hv-accent hv-accent--glow" />
      <span className="hv-accent hv-accent--square" />
      <span className="hv-accent hv-accent--bar" />
    </div>
  )
}
