import { ApiError, postJson } from '@/lib/api'

import type { WizardRequestPayload } from './tutorRequest.schema'

export interface TutorRequestResult {
  id: string
}

const TUTOR_REQUESTS_PATH = '/api/tutor-requests'

/**
 * Submits a tutor request to the real API.
 *
 * The payload uses the field names the wizard validates, so the backend can map
 * them straight onto its own columns. Only the new id comes back — the stored
 * record contains personal contact details and is never returned to the browser.
 */
export async function submitTutorRequest(
  payload: WizardRequestPayload,
): Promise<TutorRequestResult> {
  try {
    return await postJson<TutorRequestResult>(TUTOR_REQUESTS_PATH, payload)
  } catch (error) {
    if (!(error instanceof ApiError)) throw error

    /*
     * A validation failure keeps its per-field messages.
     *
     * The server's own message for this case is "Invalid tutor request.", which
     * tells the visitor nothing they can act on. The wizard needs the detail: a
     * catalogue that changed under an open form names the field, and the step
     * that owns it has to be able to say which one. So the fields are preserved
     * and rolled up into a readable line, and the generic copy is only used when
     * there was nothing specific to report.
     */
    const fields = error.fields
    const detail = fields
      ?.map((field) => field.message)
      .filter((message): message is string => Boolean(message))
      .join(' ')

    if (error.status === 400 && detail) {
      throw new ApiError(detail, error.status, error.code, fields)
    }

    // Everything else — a network failure, a 500, an unparseable body — gets one
    // message the visitor can act on. The original is kept for local debugging.
    throw new ApiError(
      "We couldn't submit your request right now. Your answers are still here — please try again.",
      error.status,
      error.code,
      fields,
    )
  }
}