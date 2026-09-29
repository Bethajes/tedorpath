import * as authApi from './auth.api'
import type { AuthStatus, AuthUser, LoginInput, RegisterInput } from './auth.types'

/**
 * The signed-in user, held in memory for the lifetime of the tab.
 *
 * Deliberately **not** persisted: there is nothing to store. The session lives
 * in an HttpOnly cookie the browser sends on its own, so there is no token for
 * this app to keep in `localStorage` or `sessionStorage` — and nothing for a
 * cross-site script to read if it ever got injected. Refreshing the page asks
 * the API who we are again.
 *
 * The store is a plain module rather than a component so it can be shared,
 * tested and subscribed to without React, and so the React layer is only a thin
 * `useSyncExternalStore` binding.
 */

export interface AuthState {
  /** `unknown` until the API has answered `/api/auth/me` at least once. */
  status: AuthStatus
  user: AuthUser | null
  /** Sign-in methods the server offers, e.g. `['GOOGLE']`. Empty until loaded. */
  providers: string[]
}

let state: AuthState = { status: 'unknown', user: null, providers: [] }

const listeners = new Set<() => void>()

function setState(next: AuthState) {
  state = next
  for (const listener of listeners) listener()
}

/**
 * Is a provider worth showing a button for?
 *
 * Empty until `/api/auth/providers` answers, so the button appears a moment
 * later rather than being flashed on and then taken away.
 */
export function hasProvider(id: string): boolean {
  return state.providers.includes(id)
}

export function getAuthState(): AuthState {
  return state
}

/** Subscribes to changes; returns the unsubscribe function, for effects. */
export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Signs the user in and makes the new identity available to every subscriber. */
export async function signIn(input: LoginInput): Promise<AuthUser> {
  const { user } = await authApi.login(input)
  setState({ ...state, status: 'authenticated', user })
  return user
}

/** Creates an account; the API signs the new user in as part of registering. */
export async function signUp(input: Omit<RegisterInput, 'confirmPassword'>): Promise<AuthUser> {
  const { user } = await authApi.register(input)
  setState({ ...state, status: 'authenticated', user })
  return user
}

/**
 * Signs out.
 *
 * The session is revoked on the server first. The local state is cleared even
 * if that call fails, because leaving a stale "signed in" UI behind is worse
 * than the browser holding a cookie the server will reject.
 */
export async function signOut(): Promise<void> {
  try {
    await authApi.logout()
  } finally {
    setState({ ...state, status: 'anonymous', user: null })
  }
}

let pending: Promise<void> | null = null
let pendingProviders: Promise<void> | null = null

/**
 * Asks the API who we are, once.
 *
 * Concurrent callers share a single request, and once the answer is known it is
 * never asked for again — a failure is not cached, so a page that loaded while
 * the API was briefly unreachable can be re-checked.
 */
export function ensureSessionLoaded(): Promise<void> {
  void loadProviders()

  if (state.status !== 'unknown') return Promise.resolve()

  pending ??= authApi
    .fetchCurrentUser()
    .then((user) => {
      setState(
        user
          ? { ...state, status: 'authenticated', user }
          : { ...state, status: 'anonymous', user: null },
      )
    })
    .catch(() => {
      // Treated as "nobody is signed in" so the public site keeps working while
      // the API is unreachable; the reason is logged by the API layer, not here.
      setState({ ...state, status: 'anonymous', user: null })
    })
    .finally(() => {
      pending = null
    })

  return pending
}

/**
 * Asks which providers to offer. Runs alongside the session request and is never
 * awaited: a failure just means the extra buttons stay hidden, which is the
 * safe direction to fail in.
 */
function loadProviders(): Promise<void> {
  pendingProviders ??= authApi
    .fetchAuthProviders()
    .then((providers) => {
      if (!Array.isArray(providers)) return
      state = { ...state, providers }
      for (const listener of listeners) listener()
    })
    .catch(() => {})
    .finally(() => {
      pendingProviders = null
    })

  return pendingProviders
}

/** Back to square one. Exists for tests; the app never needs it. */
export function resetAuthState(): void {
  pending = null
  pendingProviders = null
  setState({ status: 'unknown', user: null, providers: [] })
}
