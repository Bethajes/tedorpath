/**
 * API client for the admin dashboard analytics.
 *
 * Read-only, and goes through the shared admin session like every other admin
 * call, so the backend's `requireAdmin` guard applies. There is no permission
 * question for the UI to answer.
 *
 * `fetchDashboard` returns every aggregate in one response rather than several
 * parallel calls: a dashboard whose total and whose chart come from two
 * different moments is worse than a slower one.
 */

import { getJson } from '@/lib/api'

import type { ActivityFeed, DashboardOverview } from './adminAnalytics.types'

const BASE_PATH = '/api/admin'

/**
 * Everything the dashboard renders.
 *
 * `days` sets how far back the trend series reaches and must match one of the
 * windows in `TREND_WINDOWS`; the server caps it at 365 regardless.
 *
 * `staleDays` is the follow-up threshold. It is sent rather than assumed so the
 * count and the rule printed beside it can never disagree.
 */
export function fetchDashboard(days = 30, staleDays = 7): Promise<DashboardOverview> {
  return getJson<DashboardOverview>(`${BASE_PATH}/dashboard?days=${days}&staleDays=${staleDays}`)
}

/** The activity feed on its own, so it can refresh without re-running aggregates. */
export function fetchActivityFeed(limit = 10): Promise<ActivityFeed> {
  return getJson<ActivityFeed>(`${BASE_PATH}/activity?limit=${limit}`)
}
