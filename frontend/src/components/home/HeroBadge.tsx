import { cn } from '@/lib/cn'

/**
 * A small contextual label for the hero composition: subject areas and teaching
 * modes, the things a visitor might actually arrive looking for.
 *
 * Deliberately not interactive. These are captions on a picture, not filters —
 * giving them button affordances would promise a behaviour the hero does not
 * have. Rendered as a `<span>` with a plain-text label so assistive technology
 * reads it as content and not as an unnamed control.
 */

export type HeroBadgeTone = 'brand' | 'accent'

export interface HeroBadgeProps {
  children: string
  /** Orange marks movement and opportunity; blue marks learning and trust. */
  tone?: HeroBadgeTone
  className?: string
}

export function HeroBadge({ children, tone = 'brand', className }: HeroBadgeProps) {
  return (
    <span className={cn('hv-badge', `hv-badge--${tone}`, className)}>
      <span aria-hidden="true" className={cn('hv-badge-dot', `hv-badge-dot--${tone}`)} />
      {children}
    </span>
  )
}
