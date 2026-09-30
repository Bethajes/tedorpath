import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from './useAuth'

/**
 * Gate for pages that need an account.
 *
 * Convenience, not security: the API rejects any request without a valid
 * session regardless of what the browser renders. Its job is to avoid showing a
 * signed-out visitor a page that could only fail, and to send them back to
 * where they were afterwards.
 *
 * There is nothing signed-in-only to protect while the platform has no client
 * area yet, so the router does not use this anywhere — it exists so the first
 * private screen is a one-line change.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  // Wait for the answer before deciding: bouncing to /login while /api/auth/me
  // is still in flight would sign out perfectly good sessions on every reload.
  if (status === 'unknown') {
    return (
      <p role="status" className="p-10 text-center text-sm text-ink-500">
        Checking your session…
      </p>
    )
  }

  if (status === 'anonymous') {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  return <>{children}</>
}
