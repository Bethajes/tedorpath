/**
 * TutorOnboardingPage — `/become-a-tutor`
 *
 * Multi-step wizard for tutors to build and submit their public profile.
 *
 * Behaviour:
 * - Auth-gated: unauthenticated visitors are sent to /login?next=/become-a-tutor
 * - Loads an existing DRAFT from GET /api/tutor-profile/me if one exists
 * - Auto-saves on every forward step navigation via PATCH /api/tutor-profile
 * - Creates the profile (POST) on the first save if no profile exists yet
 * - Calls POST /api/tutor-profile/submit on the final step
 * - Shows API-returned missing-field errors on the preview step
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'

import { useAuth } from '@/features/auth/useAuth'
import { ApiError, getJson } from '@/lib/api'
import { Button } from '@/components/ui'

import {
  ONBOARDING_STEPS,
  EMPTY_FORM_DATA,
  type OnboardingFormData,
  type OnboardingStepIndex,
  type SubjectOption,
  type MyTutorProfile,
  type SubmitIssue,
} from './tutorOnboarding.types'
import { toSubmitIssues } from './tutorOnboarding.types'
import {
  createTutorProfile,
  updateTutorProfile,
  submitTutorProfile,
} from './tutorOnboarding.api'

import { BasicInfoStep } from './steps/BasicInfoStep'
import { SubjectsStep } from './steps/SubjectsStep'
import { LevelsStep } from './steps/LevelsStep'
import { TeachingModeStep } from './steps/TeachingModeStep'
import { ExperienceStep } from './steps/ExperienceStep'
import { EducationStep } from './steps/EducationStep'
import { PricingStep } from './steps/PricingStep'
import { ProfilePreviewStep } from './steps/ProfilePreviewStep'

const LAST_STEP = (ONBOARDING_STEPS.length - 1) as OnboardingStepIndex

/** Convert an existing profile into flat form-data for react-hook-form. */
function profileToFormData(profile: MyTutorProfile): Partial<OnboardingFormData> {
  return {
    displayName: profile.displayName ?? '',
    headline: profile.headline ?? '',
    bio: profile.bio ?? '',
    location: profile.location ?? '',
    profilePhotoUrl: profile.profilePhotoUrl ?? '',
    subjectIds: profile.subjects.map((s) => s.id),
    studentLevels: profile.studentLevels ?? [],
    teachingMode: profile.teachingMode ?? '',
    experience: profile.experience ?? '',
    education: profile.education ?? '',
    hourlyRate: profile.hourlyRate != null ? String(profile.hourlyRate) : '',
    languages: (profile.languages ?? ['English']).join(', '),
    availability: profile.availability ?? '',
  }
}

export function TutorOnboardingPage() {
  const { status } = useAuth()
  const navigate = useNavigate()

  const [currentStep, setCurrentStep] = useState<OnboardingStepIndex>(0)
  const [profileExists, setProfileExists] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitErrors, setSubmitErrors] = useState<SubmitIssue[]>([])
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<{ headline: string; detail: string } | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([])

  const form = useForm<OnboardingFormData>({ defaultValues: EMPTY_FORM_DATA })

  // Load active subjects for the preview step subject-name lookup
  useEffect(() => {
    getJson<SubjectOption[]>('/api/subjects')
      .then(setSubjectOptions)
      .catch(() => {
        // Non-critical — preview will just show IDs if subjects can't be fetched
      })
  }, [])

  // Load existing DRAFT profile on mount (Requirement 11.5)
  const loadProfile = useCallback(async () => {
    setLoadingProfile(true)
    try {
      const profile = await getJson<MyTutorProfile>('/api/tutor-profile/me')
      const formData = profileToFormData(profile)
      form.reset({ ...EMPTY_FORM_DATA, ...formData })
      setProfileExists(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // No profile yet — wizard starts fresh
        setProfileExists(false)
      }
      // Other errors: proceed with empty form; the user can still fill in data
    } finally {
      setLoadingProfile(false)
    }
  }, [form])

  useEffect(() => {
    if (status === 'authenticated') {
      loadProfile()
    }
  }, [status, loadProfile])

  // Redirect unauthenticated visitors (Requirement 11.1)
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: '/become-a-tutor' }} />
  }

  if (status === 'unknown' || loadingProfile) {
    return (
      <main className="min-h-screen bg-ink-50 flex items-center justify-center">
        <p role="status" className="text-sm text-ink-500">
          Loading your profile…
        </p>
      </main>
    )
  }

  if (submitSuccess) {
    return (
      <main className="min-h-screen bg-ink-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-xl border border-ink-200 bg-white shadow-sm px-8 py-10 text-center">
          <div className="text-5xl mb-4" aria-hidden="true">🎉</div>
          <h1 className="text-2xl font-bold text-ink-900 mb-3">Profile submitted!</h1>
          <p className="text-sm text-ink-600 mb-6">
            Your profile is now under review by the Tedor team. We'll be in touch soon.
          </p>
          <Button variant="primary" onClick={() => navigate('/')}>
            Back to home
          </Button>
        </div>
      </main>
    )
  }

  /** Auto-save the current step data then advance (Requirement 11.3, 6.3). */
  async function handleNext() {
    const isValid = await form.trigger()
    if (!isValid) return

    setSaving(true)
    setSaveError(null)
    try {
      const data = form.getValues()
      if (!profileExists) {
        await createTutorProfile(data)
        setProfileExists(true)
      } else {
        await updateTutorProfile(data)
      }
      setCurrentStep((s) => Math.min(s + 1, LAST_STEP) as OnboardingStepIndex)
    } catch (err) {
      // Advancing is still allowed — the data is in the form — but a save that
      // silently failed used to leave the user at step 8 with a profile the
      // server had never accepted, so the reason is now shown on the step.
      if (err instanceof ApiError && err.fields?.length) {
        setSaveError({
          headline: 'We could not save this step',
          detail: err.fields.map((f) => f.message ?? f.field).join(' '),
        })
      } else if (err instanceof ApiError) {
        setSaveError({
          headline: 'We could not save this step',
          detail:
            err.status === 0 || err.code === 'NETWORK_ERROR'
              ? 'We could not reach the server. Check your connection and try again.'
              : err.message,
        })
      } else {
        setSaveError({
          headline: 'We could not save this step',
          detail: 'Something went wrong. Your answers are still here — try again.',
        })
      }
      setCurrentStep((s) => Math.min(s + 1, LAST_STEP) as OnboardingStepIndex)
    } finally {
      setSaving(false)
    }
  }

  function handleBack() {
    setCurrentStep((s) => Math.max(s - 1, 0) as OnboardingStepIndex)
  }

  /** Submit for review on the final step (Requirement 11.3). */
  async function handleSubmit() {
    setSaving(true)
    setSubmitErrors([])
    try {
      // Save final step data first
      const data = form.getValues()
      if (!profileExists) {
        await createTutorProfile(data)
        setProfileExists(true)
      } else {
        await updateTutorProfile(data)
      }
      await submitTutorProfile()
      setSubmitSuccess(true)
    } catch (err) {
      // A 422 from either the save or the submit carries per-field detail.
      // Anything else is a plain failure with nothing actionable to report.
      if (err instanceof ApiError && err.status === 422 && err.fields?.length) {
        setSubmitErrors(toSubmitIssues(err.fields))
      } else if (err instanceof ApiError) {
        setSubmitErrorMessage(
          err.status === 0 || err.code === 'NETWORK_ERROR'
            ? 'We could not reach the server. Check your connection and try again.'
            : err.message,
        )
      } else {
        setSubmitErrorMessage('Something went wrong while submitting. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  /** Jump to the step that owns a field so it can be corrected in place. */
  function handleGoToStep(step: OnboardingStepIndex) {
    setSubmitErrors([])
    setSubmitErrorMessage(null)
    setCurrentStep(step)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isLastStep = currentStep === LAST_STEP

  return (
    <main className="min-h-screen bg-ink-50 py-10 px-4">
      <div className="mx-auto max-w-2xl">
        {/* Page heading */}
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-ink-900">Become a Tutor</h1>
          <p className="mt-2 text-sm text-ink-500">
            Complete the steps below to create your public tutor profile.
          </p>
        </header>

        {/* Step progress indicator */}
        <StepIndicator current={currentStep} total={ONBOARDING_STEPS.length} />

        {/* Step title */}
        <p className="mb-6 text-center text-base font-semibold text-ink-700">
          Step {currentStep + 1} of {ONBOARDING_STEPS.length}:{' '}
          {ONBOARDING_STEPS[currentStep]}
        </p>

        {/* Step content */}
        <form noValidate onSubmit={(e) => e.preventDefault()}>
          {saveError && (
            <div
              role="alert"
              className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 shadow-sm"
            >
              <svg
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 1.5 0v-3.5Zm-.75 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="text-sm font-semibold text-red-900">{saveError.headline}</p>
                <p className="mt-1 text-sm text-red-800">{saveError.detail}</p>
              </div>
            </div>
          )}

          <StepRenderer
            step={currentStep}
            form={form}
            subjectOptions={subjectOptions}
            submitErrors={submitErrors}
            submitErrorMessage={submitErrorMessage}
            onGoToStep={handleGoToStep}
          />

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0 || saving}
              type="button"
            >
              Back
            </Button>

            {isLastStep ? (
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={saving}
                type="button"
              >
                {saving ? 'Submitting…' : 'Submit for Review'}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleNext}
                disabled={saving}
                type="button"
              >
                {saving ? 'Saving…' : 'Next'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <nav aria-label="Onboarding progress" className="mb-4">
      <ol className="flex items-center justify-center gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <li key={i}>
            <div
              aria-current={i === current ? 'step' : undefined}
              className={[
                'h-2 rounded-full transition-all',
                i === current
                  ? 'w-6 bg-brand-600'
                  : i < current
                  ? 'w-2 bg-brand-400'
                  : 'w-2 bg-ink-200',
              ].join(' ')}
              aria-label={`Step ${i + 1}${i < current ? ' (completed)' : i === current ? ' (current)' : ''}`}
            />
          </li>
        ))}
      </ol>
    </nav>
  )
}

interface StepRendererProps {
  step: OnboardingStepIndex
  form: ReturnType<typeof useForm<OnboardingFormData>>
  subjectOptions: SubjectOption[]
  submitErrors: SubmitIssue[]
  submitErrorMessage: string | null
  onGoToStep: (step: OnboardingStepIndex) => void
}

function StepRenderer({
  step,
  form,
  subjectOptions,
  submitErrors,
  submitErrorMessage,
  onGoToStep,
}: StepRendererProps) {
  switch (step) {
    case 0: return <BasicInfoStep form={form} />
    case 1: return <SubjectsStep form={form} />
    case 2: return <LevelsStep form={form} />
    case 3: return <TeachingModeStep form={form} />
    case 4: return <ExperienceStep form={form} />
    case 5: return <EducationStep form={form} />
    case 6: return <PricingStep form={form} />
    case 7: return (
      <ProfilePreviewStep
        form={form}
        subjectOptions={subjectOptions}
        submitErrors={submitErrors}
        submitErrorMessage={submitErrorMessage}
        onGoToStep={onGoToStep}
      />
    )
    default: return null
  }
}
