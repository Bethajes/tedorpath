import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/features/auth/useAuth'
import { cn } from '@/lib/cn'

/**
 * The signed-in state in the header.
 *
 * Only the identity and a way out: there is no client area yet, so this shows
 * who you are and signs you out rather than pretending a dashboard exists.
 *
 * The menu is a plain button plus panel (no dropdown dependency) and closes on
 * Escape, on a click outside and on losing focus, so keyboard and pointer users
 * are treated the same.
 */
export interface UserMenuProps {
  /**
   * Colour treatment for the trigger. `dark` is for the dark header band; the
   * dropdown panel itself stays light either way, because a light panel on a
   * dark surface is what makes the menu readable.
   */
  tone?: 'light' | 'dark'
}

export function UserMenu({ tone = 'light' }: UserMenuProps = {}) {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDark = tone === 'dark'

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        document.getElementById('user-menu-toggle')?.focus()
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }

    function onFocusIn(event: FocusEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('focusin', onFocusIn)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [open])

  if (!user) return null

  // First name only: the header has room for a greeting, not a full name.
  const firstName = user.name.trim().split(/\s+/)[0] || user.email
  const initial = firstName.slice(0, 1).toUpperCase()

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        id="user-menu-toggle"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[0.95rem] font-medium transition-colors',
          isDark ? 'text-ink-100 hover:bg-ink-800' : 'text-ink-700 hover:bg-ink-50',
        )}
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-500 text-sm font-semibold text-white"
        >
          {initial}
        </span>
        <span className="max-w-[9rem] truncate">{firstName}</span>
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            'transition-transform',
            isDark ? 'text-ink-400' : 'text-ink-500',
            open && 'rotate-180',
          )}
        >
          <path d="M3 5.5 7 9.5l4-4" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          aria-labelledby="user-menu-toggle"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-[0_18px_50px_-24px_rgba(18,26,36,0.45)]"
        >
          <div className="border-b border-ink-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink-900">{user.name}</p>
            <p className="truncate text-xs text-ink-500">{user.email}</p>
          </div>

          <div className="p-1.5">
            <Link
              to="/request-tutor"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={cn(
                'block rounded-lg px-3 py-2 text-sm transition-colors',
                isDark ? 'text-ink-200 hover:bg-ink-800' : 'text-ink-700 hover:bg-ink-50',
              )}
            >
              Find a tutor
            </Link>
            {/* A tutor who has applied needs to be able to get back to their
                application status from anywhere. It resolves to "no application
                yet" for someone who has not applied, so it is not worth gating
                on a second request. */}
            <Link
              to="/tutor/application-status"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={cn(
                'block rounded-lg px-3 py-2 text-sm transition-colors',
                isDark ? 'text-ink-200 hover:bg-ink-800' : 'text-ink-700 hover:bg-ink-50',
              )}
            >
              My tutor application
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              disabled={signingOut}
              className={cn(
                'block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors disabled:opacity-60',
                isDark ? 'text-ink-200 hover:bg-ink-800' : 'text-ink-700 hover:bg-ink-50',
              )}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
