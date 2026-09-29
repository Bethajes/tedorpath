/**
 * Shared shapes for the authentication feature.
 *
 * These mirror what the API returns. `passwordHash` and any other credential
 * material is not part of `AuthUser` — the backend never sends it, and typing
 * the response this way makes that explicit at the call site.
 */

export const USER_ROLES = ['CLIENT', 'TUTOR', 'ADMIN'] as const

export type UserRole = (typeof USER_ROLES)[number]

/** The signed-in user, as far as the browser is concerned. */
export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  image: string | null
  createdAt: string
}

export interface RegisterInput {
  name: string
  email: string
  /** Never persisted in the browser; sent once and forgotten. */
  password: string
  confirmPassword: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface AuthResponse {
  user: AuthUser
}

/**
 * Whether we know who the visitor is yet.
 *
 * `unknown` is the important third state: it is what stops a protected route
 * from bouncing an authenticated user to the sign-in page during the first
 * render, before `/api/auth/me` has answered.
 */
export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous'
