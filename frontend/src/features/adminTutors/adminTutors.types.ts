/**
 * Types for the admin tutor moderation queue and review workspace.
 *
 * These mirror the admin tutor API. The list shape is deliberately narrower than
 * the detail shape: a queue row needs enough to decide *which* profile to open,
 * while the full submitted content, the account holder's email and the internal
 * notes are only on the detail response.
 *
 * The status, rejection-reason and verification enums mirror the Prisma enums.
 * They are duplicated here rather than imported from the server because the
 * frontend cannot import backend code, and a drift shows up as an option that
 * silently 422s — so the unions are written out and the API's own error codes
 * are surfaced in the UI.
 *
 * Requirements: 23.1, 24.1
 */

/** Every state a tutor profile can be in. Mirrors the Prisma ProfileStatus enum. */
export const PROFILE_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'SUSPENDED',
  'REJECTED',
  'NEEDS_INFORMATION',
] as const

export type ProfileStatus = (typeof PROFILE_STATUSES)[number]

/** Status filter offered in the queue. `all` is a query-string convention. */
export const STATUS_FILTERS = ['all', ...PROFILE_STATUSES] as const
export type StatusFilter = (typeof STATUS_FILTERS)[number]

/** Short label for a status, for badges and headings. */
export const PROFILE_STATUS_LABELS: Record<ProfileStatus, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Under review',
  APPROVED: 'Approved',
  SUSPENDED: 'Suspended',
  REJECTED: 'Rejected',
  NEEDS_INFORMATION: 'Needs information',
}

/**
 * Statuses an admin may set. Narrower than PROFILE_STATUSES: DRAFT and
 * PENDING_REVIEW belong to the tutor's own workflow.
 */
export const MODERATION_STATUSES = [
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'NEEDS_INFORMATION',
] as const

export type ModerationStatus = (typeof MODERATION_STATUSES)[number]

/**
 * The reason categories an admin may attach to a rejection.
 *
 * These are shown to the applicant on the status page, so the wording here is
 * the applicant's explanation and `REJECTION_REASON_LABELS` is the single
 * definition of it — the admin dropdown and the tutor's status page must not
 * be able to disagree.
 * Requirements: 22.1, 21.6
 */
export const REJECTION_REASONS = [
  'MISSING_DOCUMENT',
  'EDUCATION_NEEDS_CLARIFICATION',
  'PROFILE_INCOMPLETE',
  'QUALIFICATION_NEEDS_VERIFICATION',
  'OTHER',
] as const

export type RejectionReasonCategory = (typeof REJECTION_REASONS)[number]

/**
 * Applicant-facing wording for each rejection reason.
 *
 * Kept neutral and factual: a rejection is a decision about the application, not
 * about the person, and the applicant reads this on their own status page.
 */
export const REJECTION_REASON_LABELS: Record<RejectionReasonCategory, string> = {
  MISSING_DOCUMENT: 'A required document was missing',
  EDUCATION_NEEDS_CLARIFICATION: 'Your education or qualifications need more detail',
  PROFILE_INCOMPLETE: 'The profile was not complete enough to review',
  QUALIFICATION_NEEDS_VERIFICATION: 'Your qualifications could not be verified',
  OTHER: 'Another reason — see the message below',
}

/** Mirrors the Prisma VerificationStatus enum (five values). */
export const VERIFICATION_STATUSES = [
  'UNVERIFIED',
  'DOCUMENTS_REQUESTED',
  'DOCUMENTS_RECEIVED',
  'VERIFIED',
  'NEEDS_MORE_INFORMATION',
] as const

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number]

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  UNVERIFIED: 'Unverified',
  DOCUMENTS_REQUESTED: 'Documents requested',
  DOCUMENTS_RECEIVED: 'Documents received',
  VERIFIED: 'Verified',
  NEEDS_MORE_INFORMATION: 'Needs more information',
}

/**
 * The six external document checks an admin records.
 *
 * Fixed keys so two admins verifying the same tutor record the same six
 * decisions. The field order is the order they should be shown in.
 * Requirements: 26.5, 27.5
 */
export const VERIFICATION_CHECKLIST_FIELDS = [
  { key: 'govIdReceived', label: 'Government ID received' },
  { key: 'identityReviewed', label: 'Identity reviewed' },
  { key: 'educationDocReceived', label: 'Education document received' },
  { key: 'educationReviewed', label: 'Education information reviewed' },
  { key: 'certificateReceived', label: 'Relevant certificate received' },
  { key: 'qualificationReviewed', label: 'Qualification reviewed' },
] as const

export type VerificationChecklistKey = (typeof VERIFICATION_CHECKLIST_FIELDS)[number]['key']

export type VerificationChecklist = Record<VerificationChecklistKey, boolean>

/** A checklist with every key explicitly false — the starting point for an admin. */
export const EMPTY_VERIFICATION_CHECKLIST: VerificationChecklist = {
  govIdReceived: false,
  identityReviewed: false,
  educationDocReceived: false,
  educationReviewed: false,
  certificateReceived: false,
  qualificationReviewed: false,
}

/** A row in the moderation queue. */
export interface AdminTutorListItem {
  id: string
  userId: string
  displayName: string
  headline: string
  location: string | null
  teachingMode: string
  studentLevels: string[]
  /**
   * The tutor's own rate for each market.
   *
   * Two numbers, never derived from one another — there is no exchange rate in
   * this product, so a moderator is looking at two prices the tutor stated.
   */
  hourlyRateEtb: number | null
  hourlyRateUsd: number | null
  profileStatus: ProfileStatus
  verificationStatus: VerificationStatus
  createdAt: string
  updatedAt: string
  user: { id: string; name: string; email: string }
  subjects: Array<{ id: string; name: string; slug: string }>
}

/** The full profile as the review workspace needs it. */
export interface AdminTutorProfile extends AdminTutorListItem {
  bio: string
  profilePhotoUrl: string | null
  languages: string[]
  availability: string | null
  experience: string | null
  education: string | null
  applicationReference: string | null
  rejectionReason: RejectionReasonCategory | null
  adminMessage: string | null
  adminNotes: string | null
  verificationChecklist: Partial<VerificationChecklist> | null
  verifiedAt: string | null
}

export interface AdminTutorList {
  items: AdminTutorListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface AdminTutorListParams {
  page?: number
  limit?: number
  status?: StatusFilter
  search?: string
}

/**
 * The moderation payload.
 *
 * `rejectionReason` is required by the API for REJECTED and `adminMessage` for
 * NEEDS_INFORMATION; the types cannot express that dependency, so the review
 * page enforces it and the API's 422 is surfaced as-is.
 */
export interface AdminTutorStatusUpdate {
  status: ModerationStatus
  verificationStatus?: VerificationStatus
  rejectionReason?: RejectionReasonCategory
  adminMessage?: string
}

/**
 * The verification payload.
 *
 * Cannot carry `profileStatus` — the endpoint rejects it, which is what keeps
 * saving a document check from being a back door to approval.
 */
export interface AdminTutorVerificationUpdate {
  verificationStatus?: VerificationStatus
  adminNotes?: string
  verificationChecklist?: Partial<VerificationChecklist>
  verifiedAt?: string
}
