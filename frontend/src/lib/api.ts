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

/**
 * Supplies the admin access token, if the operator has entered one.
 *
 * The token is NOT baked into the bundle: it is never read from a `VITE_*`
 * variable, because everything prefixed `VITE_` is inlined into the browser
 * build. The admin session registers a provider here at runtime.
 */
type TokenProvider = () => string | null

let tokenProvider: TokenProvider = () => null

export function setAuthTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

async function requestJson<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const token = tokenProvider()
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
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

/** POST a JSON body to an API path and return the `data` payload. */
export function postJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>('POST', path, body)
}

export function getJson<T>(path: string): Promise<T> {
  return requestJson<T>('GET', path)
}

export function patchJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>('PATCH', path, body)
}

export function deleteJson<T>(path: string): Promise<T> {
  return requestJson<T>('DELETE', path)
}
