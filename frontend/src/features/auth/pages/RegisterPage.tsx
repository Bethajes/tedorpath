import { useCallback } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { Logo } from '@/components/brand/Logo'
import { Container, PageShell } from '@/components/layout/PageShell'
import { Alert } from '@/components/ui'

import { authErrorMessage } from '../authErrors'
import { useAuth } from '../useAuth'
import type { AuthUser } from '../auth.types'
import { AuthDivider, SocialLoginButtons } from '../components/SocialLoginButtons'
import { RegisterForm } from '../components/RegisterForm'

/**
 * Registration page.
 *
 * Asks for the minimum: a name, an email and a password. Everything else —
 * level, subjects, tutor onboarding — belongs to the moment it is actually
 * needed, and the tutor-request form still works without an account.
 */
export function RegisterPage() {
  const { status, user, providers } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const googleEnabled = providers.includes('GOOGLE')

  // The Google button is on this page too, so a failed attempt can land here.
  const providerError = authErrorMessage(searchParams.get('authError'))

  const onSuccess = useCallback(
    (_user: AuthUser) => {
      navigate('/', { replace: true })
    },
    [navigate],
  )

  if (status === 'authenticated' && user) {
    return <Navigate to="/" replace />
  }

  return (
    <PageShell>
      <Container className="flex max-w-md flex-col items-center py-6 sm:py-10">
        <Link to="/" className="rounded-md" aria-label="Tedor Tutors — home">
          <Logo size="md" />
        </Link>

        <div className="mt-8 w-full rounded-2xl border border-ink-200 bg-white p-6 shadow-[0_18px_50px_-32px_rgba(18,26,36,0.35)] sm:p-8">
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink-900">Create your account</h1>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-600">
            Join Tedor and find tutoring support that fits you.
          </p>

          <div className="mt-7 flex flex-col gap-6">
            {providerError ? <Alert tone="error">{providerError}</Alert> : null}
            <SocialLoginButtons />
            {googleEnabled ? <AuthDivider /> : null}
            <RegisterForm onSuccess={onSuccess} />
          </div>
        </div>

        <p className="mt-6 text-center text-[0.95rem] text-ink-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
      </Container>
    </PageShell>
  )
}
