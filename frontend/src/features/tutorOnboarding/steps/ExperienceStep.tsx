/**
 * Step 5 — Experience
 * Free-text description of the tutor's teaching and professional experience.
 *
 * Requirements: 11.2
 */

import type { UseFormReturn } from 'react-hook-form'
import { Field, Textarea } from '@/components/ui'
import { FormSection, FullWidth } from '@/components/form/FormSection'
import type { OnboardingFormData } from '../tutorOnboarding.types'

interface ExperienceStepProps {
  form: UseFormReturn<OnboardingFormData>
}

export function ExperienceStep({ form }: ExperienceStepProps) {
  const {
    register,
    formState: { errors },
  } = form

  return (
    <div className="space-y-6">
      <FormSection
        title="Teaching Experience"
        description="Describe your tutoring background, previous students, and any relevant professional experience."
      >
        <FullWidth>
          <Field
            id="experience"
            label="Experience"
            hint="Share your teaching history and relevant professional background. (max 2000 characters)"
            error={errors.experience?.message}
          >
            {(fieldProps) => (
              <Textarea
                {...register('experience')}
                {...fieldProps}
                rows={8}
                maxLength={2000}
                placeholder="e.g. I have been tutoring A-Level Mathematics for 5 years, helping over 50 students achieve their target grades…"
                invalid={Boolean(errors.experience)}
              />
            )}
          </Field>
        </FullWidth>
      </FormSection>
    </div>
  )
}
