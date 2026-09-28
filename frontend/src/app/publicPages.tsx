import { lazy } from 'react'

/**
 * Lazily loaded public pages.
 *
 * Each route is its own chunk so a visitor who only reads the homepage does not
 * download the request form (and its validation schema) or the other pages.
 * React Router renders `routerHydrateFallbackElement` while a chunk is in
 * flight and handles the Suspense boundary itself.
 */

/** Placeholder shown while a public page chunk loads. */
export function PageFallback() {
  return (
    <p role="status" className="p-10 text-center text-sm text-ink-500">
      Loading…
    </p>
  )
}

export const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })))

export const RequestTutorPage = lazy(() =>
  import('@/pages/RequestTutorPage').then((m) => ({ default: m.RequestTutorPage })),
)

export const AboutPage = lazy(() => import('@/pages/AboutPage').then((m) => ({ default: m.AboutPage })))

export const ContactPage = lazy(() =>
  import('@/pages/ContactPage').then((m) => ({ default: m.ContactPage })),
)

export const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
)
