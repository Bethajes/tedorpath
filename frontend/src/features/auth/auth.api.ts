import { ApiError, getJson, postJson } from '@/lib/api'

import type { AuthResponse, LoginInput, RegisterInput } from './auth.types'

const AUTH_PATH = '/api/auth'

/**
 * The signed-in user, or null when there is no valid session.
 *
 * A 401 is the expected answer for a visitor who is not signed in, so it is
 * turned into `null` rather than an error: "nobody is signed in" is a state,
 * not a failure.
 */
export async function fetchCurrentUser(): Promise<AuthResponse['user'] | null> {
  try {
    const { user } = await getJson<AuthResponse>(`${AUTH_PATH}/me`)
    return user
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

/**
 * The sign-in methods this server offers.
 *
 * A provider only appears once it is really configured, so the pages can hide a
 * button that would go nowhere instead of showing one that fails. The browser
 * asks the API rather than reading a build-time flag, so turning a provider on
 * or off never needs a rebuild.
 */
export async function fetchAuthProviders(): Promise<string[]> {
  const { providers } = await getJson<{ providers: string[] }>(`${AUTH_PATH}/providers`)
  return providers
}

/** Creates an account and signs the new user in. */
export function register(input: Omit<RegisterInput, 'confirmPassword'>): Promise<AuthResponse> {
  return postJson<AuthResponse>(`${AUTH_PATH}/register`, input)
}

/** Signs in with an email and password. */
export function login(input: LoginInput): Promise<AuthResponse> {
  return postJson<AuthResponse>(`${AUTH_PATH}/login`, input)
}

/** Revokes the session server-side. The cookie itself is cleared by the API. */
export function logout(): Promise<{ loggedOut: boolean }> {
  return postJson<{ loggedOut: boolean }>(`${AUTH_PATH}/logout`, {})
}
