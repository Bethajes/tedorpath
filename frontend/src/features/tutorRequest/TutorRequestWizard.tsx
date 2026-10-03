import { useCallback, useMemo, useRef, useState } from 'react'
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSearchParams } from 'react-router-dom'

import { Alert, Button } from '@/components/ui'
import { ApiError } from '@/lib/api'
import { parseTutorRequestPrefill } from '@/lib/tutorRequestQuery'
import { useAsyncData } from '@/lib/useAsyncData'

import { AvailabilityFields } from './components/AvailabilityFields'
import { ReviewStep } from './components/ReviewStep'
import { StepCard } from './components/StepCard'
import { errorMessage, type StepErrors } from './components/stepErrors'
import {
  AboutLearnerStep,
  BudgetStep,
  ConfigErrorPanel,
  ConfigLoadingPanel,
  ContactStep,
  CountryStep,
  EducationStep,
  LearningGoalStep,
  LocationStep,
  SubjectsStep,
  TeachingModeStep,
} from './components/steps'
import { WizardStepper } from './components/WizardStepper'
import { submitTutorRequest } from './tutorRequest.api'
import { fetchOnboardingConfig, type OnboardingConfig } from './tutorRequest.config'
import {
  defaultsForCountry,
  defaultTimezoneFor,
  educationLevelsFor,
  resolveLevelLabel,
  resolveSubjectName,
} from './tutorRequest.configUtils'
import { buildWizardSchema, toRequestPayload } from './tutorRequest.schema'
import {
  EMPTY_FORM_VALUES,
  LAST_STEP_INDEX,
  STEP_FIELD_INDEX,
  WIZARD_STEPS,
  stepIndexOf,
  type WizardFormValues,
  type WizardStepId,
} from './tutorRequest.steps'

/**
 * The adaptive "Request a Tutor" wizard.
 *
 * Four decisions shape it:
 *
 *  - The configuration is fetched first, and failing to load it is fatal. The
 *    wizard has no option lists of its own, so there is nothing to fall back to;
 *    inventing one in the browser is the exact failure this design exists to
 *    avoid. The visitor gets a retry instead of a form that would be rejected on
 *    submit.
 *
 *  - Every answer lives in one react-hook-form instance, so Back never loses
 *    anything and the review reads the same values the steps wrote. The schema is
 *    built from the configuration once it has arrived, which is what lets the
 *    rules that depend on the catalogue live in the schema.
 *
 *  - Navigation validates only the fields the step owns. An eleven-step form that
 *    validated the whole document on every Continue would refuse to advance past
 *    an unanswered question four screens away, which is how people end up fighting
 *    a form instead of filling it in.
 *
 *  - Changing the country updates the defaults it implies — currency and timezone
 *    — and nothing else. It never rewrites a budget amount, because doing that
 *    would apply an exchange rate the client did not agree to.
 */
export function TutorRequestWizard({ onSubmitted }: { onSubmitted: () => void }) {
  /*
   * The shared loader rather than a bespoke effect: the wizard needs the same
   * loading/error/reload behaviour every admin screen already uses, and one
   * implementation means one answer to "what does the form do while the data is
   * on its way".
   *
   * Failing to load is fatal, and deliberately so. The wizard has no option lists
   * of its own, so there is nothing to fall back to; inventing one in the
   * browser is the exact failure this design exists to avoid. The visitor gets a
   * retry instead of a form that would be rejected on submit.
   */
  const config = useAsyncData<OnboardingConfig>(fetchOnboardingConfig, [], (error) =>
    error instanceof ApiError
      ? error.message
      : 'We could not load the request form. Please try again.',
  )

  if (config.error) {
    return <ConfigErrorPanel message={config.error} onRetry={config.reload} />
  }

  // `useForm` is never called with a schema built from a configuration that has
  // not arrived, so the wizard body is a separate component rather than a
  // conditional branch inside this one.
  if (!config.data) return <ConfigLoadingPanel />

  return <WizardBody config={config.data} onSubmitted={onSubmitted} />
}

function WizardBody({
  config,
  onSubmitted,
}: {
  config: OnboardingConfig
  onSubmitted: () => void
}) {
  const [current, setCurrent] = useState(0)
  const [furthest, setFurthest] = useState(0)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [staleNotice, setStaleNotice] = useState<string | null>(null)

  const [searchParams] = useSearchParams()

  /**
   * Seeded from links the rest of the site builds.
   *
   * Level and subject are resolved against the configuration rather than matched
   * literally, because the homepage links them by display name and those names
   * live in the database now. Anything that resolves to nothing is left empty
   * rather than guessed at — a prefilled answer the client did not give is worse
   * than no answer.
   */
  const seeded = useMemo(() => {
    const prefill = parseTutorRequestPrefill(searchParams.toString())
    const subjectId = resolveSubjectName(config, prefill.subject)

    return {
      educationLevelCode: resolveLevelLabel(config, prefill.educationLevel),
      subjectIds: subjectId ? [subjectId] : [],
      learningMode: prefill.learningMode,
      tutorProfileId: prefill.tutorProfileId,
    }
    // `searchParams` is a stable object per navigation in react-router.
  }, [config, searchParams])

  const schema = useMemo(() => buildWizardSchema(config), [config])

  // The three type arguments are all `WizardFormValues` because the schema's
  // input and output shapes are both the form's shape: nothing is transformed on
  // the way in. Spreading them means `getValues` and the resolver agree.
  const form = useForm<WizardFormValues, unknown, WizardFormValues>({
    resolver: zodResolver(schema),
    // `onTouched` rather than `onBlur`: a fieldset of radio buttons has no blur
    // event to hang validation on, so a blur-only mode would let a card group be
    // skipped entirely until submit.
    mode: 'onTouched',
    defaultValues: { ...EMPTY_FORM_VALUES, ...seeded },
  })

  const { setValue, trigger, getValues, control, formState } = form
  const { errors, isSubmitting } = formState

  // `useWatch` rather than `form.watch()`: the latter returns a function that
  // cannot be memoised safely, and this component passes `values` down to steps
  // that are otherwise pure.
  //
  // Cast to the full form shape because `useWatch` types its return as a deep
  // partial: every field has a default value here, so no field is ever missing,
  // and the steps would otherwise all have to handle `undefined` for values the
  // form has always initialised.
  const values = useWatch({ control }) as WizardFormValues

  // The catalogue's escape hatch, found by slug rather than by display name so
  // rewording the row does not detach the rule that goes with it.
  const otherSubjectId = useMemo(
    () => config.subjects.find((subject) => subject.slug === 'other')?.id ?? '',
    [config],
  )
  const otherGoalCode = useMemo(
    () => config.learningGoals.find((goal) => goal.code === 'other')?.code ?? '',
    [config],
  )

  /**
   * The browser's own timezone.
   *
   * Read once and only ever offered as a one-click correction — never applied
   * automatically. A device can be set to the wrong zone, and a scheduling
   * timezone nobody chose is worse than one they did.
   */
  const deviceTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      return ''
    }
  }, [])

  /**
   * What choosing a country implies.
   *
   * The budget amount is deliberately untouched. If someone quoted 500 ETB and
   * then changed their country to one that uses USD, the honest response is to
   * leave the 500, raise the mismatch on the budget step, and let them decide —
   * not to rescale the number with an exchange rate this product does not have.
   */
  const applyCountry = useCallback(
    (code: string) => {
      setValue('countryCode', code, { shouldDirty: true })
      setStaleNotice(null)

      /*
       * Nothing is recorded about a market here.
       *
       * This used to call `rememberMarket(code)`, which wrote the derived market to
       * sessionStorage so the directory would price in it. The country is now sent
       * with the request itself and the server remembers it — on the account for a
       * signed-in learner, in a cookie for an anonymous one — which is better on
       * both counts: it survives the tab being closed, and there is no second copy
       * of the answer in the browser to disagree with the server's.
       *
       * The rest of this handler is unaffected. Choosing a country still sets the
       * budget currency, which is a fact about the request rather than about the
       * prices shown elsewhere.
       */

      const defaults = defaultsForCountry(config, code)
      const amountEntered = getValues('budgetAmount').trim() !== ''
      const currencyUntouched = !form.getFieldState('budgetCurrency').isDirty

      // With no amount on the form there is nothing to disagree with, so the
      // country's currency is simply the right default.
      if (!amountEntered && currencyUntouched) {
        setValue('budgetCurrency', defaults.currencyCode)
      }

      if (!form.getFieldState('timezone').isDirty) {
        setValue('timezone', defaults.timezone)
      }

      // A level from another curriculum stops being a valid answer the moment
      // the country changes. Dropping it beats leaving a selection the schema
      // would reject three steps later with a message about a level the client
      // can no longer see anywhere.
      const levelCode = getValues('educationLevelCode')
      if (levelCode && !educationLevelsFor(config, code).some((level) => level.code === levelCode)) {
        setValue('educationLevelCode', '')
      }
    },
    [config, form, getValues, setValue],
  )

  const goTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, LAST_STEP_INDEX))
    setCurrent(clamped)
    setFurthest((value) => Math.max(value, clamped))
    // The step heading is what a screen reader needs to hear to know the step
    // changed; the visible banner below it is the same content.
    window.requestAnimationFrame(() => {
      document.getElementById('wizard-step-heading')?.focus()
    })
  }, [])

  const continueToNextStep = useCallback(async () => {
    const step = WIZARD_STEPS[current]
    // The review step owns no fields, so there is nothing to validate there.
    const valid = step.fields.length === 0 ? true : await trigger(step.fields)
    if (valid) goTo(current + 1)
  }, [current, goTo, trigger])

  /**
   * Duplicate-submission guard.
   *
   * The button is disabled while the request is in flight, but pressing Enter in
   * a text field still fires a submit event, and `isSubmitting` is render state
   * that is still stale when a second event arrives in the same tick. So the
   * latch is a ref, written synchronously inside the handler.
   */
  const inFlight = useRef(false)

  // The `inFlight` latch is only read and written inside the callback below,
  // never during render. It has to be synchronous: `isSubmitting` comes from
  // render state and is still stale when a second submit event arrives in the
  // same tick.
  // oxlint-disable react/refs
  const onSubmit = form.handleSubmit(
    async (formValues) => {
      if (inFlight.current) return
      inFlight.current = true
      setSubmitError(null)
      setStaleNotice(null)

      try {
        await submitTutorRequest(toRequestPayload(formValues))
        onSubmitted()
      } catch (error) {
        if (error instanceof ApiError && error.fields?.length) {
          // The catalogue changed under a form that had been open since before it
          // did. The offending field is named and its step is opened, because a
          // client who has been told a value is unavailable and then been left
          // on the review screen has been told nothing they can act on. The
          // answers they gave are kept so they only have to fix the one thing.
          const first = error.fields[0]
          setStaleNotice(first.message ?? 'Something you selected is no longer available.')

          const stepIndex = STEP_FIELD_INDEX.get(first.field as keyof WizardFormValues)
          if (stepIndex !== undefined) goTo(stepIndex)
        } else {
          setSubmitError(
            error instanceof ApiError
              ? error.message
              : "We couldn't submit your request right now. Please try again.",
          )
        }
      } finally {
        inFlight.current = false
      }
    },
    /**
     * Submitting validates the whole form, not just the review step — and
     * nothing on the review screen is editable. So a field that became invalid
     * somewhere back in the flow would fail the submit with no visible cause,
     * which reads as a broken button.
     *
     * So the failure is routed: the first step that owns an invalid field is
     * opened, and its own error message is shown there. The review's Edit links
     * exist for the same reason, but this covers the case nobody clicked.
     */
    (errors) => {
      const firstBadStep = WIZARD_STEPS.findIndex((candidate) =>
        candidate.fields.some((field) => errors[field]),
      )
      if (firstBadStep !== -1) goTo(firstBadStep)
    },
  )
  // oxlint-enable react/refs

  const step = WIZARD_STEPS[current]
  const isLastStep = current === LAST_STEP_INDEX

  return (
    <form noValidate onSubmit={onSubmit}>
      <WizardStepper
        steps={WIZARD_STEPS}
        current={current}
        furthest={furthest}
        onStepClick={goTo}
      />

      {/*
        One live region for the step heading. Its content changes when the step
        does, which is the announcement a screen reader makes; the visible banner
        below carries the same words for everyone else.
      */}
      <h1
        id="wizard-step-heading"
        tabIndex={-1}
        aria-live="polite"
        className="sr-only focus:not-sr-only focus:mb-4 focus:rounded focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-brand-600"
      >
        {`Step ${current + 1} of ${WIZARD_STEPS.length}: ${step.heading}`}
      </h1>

      {submitError ? (
        <Alert tone="error" className="mb-5">
          {submitError}
        </Alert>
      ) : null}

      {staleNotice ? (
        <Alert tone="error" className="mb-5">
          <p>{staleNotice}</p>
          <p className="mt-1">
            Everything you have entered is still here. Please go back and choose again.
          </p>
        </Alert>
      ) : null}

      <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50/70 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-800">{step.label}</p>
        <h2 className="mt-1 text-lg font-semibold text-ink-900">{step.heading}</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-600">{step.description}</p>
      </div>

      <StepBody
        current={current}
        form={form}
        config={config}
        values={values}
        errors={errors}
        otherSubjectId={otherSubjectId}
        otherGoalCode={otherGoalCode}
        deviceTimezone={deviceTimezone}
        onApplyCountry={applyCountry}
        onEditStep={(id: WizardStepId) => goTo(stepIndexOf(id))}
      />

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="outline"
          onClick={() => goTo(current - 1)}
          disabled={current === 0 || isSubmitting}
          className="w-full sm:w-auto"
        >
          Back
        </Button>

        {isLastStep ? (
          <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? 'Sending…' : 'Send tutor request'}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            onClick={continueToNextStep}
            className="w-full sm:w-auto"
          >
            Continue
          </Button>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-ink-500">
        Fields marked with <span className="text-red-600">*</span> are required. Nothing is
        submitted until the last step.
      </p>
    </form>
  )
}

/**
 * The controls for the current step.
 *
 * A separate component purely so `WizardBody` reads as a list of steps instead of
 * a wall of props. It holds no state and has no lifecycle of its own.
 */
interface StepBodyProps {
  current: number
  form: UseFormReturn<WizardFormValues>
  config: OnboardingConfig
  values: WizardFormValues
  errors: StepErrors
  otherSubjectId: string
  otherGoalCode: string
  deviceTimezone: string
  onApplyCountry: (code: string) => void
  onEditStep: (id: WizardStepId) => void
}

function StepBody({
  current,
  form,
  config,
  values,
  errors,
  otherSubjectId,
  otherGoalCode,
  deviceTimezone,
  onApplyCountry,
  onEditStep,
}: StepBodyProps) {
  const { setValue } = form

  /**
   * Writes one field and marks the form dirty.
   *
   * The cast is confined to this one function. `setValue`'s own signature ties
   * the value type to the key through a path type that a union key cannot
   * satisfy, so every caller would otherwise need its own assertion — and a
   * generic wrapper keeps the call sites honest: `set('subjectIds', [...])` will
   * not typecheck against the wrong field.
   */
  const set = <K extends keyof WizardFormValues>(key: K, value: WizardFormValues[K]) =>
    (
      setValue as unknown as (name: K, next: WizardFormValues[K], options?: object) => void
    )(key, value, { shouldDirty: true })

  switch (WIZARD_STEPS[current].id) {
    case 'country':
      return (
        <CountryStep
          config={config}
          value={values.countryCode}
          onChange={onApplyCountry}
          errors={errors}
        />
      )

    case 'education':
      return (
        <EducationStep
          config={config}
          countryCode={values.countryCode}
          value={values.educationLevelCode}
          onChange={(code) => set('educationLevelCode', code)}
          errors={errors}
        />
      )

    case 'subjects':
      return (
        <SubjectsStep
          config={config}
          countryCode={values.countryCode}
          levelCode={values.educationLevelCode}
          selected={values.subjectIds}
          onToggle={(id) =>
            set(
              'subjectIds',
              values.subjectIds.includes(id)
                ? values.subjectIds.filter((entry) => entry !== id)
                : [...values.subjectIds, id],
            )
          }
          otherSubjectId={otherSubjectId}
          subjectOther={values.subjectOther}
          onSubjectOtherChange={(value) => set('subjectOther', value)}
          errors={errors}
        />
      )

    case 'goal':
      return (
        <LearningGoalStep
          config={config}
          value={values.learningGoal}
          onChange={(code) => set('learningGoal', code)}
          otherCode={otherGoalCode}
          otherValue={values.learningGoalOther}
          onOtherChange={(value) => set('learningGoalOther', value)}
          errors={errors}
        />
      )

    case 'mode':
      return (
        <TeachingModeStep
          value={values.learningMode}
          onChange={(value) => set('learningMode', value as WizardFormValues['learningMode'])}
          errors={errors}
        />
      )

    case 'location':
      return (
        <LocationStep
          mode={values.learningMode}
          value={values.preferredLocation}
          onChange={(value) => set('preferredLocation', value)}
          errors={errors}
        />
      )

    case 'availability':
      return (
        <StepCard>
          <AvailabilityFields
            timezones={config.timezones}
            timezone={values.timezone}
            onTimezoneChange={(value) => set('timezone', value)}
            timezoneError={errorMessage(errors, 'timezone')}
            countryTimezone={defaultTimezoneFor(config, values.countryCode)}
            deviceTimezone={deviceTimezone}
            days={values.preferredDayNames}
            onDayToggle={(day) =>
              set(
                'preferredDayNames',
                values.preferredDayNames.includes(day)
                  ? values.preferredDayNames.filter((entry) => entry !== day)
                  : [...values.preferredDayNames, day],
              )
            }
            ranges={values.preferredTimeRanges}
            onRangesChange={(ranges) => set('preferredTimeRanges', ranges)}
            rangeError={errorMessage(errors, 'preferredTimeRanges')}
          />
        </StepCard>
      )

    case 'budget':
      return (
        <BudgetStep
          config={config}
          countryCode={values.countryCode}
          amount={values.budgetAmount}
          onAmountChange={(value) => set('budgetAmount', value)}
          currencyCode={values.budgetCurrency}
          onCurrencyChange={(code) => set('budgetCurrency', code)}
          errors={errors}
        />
      )

    case 'details':
      return (
        <AboutLearnerStep
          description={values.helpDescription}
          onDescriptionChange={(value) => set('helpDescription', value)}
          additional={values.additionalInfo}
          onAdditionalChange={(value) => set('additionalInfo', value)}
          errors={errors}
        />
      )

    case 'contact':
      return <ContactStep values={values} onChange={set} errors={errors} />

    case 'review':
      return <ReviewStep config={config} values={values} onEdit={onEditStep} />
  }
}