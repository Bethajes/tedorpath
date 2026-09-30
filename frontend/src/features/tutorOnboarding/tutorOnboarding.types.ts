/**
 * Types for the tutor onboarding wizard.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 19.1
 */

import type { TeachingMode } from '@/features/tutors/tutors.types'

/**
 * Every state a tutor profile can be in.
 *
 * NEEDS_INFORMATION is new in the extended verification workflow: an admin can
 * ask the tutor for more information without rejecting them, and the wizard
 * has to be able to represent that.
 */
export type TutorProfileStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'SUSPENDED'
  | 'REJECTED'
  | 'NEEDS_INFORMATION'

/** Mirrors the Prisma VerificationStatus enum. */
export type TutorVerificationStatus =
  | 'UNVERIFIED'
  | 'DOCUMENTS_REQUESTED'
  | 'DOCUMENTS_RECEIVED'
  | 'VERIFIED'
  | 'NEEDS_MORE_INFORMATION'

/**
 * Profile data as returned by `GET /api/tutor-profile/me`.
 * Contains all fields including DRAFT ones not shown in public APIs.
 */
export interface MyTutorProfile {
  id: string
  userId: string
  displayName: string
  headline: string
  bio: string
  location: string | null
  profilePhotoUrl: string | null
  teachingMode: TeachingMode
  studentLevels: string[]
  languages: string[]
  availability: string | null
  hourlyRate: number | null
  experience: string | null
  education: string | null
  profileStatus: TutorProfileStatus
  verificationStatus: TutorVerificationStatus
  /**
   * Moderation feedback, written only by the admin API and read back only by
   * the owning tutor. Null until an admin has actually said something, which is
   * why the status page treats every one of them as optional.
   * Requirements: 20.3, 21.5, 21.6, 22.7
   */
  applicationReference: string | null
  rejectionReason: string | null
  adminMessage: string | null
  subjects: Array<{ id: string; name: string; slug: string }>
  createdAt: string
  updatedAt: string
}

/** The shape of the wizard form data accumulated across all steps. */
export interface OnboardingFormData {
  // Step 1 — Basic Info
  displayName: string
  headline: string
  bio: string
  location: string
  profilePhotoUrl: string

  // Step 2 — Subjects (stored as subject IDs)
  subjectIds: string[]

  // Step 3 — Levels
  studentLevels: string[]

  // Step 4 — Teaching Mode
  teachingMode: TeachingMode | ''

  // Step 5 — Experience
  experience: string

  // Step 6 — Education
  education: string

  // Step 7 — Pricing
  hourlyRate: string
  languages: string
  availability: string
}

export const EMPTY_FORM_DATA: OnboardingFormData = {
  displayName: '',
  headline: '',
  bio: '',
  location: '',
  profilePhotoUrl: '',
  subjectIds: [],
  studentLevels: [],
  teachingMode: '',
  experience: '',
  education: '',
  hourlyRate: '',
  languages: '',
  availability: '',
}

/**
 * The 8 wizard steps.
 *
 * Steps are indexed 0–7; step 7 is the read-only preview before submit.
 * Requirement 11.2 names them all explicitly.
 */
export const ONBOARDING_STEPS = [
  'Basic Information',
  'Teaching Subjects',
  'Student Levels',
  'Teaching Mode',
  'Experience',
  'Education',
  'Pricing',
  'Profile Preview',
] as const

export type OnboardingStepName = (typeof ONBOARDING_STEPS)[number]
export type OnboardingStepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

/** A subject option as returned from the API, used in the SubjectsStep. */
export interface SubjectOption {
  id: string
  name: string
  slug: string
  category: string
}

/**
 * How a blocked submit is described to the user: a headline, the specific
 * fields that need attention, and the step each one lives on so the user can
 * jump straight to it.
 */
export interface SubmitIssue {
  /** The API's field name, e.g. `hourlyRate`. */
  field: string
  /** Human-readable label, e.g. `Hourly rate`. */
  label: string
  /** The wizard step that owns this field, so the error can link to it. */
  step: OnboardingStepIndex
  /** Optional server-supplied detail. */
  message?: string
}

/**
 * Maps an API field name to its display label and owning step.
 *
 * The API reports raw column/field names (`subjectIds`, `studentLevels`). Those
 * are meaningless to someone filling in a form, and a name like `subjects` maps
 * back to the "Subjects" step while `subjectIds` maps to the same step — both
 * are listed here so either spelling resolves to one place.
 */
const FIELD_STEP_MAP: Record<string, { label: string; step: OnboardingStepIndex }> = {
  displayName: { label: 'Display name', step: 0 },
  headline: { label: 'Headline', step: 0 },
  bio: { label: 'Bio', step: 0 },
  location: { label: 'Location', step: 0 },
  profilePhotoUrl: { label: 'Profile photo', step: 0 },

  subjects: { label: 'Teaching subjects', step: 1 },
  subjectIds: { label: 'Teaching subjects', step: 1 },

  studentLevels: { label: 'Student levels', step: 2 },

  teachingMode: { label: 'Teaching mode', step: 3 },

  experience: { label: 'Experience', step: 4 },

  education: { label: 'Education', step: 5 },

  hourlyRate: { label: 'Hourly rate', step: 6 },
  languages: { label: 'Languages', step: 6 },
  availability: { label: 'Availability', step: 6 },
}

/**
 * Turn API field errors into presentable issues.
 *
 * Unknown fields are kept rather than dropped, labelled with a readable form of
 * the key, so a newly added server-side requirement still surfaces to the user
 * instead of vanishing.
 */
export function toSubmitIssues(
  fields: Array<{ field: string; message?: string }>,
): SubmitIssue[] {
  // Keyed on label+step rather than the raw field name, so the two spellings
  // that mean the same thing (`subjects` and `subjectIds`) collapse into one
  // entry instead of rendering as an identical pair.
  const seen = new Set<string>()
  const issues: SubmitIssue[] = []

  for (const { field, message } of fields) {
    const mapped = FIELD_STEP_MAP[field]
    const label = mapped
      ? mapped.label
      : field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
    const step = mapped ? mapped.step : 7

    const key = `${step}:${label}`
    if (seen.has(key)) continue
    seen.add(key)

    issues.push({ field, label, step, message })
  }

  // Stable, wizard-order presentation.
  return issues.sort((a, b) => a.step - b.step)
}
