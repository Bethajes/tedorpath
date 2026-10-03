import type { ReactNode } from 'react'

import { RequiredMark } from '@/components/form/RequiredMark'

export interface FieldRenderProps {
  id: string
  'aria-describedby': string | undefined
  'aria-invalid': boolean | undefined
}

export interface FieldProps {
  id: string
  label: string
  required?: boolean
  hint?: string
  error?: string
  /**
   * Set where the surrounding text already says the whole group is optional —
   * a step description, or a fieldset legend.
   *
   * Not cosmetic. The marker sits inside the `<label>`, so it becomes part of the
   * control's accessible name: a screen reader otherwise announces "From
   * Optional" for a field whose group is already marked optional, and any code
   * that looks the control up by name has to know about it.
   */
  hideOptionalMarker?: boolean
  /** Renders the control with the accessibility wiring Field computed. */
  children: (props: FieldRenderProps) => ReactNode
}

/**
 * Label + required marker + hint + error wrapper for a single form control.
 *
 * The control is supplied through a render prop so the generated ids and ARIA
 * attributes land on the real element without cloning.
 */
export function Field({
  id,
  label,
  required = false,
  hint,
  error,
  hideOptionalMarker = false,
  children,
}: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-800">
        {label}
        {required ? <RequiredMark /> : null}
        {!required && !hideOptionalMarker ? (
          <span className="ml-2 text-xs font-normal text-ink-500">Optional</span>
        ) : null}
      </label>

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}

      {hint ? (
        <p id={hintId} className="text-xs text-ink-500">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  )
}
