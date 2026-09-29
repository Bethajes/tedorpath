import { zodResolver } from '@hookform/resolvers/zod'
import { useRef, useState } from 'react'
import { useForm, type FieldErrors, type FieldPath, type UseFormReturn } from 'react-hook-form'

import { Alert, Button, Field, Input } from '@/components/ui'
import { ApiError } from '@/lib/api'

import { signUp } from '../authStore'
import { PASSWORD_HINT, registerSchema, type RegisterValues } from '../auth.schema'
import type { AuthUser } from '../auth.types'

const DEFAULT_VALUES: RegisterValues = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
}

/** react-hook-form types errors loosely; this pulls the message back out. */
function errorMessage(
  errors: FieldErrors<RegisterValues>,
  name: FieldPath<RegisterValues>,
): string | undefined {
  const entry: unknown = errors[name]
  if (entry && typeof entry === 'object' && 'message' in entry) {
    const { message } = entry as { message?: unknown }
    if (typeof message === 'string') return message
  }
  return undefined
}

type TextFieldProps = {
  form: UseFormReturn<RegisterValues>
  name: FieldPath<RegisterValues>
  label: string
  type: 'text' | 'email' | 'password'
  autoComplete: string
  hint?: string
  placeholder?: string
}

function TextField({
  form,
  name,
  label,
  type,
  autoComplete,
  hint,
  placeholder,
}: TextFieldProps) {
  const error = errorMessage(form.formState.errors, name)

  return (
    <Field id={name} label={label} required hint={hint} error={error}>
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

export interface RegisterFormProps {
  /** Called with the new user; the API signs them in as part of registering. */
  onSuccess: (user: AuthUser) => void
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: DEFAULT_VALUES,
  })

  // Guards against a second submit arriving before the button is disabled:
  // Enter inside a field fires a submit event regardless of the button state.
  const inFlight = useRef(false)

  async function createAccount() {
    if (inFlight.current) return

    inFlight.current = true
    setSubmitting(true)
    setSubmitError(null)

    const { confirmPassword: _confirmPassword, ...values } = form.getValues()

    try {
      const user = await signUp(values)
      onSuccess(user)
    } catch (error) {
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : 'We could not create your account just now. Please try again.',
      )
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  // `createAccount` only runs once react-hook-form considers the values valid.
  // oxlint-disable-next-line react/refs -- false positive: a stable event handler
  const onSubmit = form.handleSubmit(createAccount)

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {submitError ? <Alert tone="error">{submitError}</Alert> : null}

      <TextField
        form={form}
        name="name"
        label="Full name"
        type="text"
        autoComplete="name"
        placeholder="John Doe"
      />
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
        autoComplete="new-password"
        hint={PASSWORD_HINT}
      />
      <TextField
        form={form}
        name="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
      />

      <Button type="submit" size="lg" fullWidth disabled={submitting}>
        {submitting ? 'Creating your account…' : 'Create account'}
      </Button>
    </form>
  )
}
