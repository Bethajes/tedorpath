import { useAuth } from '../useAuth'

/**
 * Sign-in with an identity provider.
 *
 * The button is a plain link to `/api/auth/google`. That is deliberate: the API
 * owns the OAuth conversation end to end, so the browser holds no client id, no
 * client secret and no OAuth state, and the session cookie is set on the
 * response that finally lands back on the app. Doing it with `fetch` would mean
 * shipping the provider's credentials to the frontend for no benefit.
 *
 * It renders nothing at all while Google is not configured on the server. A
 * button that leads to a dead end is worse than no button, and the server is the
 * only thing that knows whether Google is ready — see `/api/auth/providers`.
 *
 * The mark below is a neutral single-colour G rather than Google's multi-colour
 * one, so Google's brand assets are only used where we follow their guidelines.
 */
export function SocialLoginButtons() {
  const { providers } = useAuth()

  if (!providers.includes('GOOGLE')) return null

  return (
    <a
      href="/api/auth/google"
      className="inline-flex w-full items-center justify-center gap-3 rounded-lg border border-ink-200 bg-white px-5 py-3 text-[0.95rem] font-medium text-ink-800 shadow-sm transition-colors hover:border-ink-300 hover:bg-ink-50"
    >
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M15.2 9.1c0-.6-.05-1.1-.16-1.6H9v3h3.5a3 3 0 0 1-1.3 2v1.6h2.1c1.2-1.1 1.9-2.8 1.9-5Z" />
        <path d="M9 15.5c1.7 0 3.2-.6 4.3-1.5l-2.1-1.6c-.6.4-1.3.6-2.2.6-1.7 0-3.1-1.1-3.6-2.7H3.2v1.7A6.5 6.5 0 0 0 9 15.5Z" />
        <path d="M5.4 10.3a3.9 3.9 0 0 1 0-2.5V6.1H3.2a6.5 6.5 0 0 0 0 5.9l2.2-1.7Z" />
        <path d="M9 5.9c1 0 1.8.3 2.5.9l1.9-1.8A6.5 6.5 0 0 0 3.2 6.1l2.2 1.7C5.9 7 7.3 5.9 9 5.9Z" />
      </svg>
      Continue with Google
    </a>
  )
}

/** The "or" rule between provider buttons and the email form. */
export function AuthDivider({ children = 'or continue with email' }: { children?: string }) {
  return (
    <div className="flex items-center gap-3" role="separator">
      <span className="h-px flex-1 bg-ink-200" />
      <span className="text-xs font-medium uppercase tracking-wide text-ink-400">{children}</span>
      <span className="h-px flex-1 bg-ink-200" />
    </div>
  )
}
