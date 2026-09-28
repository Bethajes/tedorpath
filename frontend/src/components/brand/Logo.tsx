import { cn } from '@/lib/cn'

/**
 * Path to the Tedor logo artwork.
 *
 * The mark lives in `public/brand/` so it can be swapped for the official
 * artwork file without touching any component — only this constant and the
 * file it points at need to change.
 */
export const LOGO_SRC = '/brand/tedor-mark.svg'

/** Pixel size of the mark for each named size. */
const MARK_SIZE = {
  sm: 28,
  md: 36,
  lg: 48,
  xl: 96,
} as const

export type LogoSize = keyof typeof MARK_SIZE

const MARK_HEIGHT: Record<LogoSize, string> = {
  sm: 'h-7',
  md: 'h-9',
  lg: 'h-12',
  xl: 'h-24',
}

const WORDMARK: Record<LogoSize, string> = {
  sm: 'text-[1.05rem]',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl',
}

export interface LogoProps {
  size?: LogoSize
  /**
   * Show the "Tedor Tutors" wordmark next to the mark. Leave off when the
   * brand name is already rendered as text by the surrounding layout.
   */
  withWordmark?: boolean
  /** Invert the wordmark for use on dark backgrounds. */
  inverted?: boolean
  className?: string
}

/**
 * The Tedor logo: the blue/orange mark, optionally paired with the wordmark.
 *
 * Rendered as a real image so the artwork stays in one place and the browser
 * can cache it. The mark is decorative, so it is hidden from assistive tech
 * whenever the wordmark is present; on its own it is labelled.
 */
export function Logo({ size = 'sm', withWordmark = true, inverted = false, className }: LogoProps) {
  const mark = (
    <img
      src={LOGO_SRC}
      alt={withWordmark ? '' : 'Tedor Tutors'}
      aria-hidden={withWordmark ? true : undefined}
      width={MARK_SIZE[size]}
      height={MARK_SIZE[size]}
      className={cn('shrink-0', MARK_HEIGHT[size])}
    />
  )

  if (!withWordmark) {
    return <span className={cn('inline-flex items-center', className)}>{mark}</span>
  }

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {mark}
      <span
        className={cn(
          'font-semibold tracking-[-0.02em]',
          WORDMARK[size],
          inverted ? 'text-white' : 'text-ink-900',
        )}
      >
        Tedor{' '}
        <span className={inverted ? 'text-brand-200' : 'text-ink-500'}>Tutors</span>
      </span>
    </span>
  )
}
