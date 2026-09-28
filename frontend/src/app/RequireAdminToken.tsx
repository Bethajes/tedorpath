import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { hasAdminToken } from '@/features/adminRequests/adminSession'

/**
 * Client-side gate for the admin area.
 *
 * This is convenience, not security: it simply avoids rendering admin screens
 * when no token is stored. The real boundary is the `requireAdmin` middleware
 * on the backend, which rejects every `/api/admin` request without a valid
 * token regardless of what the browser does.
 */
export function RequireAdminToken({ children }: { children: ReactNode }) {
  const location = useLocation()

  if (!hasAdminToken()) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
