import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

export interface FormSectionProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

/** A titled card that groups related form fields in a responsive 2-column grid. */
export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <section
      aria-labelledby={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
      className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)}
    >
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2
          id={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
          className="text-lg font-semibold text-slate-900"
        >
          {title}
        </h2>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      <div className="grid grid-cols-1 gap-5 px-5 py-6 sm:grid-cols-2 sm:px-6">{children}</div>
    </section>
  )
}

/** Wrapper for fields that should span both columns (e.g. a textarea). */
export function FullWidth({ children }: { children: ReactNode }) {
  return <div className="sm:col-span-2">{children}</div>
}
