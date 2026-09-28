import { setAuthTokenProvider } from '@/lib/api'

/**
 * Admin session: holds the access token for this browser tab.
 *
 * DEVELOPMENT-ONLY. This is not authentication — it stores a single shared
 * secret that the operator types in, so the admin API is not publicly
 * reachable while real staff authentication is still to be built. Anyone with
 * the token has full access.
 *
 * The token is kept in `sessionStorage` so it disappears when the tab closes
 * and is never written to disk in a durable way, and it is deliberately not
 * bundled: nothing here reads a `VITE_*` variable, which would expose it to
 * every visitor.
 */

const STORAGE_KEY = 'tedor.admin.token'

let cached: string | null = null

function readStored(): string | null {
  if (cached !== null) return cached || null
  try {
    cached = window.sessionStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    // sessionStorage can be unavailable (private mode, blocked storage).
    cached = ''
  }
  return cached || null
}

export function getAdminToken(): string | null {
  return readStored()
}

export function setAdminToken(token: string): void {
  const value = token.trim()
  cached = value
  try {
    if (value) window.sessionStorage.setItem(STORAGE_KEY, value)
    else window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Keep the in-memory copy so the current tab still works.
  }
}

export function clearAdminToken(): void {
  setAdminToken('')
}

export function hasAdminToken(): boolean {
  return getAdminToken() !== null
}

// Let the API layer attach the token to every request automatically.
setAuthTokenProvider(getAdminToken)
