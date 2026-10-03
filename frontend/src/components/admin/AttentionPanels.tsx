import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { AdminIcon, type AdminIconName } from '@/components/admin/icons'
import { cn } from '@/lib/cn'

/**
 * "Needs Attention" — the panels that answer "what should I work on?".
 *
 * Every row is a live count with a queue behind it, and every row links into that
 * queue pre-filtered. A panel that cannot be acted on would just be a second
 * place for a number to go stale.
 *
 * WHY THESE FOUR AND NOT OTHERS
 *
 * New requests and pending applications are the two queues that block on an
 * admin. Missing documents is the `NEEDS_INFORMATION` state — tutors the platform
 * has asked for paperwork and is now waiting on. Follow-ups is the one that is a
 * judgement rather than a status: a request that has sat in NEW for over a week
 * is not blocked by anything, which is exactly why it needs a person.
 *
 * The follow-up threshold is a real cutoff on `createdAt`, not a stored flag, and
 * its value arrives with the count so the UI can say "over 7 days" rather than
 * implying a rule the data does not contain.
 */
export interface AttentionItem {
  key: string
  label: string
  count: number
  /** One line naming the exact state, so the number is not read on its own. */
  detail: string
  to: string
  cta: string
  icon: AdminIconName
  tone: 'blue' | 'amber' | 'orange' | 'ink'
  /** Shown when the queue is empty. */
  clearLabel: string
}

const TONE_CLASSES: Record<
  AttentionItem['tone'],
  { chip: string; icon: string; border: string }
> = {
  blue: {
    chip: 'bg-blue-100 text-blue-800',
    icon: 'bg-blue-50 text-blue-600',
    border: 'border-blue-200',
  },
  amber: {
    chip: 'bg-amber-100 text-amber-900',
    icon: 'bg-amber-50 text-amber-600',
    border: 'border-amber-200',
  },
  orange: {
    chip: 'bg-orange-100 text-orange-900',
    icon: 'bg-orange-50 text-orange-600',
    border: 'border-orange-200',
  },
  ink: {
    chip: 'bg-ink-100 text-ink-700',
    icon: 'bg-ink-100 text-ink-600',
    border: 'border-ink-200',
  },
}

export function AttentionItemCard({ item }: { item: AttentionItem }) {
  const tone = TONE_CLASSES[item.tone]
  const active = item.count > 0

  return (
    <div
      className={cn(
        'flex h-full flex-col rounded-xl border bg-white p-5 shadow-sm transition-shadow',
        active ? tone.border : 'border-ink-200',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
              active ? tone.icon : 'bg-ink-100 text-ink-400',
            )}
          >
            <AdminIcon name={item.icon} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink-900">{item.label}</h3>
            <p className="mt-0.5 text-sm text-ink-600">
              {active ? item.detail : item.clearLabel}
            </p>
          </div>
        </div>

        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums',
            active ? tone.chip : 'bg-ink-100 text-ink-500',
          )}
        >
          {item.count}
        </span>
      </div>

      <Link
        to={item.to}
        className="mt-4 inline-flex items-center gap-1 self-start text-sm font-medium text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        {item.cta}
        <AdminIcon name="arrowRight" className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  )
}

export function AttentionGrid({ items }: { items: AttentionItem[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map((item) => (
        <li key={item.key} className="h-full">
          <AttentionItemCard item={item} />
        </li>
      ))}
    </ul>
  )
}

/**
 * Quick Actions — the three things an admin opens the back office to do.
 *
 * Not a general command palette and not a link farm: three buttons, each naming
 * the queue it opens and the state it opens on. Everything else is one click away
 * in the sidebar, and a grid of twenty links would be the same list twice.
 */
const QUICK_ACTIONS: { label: string; to: string; icon: AdminIconName; hint: string }[] = [
  {
    label: 'Review applications',
    to: '/admin/tutors?status=PENDING_REVIEW',
    icon: 'check',
    hint: 'Profiles waiting on a moderation decision',
  },
  {
    label: 'View requests',
    to: '/admin/requests?status=NEW',
    icon: 'requests',
    hint: 'Learner requests with no reply yet',
  },
  {
    label: 'Manage tutors',
    to: '/admin/tutors',
    icon: 'tutors',
    hint: 'Every tutor profile and its status',
  },
]

export function QuickActions({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-stretch gap-3">
      {QUICK_ACTIONS.map((action) => (
        <Link
          key={action.to + action.label}
          to={action.to}
          className="group flex flex-1 basis-56 items-center gap-3 rounded-xl border border-ink-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-100">
            <AdminIcon name={action.icon} className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink-900">{action.label}</span>
            <span className="block truncate text-xs text-ink-500">{action.hint}</span>
          </span>
        </Link>
      ))}
      {children}
    </div>
  )
}
