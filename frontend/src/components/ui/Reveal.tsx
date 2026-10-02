import type { CSSProperties, ReactNode } from 'react'

import { useInView } from '@/lib/useInView'
import { cn } from '@/lib/cn'

/**
 * Fades and lifts its children into place the first time they are scrolled to.
 *
 * The hidden state lives in the `.reveal` class in `index.css` and the visible
 * state is `data-revealed`, so the transition is pure CSS and applies to
 * whatever element this renders. Only `opacity` and the standalone `translate`
 * property are animated: `translate` rather than `transform` specifically so it
 * composes with a hover lift or a rotation on the same element instead of
 * replacing it.
 *
 * Staggering is `delay` in milliseconds, which is what makes a row of cards
 * arrive as one movement rather than all at once. Keep it well inside the
 * transition duration (~700ms) — a longer gap reads as lag, not as polish.
 */
export type RevealTag = 'div' | 'section' | 'li' | 'p' | 'span'

export interface RevealProps {
  children: ReactNode
  /** Milliseconds to wait before the transition starts. */
  delay?: number
  /** Element to render as. Defaults to a `div`. */
  as?: RevealTag
  className?: string
}

export function Reveal({ children, delay = 0, as = 'div', className }: RevealProps) {
  const { ref, inView } = useInView()
  const Tag = as

  return (
    <Tag
      ref={ref}
      data-revealed={inView ? 'true' : 'false'}
      className={cn('reveal', className)}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  )
}
