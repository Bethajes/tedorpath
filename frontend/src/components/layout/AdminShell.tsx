import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'

import { Button } from '@/components/ui'
import { clearAdminToken, hasAdminToken } from '@/features/adminRequests/adminSession'
import { cn } from '@/lib/cn'

const ADMIN_LINKS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/requests', label: 'Tutor Requests', end: false },
]

function linkClass(isActive: boolean) {
  return cn(
    'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-brand-600 text-white'
      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
  )
}

/**
 * Chrome for the admin area.
 *
 * Desktop is a fixed sidebar beside the content; on small screens the same
 * navigation becomes a horizontal bar under the header.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="lg:flex">
        {/* Sidebar / top bar */}
        <aside className="border-b border-slate-200 bg-white lg:min-h-screen lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between gap-3 px-4 py-4 lg:block">
            <div>
              <p className="text-lg font-bold tracking-tight text-slate-900">Tedor Tutors</p>
              <p className="text-sm font-medium text-brand-700">Admin</p>
            </div>
            {hasAdminToken() ? (
              <Button
                variant="outline"
                size="sm"
                className="lg:mt-4"
                onClick={() => {
                  clearAdminToken()
                  window.location.assign('/admin/login')
                }}
              >
                Sign out
              </Button>
            ) : null}
          </div>

          <nav aria-label="Admin" className="px-4 pb-4">
            <ul className="flex flex-col gap-1 lg:flex-col">
              {ADMIN_LINKS.map((link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) => linkClass(isActive)}
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <main id="main-content" className="px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  )
}

export function AdminBackLink() {
  return (
    <Link to="/admin/requests" className="text-sm font-medium text-brand-700 hover:underline">
      &larr; Back to all requests
    </Link>
  )
}
