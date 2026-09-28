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
