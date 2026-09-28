import { forwardRef, type ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'outline' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 hover:shadow',
  accent: 'bg-accent-500 text-white shadow-sm hover:bg-accent-600 hover:shadow',
  secondary: 'bg-ink-100 text-ink-900 hover:bg-ink-200',
  outline: 'border border-ink-200 bg-white text-ink-800 hover:border-ink-300 hover:bg-ink-50',
  ghost: 'text-brand-700 hover:bg-brand-50',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-[0.95rem]',
  lg: 'px-5 py-3 text-base',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    className,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
        'transition-[background-color,border-color,box-shadow,color] duration-150',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    />
  )
})
