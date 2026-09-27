/**
 * Centralised HTTP access to the Tedor Tutors API.
 *
 * The base URL comes from `VITE_API_URL` so it is never hardcoded in a
 * component. When it is not set the app falls back to same-origin `/api`
 * requests, which the Vite dev server proxies to the backend (see
 * vite.config.ts) — that keeps development free of CORS entirely.
 */
const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim()

export const API_BASE_URL = configuredBaseUrl ? configuredBaseUrl.replace(/\/+$/, '') : ''

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

interface ApiEnvelope {
  success: boolean
  data?: unknown
  error?: { code?: string; message?: string }
}

/** POST a JSON body to an API path and return the `data` payload. */
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    // Network failure, CORS rejection or the API being down.
    throw new ApiError('We could not reach the server. Please try again.', 0, 'NETWORK_ERROR')
  }

  let envelope: ApiEnvelope | null = null
  try {
    envelope = (await response.json()) as ApiEnvelope
  } catch {
    throw new ApiError('The server returned an unexpected response.', response.status, 'BAD_RESPONSE')
  }

  if (!response.ok || !envelope?.success) {
    throw new ApiError(
      envelope?.error?.message ?? 'Something went wrong. Please try again.',
      response.status,
      envelope?.error?.code ?? 'UNKNOWN_ERROR',
    )
  }

  return envelope.data as T
}
