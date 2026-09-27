import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

export type AlertTone = 'info' | 'success' | 'error'

const TONE_CLASSES: Record<AlertTone, string> = {
  info: 'border-brand-200 bg-brand-50 text-brand-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
}

export type AlertProps = HTMLAttributes<HTMLDivElement> & {
  tone?: AlertTone
}

export function Alert({ tone = 'info', className, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn('rounded-lg border px-4 py-3 text-sm', TONE_CLASSES[tone], className)}
      {...props}
    />
  )
}
