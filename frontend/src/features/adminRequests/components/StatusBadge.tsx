import { cn } from '@/lib/cn'

import type { AdminStatus } from '../types'

/**
 * Status badge.
 *
 * The status name is always rendered as text, so meaning never depends on
 * colour alone. Each state also differs in border and background treatment.
 */
const STATUS_STYLES: Record<AdminStatus, { label: string; className: string }> = {
  NEW: {
    label: 'NEW',
    className: 'border-blue-200 bg-blue-50 text-blue-800',
  },
  CONTACTED: {
    label: 'CONTACTED',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  IN_PROGRESS: {
    label: 'IN PROGRESS',
    className: 'border-violet-200 bg-violet-50 text-violet-800',
  },
  COMPLETED: {
    label: 'COMPLETED',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  CANCELLED: {
    label: 'CANCELLED',
    className: 'border-slate-300 bg-slate-100 text-slate-700',
  },
}

export function StatusBadge({ status, className }: { status: AdminStatus; className?: string }) {
  const style = STATUS_STYLES[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide whitespace-nowrap',
        style.className,
        className,
      )}
    >
      {style.label}
    </span>
  )
}

export { STATUS_STYLES }
