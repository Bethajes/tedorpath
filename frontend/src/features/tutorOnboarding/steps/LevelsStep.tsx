/**
 * Step 3 — Student Levels
 * Multi-select from EDUCATION_LEVELS constant.
 *
 * Requirements: 11.2, 2.6
 */

import type { UseFormReturn } from 'react-hook-form'
import { EDUCATION_LEVELS } from '@/types/tutorRequest'
import type { OnboardingFormData } from '../tutorOnboarding.types'

interface LevelsStepProps {
  form: UseFormReturn<OnboardingFormData>
}

export function LevelsStep({ form }: LevelsStepProps) {
  const { register, watch, setValue, formState: { errors } } = form
  const selectedLevels = watch('studentLevels')

  function toggleLevel(level: string) {
    if (selectedLevels.includes(level)) {
      setValue('studentLevels', selectedLevels.filter((l) => l !== level), { shouldValidate: true })
    } else {
      setValue('studentLevels', [...selectedLevels, level], { shouldValidate: true })
    }
  }

  return (
    <div className="space-y-6">
      {/* Driven by the toggle buttons, but registered so the rule below actually
          runs when one is clicked — without it `errors.studentLevels` could
          never be populated. Requirement 18.4. */}
      <input
        type="hidden"
        {...register('studentLevels', {
          validate: (value) =>
            (value?.length ?? 0) > 0 || 'Please select at least one level.',
        })}
      />

      <div className="rounded-xl border border-ink-200 bg-white shadow-sm">
        <div className="border-b border-ink-100 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-ink-900">Student Levels</h2>
          <p className="mt-1 text-sm text-ink-600">
            Select the student levels you are comfortable teaching. At least one is required.
          </p>
        </div>

        <div className="px-5 py-6 sm:px-6">
          <div role="group" aria-label="Student levels" className="flex flex-wrap gap-3">
            {EDUCATION_LEVELS.map((level) => {
              const selected = selectedLevels.includes(level)
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => toggleLevel(level)}
                  aria-pressed={selected}
                  className={[
                    'rounded-full border px-5 py-2.5 text-sm font-medium transition-colors',
                    selected
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-ink-200 bg-white text-ink-700 hover:border-brand-400 hover:bg-brand-50',
                  ].join(' ')}
                >
                  {level}
                </button>
              )
            })}
          </div>

          {errors.studentLevels && (
            <p role="alert" className="mt-3 text-xs font-medium text-red-600">
              {errors.studentLevels.message}
            </p>
          )}

          {selectedLevels.length > 0 && (
            <p className="mt-4 text-sm text-ink-500">
              {selectedLevels.length} level{selectedLevels.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
