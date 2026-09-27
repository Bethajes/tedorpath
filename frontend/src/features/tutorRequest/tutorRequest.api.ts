import { ApiError, postJson } from '@/lib/api'

import type { TutorRequestPayload } from './tutorRequest.schema'

export interface TutorRequestResult {
  id: string
}

const TUTOR_REQUESTS_PATH = '/api/tutor-requests'

/**
 * Submits a tutor request to the real API.
 *
 * The payload uses the same field names the form already validates, so the
 * backend can map them straight onto its own columns. Only the new id comes
 * back — the stored record contains personal contact details and is never
 * returned to the browser.
 */
export async function submitTutorRequest(
  payload: TutorRequestPayload,
): Promise<TutorRequestResult> {
  try {
    return await postJson<TutorRequestResult>(TUTOR_REQUESTS_PATH, payload)
  } catch (error) {
    // Replace low-level messages with one the visitor can act on. The
    // original is kept on the error for local debugging.
    if (error instanceof ApiError) {
      throw new ApiError(
        "We couldn't submit your request right now. Please try again.",
        error.status,
        error.code,
      )
    }
    throw error
  }
}
