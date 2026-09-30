/**
 * Step 6 — Education
 * Free-text description of the tutor's academic qualifications.
 *
 * Requirements: 11.2
 */

import type { UseFormReturn } from 'react-hook-form'
import { Field, Textarea } from '@/components/ui'
import { FormSection, FullWidth } from '@/components/form/FormSection'
import type { OnboardingFormData } from '../tutorOnboarding.types'

interface EducationStepProps {
  form: UseFormReturn<OnboardingFormData>
}

export function EducationStep({ form }: EducationStepProps) {
  const {
    register,
    formState: { errors },
  } = form

  return (
    <div className="space-y-6">
      <FormSection
        title="Education"
        description="List your academic qualifications, degrees, and any relevant certifications."
      >
        <FullWidth>
          <Field
            id="education"
            label="Education"
            hint="Describe your academic background and qualifications. (max 2000 characters)"
            error={errors.education?.message}
          >
            {(fieldProps) => (
              <Textarea
                {...register('education')}
                {...fieldProps}
                rows={8}
                maxLength={2000}
                placeholder="e.g. BSc Mathematics, University of London (2018). A-Levels: Maths (A*), Further Maths (A*), Physics (A)…"
                invalid={Boolean(errors.education)}
              />
            )}
          </Field>
        </FullWidth>
      </FormSection>
    </div>
  )
}
