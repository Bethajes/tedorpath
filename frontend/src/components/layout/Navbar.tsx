import { useEffect, useRef, useState } from 'react'
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
  /**
   * Stable identity for the list. Defaults to `to`, which is only safe while
   * every entry points somewhere different — two entries may share a
   * destination now that "Subjects" goes to the directory like "Find a Tutor"
   * does. Labels are unique, so they are used as the key instead.
   */
  key?: string
}

/**
 * The same list drives the desktop bar and the mobile panel, so the two can
 * never disagree about what navigation exists (Requirement 1.3).
 */
const NAV_ITEMS: NavItem[] = [
  { to: '/tutors', label: 'Find a Tutor', key: 'find-a-tutor' },
  { to: '/#how-it-works', label: 'How It Works', anchor: true, key: 'how-it-works' },
  // The homepage's subject index is gone, so this goes to the directory, where
  // subjects are a filter rather than a page of their own. Left pointing at
  // /#subjects it would scroll a viewport and stop.
  { to: '/tutors', label: 'Subjects', key: 'subjects' },
  { to: '/become-a-tutor', label: 'Become a Tutor', key: 'become-a-tutor' },
  { to: '/about', label: 'About', key: 'about' },
]

/**
 * Announcement shown in the strip above the header.
 *
 * Set `NOTICE.text` to null to hide the strip entirely — it is a plain banner,
 * not a queue, so there is exactly one message at a time.
 */
const NOTICE: { text: string; action?: { to: string; label: string } } = {
  text: 'Tutor profiles are reviewed by our team before they go live.',
  action: { to: '/become-a-tutor', label: 'Apply to teach' },
}

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [noticeDismissed, setNoticeDismissed] = useState(false)
  const location = useLocation()
  const { status, user } = useAuth()
  const panelId = 'primary-navigation'
  const headerRef = useRef<HTMLElement>(null)

  // Escape closes the panel and returns focus to the toggle. Clicking outside
  // closes it too: the panel is a full-width overlay, and Requirement 1.3 asks
  // for both. A pointerdown listener is used rather than click so the panel is
  // already gone by the time the click reaches whatever was underneath.
  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        document.getElementById('primary-navigation-toggle')?.focus()
      }
    }

    function onPointerDown(event: PointerEvent | MouseEvent) {
      // The toggle is inside the header, so this only fires for genuine
      // outside clicks.
      if (!headerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  // A navigation closes the panel. Every link below calls `closeMenu` on click,
  // which covers a same-pathname anchor too — so an in-page link cannot leave
  // the menu sitting open over the section it just scrolled to.
  function closeMenu() {
    setOpen(false)
  }

  function isCurrent(item: NavItem) {
    if (item.anchor) return false
    return location.pathname === item.to
  }

  return (
    <header ref={headerRef} className="sticky top-0 z-40">
      {NOTICE.text && !noticeDismissed ? (
        <div className="border-b border-notice-200 bg-notice-50">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-5 py-2 sm:px-8 lg:px-10">
            <p className="flex-1 text-center text-[0.8rem] leading-snug text-notice-800 sm:text-sm">
              {NOTICE.text}
              {NOTICE.action ? (
                <>
                  {' '}
                  <Link
                    to={NOTICE.action.to}
                    className="font-semibold text-notice-700 underline underline-offset-2 hover:text-notice-800"
                  >
                    {NOTICE.action.label}
                  </Link>
                </>
              ) : null}
            </p>
            <button
              type="button"
              onClick={() => setNoticeDismissed(true)}
              className="-mr-1 shrink-0 rounded p-1 text-notice-700 transition-colors hover:bg-notice-200 hover:text-notice-800"
            >
              <span className="sr-only">Dismiss announcement</span>
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M3 3l8 8" />
                <path d="M11 3l-8 8" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      <div className="border-b border-ink-950 bg-ink-950">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-6 px-5 sm:px-8 lg:px-10">
          <Link
            to="/"
            className="rounded-md"
            aria-label="Tedor Tutors — home"
          >
            <Logo size="sm" inverted />
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
                    ? 'bg-ink-800 text-white'
                    : 'text-ink-300 hover:bg-ink-800 hover:text-white',
                )}
              >
                {item.label}
              </Link>
            ))}

            <Link
              to="/tutors"
              className="ml-3 inline-flex items-center rounded-md bg-accent-500 px-5 py-2.5 text-[0.95rem] font-semibold text-white transition-colors hover:bg-accent-600"
            >
              Find a Tutor
            </Link>

            {user ? (
              <div className="ml-2">
                <UserMenu tone="dark" />
              </div>
            ) : (
              /* Shown while the session is still being checked would make the
                 header flicker on every page load, so it only appears once we
                 know for certain. */
              status === 'anonymous' ? (
                <Link
                  to="/login"
                  className="ml-2 rounded-md px-3 py-2 text-[0.95rem] font-medium text-ink-200 transition-colors hover:bg-ink-800 hover:text-white"
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
            className="inline-flex items-center justify-center rounded-md border border-ink-700 p-2.5 text-ink-200 transition-colors hover:bg-ink-800 lg:hidden"
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
      </div>

      {open ? (
        <nav
          id={panelId}
          aria-label="Mobile"
          className="border-b border-ink-950 bg-ink-950 lg:hidden"
        >
          <ul className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-5 py-4 sm:px-8">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={closeMenu}
                  aria-current={isCurrent(item) ? 'page' : undefined}
                  className={cn(
                    'block rounded-md px-3 py-3 text-base font-medium transition-colors',
                    isCurrent(item)
                      ? 'bg-ink-800 text-white'
                      : 'text-ink-200 hover:bg-ink-800 hover:text-white',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="mt-2 border-t border-ink-800 pt-4">
              <Link
                to="/tutors"
                onClick={closeMenu}
                className="block rounded-md bg-accent-500 px-4 py-3.5 text-center text-base font-semibold text-white transition-colors hover:bg-accent-600"
              >
                Find a Tutor
              </Link>
            </li>
            {user ? (
              <li className="flex items-center justify-between gap-3 rounded-md bg-ink-800 px-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-white">
                    {user.name}
                  </span>
                  <span className="block truncate text-xs text-ink-400">{user.email}</span>
                </span>
                <UserMenu tone="dark" />
              </li>
            ) : status === 'anonymous' ? (
              <li className="grid gap-2 sm:grid-cols-2">
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="block rounded-md border border-ink-700 px-4 py-3 text-center text-base font-medium text-ink-100 transition-colors hover:bg-ink-800"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  onClick={closeMenu}
                  className="block rounded-md px-4 py-3 text-center text-base font-medium text-accent-400 transition-colors hover:bg-ink-800"
                >
                  Create account
                </Link>
              </li>
            ) : null}
          </ul>
        </nav>
      ) : null}
    </header>
  )
}
