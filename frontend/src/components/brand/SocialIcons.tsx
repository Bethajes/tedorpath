import type { ReactElement } from 'react'

import type { SocialPlatformId } from '@/lib/socialConfig'

/**
 * Social platform marks for the footer.
 *
 * Hand-drawn rather than an icon package, matching how every other icon in this
 * codebase is done — the public bundle is small and these six are the only
 * brand marks the site needs.
 *
 * Each is a simplified glyph on one 24×24 grid. They are recognisable at 20px,
 * which is the size they render at, and drawn as outlines rather than filled
 * logos so they sit consistently next to each other in a single row. They are
 * not the platforms' official trademarked artwork, and do not need to be: an
 * icon is a link affordance, and the accessible name carries the real name.
 */
const PATHS: Record<SocialPlatformId, ReactElement> = {
  x: (
    <path
      d="M17.53 3h3.02l-6.6 7.54L21.75 21h-6.06l-4.75-6.21L5.5 21H2.47l7.06-8.07L2.25 3h6.22l4.29 5.67L17.53 3Zm-1.06 16.2h1.67L7.6 4.72H5.81l10.66 14.48Z"
      fill="currentColor"
    />
  ),
  facebook: (
    <path
      d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z"
      fill="currentColor"
    />
  ),
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
    </>
  ),
  telegram: (
    <path
      d="M21.7 4.3 2.9 11.5c-.9.35-.88 1.63.03 1.95l4.5 1.6 1.72 5.2c.24.72 1.17.9 1.67.33l2.44-2.82 4.5 3.3c.66.48 1.6.12 1.75-.68l3.1-14.4c.16-.84-.67-1.52-1.4-1.68Zm-3.9 3.3-8.2 7.28-.3 3.3-1.3-3.9 9.5-7.1c.36-.26.8.15.3.42Z"
      fill="currentColor"
    />
  ),
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="7.4" cy="7.6" r="1.35" fill="currentColor" />
      <path d="M6.1 10.5h2.6V18H6.1v-7.5Z" fill="currentColor" />
      <path d="M10.6 10.5h2.5v1.02h.04c.35-.66 1.2-1.36 2.48-1.36 2.65 0 3.14 1.74 3.14 4V18h-2.6v-3.44c0-.82-.02-1.88-1.15-1.88-1.15 0-1.33.9-1.33 1.82V18h-2.6v-7.5Z" fill="currentColor" />
    </>
  ),
  tiktok: (
    <path
      d="M16.6 2h-3.2v13.06a2.6 2.6 0 1 1-2.6-2.6c.24 0 .47.03.7.09V9.34a5.86 5.86 0 0 0-.7-.04 5.8 5.8 0 1 0 5.8 5.8V8.9a6.9 6.9 0 0 0 4 1.28V7.1a3.9 3.9 0 0 1-3.9-3.9V2Z"
      fill="currentColor"
    />
  ),
}

export interface SocialIconProps {
  platform: SocialPlatformId
  className?: string
}

export function SocialIcon({ platform, className }: SocialIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      focusable="false"
    >
      {PATHS[platform]}
    </svg>
  )
}
