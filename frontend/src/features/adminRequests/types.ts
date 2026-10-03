/**
 * Types for the admin dashboard.
 *
 * These mirror the admin API responses. The list shape is intentionally
 * narrower than the detail shape — the server does not send admin notes or
 * full contact details in list responses.
 */

export const ADMIN_STATUSES = [
  'NEW',
  'CONTACTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const

export type AdminStatus = (typeof ADMIN_STATUSES)[number]

export const STATUS_FILTERS = ['all', ...ADMIN_STATUSES] as const
export type StatusFilter = (typeof STATUS_FILTERS)[number]

/**
 * The tutor a client asked for, resolved from the profile they came from.
 *
 * Null when the request was made without choosing a tutor, and also when the
 * chosen tutor has since been deleted or un-published: the relation is
 * `onDelete: SetNull`, so the request outlives the profile and the client's own
 * details must not disappear with it. The two cases are deliberately
 * indistinguishable here — the admin needs to know no tutor is attached, not why.
 */
export interface RequestedTutor {
  id: string
  displayName: string
  headline: string
  profileStatus: string
}

export interface AdminRequestListItem {
  id: string
  fullName: string
  subject: string
  educationLevel: string
  learningMode: string
  status: AdminStatus
  createdAt: string
  /**
   * ISO 3166-1 alpha-2. Which currency a budget on this row is in, and which
   * timezone its availability is written in, is decided by this and nothing
   * else — so it travels with the row rather than being inferred on screen.
   * Null on requests made before the wizard asked for a country.
   */
  countryCode: string | null
  /** Requirement 13.1: which tutor the client chose, when they chose one. */
  tutorProfileId: string | null
  tutor: RequestedTutor | null
}

/**
 * Everything the request wizard collects beyond the original form's fields.
 *
 * Each group is optional because a request submitted before the wizard carries
 * none of them, and a null here means "we were never told", not "no".
 */
export interface AdminRequestOnboarding {
  countryCode: string | null
  /** IANA identifier, e.g. `Africa/Addis_Ababa`. Never converted. */
  timezone: string | null
  educationLevelCode: string | null
  /** Subject names from the many-to-many join, in alphabetical order. */
  subjects: string[]
  /** The client's own wording for the subjects under "Other". */
  subjectOther: string | null
  learningGoal: string | null
  learningGoalOther: string | null
  preferredDayNames: string[]
  preferredTimeRanges: string[]
  /**
   * The budget, kept as a number plus a currency code.
   *
   * Deliberately two fields rather than one formatted string: the admin must be
   * able to see that a quoted amount is in ETB and not silently read it as
   * dollars. `budget` below is still sent as a readable summary for display.
   */
  budgetAmount: number | null
  budgetCurrency: string | null
}

export interface AdminRequestDetail extends AdminRequestListItem, AdminRequestOnboarding {
  phone: string
  telegramUsername: string | null
  email: string | null
  description: string
  location: string | null
  preferredDays: string | null
  preferredTime: string | null
  budget: string | null
  additionalInfo: string | null
  adminNotes: string | null
  updatedAt: string
}

export interface AdminRequestList {
  items: AdminRequestListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface AdminStats {
  total: number
  NEW: number
  CONTACTED: number
  IN_PROGRESS: number
  COMPLETED: number
  CANCELLED: number
  /**
   * Tutor applications, counted separately from the request figures above.
   *
   * Kept in its own object because these are different things: a tutor request
   * is a student asking for a lesson, an application is a tutor asking to be
   * listed. Folding them together would make "Total Requests" mean two
   * different populations depending on which page you were looking at.
   */
  tutorApplications: {
    total: number
    PENDING_REVIEW: number
    NEEDS_INFORMATION: number
    APPROVED: number
  }
}

export interface ListParams {
  page?: number
  limit?: number
  status?: StatusFilter
  search?: string
}

/** Fields the admin API accepts. Client-submitted data is immutable. */
export interface AdminRequestUpdate {
  status?: AdminStatus
  adminNotes?: string | null
}
