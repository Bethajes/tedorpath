import { useEffect, useRef, useState, type HTMLInputTypeAttribute } from 'react'
import {
  useForm,
  type FieldErrors,
  type FieldPath,
  type UseFormReturn,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSearchParams } from 'react-router-dom'

import { FormSection, FullWidth } from '@/components/form/FormSection'
import { Alert, Button, Field, Input, Select, Textarea } from '@/components/ui'
import { ApiError } from '@/lib/api'
import { parseTutorRequestPrefill } from '@/lib/tutorRequestQuery'

import { submitTutorRequest } from './tutorRequest.api'
import {
  EDUCATION_LEVELS,
  FORM_SECTIONS,
  LEARNING_MODES,
  SELECT_PLACEHOLDER,
  SUBJECTS,
  SUBMIT_LABEL,
  SUBMITTING_LABEL,
} from './tutorRequest.constants'
import {
  tutorRequestSchema,
  type TutorRequestPayload,
  type TutorRequestValues,
} from './tutorRequest.schema'
import { TutorRequestSuccess } from './TutorRequestSuccess'

/**
 * Duplicate-submission guard.
 *
 * The submit button is disabled while the request is in flight, which blocks
 * repeat clicks. Pressing Enter inside a text field still fires a submit event,
 * so the handler checks the in-flight state as well.
 */
const DEFAULT_VALUES: TutorRequestValues = {
  fullName: '',
  phone: '',
  telegram: '',
  email: '',
  subject: '',
  educationLevel: '',
  learningMode: '',
  helpDescription: '',
  preferredLocation: '',
  preferredDays: '',
  preferredTime: '',
  budget: '',
  additionalInfo: '',
}

function errorMessage(
  errors: FieldErrors<TutorRequestValues>,
  name: FieldPath<TutorRequestValues>,
): string | undefined {  const entry: unknown = errors[name]
  if (entry && typeof entry === 'object' && 'message' in entry) {
    const { message } = entry as { message?: unknown }
    if (typeof message === 'string') return message
  }
  return undefined
}

type TextFieldProps = {
  form: UseFormReturn<TutorRequestValues, unknown, TutorRequestPayload>
  name: FieldPath<TutorRequestValues>
  label: string
  required?: boolean
  hint?: string
  type?: HTMLInputTypeAttribute
  placeholder?: string
  autoComplete?: string
}

function TextField({ form, name, label, required, hint, ...inputProps }: TextFieldProps) {
  const error = errorMessage(form.formState.errors, name)
  return (
    <Field id={name} label={label} required={required} hint={hint} error={error}>
      {(field) => (
        <Input
          {...form.register(name)}
          {...field}
          {...inputProps}
          invalid={Boolean(error)}
        />
      )}
    </Field>
  )
}

type SelectFieldProps = {
  form: UseFormReturn<TutorRequestValues, unknown, TutorRequestPayload>
  name: FieldPath<TutorRequestValues>
  label: string
  options: readonly string[]
  required?: boolean
  hint?: string
}

function SelectField({ form, name, label, options, required, hint }: SelectFieldProps) {
  const error = errorMessage(form.formState.errors, name)
  return (
    <Field id={name} label={label} required={required} hint={hint} error={error}>
      {(field) => (
        <Select {...form.register(name)} {...field} invalid={Boolean(error)}>
          <option value="">{SELECT_PLACEHOLDER}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      )}
    </Field>
  )
}

type TextAreaFieldProps = {
  form: UseFormReturn<TutorRequestValues, unknown, TutorRequestPayload>
  name: FieldPath<TutorRequestValues>
  label: string
  required?: boolean
  hint?: string
  placeholder?: string
  rows?: number
}

function TextAreaField({
  form,
  name,
  label,
  required,
  hint,
  placeholder,
  rows,
}: TextAreaFieldProps) {
  const error = errorMessage(form.formState.errors, name)
  return (
    <Field id={name} label={label} required={required} hint={hint} error={error}>
      {(field) => (
        <Textarea
          {...form.register(name)}
          {...field}
          rows={rows}
          placeholder={placeholder}
          invalid={Boolean(error)}
        />
      )}
    </Field>
  )
}

export function TutorRequestForm() {
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [searchParams] = useSearchParams()

  /**
   * Preferences carried over from the homepage discovery panel and the subject
   * cards, plus the tutor the client opened the form from. Parsed against the
   * same enums the schema enforces, so a hand-edited URL cannot seed the form
   * with a value it could not otherwise hold.
   */
  const { subject, educationLevel, learningMode, tutorProfileId } = parseTutorRequestPrefill(
    searchParams.toString(),
  )

  const form = useForm<TutorRequestValues, unknown, TutorRequestPayload>({
    resolver: zodResolver(tutorRequestSchema),
    mode: 'onBlur',
    defaultValues: {
      ...DEFAULT_VALUES,
      subject,
      educationLevel,
      learningMode,
      tutorProfileId,
    },
  })

  // Keep the dropdowns in step when the query string changes under us, e.g. the
  // visitor edits the URL or navigates back and forward.
  useEffect(() => {
    if (subject) form.setValue('subject', subject)
    if (educationLevel) form.setValue('educationLevel', educationLevel)
    if (learningMode) form.setValue('learningMode', learningMode)
    form.setValue('tutorProfileId', tutorProfileId)
  }, [form, subject, educationLevel, learningMode, tutorProfileId])

  const {
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form

  // Guards against duplicate submissions. Disabling the button stops repeat
  // clicks, but pressing Enter in a text field still fires a submit event.
  const inFlight = useRef(false)

  // The `inFlight` latch below is only read and written inside this event
  // handler, never during render. It has to be synchronous: `isSubmitting`
  // comes from render state and is still stale when a second submit event
  // arrives in the same tick (Enter pressed twice in a text field).
  // oxlint-disable-next-line react/refs
  const onSubmit = handleSubmit(async (values) => {
    if (inFlight.current) return
    inFlight.current = true
    setSubmitError(null)
    try {
      // The schema accepts an empty string for "no tutor chosen"; the API wants
      // the key absent or null, so the two representations are collapsed here
      // rather than leaving the API to guess.
      const payload =
        values.tutorProfileId === ''
          ? { ...values, tutorProfileId: undefined }
          : values

      await submitTutorRequest(payload)
      setSubmitted(true)
    } catch (error) {
      // The entered values are deliberately left in place so the visitor can
      // correct one field and submit again.
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : "We couldn't submit your request right now. Please try again.",
      )
    } finally {
      inFlight.current = false
    }
  })

  if (submitted) {
    return <TutorRequestSuccess />
  }

  const hasErrors = Object.keys(errors).length > 0

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {submitError ? <Alert tone="error">{submitError}</Alert> : null}

      {hasErrors ? (
        <Alert tone="error">
          Please check the highlighted fields below before sending your request.
        </Alert>
      ) : null}

      <FormSection
        title={FORM_SECTIONS.information.title}
        description={FORM_SECTIONS.information.description}
      >
        <TextField
          form={form}
          name="fullName"
          label="Full Name"
          required
          autoComplete="name"
          placeholder="e.g. Alex Morgan"
        />
        <TextField
          form={form}
          name="phone"
          label="Phone Number"
          required
          type="tel"
          autoComplete="tel"
          placeholder="e.g. +1 555 123 4567"
          hint="Include your country code if you are outside your local area."
        />
        <TextField
          form={form}
          name="telegram"
          label="Telegram Username"
          placeholder="e.g. @yourname"
          hint="If you would prefer we contact you on Telegram."
        />
        <TextField
          form={form}
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="e.g. you@example.com"
        />
      </FormSection>

      <FormSection
        title={FORM_SECTIONS.learning.title}
        description={FORM_SECTIONS.learning.description}
      >
        <SelectField
          form={form}
          name="subject"
          label="Subject"
          options={SUBJECTS}
          required
        />
        <SelectField
          form={form}
          name="educationLevel"
          label="Education Level"
          options={EDUCATION_LEVELS}
          required
        />
        <SelectField
          form={form}
          name="learningMode"
          label="Learning Mode"
          options={LEARNING_MODES}
          required
          hint="Online, in person, or whichever suits you."
        />
        <FullWidth>
          <TextAreaField
            form={form}
            name="helpDescription"
            label="What do you need help with?"
            required
            rows={5}
            hint="For example: I am struggling with algebra and quadratic equations, and I have an exam in three weeks."
            placeholder="Tell us a little about the topic, your goals, and any deadlines."
          />
        </FullWidth>
      </FormSection>

      <FormSection
        title={FORM_SECTIONS.preferences.title}
        description={FORM_SECTIONS.preferences.description}
      >
        <TextField
          form={form}
          name="preferredLocation"
          label="Preferred Location"
          placeholder="City or neighbourhood"
        />
        <TextField
          form={form}
          name="preferredDays"
          label="Preferred Days"
          placeholder="e.g. Monday and Wednesday"
        />
        <TextField
          form={form}
          name="preferredTime"
          label="Preferred Time"
          placeholder="e.g. after 17:00"
        />
        <TextField
          form={form}
          name="budget"
          label="Budget"
          placeholder="e.g. $15 per hour"
        />
      </FormSection>

      <FormSection
        title={FORM_SECTIONS.additional.title}
        description={FORM_SECTIONS.additional.description}
      >
        <FullWidth>
          <TextAreaField
            form={form}
            name="additionalInfo"
            label="Anything else we should know?"
            rows={4}
            placeholder="Share anything that helps us understand your situation."
          />
        </FullWidth>
      </FormSection>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-500">
          Fields marked with <span className="text-red-600">*</span> are required.
        </p>
        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? SUBMITTING_LABEL : SUBMIT_LABEL}
        </Button>
      </div>
    </form>
  )
}
