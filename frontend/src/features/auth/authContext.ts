import { createContext } from 'react'

import type { AuthUser, LoginInput, RegisterInput } from './auth.types'

/**
 * The auth context, kept apart from the provider component.
 *
 * Splitting it out means `AuthProvider.tsx` exports only a component, so React
 * Fast Refresh keeps working while editing it.
 */

export interface AuthContextValue {
  status: 'unknown' | 'authenticated' | 'anonymous'
  user: AuthUser | null
  /** Sign-in methods the server offers, e.g. `['GOOGLE']`. */
  providers: string[]
  signIn: (input: LoginInput) => Promise<AuthUser>
  signUp: (input: Omit<RegisterInput, 'confirmPassword'>) => Promise<AuthUser>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
