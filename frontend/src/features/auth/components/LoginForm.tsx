import { zodResolver } from '@hookform/resolvers/zod'
import { useRef, useState } from 'react'
import { useForm, type FieldErrors, type FieldPath, type UseFormReturn } from 'react-hook-form'

import { Alert, Button, Field, Input } from '@/components/ui'
import { ApiError } from '@/lib/api'

import { signIn } from '../authStore'
import { loginSchema, type LoginValues } from '../auth.schema'
import type { AuthUser } from '../auth.types'

const DEFAULT_VALUES: LoginValues = { email: '', password: '' }

/** react-hook-form types errors loosely; this pulls the message back out. */
function errorMessage(
  errors: FieldErrors<LoginValues>,
  name: FieldPath<LoginValues>,
): string | undefined {
  const entry: unknown = errors[name]
  if (entry && typeof entry === 'object' && 'message' in entry) {
    const { message } = entry as { message?: unknown }
    if (typeof message === 'string') return message
  }
  return undefined
}

type TextFieldProps = {
  form: UseFormReturn<LoginValues>
  name: FieldPath<LoginValues>
  label: string
  type: 'email' | 'password'
  autoComplete: string
  placeholder?: string
}

function TextField({ form, name, label, type, autoComplete, placeholder }: TextFieldProps) {
  const error = errorMessage(form.formState.errors, name)

  return (
    <Field id={name} label={label} required error={error}>
      {(field) => (
        <Input
          {...form.register(name)}
          {...field}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          invalid={Boolean(error)}
        />
      )}
    </Field>
  )
}

export interface LoginFormProps {
  /** Called with the signed-in user so the page can decide where to go next. */
  onSuccess: (user: AuthUser) => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: DEFAULT_VALUES,
  })

  // Guards against a second submit arriving before the button is disabled:
  // Enter inside a field fires a submit event regardless of the button state.
  const inFlight = useRef(false)

  async function authenticate() {
    if (inFlight.current) return

    inFlight.current = true
    setSubmitting(true)
    setSubmitError(null)

    try {
      const user = await signIn(form.getValues())
      onSuccess(user)
    } catch (error) {
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : 'We could not sign you in just now. Please try again.',
      )
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  // `authenticate` only runs once react-hook-form considers the values valid.
  // oxlint-disable-next-line react/refs -- false positive: a stable event handler
  const onSubmit = form.handleSubmit(authenticate)

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {submitError ? <Alert tone="error">{submitError}</Alert> : null}

      <TextField
        form={form}
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
      />
      <TextField
        form={form}
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
      />

      <Button type="submit" size="lg" fullWidth disabled={submitting}>
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
