/**
 * API client for the admin tutor moderation queue and review workspace.
 *
 * Every call here goes through the shared admin session, which attaches the
 * admin token as a bearer header (see features/adminRequests/adminSession.ts).
 * The backend rejects all of these without a valid token, so there is no
 * client-side "is this allowed" question to answer.
 *
 * Requirements: 23.1, 24.1
 */

import { getJson, patchJson } from '@/lib/api'

import type {
  AdminTutorList,
  AdminTutorListParams,
  AdminTutorProfile,
  AdminTutorStatusUpdate,
  AdminTutorVerificationUpdate,
} from './adminTutors.types'

const BASE_PATH = '/api/admin/tutors'

/**
 * The moderation queue.
 *
 * Defaults to page 1, 20 rows and `all` statuses. The server orders newest
 * first, which is what a queue needs — the profile an admin has to look at is
 * usually the one that arrived most recently.
 */
export function fetchAdminTutors(params: AdminTutorListParams = {}): Promise<AdminTutorList> {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 1))
  query.set('limit', String(params.limit ?? 20))
  query.set('status', params.status ?? 'all')

  // Sent as `q`, matching the tutor-requests list, so both queues are filtered
  // the same way in the query string and in the dev tools.
  if (params.search) query.set('q', params.search)

  return getJson<AdminTutorList>(`${BASE_PATH}?${query.toString()}`)
}

/** The full profile for the review workspace. */
export function fetchAdminTutor(id: string): Promise<AdminTutorProfile> {
  return getJson<AdminTutorProfile>(`${BASE_PATH}/${encodeURIComponent(id)}`)
}

/**
 * Applies a moderation decision.
 *
 * REJECTED requires a `rejectionReason` and NEEDS_INFORMATION requires an
 * `adminMessage`; the API answers 422 with `REJECTION_REASON_REQUIRED` or
 * `ADMIN_MESSAGE_REQUIRED` when one is missing, and that error is left to
 * propagate so the review page can show which field the admin still owes.
 */
export function updateTutorStatus(
  id: string,
  update: AdminTutorStatusUpdate,
): Promise<AdminTutorProfile> {
  return patchJson<AdminTutorProfile>(`${BASE_PATH}/${encodeURIComponent(id)}/status`, update)
}

/**
 * Saves verification status, notes and checklist.
 *
 * Separate from the status endpoint on purpose: this one never touches
 * `profileStatus`, so it can be called as often as an admin likes without any
 * risk of approving, rejecting or suspending anyone by accident.
 */
export function updateTutorVerification(
  id: string,
  update: AdminTutorVerificationUpdate,
): Promise<AdminTutorProfile> {
  return patchJson<AdminTutorProfile>(
    `${BASE_PATH}/${encodeURIComponent(id)}/verification`,
    update,
  )
}
