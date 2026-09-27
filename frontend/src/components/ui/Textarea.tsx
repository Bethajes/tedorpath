import { forwardRef, type TextareaHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

import { controlClassName } from './controlStyles'

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, invalid = false, rows = 5, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={invalid || undefined}
        className={cn(controlClassName(invalid), 'resize-y', className)}
        {...props}
      />
    )
  },
)
