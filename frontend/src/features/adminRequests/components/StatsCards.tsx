import type { AdminStats } from '../types'

const CARDS: { key: keyof AdminStats; label: string; accent: string }[] = [
  { key: 'total', label: 'Total Requests', accent: 'border-slate-300' },
  { key: 'NEW', label: 'New', accent: 'border-blue-300' },
  { key: 'CONTACTED', label: 'Contacted', accent: 'border-amber-300' },
  { key: 'IN_PROGRESS', label: 'In Progress', accent: 'border-violet-300' },
  { key: 'COMPLETED', label: 'Completed', accent: 'border-emerald-300' },
]

/** Summary cards. Every value comes from the database. */
export function StatsCards({ stats }: { stats: AdminStats }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {CARDS.map((card) => (
        <li
          key={card.key}
          className={`rounded-xl border-t-4 border border-slate-200 bg-white p-4 shadow-sm ${card.accent}`}
        >
          <p className="text-sm text-slate-600">{card.label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{stats[card.key]}</p>
        </li>
      ))}
    </ul>
  )
}
