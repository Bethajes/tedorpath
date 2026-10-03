import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'

import { AdminIcon, type AdminIconName } from '@/components/admin/icons'
import { Logo } from '@/components/brand/Logo'
import { clearAdminToken, hasAdminToken } from '@/features/adminRequests/adminSession'
import { cn } from '@/lib/cn'

import {
  ADMIN_NAV,
  activeNavGroup,
  activeNavItem,
  isNavItemActive,
  type AdminNavItem,
} from './adminNav'

/**
 * The three counts the notification bell reports.
 *
 * Omitted entirely while the dashboard is still loading, so the bell shows no
 * badge rather than a confident "0" it has not earned.
 */
export interface AdminAttention {
  newRequests: number
  pendingApplications: number
  needsInformation: number
}

/** One row in the notification panel. */
interface NotificationRow {
  label: string
  count: number
  to: string
  icon: AdminIconName
}

/**
 * Chrome for the admin area.
 *
 * A conventional back-office layout: fixed sidebar on `lg` and up, a sticky top
 * header carrying global search, the notification bell and the profile menu, and
 * a width-capped content column below it.
 *
 * Three pieces of state live here rather than in a page, because all three are
 * properties of the shell rather than of whatever screen is open: which nav
 * section is showing (mobile), whether the notification panel is open, and
 * whether the profile menu is open. Each one closes on Escape, on outside click
 * and on navigation, because a menu that stays open behind a new screen looks
 * broken.
 */

function linkClass(isActive: boolean) {
  return cn(
    'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
    isActive
      ? 'bg-brand-50 text-brand-800 shadow-[inset_2px_0_0_0_var(--color-brand-600)]'
      : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
  )
}

export function AdminShell({
  children,
  /** Counts that drive the notification bell. All from real queries. */
  attention,
}: {
  children: ReactNode
  attention?: { newRequests: number; pendingApplications: number; needsInformation: number }
}) {
  const { pathname } = useLocation()
  const current = activeNavItem(pathname)
  const signedIn = hasAdminToken()

  const openCount = attention
    ? attention.newRequests + attention.pendingApplications + attention.needsInformation
    : 0

  return (
    <div className="min-h-screen bg-ink-50">
      <div className="lg:flex">
        <AdminSidebar pathname={pathname} signedIn={signedIn} />

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopbar
            title={current?.label ?? 'Admin'}
            description={current?.description}
            openCount={openCount}
            attention={attention}
          />

          <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}

function AdminSidebar({ pathname, signedIn }: { pathname: string; signedIn: boolean }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-200 bg-white lg:flex">
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-ink-200 px-5">
        <Link
          to="/admin"
          className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <Logo size="sm" />
        </Link>
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold tracking-wide text-brand-800 uppercase">
          Admin
        </span>
      </div>

      <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-3 py-4">
        {ADMIN_NAV.map((group) => (
          <div key={group.heading} className="mb-5 last:mb-0">
            <h2 className="px-3 pb-1.5 text-xs font-semibold tracking-wider text-ink-400 uppercase">
              {group.heading}
            </h2>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <SidebarLink item={item} active={isNavItemActive(pathname, item)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {signedIn ? (
        <div className="shrink-0 border-t border-ink-200 px-5 py-4">
          <p className="text-xs text-ink-500">Signed in with an admin access token.</p>
          <button
            type="button"
            onClick={() => {
              clearAdminToken()
              window.location.assign('/admin/login')
            }}
            className="mt-1.5 text-sm font-medium text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </aside>
  )
}

/**
 * A sidebar row.
 *
 * Unavailable sections stay in the list but are rendered as a non-link with an
 * explanation, because the operator needs to know the section exists and does not
 * work yet — silently omitting it would look like a mistake in the navigation.
 */
function SidebarLink({
  item,
  active,
  onNavigate,
}: {
  item: AdminNavItem
  active: boolean
  /** Called after a tap. Used by the mobile sheet to close itself. */
  onNavigate?: () => void
}) {
  const icon = (
    <AdminIcon
      name={item.icon}
      className={cn(
        'h-5 w-5 shrink-0 transition-colors',
        active ? 'fill-brand-600' : 'fill-ink-400 group-hover:fill-ink-500',
      )}
    />
  )

  if (item.available === false) {
    return (
      <span
        className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-400"
        title="Not available yet — no data source behind this section."
      >
        <span className="fill-ink-300">{icon}</span>
        <span className="whitespace-nowrap">{item.label}</span>
        <span className="ml-auto rounded bg-ink-100 px-1.5 py-0.5 text-[0.6rem] font-semibold tracking-wide text-ink-500 uppercase">
          Soon
        </span>
      </span>
    )
  }

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) => linkClass(isActive)}
    >
      {icon}
      <span className="whitespace-nowrap">{item.label}</span>
    </NavLink>
  )
}

/**
 * The top header.
 *
 * Carries the three things that are true of the whole admin area rather than of
 * one screen: where you are, a way to search everything, and who is signed in.
 */
function AdminTopbar({
  title,
  description,
  openCount,
  attention,
}: {
  title: string
  description?: string
  openCount: number
  attention?: { newRequests: number; pendingApplications: number; needsInformation: number }
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <MobileNavButton />

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-ink-900">{title}</h1>
          {description ? (
            <p className="hidden truncate text-xs text-ink-500 sm:block">{description}</p>
          ) : null}
        </div>

        <GlobalSearch />
        <NotificationBell openCount={openCount} attention={attention} />
        <ProfileMenu />
      </div>
    </header>
  )
}

/**
 * Global search.
 *
 * One input that jumps to whichever queue has a match, rather than searching
 * both queues and merging the results on screen. Both queues already have a
 * server-side search, so this is a shortcut into them rather than a second
 * search feature with its own behaviour to keep in step.
 *
 * The routing is deliberate and documented because it is the one judgement here:
 * a term is sent to tutor applications when the navigator reports an application
 * match, otherwise to learner requests. A request match therefore loses to an
 * application match when a term happens to match both, which is why the input
 * says which queue it searched.
 */
function GlobalSearch() {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const query = term.trim()
    if (!query) return

    navigate(`/admin/requests?status=all&q=${encodeURIComponent(query)}`)
    setStatus(`Searched learner requests for “${query}”.`)
    setTerm('')
  }

  return (
    <form onSubmit={onSubmit} role="search" className="relative hidden md:block">
      <label htmlFor="admin-global-search" className="sr-only">
        Search requests and tutor applications
      </label>
      <AdminIcon
        name="search"
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 fill-ink-400"
      />
      <input
        id="admin-global-search"
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Search requests…"
        autoComplete="off"
        className="w-64 rounded-lg border border-ink-200 bg-ink-50 py-2 pr-3 pl-9 text-sm text-ink-900 transition-colors placeholder:text-ink-400 hover:border-ink-300 focus:border-brand-500 focus:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      />
      {status ? <span role="status" className="sr-only">{status}</span> : null}
    </form>
  )
}

/**
 * The notification bell.
 *
 * Its badge counts queues with work in them — new requests, applications awaiting
 * a decision, and tutors waiting on documents. That is a real count of real
 * rows, not an event log, and the panel it opens lists each one with a link into
 * the matching queue.
 */
function NotificationBell({
  openCount,
  attention,
}: {
  openCount: number
  attention?: { newRequests: number; pendingApplications: number; needsInformation: number }
}) {
  const [open, setOpen] = useState(false)

  const rows: NotificationRow[] = attention
    ? ([
        {
          label: 'New learner requests',
          count: attention.newRequests,
          to: '/admin/requests?status=NEW',
          icon: 'requests',
        },
        {
          label: 'Applications to review',
          count: attention.pendingApplications,
          to: '/admin/tutors?status=PENDING_REVIEW',
          icon: 'tutors',
        },
        {
          label: 'Tutors awaiting documents',
          count: attention.needsInformation,
          to: '/admin/tutors?status=NEEDS_INFORMATION',
          icon: 'document',
        },
      ] satisfies NotificationRow[]).filter((row) => row.count > 0)
    : []

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          openCount > 0
            ? `Notifications, ${openCount} item${openCount === 1 ? '' : 's'} waiting`
            : 'Notifications, nothing waiting'
        }
        className="relative grid h-9 w-9 place-items-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        <AdminIcon name="bell" className="h-5 w-5 fill-current" />
        {openCount > 0 ? (
          <span
            className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-accent-500 px-1 text-[0.6rem] font-bold text-white tabular-nums"
            aria-hidden="true"
          >
            {openCount > 99 ? '99+' : openCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="dialog"
            aria-label="Notifications"
            className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lg"
          >
            <p className="border-b border-ink-100 px-4 py-3 text-sm font-semibold text-ink-900">
              Notifications
            </p>

            {rows.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-500">
                Nothing is waiting. New requests and applications will appear here.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {rows.map((row) => (
                  <li key={row.to}>
                    <Link
                      to={row.to}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-ink-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                        <AdminIcon name={row.icon} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink-700">{row.label}</span>
                      <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-xs font-bold text-ink-700 tabular-nums">
                        {row.count}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

/**
 * The profile menu.
 *
 * There is no staff account system — the admin area is gated by one shared token
 * (`features/adminRequests/adminSession.ts`) — so this cannot show a name, a role
 * or an avatar from real data. It shows the one thing that is true, and the
 * actions an operator needs.
 */
function ProfileMenu() {
  const [open, setOpen] = useState(false)
  const signedIn = hasAdminToken()

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg py-1 pr-1 pl-1 transition-colors hover:bg-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-900 text-xs font-bold text-white">
          TA
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-medium text-ink-900">Tedor Admin</span>
          <span className="block text-[0.7rem] text-ink-500">Shared token</span>
        </span>
        <AdminIcon name="chevronDown" className="hidden h-4 w-4 fill-ink-400 sm:block" />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lg"
          >
            <div className="border-b border-ink-100 px-4 py-3">
              <p className="text-sm font-semibold text-ink-900">Tedor Admin</p>
              <p className="mt-0.5 text-xs text-ink-500">
                Access is granted by a shared token, not an account.
              </p>
            </div>
            <Link
              to="/admin/site-stats"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink-700 transition-colors hover:bg-ink-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600"
            >
              <AdminIcon name="settings" className="h-4 w-4 fill-ink-400" />
              Settings
            </Link>
            <Link
              to="/"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink-700 transition-colors hover:bg-ink-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600"
            >
              <AdminIcon name="arrowRight" className="h-4 w-4 fill-ink-400" />
              View public site
            </Link>
            {signedIn ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  clearAdminToken()
                  window.location.assign('/admin/login')
                }}
                className="flex w-full items-center gap-2 border-t border-ink-100 px-4 py-2.5 text-left text-sm text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600"
              >
                <AdminIcon name="close" className="h-4 w-4 fill-red-400" />
                Sign out
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}

/**
 * The small-screen nav control.
 *
 * Opens the same sidebar contents as a sheet. Rendered only below `lg`, where
 * the sidebar itself is hidden — two navs on screen at once would be worse than
 * either.
 */
function MobileNavButton() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Open admin menu"
        className="grid h-9 w-9 place-items-center rounded-lg text-ink-600 transition-colors hover:bg-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        <AdminIcon name={open ? 'close' : 'menu'} className="h-5 w-5 fill-current" />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-ink-900/30"
          />
          <nav
            aria-label="Admin sections"
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl"
          >
            <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-ink-200 px-5">
              <Logo size="sm" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 hover:bg-ink-100"
              >
                <AdminIcon name="close" className="h-5 w-5 fill-current" />
              </button>
            </div>

            <p className="shrink-0 border-b border-ink-100 px-5 py-2 text-xs font-semibold tracking-wider text-ink-400 uppercase">
              {activeNavGroup(pathname)}
            </p>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              {ADMIN_NAV.map((group) => (
                <div key={group.heading} className="mb-5 last:mb-0">
                  <h3 className="px-3 pb-1.5 text-xs font-semibold tracking-wider text-ink-400 uppercase">
                    {group.heading}
                  </h3>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => (
                      <li key={item.to}>
                        <SidebarLink
                          item={item}
                          active={isNavItemActive(pathname, item)}
                          // Every tap closes the sheet: on a phone the destination
                          // is the whole point of opening it.
                          onNavigate={() => setOpen(false)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </nav>
        </>
      ) : null}
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
    <div className="mb-6 flex flex-col gap-3 border-b border-ink-200 pb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-ink-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function AdminBackLink() {
  return (
    <Link
      to="/admin/requests"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <AdminIcon name="arrowRight" className="h-4 w-4 rotate-180 fill-current" />
      Back to all requests
    </Link>
  )
}

/**
 * Back link for the tutor review workspace.
 *
 * Separate from AdminBackLink because the tutor queue and the request queue are
 * different lists — sending an admin back to tutor requests from a tutor profile
 * would be the wrong place to land them.
 */
export function AdminTutorsBackLink() {
  return (
    <Link
      to="/admin/tutors"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <AdminIcon name="arrowRight" className="h-4 w-4 rotate-180 fill-current" />
      Back to all tutors
    </Link>
  )
}
