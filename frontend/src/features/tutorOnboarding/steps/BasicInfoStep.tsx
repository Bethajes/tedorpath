/**
 * Step 1 — Basic Information
 * Fields: displayName, headline, bio, location, profilePhoto
 *
 * Requirements: 11.2
 */

import type { UseFormReturn } from 'react-hook-form'
import { Field, Input, Textarea } from '@/components/ui'
import { FormSection, FullWidth } from '@/components/form/FormSection'
import { deleteProfilePhoto, uploadProfilePhoto } from '../tutorOnboarding.api'
import { ProfilePhotoPicker } from '../components/ProfilePhotoPicker'
import type { OnboardingFormData } from '../tutorOnboarding.types'

interface BasicInfoStepProps {
  form: UseFormReturn<OnboardingFormData>
}

export function BasicInfoStep({ form }: BasicInfoStepProps) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form

  const profilePhotoUrl = watch('profilePhotoUrl')

  return (
    <div className="space-y-6">
      <FormSection
        title="Basic Information"
        description="Tell students who you are and what you offer."
      >
        <Field
          id="displayName"
          label="Display Name"
          required
          hint="This is how students will see your name."
          error={errors.displayName?.message}
        >
          {(fieldProps) => (
            <Input
              {...register('displayName')}
              {...fieldProps}
              placeholder="e.g. Sarah Johnson"
              autoComplete="name"
              invalid={Boolean(errors.displayName)}
            />
          )}
        </Field>

        <Field
          id="headline"
          label="Headline"
          required
          hint="A short description of your teaching specialty (max 160 characters)."
          error={errors.headline?.message}
        >
          {(fieldProps) => (
            <Input
              {...register('headline')}
              {...fieldProps}
              placeholder="e.g. Experienced Maths tutor specialising in A-Level"
              maxLength={160}
              invalid={Boolean(errors.headline)}
            />
          )}
        </Field>

        <Field
          id="location"
          label="Location"
          hint="City or neighbourhood where you are based."
          error={errors.location?.message}
        >
          {(fieldProps) => (
            <Input
              {...register('location')}
              {...fieldProps}
              placeholder="e.g. London, UK"
              autoComplete="address-level2"
              invalid={Boolean(errors.location)}
            />
          )}
        </Field>

        <FullWidth>
          {/* The photo is uploaded as soon as it is chosen, and the resulting
              path is written straight onto the form so the wizard's existing
              save-on-next carries it like any other field. */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-800">
              Profile Photo
              <span className="ml-2 text-xs font-normal text-ink-500">Optional</span>
            </span>
            <ProfilePhotoPicker
              value={profilePhotoUrl || null}
              onUpload={uploadProfilePhoto}
              onDelete={deleteProfilePhoto}
              onChange={(url) =>
                setValue('profilePhotoUrl', url ?? '', { shouldDirty: true })
              }
            />
            {errors.profilePhotoUrl && (
              <p role="alert" className="text-xs font-medium text-red-600">
                {errors.profilePhotoUrl.message}
              </p>
            )}
          </div>
        </FullWidth>

        <FullWidth>
          <Field
            id="bio"
            label="Bio"
            required
            hint="Tell students about yourself, your teaching style, and your background. (max 2000 characters)"
            error={errors.bio?.message}
          >
            {(fieldProps) => (
              <Textarea
                {...register('bio')}
                {...fieldProps}
                rows={6}
                maxLength={2000}
                placeholder="Share your background, teaching philosophy, and what makes you a great tutor…"
                invalid={Boolean(errors.bio)}
              />
            )}
          </Field>
        </FullWidth>
      </FormSection>
    </div>
  )
}
