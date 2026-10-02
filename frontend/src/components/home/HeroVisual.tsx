import { cn } from '@/lib/cn'

import { HeroAccent } from './HeroAccent'
import { HeroPhotoCard } from './HeroPhotoCard'
import { heroPhoto } from './heroPhotos'

import './HeroVisual.css'

/**
 * The hero's right-hand visual: three people, and nothing else.
 *
 * The pictures are the argument. A learner at a desk, the tutor who meets them,
 * the lesson itself happening between the two — told in three photographs rather
 * than in a diagram, because the marketplace sells a human connection and a
 * drawn learning path sells an abstraction.
 *
 * The composition is a layered stack, not a row. The learner is the largest
 * frame; the tutor hangs across its right edge; the lesson slides underneath its
 * lower edge, partly hidden. Those two overlaps are what make it read as one
 * picture rather than as three cards that happen to be near each other, and they
 * come from stacking order and one negative margin — never from absolutely
 * positioned boxes — so the whole arrangement scales as a single unit and cannot
 * leave its container at any width.
 *
 * WHAT IS NOT HERE. No diagram, no arrow, no chart, no floating icon, no panel
 * behind the pictures, and no card that is not a photograph. The only decoration
 * is `HeroAccent`: one soft brand glow behind the stack and two small marks in
 * the air the composition leaves empty. Geometry that competes with a face is
 * decoration for its own sake, and so is a fourth label — each frame carries its
 * own caption and nothing else says anything.
 *
 * NOTHING HERE STATES A FACT. No names, counts, ratings, universities or
 * achievements: the labels name subject areas and teaching modes only. See
 * `heroPhotos.ts`.
 */

export interface HeroVisualProps {
  className?: string
}

export function HeroVisual({ className }: HeroVisualProps) {
  return (
    <div className={cn('hv', className)}>
      <HeroAccent />

      {/* The subject. Largest frame, and the one that loads eagerly. */}
      <HeroPhotoCard photo={heroPhoto('learner')} />

      {/* Hangs across the subject's right edge. */}
      <HeroPhotoCard photo={heroPhoto('tutor')} />

      {/* Slid underneath, tucked below the subject's lower edge. */}
      <HeroPhotoCard photo={heroPhoto('study')} />
    </div>
  )
}
