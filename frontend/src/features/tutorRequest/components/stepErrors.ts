import type { FieldErrors } from 'react-hook-form'

import type { WizardFormValues } from '../tutorRequest.steps'

/**
 * Reading react-hook-form's error state for display.
 *
 * Its own module because it is a helper rather than a component: keeping it next
 * to the step components would stop this file from exporting only components,
 * which is what lets the dev server's fast refresh work while editing a step.
 */
export type StepErrors = FieldErrors<WizardFormValues>

/**
 * One field's error message, or undefined when the field is valid.
 *
 * react-hook-form types an error as `FieldError | Merge<FieldError, FieldErrors>`,
 * so the message has to be read defensively: a field that failed a
 * cross-field refinement has no `type`, and a nested field has no `message` at
 * all. Anything that is not a string is simply "no message", which leaves the
 * field un-highlighted rather than showing an empty error region.
 */
export function errorMessage(
  errors: StepErrors,
  name: keyof WizardFormValues,
): string | undefined {
  const entry: unknown = errors[name]
  if (entry && typeof entry === 'object' && 'message' in entry) {
    const { message } = entry as { message?: unknown }
    if (typeof message === 'string') return message
  }
  return undefined
}