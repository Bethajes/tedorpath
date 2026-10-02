import type { ReactNode } from 'react'

import { Reveal } from '@/components/ui/Reveal'
import { cn } from '@/lib/cn'

import '../brand/surfaces.css'

/**
 * The heading block every section on the site opens with.
 *
 * One component rather than the same seven Tailwind classes written out in ten
 * places: the eyebrow, the h2 and the lede are what make the pages read as one
 * document, and duplicating the classes is how two sections end up two pixels
 * apart. The lede is capped at `max-w-2xl` for the same reason — a
 * 70-character measure is comfortable, a full-width one is not.
 *
 * `tone="onDark"` swaps to the light palette for sections sitting on the navy
 * surface. `align="center"` is for the sections that are genuinely symmetrical,
 * not for making things look different.
 *
 * The reveal lives here so no section can forget it, and so the whole block
 * arrives as one movement rather than a heading fading in on its own.
 */
export interface SectionHeadingProps {
  /** Small label above the heading: the section's subject in three or four words. */
  eyebrow: string
  /** The visible heading. Pass the element itself, so keep it an h2. */
  children: ReactNode
  /** Supporting sentence. Omit for a section that needs no explanation. */
  lede?: ReactNode
  /** `id` for the heading — the section's `aria-labelledby` target. */
  id: string
  tone?: 'light' | 'onDark'
  align?: 'start' | 'center'
  className?: string
}

const TONES = {
  light: {
    eyebrow: 'text-brand-700',
    heading: 'text-ink-900',
    lede: 'text-ink-600',
  },
  onDark: {
    eyebrow: 'text-brand-300',
    heading: 'text-white',
    lede: 'text-ink-300',
  },
} as const

export function SectionHeading({
  eyebrow,
  children,
  lede,
  id,
  tone = 'light',
  align = 'start',
  className,
}: SectionHeadingProps) {
  const colors = TONES[tone]

  return (
    <Reveal className={cn(align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl', className)}>
      <p className={cn('text-sm font-semibold uppercase tracking-[0.14em]', colors.eyebrow)}>
        {eyebrow}
      </p>
      <h2
        id={id}
        className={cn('mt-3 text-3xl font-bold tracking-[-0.025em] sm:text-4xl', colors.heading)}
      >
        {children}
      </h2>
      {lede ? <p className={cn('mt-4 text-lg leading-relaxed', colors.lede)}>{lede}</p> : null}
    </Reveal>
  )
}

/**
 * The seam between two sections: two hairlines and a tilted square between
 * them, in the middle of the container.
 *
 * It exists because an unadorned boundary between a navy panel and a white one
 * is a hard horizontal cut, and a hairline is the cheapest way to make that cut
 * read as a decision. Decorative, so it is hidden from assistive technology.
 */
export function SectionDivider({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('mb-12 flex items-center gap-4 sm:mb-16', className)}>
      <span className="tt-rule flex-1" />
      <span className="tt-rule-mark" />
      <span className="tt-rule flex-1" />
    </div>
  )
}
