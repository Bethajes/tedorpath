import { Link } from 'react-router-dom'

import { AdminIcon, type AdminIconName } from '@/components/admin/icons'
import { cn } from '@/lib/cn'

/**
 * The KPI row.
 *
 * Five cards, each a count the database produced, each linking into the queue
 * that figure is about. A count an admin cannot act on is decoration, so there
 * is no card on this row that does not lead somewhere useful.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *
 * No percentage change, no trend arrow, no "vs last month". The platform does not
 * snapshot its own totals, so a comparison would need a second figure stored
 * somewhere, and a stored comparison is a figure nobody has checked. The trend
 * charts below carry the only growth information on this page, and it is drawn
 * from the rows themselves.
 *
 * Every card's `hint` states what the number counts, because "Active Learners"
 * in particular has no single obvious meaning and the two candidate readings are
 * different numbers.
 */
export interface KpiCard {
  key: string
  label: string
  value: number
  icon: AdminIconName
  /** Where the count leads. Omit for a card that has nowhere to go. */
  to: string
  /** Shown under the number. Says what is counted, not what it means. */
  hint: string
  tone: 'brand' | 'accent' | 'emerald' | 'amber' | 'ink'
  /** Emphasised when the queue is non-empty. */
  actionable?: boolean
}

const TONE_CLASSES: Record<KpiCard['tone'], string> = {
  brand: 'bg-brand-50 text-brand-700',
  accent: 'bg-accent-50 text-accent-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  ink: 'bg-ink-100 text-ink-600',
}

export function KpiCard({ card }: { card: KpiCard }) {
  const emphasised = card.actionable && card.value > 0

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-600">{card.label}</p>
        <span
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
            TONE_CLASSES[card.tone],
          )}
        >
          <AdminIcon name={card.icon} className="h-5 w-5" />
        </span>
      </div>

      {/*
        Amber text is reserved for a figure with work behind it. A count of zero
        is not a problem, so an amber "0" would be crying wolf.
      */}
      <p
        className={cn(
          'mt-3 text-3xl font-bold tracking-[-0.02em] tabular-nums',
          emphasised && card.tone === 'amber' ? 'text-amber-700' : 'text-ink-900',
        )}
      >
        {card.value}
      </p>

      <p className="mt-1 text-xs leading-relaxed text-ink-500">{card.hint}</p>
    </>
  )

  return (
    <Link
      to={card.to}
      className={cn(
        'group flex h-full flex-col rounded-xl border bg-white p-5 shadow-sm',
        'transition-shadow hover:shadow-md',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        emphasised ? 'border-amber-300 ring-1 ring-amber-200' : 'border-ink-200',
      )}
    >
      {body}
      <span
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-700 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden="true"
      >
        View
        <AdminIcon name="arrowRight" className="h-3.5 w-3.5" />
      </span>
    </Link>
  )
}

export function KpiRow({ cards }: { cards: KpiCard[] }) {
  return (
    // Named, because "Learner requests" is also the sidebar's label and a bare
    // <ul> of figures would otherwise be an unlabelled grab-bag to a screen
    // reader — and impossible to target precisely in a test.
    <ul aria-label="Key figures" className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <li key={card.key} className="h-full">
          <KpiCard card={card} />
        </li>
      ))}
    </ul>
  )
}
