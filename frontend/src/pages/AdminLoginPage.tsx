import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { Logo } from '@/components/brand/Logo'
import { fetchAdminStats } from '@/features/adminRequests/adminRequests.api'
import { setAdminToken } from '@/features/adminRequests/adminSession'
import { Button, Field, Input } from '@/components/ui'

/**
 * Development-only access gate.
 *
 * The operator pastes the shared admin token configured in the backend
 * `ADMIN_API_TOKEN`. The token is validated against the API before it is
 * stored, and is never bundled into the app.
 */
export function AdminLoginPage() {
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const value = token.trim()
    if (!value) {
      setError('Enter the admin access token.')
      return
    }

    setChecking(true)
    setError(null)
    setAdminToken(value)

    try {
      await fetchAdminStats()
      navigate('/admin')
    } catch {
      // Reject the token we optimistically stored.
      setAdminToken('')
      setError('That token was not accepted. Check the ADMIN_API_TOKEN value in the backend .env.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-ink-200 bg-white p-7 shadow-sm">
        <Logo size="md" />

        <h1 className="mt-7 text-xl font-semibold tracking-tight text-ink-900">Staff access</h1>
        <p className="mt-2 text-sm text-ink-600">
          Enter the admin access token to manage tutor requests, tutor applications and the homepage
          figures.
        </p>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} noValidate className="mt-5">
          <Field id="adminToken" label="Admin access token" error={undefined}>
            {(field) => (
              <Input
                {...field}
                type="password"
                autoComplete="off"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Paste the ADMIN_API_TOKEN value"
              />
            )}
          </Field>
          <Button type="submit" fullWidth className="mt-4" disabled={checking}>
            {checking ? 'Checking…' : 'Continue'}
          </Button>
        </form>

        <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Development only. This is a shared token, not a staff account system. Do not deploy the
          admin dashboard publicly until real authentication is in place.
        </p>
      </div>
    </div>
  )
}
