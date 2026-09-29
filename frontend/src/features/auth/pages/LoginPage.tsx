import { useCallback } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { Logo } from '@/components/brand/Logo'
import { Container, PageShell } from '@/components/layout/PageShell'
import { Alert } from '@/components/ui'

import { authErrorMessage } from '../authErrors'
import { useAuth } from '../useAuth'
import type { AuthUser } from '../auth.types'
import { LoginForm } from '../components/LoginForm'
import { AuthDivider, SocialLoginButtons } from '../components/SocialLoginButtons'

/**
 * Sign-in page.
 *
 * Deliberately not styled like the admin login: this is the public face of the
 * product, on the public brand palette, and it shares the site header and
 * footer so a visitor never feels they have left the site to authenticate.
 */
export function LoginPage() {
  const { status, user, providers } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  /** Where to go after signing in: back where they were headed, or home. */
  const destination = (location.state as { from?: string } | null)?.from ?? '/'

  const googleEnabled = providers.includes('GOOGLE')

  /** Set when the API sent the visitor back from a failed Google attempt. */
  const providerError = authErrorMessage(searchParams.get('authError'))

  const onSuccess = useCallback(
    (_user: AuthUser) => {
      navigate(destination, { replace: true })
    },
    [navigate, destination],
  )

  // Someone already signed in has no business on this page.
  if (status === 'authenticated' && user) {
    return <Navigate to={destination} replace />
  }

  return (
    <PageShell>
      <Container className="flex max-w-md flex-col items-center py-6 sm:py-10">
        <Link to="/" className="rounded-md" aria-label="Tedor Tutors — home">
          <Logo size="md" />
        </Link>

        <div className="mt-8 w-full rounded-2xl border border-ink-200 bg-white p-6 shadow-[0_18px_50px_-32px_rgba(18,26,36,0.35)] sm:p-8">
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink-900">Welcome back</h1>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-600">
            Sign in to continue learning with Tedor.
          </p>

          <div className="mt-7 flex flex-col gap-6">
            {providerError ? <Alert tone="error">{providerError}</Alert> : null}
            <SocialLoginButtons />
            {googleEnabled ? <AuthDivider /> : null}
            <LoginForm onSuccess={onSuccess} />
          </div>
        </div>

        <p className="mt-6 text-center text-[0.95rem] text-ink-600">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-medium text-brand-700 hover:underline">
            Create an account
          </Link>
        </p>
      </Container>
    </PageShell>
  )
}
