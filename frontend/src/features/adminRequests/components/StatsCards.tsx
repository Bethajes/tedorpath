import { Link } from 'react-router-dom'

import { cn } from '@/lib/cn'

import type { AdminStatus, AdminStats } from '../types'

/**
 * The request counts, and only those.
 *
 * Typed as the numeric keys explicitly rather than `keyof AdminStats`, because
 * `AdminStats` also carries `tutorApplications` — a nested object of counts, not
 * a count. Looping over every key would try to render it as a number and break
 * the build the moment a second group of figures was added. Tutor applications
 * have their own panel on the dashboard.
 */
type RequestCountKey = Exclude<keyof AdminStats, 'tutorApplications'>

/**
 * Every card links to the matching slice of the request queue.
 *
 * A count an admin cannot act on is just decoration. Each one already knows how
 * to filter the list, so the two are linked and the card becomes the affordance.
 */
const CARDS: {
  key: RequestCountKey
  label: string
  accent: string
  status?: AdminStatus
}[] = [
  { key: 'total', label: 'Total Requests', accent: 'border-t-slate-400' },
  { key: 'NEW', label: 'New', accent: 'border-t-blue-500', status: 'NEW' },
  { key: 'CONTACTED', label: 'Contacted', accent: 'border-t-amber-500', status: 'CONTACTED' },
  { key: 'IN_PROGRESS', label: 'In Progress', accent: 'border-t-violet-500', status: 'IN_PROGRESS' },
  { key: 'COMPLETED', label: 'Completed', accent: 'border-t-emerald-500', status: 'COMPLETED' },
]

/**
 * Summary cards. Every value comes from the database.
 *
 * `NEW` is the one status that means a person is waiting for a first reply, so
 * it is the one count that gets emphasis. An admin should be able to tell from
 * across the room whether anyone is waiting.
 */
export function StatsCards({ stats }: { stats: AdminStats }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {CARDS.map((card) => {
        const value = stats[card.key]
        const isActionable = card.status === 'NEW'
        const to = card.status
          ? `/admin/requests?status=${card.status}`
          : '/admin/requests'

        return (
          <li key={card.key}>
            <Link
              to={to}
              className={cn(
                'block h-full rounded-xl border border-t-4 border-slate-200 bg-white p-4 shadow-sm',
                'transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                card.accent,
              )}
            >
              <p className="text-sm font-medium text-slate-600">{card.label}</p>
              <p
                className={cn(
                  'mt-1 text-3xl font-bold tabular-nums',
                  isActionable && value > 0 ? 'text-blue-700' : 'text-slate-900',
                )}
              >
                {value}
              </p>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
