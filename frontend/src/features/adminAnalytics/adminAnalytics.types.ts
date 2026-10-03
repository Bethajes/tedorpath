/**
 * Types for the admin dashboard analytics.
 *
 * Mirrors `GET /api/admin/dashboard` and `GET /api/admin/activity`.
 *
 * Every field here is a count the database can produce. There is no field for a
 * conversion rate, a satisfaction score, a response time or a growth
 * percentage, because the platform records none of those — adding one would put
 * a figure on the dashboard that no row supports. What exists instead is spelled
 * out in `learners` and `matching`, where the definition travels with the number
 * so the UI can show it rather than implying one.
 */

/** A single day in the trend series. `count` is a real row count for that day. */
export interface TrendPoint {
  date: string
  count: number
}

export interface TrendSeries {
  days: number
  from: string
  to: string
  /** Zero-filled: every day in the window is present, including the empty ones. */
  requests: TrendPoint[]
  applications: TrendPoint[]
}

/** One row in the activity feed. */
export interface ActivityEntry {
  /** Namespaced (`request:<uuid>`) so two tables can share one list. */
  id: string
  kind: 'request' | 'application'
  entityId: string
  occurredAt: string
  actor: string
  headline: string
  status: string
  /**
   * True when the row was created and never written again.
   *
   * The schema has no audit log, so "new" and "updated" is the most the
   * timestamps can prove — hence a boolean rather than a claimed action.
   */
  isNew: boolean
  /** Whether the actor had an account. An anonymous request is still a person. */
  signedIn: boolean
}

export interface SubjectBreakdownRow {
  subject: string
  count: number
}

export interface DashboardOverview {
  requests: {
    total: number
    NEW: number
    CONTACTED: number
    IN_PROGRESS: number
    COMPLETED: number
    CANCELLED: number
  }
  applications: {
    total: number
    PENDING_REVIEW: number
    NEEDS_INFORMATION: number
    APPROVED: number
    SUSPENDED: number
    REJECTED: number
    DRAFT: number
  }
  verification: {
    VERIFIED: number
    DOCUMENTS_REQUESTED: number
    DOCUMENTS_RECEIVED: number
    NEEDS_MORE_INFORMATION: number
    UNVERIFIED: number
  }
  /**
   * The two learner figures, kept apart because they are different claims.
   *
   * There is no session-per-visitor tracking, so "active" cannot be measured
   * directly. `registered` is every client account; `requestedRecently` is
   * requests in the last `windowDays`. The UI labels each with which it is.
   */
  learners: {
    registered: number
    requestedRecently: number
    windowDays: number
  }
  /**
   * Requests split by whether a tutor has been attached, plus the follow-up
   * count. `staleDays` travels with `stale` so the UI can state the rule it
   * applied instead of asserting a conclusion.
   */
  matching: {
    total: number
    matched: number
    unmatched: number
    /** Requests still in NEW after `staleDays`. */
    stale: number
    staleDays: number
  }
  subjects: SubjectBreakdownRow[]
  trends: TrendSeries
  activity: ActivityEntry[]
}

export interface ActivityFeed {
  items: ActivityEntry[]
}

/** The windows the dashboard offers. Each is a real date range, not a preset look. */
export const TREND_WINDOWS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
] as const

export type TrendWindowDays = (typeof TREND_WINDOWS)[number]['days']
