import type { ReactNode } from 'react'

/** Label/value pair used throughout the request detail sections. */
export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  const isEmpty = value === null || value === undefined || value === ''

  return (
    <div className="flex flex-col gap-0.5 py-2">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`text-sm ${isEmpty ? 'text-slate-400 italic' : 'text-slate-900'}`}>
        {isEmpty ? 'Not provided' : value}
      </dd>
    </div>
  )
}

export function DetailSection({
  title,
  description,
  children,
  tone = 'default',
}: {
  title: string
  description?: string
  children: ReactNode
  tone?: 'default' | 'internal'
}) {
  return (
    <section
      aria-label={title}
      className={
        tone === 'internal'
          ? 'rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/40 p-5'
          : 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm'
      }
    >
      <h2 className={`text-lg font-semibold ${tone === 'internal' ? 'text-amber-900' : 'text-slate-900'}`}>
        {title}
      </h2>
      {description ? (
        <p className={`mt-1 text-sm ${tone === 'internal' ? 'text-amber-800' : 'text-slate-600'}`}>
          {description}
        </p>
      ) : null}
      {children}
    </section>
  )
}
