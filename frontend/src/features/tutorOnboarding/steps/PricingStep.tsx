/**
 * Step 7 — Pricing
 * Fields: hourlyRate, languages, availability.
 *
 * Requirements: 11.2
 */

import type { UseFormReturn } from 'react-hook-form'
import { Field, Input, Textarea } from '@/components/ui'
import { FormSection, FullWidth } from '@/components/form/FormSection'
import type { OnboardingFormData } from '../tutorOnboarding.types'

interface PricingStepProps {
  form: UseFormReturn<OnboardingFormData>
}

export function PricingStep({ form }: PricingStepProps) {
  const {
    register,
    formState: { errors },
  } = form

  return (
    <div className="space-y-6">
      <FormSection
        title="Pricing & Availability"
        description="Set your rate and let students know when you are available."
      >
        <Field
          id="hourlyRate"
          label="Hourly Rate (£)"
          required
          hint="Your rate per hour in GBP, up to £9999.99. This is required before you can submit — you can change it later."
          error={errors.hourlyRate?.message}
        >
          {(fieldProps) => (
            <Input
              {...register('hourlyRate', {
                required: 'Please enter your hourly rate — it is required to submit.',
                validate: (value) => {
                  const trimmed = value.trim()
                  if (trimmed === '') return 'Please enter your hourly rate — it is required to submit.'

                  const parsed = Number(trimmed)
                  if (!Number.isFinite(parsed)) return 'Hourly rate must be a number.'
                  if (parsed < 0) return 'Hourly rate cannot be negative.'
                  if (parsed > 9999.99) return 'Hourly rate must be £9999.99 or less.'
                  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
                    return 'Hourly rate can have at most two decimal places.'
                  }
                  return true
                },
              })}
              {...fieldProps}
              type="number"
              min="0"
              max="9999.99"
              step="0.01"
              placeholder="e.g. 35"
              invalid={Boolean(errors.hourlyRate)}
            />
          )}
        </Field>

        <Field
          id="languages"
          label="Languages"
          hint="Comma-separated list of languages you can teach in (e.g. English, French)."
          error={errors.languages?.message}
        >
          {(fieldProps) => (
            <Input
              {...register('languages', {
                maxLength: {
                  value: 200,
                  message: 'Languages must be 200 characters or fewer.',
                },
              })}
              {...fieldProps}
              placeholder="English, French"
              invalid={Boolean(errors.languages)}
            />
          )}
        </Field>

        <FullWidth>
          <Field
            id="availability"
            label="Availability"
            hint="Describe when you are typically available for sessions. (max 300 characters)"
            error={errors.availability?.message}
          >
            {(fieldProps) => (
              <Textarea
                {...register('availability', {
                  maxLength: {
                    value: 300,
                    message: 'Availability must be 300 characters or fewer.',
                  },
                })}
                {...fieldProps}
                rows={4}
                maxLength={300}
                placeholder="e.g. Weekday evenings (6–9 pm) and weekend mornings."
                invalid={Boolean(errors.availability)}
              />
            )}
          </Field>
        </FullWidth>
      </FormSection>
    </div>
  )
}
