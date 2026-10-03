/**
 * Step 8 — Profile Preview
 * Read-only summary of all wizard data before the user submits.
 *
 * Requirements: 11.2, 11.3, 11.4
 */

import type { UseFormReturn } from 'react-hook-form'
import { knownMarkets } from '@/features/tutors/market'
import { TEACHING_MODE_LABELS } from '@/features/tutors/tutors.types'
import type {
  OnboardingFormData,
  OnboardingStepIndex,
  SubjectOption,
  SubmitIssue,
} from '../tutorOnboarding.types'
import { ONBOARDING_STEPS } from '../tutorOnboarding.types'
import { resolveImageUrl } from '@/lib/api'
import { telegramHandle, telegramLink } from '@/lib/contactConfig'

interface ProfilePreviewStepProps {
  form: UseFormReturn<OnboardingFormData>
  /** Subject options loaded in SubjectsStep, passed down so we can show names. */
  subjectOptions: SubjectOption[]
  /** Per-field problems reported by the submit API call. */
  submitErrors: SubmitIssue[]
  /** A failure with no field-level detail, shown on its own. */
  submitErrorMessage: string | null
  /** Jumps back to the step that owns a field. */
  onGoToStep: (step: OnboardingStepIndex) => void
}

function PreviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-ink-600">{label}</dt>
      <dd className="mt-1 text-sm text-ink-900 sm:col-span-2 sm:mt-0 whitespace-pre-wrap">{value}</dd>
    </div>
  )
}

export function ProfilePreviewStep({
  form,
  subjectOptions,
  submitErrors,
  submitErrorMessage,
  onGoToStep,
}: ProfilePreviewStepProps) {
  const data = form.getValues()

  const subjectNames = subjectOptions
    .filter((s) => data.subjectIds.includes(s.id))
    .map((s) => s.name)
    .join(', ')

  const modeLabel = data.teachingMode
    ? TEACHING_MODE_LABELS[data.teachingMode]
    : '—'

  const levelsList = data.studentLevels.length > 0 ? data.studentLevels.join(', ') : '—'

  /*
   * The markets to preview a rate for: every market the platform sells in, plus
   * any market the tutor has already typed a rate for.
   *
   * The second half matters for a withdrawn market. The form keeps such a rate —
   * see the profile hydration — so a preview that listed only the registry would
   * hide a price the tutor can see, edit and submit one screen later.
   */
  const previewMarkets = [
    ...knownMarkets(),
    ...Object.keys(data.rates ?? {})
      .filter((code) => !knownMarkets().some((market) => market.code === code))
      .map((code) => ({ code, name: code, currencyName: code })),
  ]

  const langsList =
    data.languages.trim().length > 0 ? data.languages : 'English'

  const photoUrl = resolveImageUrl(data.profilePhotoUrl)

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-ink-200 bg-white shadow-sm">
        <div className="border-b border-ink-100 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-ink-900">Profile Preview</h2>
          <p className="mt-1 text-sm text-ink-600">
            Review your profile before submitting it for Tedor review. You can go back to any
            step to make changes.
          </p>
        </div>

        <dl className="divide-y divide-ink-100 px-5 sm:px-6">
          {photoUrl && (
            <div className="flex items-center gap-4 py-4">
              <dt className="text-sm font-medium text-ink-600 sm:w-1/3">Photo</dt>
              <dd className="sm:col-span-2">
                <img
                  src={photoUrl}
                  alt={`${data.displayName || 'Tutor'} profile photo`}
                  className="h-24 w-24 rounded-full border border-ink-200 bg-ink-100 object-cover"
                />
              </dd>
            </div>
          )}
          <PreviewRow label="Display Name" value={data.displayName || '—'} />
          <PreviewRow label="Headline" value={data.headline || '—'} />
          <PreviewRow label="Location" value={data.location || '—'} />
          <PreviewRow label="Bio" value={data.bio || '—'} />
          <PreviewRow label="Subjects" value={subjectNames || '—'} />
          <PreviewRow label="Student Levels" value={levelsList} />
          <PreviewRow label="Teaching Mode" value={modeLabel} />
          <PreviewRow label="Experience" value={data.experience || '—'} />
          <PreviewRow label="Education" value={data.education || '—'} />
          {/*
            One row per market, generated from the market registry, each with the
            code the tutor's own number is in. The previous version printed a
            hardcoded `£` in front of a number the API never said was pounds — a
            currency this product does not use in any market — and listed exactly
            two markets whether or not the platform sold in them.
          */}
          {previewMarkets.map((market) => {
            const entered = data.rates[market.code]?.trim()

            return (
              <PreviewRow
                key={market.code}
                label={`Hourly rate (${market.code})`}
                value={entered ? `${entered} ${market.code}/hr` : 'Not offered'}
              />
            )
          })}
          <PreviewRow label="Languages" value={langsList} />
          <PreviewRow label="Availability" value={data.availability || '—'} />
        </dl>
      </div>

      {submitErrors.length > 0 && (
        <div
          role="alert"
          aria-labelledby="submit-issues-heading"
          className="rounded-xl border border-amber-200 bg-amber-50/70 shadow-sm"
        >
          <div className="flex gap-3 border-b border-amber-200/70 px-5 py-4 sm:px-6">
            <svg
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.515 2.625H3.72c-1.347 0-2.188-1.458-1.515-2.625L8.485 2.495ZM10 5.75a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5.75Zm0 9a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h3
                id="submit-issues-heading"
                className="text-sm font-semibold text-amber-900"
              >
                Your profile isn&rsquo;t ready to submit yet
              </h3>
              <p className="mt-1 text-sm text-amber-800">
                {submitErrors.length === 1
                  ? 'One field still needs your attention.'
                  : `${submitErrors.length} fields still need your attention.`}{' '}
                Select one to go straight to it.
              </p>
            </div>
          </div>

          <ul className="divide-y divide-amber-200/50">
            {submitErrors.map((issue) => (
              <li key={issue.field}>
                <button
                  type="button"
                  onClick={() => onGoToStep(issue.step)}
                  className="group flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-amber-100/60 focus-visible:outline-2 focus-visible:outline-amber-600 focus-visible:-outline-offset-2 sm:px-6"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-amber-950">
                      {issue.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-amber-700">
                      {issue.message ?? 'Required before your profile can be reviewed.'}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-amber-700 group-hover:text-amber-900">
                    {ONBOARDING_STEPS[issue.step]}
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {submitErrorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 shadow-sm sm:px-6"
        >
          <div className="flex gap-3">
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
              <h3 className="text-sm font-semibold text-red-900">
                We couldn&rsquo;t submit your profile
              </h3>
              <p className="mt-1 text-sm text-red-800">{submitErrorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/*
        What happens after they press submit, said before they press it.

        Documents are requested *after* submission — the wizard cannot ask for an
        identity document before the profile exists — so this is the last moment
        the tutor can be told where those documents will go. Without it they
        submit, wait, and only discover the address once an admin has asked.

        Hidden entirely when no Telegram handle is configured, so a deployment
        without one shows no channel that does not work.
      */}
      <NextStepsNote />
    </div>
  )
}

/**
 * The "what happens next" note at the end of the wizard.
 *
 * Its own component rather than inline, because the document-delivery address
 * has to be read from the environment at render time and there is no reason to
 * re-render the whole preview step when that value is absent.
 */
function NextStepsNote() {
  const telegram = telegramLink()
  const handle = telegramHandle()

  if (!telegram || !handle) return null

  return (
    <aside className="rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 sm:px-6">
      <h3 className="text-sm font-semibold text-brand-900">What happens after you submit</h3>
      <p className="mt-1.5 text-sm text-brand-900">
        Our team reviews your profile. We will then ask for the documents that verify your
        qualifications &mdash; and when we do, you can send them straight to us on Telegram at{' '}
        <a
          href={telegram}
          target="_blank"
          rel="noreferrer noopener"
          className="font-semibold underline underline-offset-2 hover:text-brand-800"
        >
          {handle}
        </a>
        .
      </p>
    </aside>
  )
}
