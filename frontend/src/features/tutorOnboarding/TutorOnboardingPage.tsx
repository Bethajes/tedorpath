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
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'

import { useAuth } from '@/features/auth/useAuth'
import { PageShell } from '@/components/layout/PageShell'
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
  type TutorProfileStatus,
} from './tutorOnboarding.types'
import { toSubmitIssues } from './tutorOnboarding.types'
import {
  createStarterProfile,
  createTutorProfile,
  getMyTutorProfile,
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
  const { status, user } = useAuth()
  const navigate = useNavigate()

  const [currentStep, setCurrentStep] = useState<OnboardingStepIndex>(0)
  const [profileExists, setProfileExists] = useState(false)
  const [profileStatus, setProfileStatus] = useState<TutorProfileStatus | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitErrors, setSubmitErrors] = useState<SubmitIssue[]>([])
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<{ headline: string; detail: string } | null>(null)
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

  /**
   * Loads the applicant's own profile, creating a DRAFT if there is none yet.
   *
   * Requirement 11.5 loads saved progress, and Requirement 17.2 additionally
   * creates the profile up front. Both happen in the same loading state the
   * page already had, so the applicant never sees a flash of a half-built form
   * and the step-1 photo upload always has a profile to write to.
   */
  const loadProfile = useCallback(async () => {
    setLoadingProfile(true)
    setLoadError(null)
    try {
      let profile: MyTutorProfile
      try {
        profile = await getMyTutorProfile()
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 404) throw err

        // No profile yet. Create the DRAFT the applicant can start filling in.
        // A 409 means one appeared in the meantime (a second tab, a retry), so
        // the existing profile is the correct outcome and we load it instead of
        // treating it as a failure — Requirement 17.3.
        try {
          profile = await createStarterProfile(user?.name ?? '')
        } catch (createErr) {
          if (createErr instanceof ApiError && createErr.status === 409) {
            profile = await getMyTutorProfile()
          } else {
            throw createErr
          }
        }
      }

      form.reset({ ...EMPTY_FORM_DATA, ...profileToFormData(profile) })
      setProfileExists(true)
      setProfileStatus(profile.profileStatus)
    } catch (err) {
      // Requirement 17.4: a profile we could not create is not a reason to
      // render an editor whose first save will fail. Say so and stop.
      setProfileExists(false)
      setProfileStatus(null)
      setLoadError(
        err instanceof ApiError && (err.status === 0 || err.code === 'NETWORK_ERROR')
          ? 'We could not reach the server to start your profile. Check your connection and try again.'
          : 'We could not start your tutor profile. Please try again in a moment.',
      )
    } finally {
      setLoadingProfile(false)
    }
  }, [form, user?.name])

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
      <PageShell bare className="bg-ink-50">
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <p role="status" className="text-sm text-ink-500">
            Loading your profile…
          </p>
        </div>
      </PageShell>
    )
  }

  if (loadError) {
    return (
      <PageShell bare className="bg-ink-50">
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="max-w-md rounded-xl border border-red-200 bg-white px-8 py-10 text-center shadow-sm">
            <h1 className="mb-3 text-xl font-bold text-ink-900">
              We could not start your application
            </h1>
            <p className="mb-6 text-sm text-ink-600">{loadError}</p>
            <Button variant="primary" onClick={() => loadProfile()}>
              Try again
            </Button>
          </div>
        </div>
      </PageShell>
    )
  }

  // An approved or suspended profile is finished with: there is nothing left to
  // edit, so send the tutor to the status page rather than showing a wizard
  // that would refuse every save. Requirements: 25.3, 28.4
  if (profileStatus === 'APPROVED' || profileStatus === 'SUSPENDED') {
    return <Navigate to="/tutor/application-status" replace />
  }

  // A profile that is under review must not be edited behind the moderator's
  // back — a save here would change the content they are reading.
  // Requirement 25.2
  if (profileStatus === 'PENDING_REVIEW') {
    return <UnderReviewNotice />
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
      // Straight to the status page rather than a congratulation card: the
      // reference number and the document checklist live there, and a tutor who
      // needs to know what happens next should land somewhere that answers it.
      // Requirement 21.1
      navigate('/tutor/application-status', { replace: true })
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
    <PageShell bare className="bg-ink-50">
      <div className="px-4 py-10">
        <div className="mx-auto max-w-2xl">
        {/* Contextual banner for REJECTED / NEEDS_INFORMATION — Requirements 25.1, 25.2 */}
        {profileStatus === 'REJECTED' && (
          <div
            role="alert"
            className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 shadow-sm"
          >
            <svg aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 1.5 0v-3.5Zm-.75 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-900">Your application was not approved</p>
              <p className="mt-1 text-sm text-red-800">
                Please update your profile and resubmit.{' '}
                <Link to="/tutor/application-status" className="underline hover:no-underline">
                  View feedback
                </Link>
              </p>
            </div>
          </div>
        )}
        {profileStatus === 'NEEDS_INFORMATION' && (
          <div
            role="alert"
            className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm"
          >
            <svg aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-900">Additional information required</p>
              <p className="mt-1 text-sm text-amber-800">
                The Tedor team has requested more details.{' '}
                <Link to="/tutor/application-status" className="underline hover:no-underline">
                  View the message
                </Link>{' '}
                then update your profile and resubmit.
              </p>
            </div>
          </div>
        )}

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
      </div>
    </PageShell>
  )
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Shown instead of the wizard when a profile is under review.
 *
 * Editing here is not merely hidden but impossible on purpose: the moderator is
 * reading a specific version of the profile, and a silent edit underneath them
 * would mean the decision is made on something they never saw. The status page
 * is where the review progress is explained. Requirement 25.2
 */
function UnderReviewNotice() {
  return (
    <PageShell bare className="bg-ink-50">
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-ink-200 bg-white px-8 py-10 text-center shadow-sm">
          <h1 className="mb-3 text-xl font-bold text-ink-900">Your application is under review</h1>
          <p className="mb-6 text-sm text-ink-600">
            You cannot edit it at this time. We will contact you if we need anything else.
          </p>
          <Link
            to="/tutor/application-status"
            className="inline-flex items-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            View application status
          </Link>
        </div>
      </div>
    </PageShell>
  )
}

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
