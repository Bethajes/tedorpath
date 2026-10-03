import { useId, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * The card a wizard step's controls sit in.
 *
 * Deliberately heading-free: the wizard renders one heading above the stepper
 * block, so every step has the same heading in the same place and none of them
 * can drift. This is the surface below it.
 */
export function StepCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-ink-200 bg-white shadow-sm', className)}>
      <div className="px-5 py-6 sm:px-6">{children}</div>
    </section>
  )
}

/**
 * A single-select set of cards.
 *
 * Built on real radio inputs rather than on buttons with `aria-pressed`: a group
 * of mutually exclusive answers has to be one group to a screen reader, and
 * arrow-key navigation between options comes with the native control. The card
 * is a `<label>`, so the visible target and the hit target are the same thing
 * and tapping the description selects the option.
 */
export interface ChoiceOption {
  value: string
  label: string
  description?: string
  /** Small right-aligned text, e.g. the stage a level belongs to. */
  meta?: string
}

export interface ChoiceCardsProps {
  legend: string
  hint?: string
  error?: string
  options: readonly ChoiceOption[]
  value: string
  onChange: (value: string) => void
  /** Column count at the `sm` breakpoint. */
  columns?: 2 | 3
  /** Rendered after the options — the "other" text field, for instance. */
  children?: ReactNode
  required?: boolean
}

export function ChoiceCards({
  legend,
  hint,
  error,
  options,
  value,
  onChange,
  columns = 2,
  children,
  required = true,
}: ChoiceCardsProps) {
  const groupId = useId()
  const hintId = `${groupId}-hint`
  const errorId = `${groupId}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <fieldset aria-describedby={describedBy || undefined} className="min-w-0">
      <legend className="text-sm font-medium text-ink-800">
        {legend}
        {required ? (
          <span className="ml-1 text-red-600" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-2 text-xs font-normal text-ink-500">Optional</span>
        )}
      </legend>

      {hint ? (
        <p id={hintId} className="mt-1 text-xs text-ink-500">
          {hint}
        </p>
      ) : null}

      <div
        className={cn(
          'mt-3 grid grid-cols-1 gap-2.5',
          columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3',
        )}
      >
        {options.map((option) => {
          const selected = option.value === value
          const id = `${groupId}-${option.value}`
          return (
            <label
              key={option.value}
              htmlFor={id}
              className={cn(
                'flex cursor-pointer flex-col rounded-xl border p-4 transition-colors',
                selected
                  ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                  : 'border-ink-200 bg-white hover:border-brand-300 hover:bg-brand-50/40',
              )}
            >
              <span className="flex items-start gap-3">
                <input
                  id={id}
                  type="radio"
                  name={groupId}
                  value={option.value}
                  checked={selected}
                  onChange={() => onChange(option.value)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        selected ? 'text-brand-900' : 'text-ink-900',
                      )}
                    >
                      {option.label}
                    </span>
                    {option.meta ? (
                      <span className="shrink-0 text-xs font-medium text-ink-500">
                        {option.meta}
                      </span>
                    ) : null}
                  </span>
                  {option.description ? (
                    <span className="mt-1 block text-xs leading-relaxed text-ink-600">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </span>
            </label>
          )
        })}
      </div>

      {children ? <div className="mt-4">{children}</div> : null}

      {error ? (
        <p id={errorId} role="alert" className="mt-3 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}