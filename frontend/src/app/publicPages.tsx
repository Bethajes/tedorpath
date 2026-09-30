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

// Authentication lives in features/auth (see frontend/src/features/auth), but
// the pages are loaded here so the router keeps its single lazy-loading seam.
export const LoginPage = lazy(() =>
  import('@/features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
)

export const RegisterPage = lazy(() =>
  import('@/features/auth/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
)

export const TutorDirectoryPage = lazy(() =>
  import('@/features/tutors/TutorDirectoryPage').then((m) => ({ default: m.TutorDirectoryPage })),
)

export const TutorProfilePage = lazy(() =>
  import('@/features/tutorProfile/TutorProfilePage').then((m) => ({ default: m.TutorProfilePage })),
)

export const TutorOnboardingPage = lazy(() =>
  import('@/features/tutorOnboarding/TutorOnboardingPage').then((m) => ({ default: m.TutorOnboardingPage })),
)

export const TutorApplicationStatusPage = lazy(() =>
  import('@/features/tutorOnboarding/TutorApplicationStatusPage').then((m) => ({
    default: m.TutorApplicationStatusPage,
  })),
)
