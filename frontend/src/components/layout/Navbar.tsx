import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

import { cn } from '@/lib/cn'

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/request-tutor', label: 'Find a Tutor', end: false },
  { to: '/about', label: 'About', end: false },
  { to: '/contact', label: 'Contact', end: false },
]

export function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="text-lg font-bold tracking-tight text-slate-900">
          Tedor Tutors
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
          <Link
            to="/request-tutor"
            className="ml-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            Find a Tutor
          </Link>
        </nav>

        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center justify-center rounded-md border border-slate-300 p-2 text-slate-700 md:hidden"
        >
          <span className="sr-only">Toggle navigation menu</span>
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            {open ? (
              <>
                <path d="M5 5l10 10" />
                <path d="M15 5L5 15" />
              </>
            ) : (
              <>
                <path d="M3 6h14" />
                <path d="M3 10h14" />
                <path d="M3 14h14" />
              </>
            )}
          </svg>
        </button>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="border-t border-slate-200 bg-white px-4 py-3 md:hidden"
        >
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'block rounded-md px-3 py-2 text-sm font-medium',
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-700 hover:bg-slate-100',
                    )
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
            <li className="pt-1">
              <Link
                to="/request-tutor"
                onClick={() => setOpen(false)}
                className="block rounded-lg bg-brand-600 px-3 py-2.5 text-center text-sm font-medium text-white"
              >
                Find a Tutor
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  )
}
