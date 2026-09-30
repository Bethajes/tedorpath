import type { RefObject } from 'react'

import { cn } from '@/lib/cn'

import { HeroAccent } from './HeroAccent'
import { HeroBadge } from './HeroBadge'
import { HeroPhotoCard } from './HeroPhotoCard'
import { TedorLearningGraphic } from './TedorLearningGraphic'
import { heroPhoto } from './heroPhotos'

import './HeroVisual.css'

/**
 * The hero's right-hand visual: people arranged around Tedor's learning path.
 *
 * The learning-path graphic is the subject of this composition, not a card
 * beside it — it keeps its own artwork, its own five milestones and its own
 * orange arrow, and everything else is positioned to look like it belongs to
 * the journey. A learner stands at the start end, a tutor meets them partway
 * along, and the lesson itself shows up at the finish. Read as a whole it is
 * the argument the hero makes in three gestures: LEARN → CONNECT → MOVE ON.
 *
 * LAYOUT. A single grid column with four rows — two frames, the path, one more
 * frame — and the overlaps come from `translate` offsets and stacking order
 * rather than from absolutely positioned boxes, so the composition rescales as
 * one unit and cannot leave the container at any width. Two rules do most of
 * the work:
 *
 *   - The learner is lifted clear of the card's top edge, and the tutor hangs
 *     across it. That asymmetry is the composition; without it this is a stack.
 *   - The third frame is behind the card, so it slides under the card's lower
 *     edge and only its top is hidden. The graphic is never covered — the
 *     learning path and its caption stay fully readable at every size.
 *
 * Nothing in here states a fact. No names, counts, ratings, universities or
 * achievements: the frames are placeholders for photographs that do not exist
 * yet, and the labels name subject areas and teaching modes only. See
 * `heroPhotos.ts`.
 */

export interface HeroVisualProps {
  /**
   * Element whose pointer movement drives the parallax. Passed through to the
   * learning-path graphic so the whole hero responds, not just this column.
   */
  parallaxHost?: RefObject<HTMLElement | null>
  className?: string
}

export function HeroVisual({ parallaxHost, className }: HeroVisualProps) {
  return (
    <div className={cn('hv', className)}>
      <HeroAccent />


      {/* People at the start of the journey, staggered so the row is never level. */}
      <div className="hv-pair">
        <HeroPhotoCard photo={heroPhoto('learner')} />
        {/*
          The third shape is a flex item rather than an absolutely positioned
          one, so it sits in whatever gap the two frames leave — which changes
          with the viewport. Positioned by percentage it would drift under one
          of them as soon as the column got narrow.
        */}
        <span aria-hidden="true" className="hv-accent hv-accent--square" />
        <HeroPhotoCard photo={heroPhoto('tutor')} />
      </div>

      {/* The Tedor journey itself, unchanged, and the anchor everything else
          is positioned against. */}
      <div className="hv-path">
        <TedorLearningGraphic parallaxHost={parallaxHost} />
      </div>

      {/* The lesson arriving, tucked in behind the card's lower corner. */}
      <div className="hv-base">
        <HeroPhotoCard photo={heroPhoto('study')} />
      </div>

      {/*
        A fourth label, set in the air the composition leaves on purpose. Named
        for a subject area rather than a person, because naming a person here
        would be a claim nobody has verified.
      */}
      <HeroBadge tone="accent" className="hv-badge--corner">
        Exam preparation
      </HeroBadge>
    </div>
  )
}
