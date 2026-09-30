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

/**
 * A single field-level problem reported by the API.
 *
 * The backend uses this shape for validation failures (`field` + human
 * `message`) and for the submit endpoint's completeness check, where only the
 * field name is known and `message` is absent.
 */
export interface ApiFieldError {
  field: string
  message?: string
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  /**
   * Field-level problems, when the server sent them.
   *
   * Preserved so the UI can point at the specific inputs that need attention
   * instead of showing one generic "something went wrong" line.
   */
  readonly fields?: ApiFieldError[]

  constructor(message: string, status: number, code: string, fields?: ApiFieldError[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

interface ApiEnvelope {
  success: boolean
  data?: unknown
  error?: {
    code?: string
    message?: string
    /**
     * Either `{ field, message }` objects (validation) or bare field names
     * (the submit endpoint's completeness check). Both are normalised to
     * `ApiFieldError` on the way out.
     */
    fields?: Array<ApiFieldError | string>
  }
}

/** Normalise the two `fields` shapes the API uses into `ApiFieldError[]`. */
function normaliseFields(fields: Array<ApiFieldError | string> | undefined): ApiFieldError[] | undefined {
  if (!fields?.length) return undefined
  return fields.map((f) => (typeof f === 'string' ? { field: f } : f))
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
      // The sign-in session is an HttpOnly cookie, so the browser has to be
      // allowed to send it — including when the API lives on another host.
      credentials: 'include',
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
      normaliseFields(envelope?.error?.fields),
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

/**
 * Resolve a stored image path against the API origin.
 *
 * Photos the tutor uploads come back from the API as a path such as
 * `/api/uploads/<id>.png` rather than a full URL, so the API can be reached
 * through the dev proxy, a CDN, or a different public host without rewriting
 * every row in the database.
 *
 * A path that is already absolute — an externally hosted image a tutor linked
 * themselves — is returned untouched, and `null`/empty stays falsy so callers
 * can keep using it as a simple "is there a photo?" check.
 */
export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`
  return url
}

/**
 * POST a file as `multipart/form-data` and return the `data` payload.
 *
 * `Content-Type` is intentionally left unset: the browser has to add the
 * multipart boundary itself, and setting the header by hand produces a request
 * the server cannot parse.
 */
export async function postFile<T>(
  path: string,
  file: File,
  fieldName = 'photo',
): Promise<T> {
  const form = new FormData()
  form.append(fieldName, file)

  const token = tokenProvider()
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: form,
    })
  } catch {
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
      normaliseFields(envelope?.error?.fields),
    )
  }

  return envelope.data as T
}
