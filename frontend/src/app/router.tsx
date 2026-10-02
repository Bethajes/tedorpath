import { Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'

import {
  AdminDashboardPage,
  AdminFallback,
  AdminLoginPage,
  AdminRequestDetailPage,
  AdminRequestsPage,
  AdminTutorReviewPage,
  AdminTutorsPage,
} from '@/app/adminPages'
import { RequireAdminToken } from '@/app/RequireAdminToken'
import {
  AboutPage,
  ContactPage,
  HomePage,
  HowItWorksPage,
  LoginPage,
  NotFoundPage,
  PageFallback,
  RegisterPage,
  RequestTutorPage,
  TutorApplicationStatusPage,
  TutorDirectoryPage,
  TutorOnboardingPage,
  TutorProfilePage,
} from '@/app/publicPages'

const admin = (element: ReactNode) => (
  <RequireAdminToken>
    <Suspense fallback={<AdminFallback />}>{element}</Suspense>
  </RequireAdminToken>
)

// Public pages are code-split (see `publicPages`), so the router renders
// `PageFallback` while a chunk loads.

export const router = createBrowserRouter([
  { path: '/', element: <HomePage />, hydrateFallbackElement: <PageFallback /> },
  { path: '/request-tutor', element: <RequestTutorPage /> },
  { path: '/about', element: <AboutPage /> },
  { path: '/how-it-works', element: <HowItWorksPage /> },
  { path: '/contact', element: <ContactPage /> },

  // Tutor marketplace — public directory and individual profile pages
  // Requirements: 8.1, 10.1
  { path: '/tutors', element: <TutorDirectoryPage /> },
  { path: '/tutors/:id', element: <TutorProfilePage /> },

  // Tutor onboarding — auth-gated (Requirement 11.1)
  { path: '/become-a-tutor', element: <TutorOnboardingPage /> },

  // Where an applicant's application has got to. Auth-gated in-component for
  // the same reason as the wizard: it reads the applicant's own profile, so
  // there is nothing to show an anonymous visitor. Requirement 21.1
  { path: '/tutor/application-status', element: <TutorApplicationStatusPage /> },

  // Authentication. Public: signing in must never be behind a login. These
  // pages redirect away if a session already exists, and the guard
  // (features/auth/RequireAuth) is ready for the first private screen.
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },

  // Admin area. Not part of the public site: gated by RequireAdminToken, and
  // every /api/admin call is additionally rejected by the backend without a
  // valid admin token. See backend/src/middleware/adminAuth.js.
  {
    path: '/admin/login',
    element: (
      <Suspense fallback={<AdminFallback />}>
        <AdminLoginPage />
      </Suspense>
    ),
  },
  { path: '/admin', element: admin(<AdminDashboardPage />) },
  { path: '/admin/requests', element: admin(<AdminRequestsPage />) },
  { path: '/admin/requests/:id', element: admin(<AdminRequestDetailPage />) },
  // Tutor moderation queue and the per-profile review workspace.
  // Requirements: 23.1, 24.1
  { path: '/admin/tutors', element: admin(<AdminTutorsPage />) },
  { path: '/admin/tutors/:id', element: admin(<AdminTutorReviewPage />) },

  { path: '*', element: <NotFoundPage /> },
])
