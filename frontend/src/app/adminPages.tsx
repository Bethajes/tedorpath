import { lazy } from 'react'

/**
 * Lazily loaded admin pages.
 *
 * Kept in their own module so the router file only exports the router (and so
 * React Fast Refresh keeps working). Code-splitting means public visitors never
 * download the staff UI.
 *
 * The actual security boundary is the `requireAdmin` middleware on the backend;
 * this only avoids shipping admin screens to the public.
 */
/** Placeholder shown while an admin page chunk loads. */
export function AdminFallback() {
  return (
    <p role="status" className="p-8 text-center text-sm text-slate-600">
      Loading admin…
    </p>
  )
}

export const AdminLoginPage = lazy(() =>
  import('@/pages/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage })),
)

export const AdminDashboardPage = lazy(() =>
  import('@/pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
)

export const AdminRequestsPage = lazy(() =>
  import('@/pages/AdminRequestsPage').then((m) => ({ default: m.AdminRequestsPage })),
)

export const AdminRequestDetailPage = lazy(() =>
  import('@/pages/AdminRequestDetailPage').then((m) => ({ default: m.AdminRequestDetailPage })),
)

export const AdminTutorsPage = lazy(() =>
  import('@/pages/AdminTutorsPage').then((m) => ({ default: m.AdminTutorsPage })),
)

export const AdminTutorReviewPage = lazy(() =>
  import('@/pages/AdminTutorReviewPage').then((m) => ({ default: m.AdminTutorReviewPage })),
)

export const AdminSiteStatsPage = lazy(() =>
  import('@/pages/AdminSiteStatsPage').then((m) => ({ default: m.AdminSiteStatsPage })),
)

export const AdminAnalyticsPage = lazy(() =>
  import('@/pages/AdminAnalyticsPage').then((m) => ({ default: m.AdminAnalyticsPage })),
)

export const AdminMatchingPage = lazy(() =>
  import('@/pages/AdminMatchingPage').then((m) => ({ default: m.AdminMatchingPage })),
)

export const AdminContentPage = lazy(() =>
  import('@/pages/AdminContentPage').then((m) => ({ default: m.AdminContentPage })),
)

export const AdminMessagesPage = lazy(() =>
  import('@/pages/AdminMessagesPage').then((m) => ({ default: m.AdminMessagesPage })),
)
