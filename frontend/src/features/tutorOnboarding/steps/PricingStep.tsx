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
          hint="Your rate per hour in GBP. Leave blank if you prefer to discuss pricing."
          error={errors.hourlyRate?.message}
        >
          {(fieldProps) => (
            <Input
              {...register('hourlyRate')}
              {...fieldProps}
              type="number"
              min="0"
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
              {...register('languages')}
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
                {...register('availability')}
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
