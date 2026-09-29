import { useContext } from 'react'

import { AuthContext, type AuthContextValue } from './authContext'

/**
 * The current user and the actions that change it.
 *
 * Throws outside an `<AuthProvider>` on purpose: a component that needs to know
 * who is signed in and cannot see the provider is a wiring bug, and failing
 * loudly beats rendering a header that silently never updates.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.')
  }

  return context
}
