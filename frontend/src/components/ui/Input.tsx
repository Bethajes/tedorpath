import { forwardRef, type InputHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

import { controlClassName } from './controlStyles'

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid = false, type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(controlClassName(invalid), className)}
      {...props}
    />
  )
})
