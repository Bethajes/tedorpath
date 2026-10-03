import type { AdminIconName } from '@/components/admin/icons'

/**
 * The admin sidebar's structure.
 *
 * Kept out of `AdminShell.tsx` so that file only exports components, which is
 * what React Fast Refresh needs — a module that exports both a component and a
 * constant will hot-reload as a full remount instead of a re-render.
 *
 * `available: false` means the section exists in the product plan but has no API
 * behind it yet. Those entries render visibly but disabled, with an explanation,
 * rather than being hidden — a navigation that silently omits half its own
 * sections is more confusing than one that says "not built".
 *
 * Nothing here is aspirational. An entry only claims to work when a route behind
 * it answers with real data.
 */
export interface AdminNavItem {
  to: string
  label: string
  end: boolean
  icon: AdminIconName
  /** Shown in the top header as the description of the current section. */
  description: string
  /** Absent or `false` means there is no route behind this entry yet. */
  available?: boolean
}

export interface AdminNavGroup {
  heading: string
  items: AdminNavItem[]
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    heading: 'Overview',
    items: [
      {
        to: '/admin',
        label: 'Dashboard',
        end: true,
        icon: 'dashboard',
        description: 'What is waiting for a decision right now.',
      },
      {
        to: '/admin/analytics',
        label: 'Analytics',
        end: false,
        icon: 'analytics',
        description: 'Request and application volume over time.',
      },
    ],
  },
  {
    heading: 'Queues',
    items: [
      {
        to: '/admin/requests',
        label: 'Learner requests',
        end: false,
        icon: 'requests',
        description: 'Tutor requests submitted from the public site.',
      },
      {
        to: '/admin/tutors',
        label: 'Tutor applications',
        end: false,
        icon: 'tutors',
        description: 'Applications to join the tutor directory.',
      },
      {
        to: '/admin/matching',
        label: 'Matching',
        end: false,
        icon: 'matching',
        description: 'Requests with and without a tutor attached.',
      },
    ],
  },
  {
    heading: 'Directory',
    items: [
      {
        to: '/admin/messages',
        label: 'Messages',
        end: false,
        icon: 'messages',
        description: 'No messages are stored yet, so there is nothing to read.',
        available: false,
      },
    ],
  },
  {
    heading: 'Content & settings',
    items: [
      {
        to: '/admin/content',
        label: 'Content',
        end: false,
        icon: 'content',
        description: 'The subjects offered in the public catalogue.',
      },
      {
        to: '/admin/site-stats',
        label: 'Settings',
        end: false,
        icon: 'settings',
        description: 'The figures published in the homepage trust band.',
      },
    ],
  },
]

/** Whether a nav item is the current page. */
export function isNavItemActive(pathname: string, item: AdminNavItem): boolean {
  return item.end ? pathname === item.to : pathname.startsWith(item.to)
}

/**
 * The nav item for a path, for the header title.
 *
 * Sorted longest-`to` first so `/admin/tutors` wins over a hypothetical shorter
 * sibling that shares its prefix — without that, the first match in declaration
 * order would win and the header could name the wrong section on a detail page.
 *
 * Unavailable entries are excluded: they have no page to be on.
 */
export function activeNavItem(pathname: string): AdminNavItem | undefined {
  return ADMIN_NAV.flatMap((group) => group.items)
    .filter((item) => item.available !== false)
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => isNavItemActive(pathname, item))
}

/** The group a path belongs to, used for the mobile sheet's heading. */
export function activeNavGroup(pathname: string): string {
  const item = activeNavItem(pathname)
  if (!item) return 'Admin'
  return ADMIN_NAV.find((group) => group.items.includes(item))?.heading ?? 'Admin'
}
