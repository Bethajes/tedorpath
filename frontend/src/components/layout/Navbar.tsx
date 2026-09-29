import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { Logo } from '@/components/brand/Logo'
import { useAuth } from '@/features/auth/useAuth'
import { UserMenu } from '@/features/auth/components/UserMenu'
import { cn } from '@/lib/cn'

interface NavItem {
  to: string
  label: string
  /** Anchor targets live on another page; they should not render as "current". */
  anchor?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/request-tutor', label: 'Find a Tutor' },
  { to: '/about#become-a-tutor', label: 'Become a Tutor', anchor: true },
  { to: '/#how-it-works', label: 'How It Works', anchor: true },
  { to: '/about', label: 'About' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { status, user } = useAuth()
  const panelId = 'primary-navigation'

  // Escape closes the panel and returns focus to the toggle.
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        document.getElementById('primary-navigation-toggle')?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  function closeMenu() {
    setOpen(false)
  }

  function isCurrent(item: NavItem) {
    if (item.anchor) return false
    return location.pathname === item.to
  }

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-6 px-5 sm:h-18 sm:px-8 lg:px-10">
        <Link
          to="/"
          className="rounded-md"
          aria-label="Tedor Tutors — home"
        >
          <Logo size="sm" />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={isCurrent(item) ? 'page' : undefined}
              className={cn(
                'rounded-md px-3.5 py-2 text-[0.95rem] font-medium transition-colors',
                isCurrent(item)
                  ? 'text-brand-700'
                  : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
              )}
            >
              {item.label}
            </Link>
          ))}

          <Link
            to="/request-tutor"
            className="ml-3 inline-flex items-center rounded-lg bg-brand-600 px-5 py-2.5 text-[0.95rem] font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            Find a Tutor
          </Link>

          {user ? (
            <div className="ml-2">
              <UserMenu />
            </div>
          ) : (
            /* Shown while the session is still being checked would make the
               header flicker on every page load, so it only appears once we
               know for certain. */
            status === 'anonymous' ? (
              <Link
                to="/login"
                className="ml-2 rounded-lg px-3 py-2 text-[0.95rem] font-medium text-ink-700 transition-colors hover:bg-ink-50"
              >
                Sign in
              </Link>
            ) : null
          )}
        </nav>

        <button
          id="primary-navigation-toggle"
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center justify-center rounded-lg border border-ink-200 p-2.5 text-ink-700 transition-colors hover:bg-ink-50 lg:hidden"
        >
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          <svg
            aria-hidden="true"
            width="22"
            height="22"
            viewBox="0 0 22 22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          >
            {open ? (
              <>
                <path d="M5 5l12 12" />
                <path d="M17 5L5 17" />
              </>
            ) : (
              <>
                <path d="M3 6h16" />
                <path d="M3 11h16" />
                <path d="M3 16h16" />
              </>
            )}
          </svg>
        </button>
      </div>

      {open ? (
        <nav
          id={panelId}
          aria-label="Mobile"
          className="border-t border-ink-200 bg-white lg:hidden"
        >
          <ul className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-5 py-4 sm:px-8">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={closeMenu}
                  className={cn(
                    'block rounded-lg px-3 py-3 text-base font-medium transition-colors',
                    isCurrent(item)
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-ink-700 hover:bg-ink-50',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="mt-2 border-t border-ink-200 pt-4">
              <Link
                to="/request-tutor"
                onClick={closeMenu}
                className="block rounded-lg bg-brand-600 px-4 py-3.5 text-center text-base font-medium text-white transition-colors hover:bg-brand-700"
              >
                Find a Tutor
              </Link>
            </li>
            {user ? (
              <li className="flex items-center justify-between gap-3 rounded-lg bg-ink-50 px-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink-900">
                    {user.name}
                  </span>
                  <span className="block truncate text-xs text-ink-500">{user.email}</span>
                </span>
                <UserMenu />
              </li>
            ) : status === 'anonymous' ? (
              <li className="grid gap-2 sm:grid-cols-2">
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="block rounded-lg border border-ink-200 px-4 py-3 text-center text-base font-medium text-ink-800 transition-colors hover:bg-ink-50"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  onClick={closeMenu}
                  className="block rounded-lg px-4 py-3 text-center text-base font-medium text-brand-700 transition-colors hover:bg-brand-50"
                >
                  Create account
                </Link>
              </li>
            ) : null}
            <li>
              <Link
                to="/contact"
                onClick={closeMenu}
                className="block rounded-lg px-3 py-3 text-center text-sm font-medium text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800"
              >
                Contact us
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  )
}
