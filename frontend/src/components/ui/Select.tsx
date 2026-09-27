import { forwardRef, type SelectHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

import { controlClassName } from './controlStyles'

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid = false, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(controlClassName(invalid), 'appearance-none pr-9', className)}
      {...props}
    >
      {children}
    </select>
  )
})
