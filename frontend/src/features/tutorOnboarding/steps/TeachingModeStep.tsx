/**
 * Step 4 — Teaching Mode
 * Select ONLINE / IN_PERSON / BOTH, with a location hint when in-person.
 *
 * Requirements: 11.2, 2.7
 */

import type { UseFormReturn } from 'react-hook-form'
import { TEACHING_MODES, TEACHING_MODE_LABELS } from '@/features/tutors/tutors.types'
import { Field, Input } from '@/components/ui'
import type { OnboardingFormData } from '../tutorOnboarding.types'

interface TeachingModeStepProps {
  form: UseFormReturn<OnboardingFormData>
}

export function TeachingModeStep({ form }: TeachingModeStepProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form

  const selectedMode = watch('teachingMode')
  const showLocationHint = selectedMode === 'IN_PERSON' || selectedMode === 'BOTH'

  return (
    <div className="space-y-6">
      {/* Registered so the rule below runs when a mode is chosen or when the
          step is submitted empty. `teachingMode` is required for the profile to
          be complete (Requirement 18.5), so an untouched step has to be able to
          report that rather than passing through silently. */}
      <input
        type="hidden"
        {...register('teachingMode', {
          required: 'Please choose how you teach: online, in person, or both.',
        })}
      />

      <div className="rounded-xl border border-ink-200 bg-white shadow-sm">
        <div className="border-b border-ink-100 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-ink-900">Teaching Mode</h2>
          <p className="mt-1 text-sm text-ink-600">
            How do you prefer to deliver your tutoring sessions?
          </p>
        </div>

        <div className="px-5 py-6 sm:px-6 space-y-6">
          <div role="group" aria-label="Teaching mode" className="flex flex-wrap gap-3">
            {TEACHING_MODES.map((mode) => {
              const selected = selectedMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setValue('teachingMode', mode, { shouldValidate: true })}
                  aria-pressed={selected}
                  className={[
                    'rounded-full border px-5 py-2.5 text-sm font-medium transition-colors',
                    selected
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-ink-200 bg-white text-ink-700 hover:border-brand-400 hover:bg-brand-50',
                  ].join(' ')}
                >
                  {TEACHING_MODE_LABELS[mode]}
                </button>
              )
            })}
          </div>

          {errors.teachingMode && (
            <p role="alert" className="text-xs font-medium text-red-600">
              {errors.teachingMode.message}
            </p>
          )}

          {showLocationHint && (
            <Field
              id="location"
              label="Location"
              hint="Where are you available for in-person sessions? (e.g. London, UK)"
              error={errors.location?.message}
            >
              {(fieldProps) => (
                <Input
                  {...register('location', {
                    maxLength: {
                      value: 120,
                      message: 'Location must be 120 characters or fewer.',
                    },
                  })}
                  {...fieldProps}
                  placeholder="e.g. London, UK"
                  autoComplete="address-level2"
                  invalid={Boolean(errors.location)}
                />
              )}
            </Field>
          )}
        </div>
      </div>
    </div>
  )
}
