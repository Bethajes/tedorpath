import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'

import { AuthContext, type AuthContextValue } from './authContext'
import { ensureSessionLoaded, getAuthState, signIn, signOut, signUp, subscribeAuth } from './authStore'

/**
 * React binding for the auth store.
 *
 * Mounted once, above the router, so the whole app — header included — knows
 * who is signed in. The provider's only jobs are to ask the API once on startup
 * and to expose the store through context.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // Subscribing rather than mirroring the store in state keeps a single source
  // of truth: a sign-in from the login page updates the header too, with no
  // prop drilling and no chance of the two disagreeing.
  const state = useSyncExternalStore(subscribeAuth, getAuthState, getAuthState)

  useEffect(() => {
    void ensureSessionLoaded()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.user,
      providers: state.providers,
      signIn,
      signOut,
      signUp,
    }),
    [state.status, state.user, state.providers],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
