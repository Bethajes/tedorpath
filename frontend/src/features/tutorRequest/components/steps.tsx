import { Alert, Button, Field, Input, Select, Textarea } from '@/components/ui'

import type { ConfigCountry, ConfigCurrency, OnboardingConfig } from '../tutorRequest.config'
import {
  defaultCurrencyFor,
  educationLevelsFor,
  findCurrency,
  otherSubjectsFor,
  suggestedSubjectsFor,
} from '../tutorRequest.configUtils'
import type { WizardFormValues } from '../tutorRequest.steps'
import { TEACHING_MODE_OPTIONS, needsLocation } from '../tutorRequest.steps'

import { CurrencyMismatchNotice } from './AvailabilityFields'
import { CountryPicker } from './CountryPicker'
import { ChoiceCards, StepCard } from './StepCard'
import { errorMessage, type StepErrors } from './stepErrors'
import { SubjectPicker } from './SubjectPicker'

/**
 * The wizard's input steps.
 *
 * Each one is a plain component that receives exactly what it renders. The
 * adaptive behaviour — a country choosing a currency and a curriculum, a level
 * choosing the suggested subjects, a teaching mode deciding whether a location is
 * required — is resolved by the shell from the configuration and passed in as
 * props, so a step never has to know why it is showing what it is showing.
 *
 * None of them render a heading: the wizard puts one block above the stepper, so
 * the heading is in the same place on every step and cannot drift out of step
 * with the step definitions.
 */

/**
 * Ethiopia's country code.
 *
 * The default answer, and the one that decides the birr rate rather than the
 * international one. Defined here rather than imported from the market registry
 * because it is a country, not a market: the wizard asks a question about where
 * somebody is, and the country is the answer to that. Which price it implies is
 * derived from it at the point of use.
 */
const ETHIOPIA_CODE = 'ET'

/** The four fields on the contact step. All of them are free text. */
export type ContactField = 'fullName' | 'phone' | 'email' | 'telegram'

/**
 * Step 1 — country.
 *
 * A searchable combo box rather than a `<select>`: the list runs to dozens of
 * countries, and on a phone a native select takes over the screen with an
 * alphabetical wheel, so the consequence of the answer is not visible while it is
 * being given. The currency and timezone the country implies are shown on the step,
 * because those are the consequences of the answer and the visitor is entitled to
 * see them before agreeing to them.
 */
export function CountryStep({
  config,
  value,
  onChange,
  errors,
}: {
  config: OnboardingConfig
  value: string
  onChange: (code: string) => void
  errors: StepErrors
}) {
  const country = config.countries.find((entry) => entry.code === value)
  const currency = country ? findCurrency(config, country.currencyCode) : undefined

  /*
   * Whether this answer means the birr price or the international one.
   *
   * Read from the country rather than from a market, because the country is what
   * was asked and what is stored on the request. Ethiopia is the local market and
   * the default; everywhere else is served the international rate.
   */
  const countryIsEthiopia = value.toUpperCase() === ETHIOPIA_CODE

  return (
    <StepCard>
      <Field
        id="countryCode"
        label="Which country are you located in?"
        required
        error={errorMessage(errors, 'countryCode')}
        hint="Search for the country you are in. This decides which of a tutor's prices you are shown, and the currency your budget is in."
      >
        {(fieldProps) => (
          /*
           * `fieldProps` is threaded into the picker rather than dropped. It carries
           * the id this field's `<label for>` points at, plus the ids of the hint and
           * the error — and a combo box with no `id` is announced as an unnamed text
           * box, which loses the question it is asking.
           */
          <CountryPicker
            countries={config.countries}
            value={value}
            onChange={onChange}
            defaultCode={ETHIOPIA_CODE}
            invalid={Boolean(errors.countryCode)}
            id={fieldProps.id}
            describedBy={fieldProps['aria-describedby']}
          />
        )}
      </Field>

      {/*
        The consequence of the answer, shown while the answer is being given.

        This is why the country question comes first: the currency, the curriculum,
        the education levels, the suggested subjects and which of a tutor's two
        prices they will see all follow from it, and a parent should be able to see
        that before agreeing rather than after submitting.

        The price line is the one that matters most to them, so it is stated
        outright — and stated as "the rate you will see", never as a conversion of
        one price into another.
      */}
      {country && currency ? (
        <Alert tone="info" className="mt-5">
          <p className="font-medium text-brand-900">
            For {country.name} we will use {currency.name} ({currency.code})
          </p>
          <p className="mt-1">
            Budgets will be shown in {currency.code} and lesson times in {country.timezone}.{' '}
            {countryIsEthiopia
              ? 'You will be shown tutors’ Ethiopian rates, in birr.'
              : 'You will be shown tutors’ international rates, in dollars.'}{' '}
            Nothing is converted — those are the prices tutors set themselves.
          </p>
        </Alert>
      ) : null}
    </StepCard>
  )
}

/**
 * Step 2 — education level, offered by the curriculum the country is configured
 * with.
 */
export function EducationStep({
  config,
  countryCode,
  value,
  onChange,
  errors,
}: {
  config: OnboardingConfig
  countryCode: string
  value: string
  onChange: (code: string) => void
  errors: StepErrors
}) {
  const levels = educationLevelsFor(config, countryCode)

  return (
    <StepCard>
      <ChoiceCards
        legend="Education level"
        error={errorMessage(errors, 'educationLevelCode')}
        hint={
          levels.length > 0
            ? 'Grouped by stage, in the order your education system lists them.'
            : 'Choose your country on the previous step to see the levels that apply to you.'
        }
        options={levels.map((level) => ({
          value: level.code,
          label: level.name,
          meta: level.stage,
        }))}
        value={value}
        onChange={onChange}
      />
    </StepCard>
  )
}

/**
 * Step 3 — subjects: the level's suggestions first, then the whole catalogue.
 *
 * The suggestions are advisory and the rest of the catalogue stays available, so
 * a client whose subject is not taught at their level is not stuck. The heading
 * on the suggestions says which level produced them, because a list that appears
 * out of nowhere reads as an opinion rather than as a consequence of the answer
 * they just gave.
 */
export function SubjectsStep({
  config,
  countryCode,
  levelCode,
  selected,
  onToggle,
  otherSubjectId,
  subjectOther,
  onSubjectOtherChange,
  errors,
}: {
  config: OnboardingConfig
  countryCode: string
  levelCode: string
  selected: string[]
  onToggle: (id: string) => void
  otherSubjectId: string
  subjectOther: string
  onSubjectOtherChange: (value: string) => void
  errors: StepErrors
}) {
  const suggested = suggestedSubjectsFor(config, countryCode, levelCode)

  // The rest of the catalogue, still grouped the same way, so a client whose
  // subject is not taught at their level is never stuck.
  const byCategory = new Map<string, typeof config.subjects>()
  for (const subject of otherSubjectsFor(config, suggested)) {
    const group = byCategory.get(subject.category)
    if (group) group.push(subject)
    else byCategory.set(subject.category, [subject])
  }

  const showOtherField = otherSubjectId !== '' && selected.includes(otherSubjectId)
  const levelName = config.educationSystems
    .flatMap((system) => system.levels)
    .find((level) => level.code === levelCode)?.name

  return (
    <StepCard>
      <SubjectPicker
        legend="Subjects"
        hint={
          levelName
            ? `The subjects most often taught at ${levelName} are listed first. You can choose from the whole catalogue.`
            : 'Choose an education level on the previous step to see suggestions first.'
        }
        error={errorMessage(errors, 'subjectIds')}
        suggestedHeading={levelName ? `Commonly taught at ${levelName}` : undefined}
        suggested={suggested}
        groups={[...byCategory].map(([category, subjects]) => ({ category, subjects }))}
        selected={selected}
        onToggle={onToggle}
      >
        {showOtherField ? (
          <Field
            id="subjectOther"
            label="What subject do you mean?"
            required
            error={errorMessage(errors, 'subjectOther')}
            hint="Tell us what you actually want help with and we will find the right tutor."
          >
            {(field) => (
              <Input
                {...field}
                value={subjectOther}
                onChange={(event) => onSubjectOtherChange(event.target.value)}
                placeholder="e.g. Environmental Economics"
                invalid={Boolean(errors.subjectOther)}
              />
            )}
          </Field>
        ) : null}
      </SubjectPicker>
    </StepCard>
  )
}

/** Step 4 — what the client is trying to achieve. */
export function LearningGoalStep({
  config,
  value,
  onChange,
  otherCode,
  otherValue,
  onOtherChange,
  errors,
}: {
  config: OnboardingConfig
  value: string
  onChange: (code: string) => void
  otherCode: string
  otherValue: string
  onOtherChange: (value: string) => void
  errors: StepErrors
}) {
  return (
    <StepCard>
      <ChoiceCards
        legend="Main goal"
        error={errorMessage(errors, 'learningGoal')}
        options={config.learningGoals.map((goal) => ({
          value: goal.code,
          label: goal.name,
          description: goal.description ?? undefined,
        }))}
        value={value}
        onChange={onChange}
      >
        {value === otherCode ? (
          <Field
            id="learningGoalOther"
            label="Tell us in your own words"
            required
            error={errorMessage(errors, 'learningGoalOther')}
          >
            {(field) => (
              <Textarea
                {...field}
                rows={3}
                value={otherValue}
                onChange={(event) => onOtherChange(event.target.value)}
                placeholder="e.g. I want to be able to hold a conversation with colleagues in English."
                invalid={Boolean(errors.learningGoalOther)}
              />
            )}
          </Field>
        ) : null}
      </ChoiceCards>
    </StepCard>
  )
}

/** Step 5 — how the lessons should happen. */
export function TeachingModeStep({
  value,
  onChange,
  errors,
}: {
  value: string
  onChange: (value: string) => void
  errors: StepErrors
}) {
  return (
    <StepCard>
      <ChoiceCards
        legend="Teaching mode"
        error={errorMessage(errors, 'learningMode')}
        options={TEACHING_MODE_OPTIONS.map((mode) => ({
          value: mode.value,
          label: mode.label,
          description: mode.description,
        }))}
        value={value}
        onChange={onChange}
        columns={3}
      />
    </StepCard>
  )
}

/**
 * Step 6 — location.
 *
 * Required only when a tutor could turn up in a room. For online learners it is
 * still offered, because knowing roughly where someone is helps us match a tutor
 * who teaches in their language, but it is labelled optional and the wording
 * changes to match.
 */
export function LocationStep({
  mode,
  value,
  onChange,
  errors,
}: {
  mode: string
  value: string
  onChange: (value: string) => void
  errors: StepErrors
}) {
  const required = needsLocation(mode)

  return (
    <StepCard>
      <Field
        id="preferredLocation"
        label="City or area"
        required={required}
        error={errorMessage(errors, 'preferredLocation')}
        hint={
          required
            ? 'In-person lessons need a location so we can match you with a tutor nearby. A city or neighbourhood is enough.'
            : 'You chose online lessons, so this is optional. It still helps us find a tutor who speaks your language.'
        }
      >
        {(field) => (
          <Input
            {...field}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            autoComplete="address-level2"
            placeholder="e.g. Addis Ababa"
            invalid={Boolean(errors.preferredLocation)}
          />
        )}
      </Field>
    </StepCard>
  )
}

/**
 * Step 8 — budget.
 *
 * The amount and the currency are two controls that cannot be filled in
 * independently of each other: the currency is prefilled from the country and the
 * two travel to the server as separate fields. Nothing on this step converts
 * between currencies — including when the country changes underneath it, which is
 * what `CurrencyMismatchNotice` is for.
 */
export function BudgetStep({
  config,
  countryCode,
  amount,
  onAmountChange,
  currencyCode,
  onCurrencyChange,
  errors,
}: {
  config: OnboardingConfig
  countryCode: string
  amount: string
  onAmountChange: (value: string) => void
  currencyCode: string
  onCurrencyChange: (code: string) => void
  errors: StepErrors
}) {
  const country: ConfigCountry | undefined = config.countries.find(
    (entry) => entry.code === countryCode,
  )
  const countryCurrency = defaultCurrencyFor(config, countryCode)
  const selectedCurrency: ConfigCurrency | undefined = findCurrency(config, currencyCode)

  // Only raised once there is something to disagree with: an empty budget has no
  // currency to be wrong about.
  const mismatch =
    amount.trim() !== '' &&
    currencyCode !== '' &&
    countryCurrency !== undefined &&
    currencyCode !== countryCurrency.code

  return (
    <StepCard>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]">
        <Field
          id="budgetAmount"
          label="Amount"
          // The step description already says the budget is optional.
          hideOptionalMarker
          error={errorMessage(errors, 'budgetAmount')}
          hint={
            selectedCurrency
              ? `In ${selectedCurrency.name} (${selectedCurrency.code}).`
              : 'Per lesson, per hour, or for a package — whichever you have in mind.'
          }
        >
          {(field) => (
            <Input
              {...field}
              // `inputMode="decimal"` gives a phone a numeric keypad with a
              // decimal point without locking out anything else someone might
              // type while working out what to write.
              inputMode="decimal"
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
              placeholder="e.g. 450"
              invalid={Boolean(errors.budgetAmount)}
            />
          )}
        </Field>

        <Field
          id="budgetCurrency"
          label="Currency"
          required={amount.trim() !== ''}
          hideOptionalMarker
          error={errorMessage(errors, 'budgetCurrency')}
          hint={
            countryCurrency
              ? `${country?.name ?? 'Your country'} uses ${countryCurrency.code}.`
              : undefined
          }
        >
          {(field) => (
            <Select
              {...field}
              value={currencyCode}
              onChange={(event) => onCurrencyChange(event.target.value)}
              invalid={Boolean(errors.budgetCurrency)}
            >
              <option value="">Please select…</option>
              {config.currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} — {currency.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {mismatch && countryCurrency && country ? (
        <CurrencyMismatchNotice
          amount={amount.trim()}
          currencyCode={currencyCode}
          countryName={country.name}
          countryCurrencyCode={countryCurrency.code}
          onUseCountryCurrency={() => onCurrencyChange(countryCurrency.code)}
        />
      ) : null}

      <p className="mt-5 text-xs leading-relaxed text-ink-500">
        We store the amount and the currency it is in as two separate values, and we never convert
        between currencies. If you would rather give your budget in a different currency, choose it
        above — your amount stays exactly as you typed it.
      </p>
    </StepCard>
  )
}

/** Step 9 — the description, and anything else worth saying. */
export function AboutLearnerStep({
  description,
  onDescriptionChange,
  additional,
  onAdditionalChange,
  errors,
}: {
  description: string
  onDescriptionChange: (value: string) => void
  additional: string
  onAdditionalChange: (value: string) => void
  errors: StepErrors
}) {
  return (
    <StepCard>
      <Field
        id="helpDescription"
        label="What do you need help with?"
        required
        error={errorMessage(errors, 'helpDescription')}
        hint="For example: I am struggling with algebra and quadratic equations, and I have an exam in three weeks."
      >
        {(field) => (
          <Textarea
            {...field}
            rows={5}
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Tell us about the topic, your goals, and any deadlines."
            invalid={Boolean(errors.helpDescription)}
          />
        )}
      </Field>

      <div className="mt-5">
        <Field
          id="additionalInfo"
          label="Anything else we should know?"
          hint="Preferred language, tutor gender, anything that would make lessons work better for you."
        >
          {(field) => (
            <Textarea
              {...field}
              rows={3}
              value={additional}
              onChange={(event) => onAdditionalChange(event.target.value)}
              invalid={Boolean(errors.additionalInfo)}
            />
          )}
        </Field>
      </div>
    </StepCard>
  )
}

/** Step 10 — how to reach the client. */
export function ContactStep({
  values,
  onChange,
  errors,
}: {
  values: WizardFormValues
  /**
   * Every field on this step is text, so the callback is not generic. That keeps
   * the wizard shell from needing a type assertion per field just to satisfy
   * `setValue`'s path-typed value parameter.
   */
  onChange: (key: ContactField, value: string) => void
  errors: StepErrors
}) {
  return (
    <StepCard>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field id="fullName" label="Full name" required error={errorMessage(errors, 'fullName')}>
          {(field) => (
            <Input
              {...field}
              value={values.fullName}
              onChange={(event) => onChange('fullName', event.target.value)}
              autoComplete="name"
              placeholder="e.g. Alex Morgan"
              invalid={Boolean(errors.fullName)}
            />
          )}
        </Field>

        <Field
          id="phone"
          label="Phone number"
          required
          error={errorMessage(errors, 'phone')}
          hint="Include your country code if you are outside your local area."
        >
          {(field) => (
            <Input
              {...field}
              type="tel"
              value={values.phone}
              onChange={(event) => onChange('phone', event.target.value)}
              autoComplete="tel"
              placeholder="e.g. +251 91 234 5678"
              invalid={Boolean(errors.phone)}
            />
          )}
        </Field>

        <Field
          id="email"
          label="Email"
          error={errorMessage(errors, 'email')}
          hint="Only if you would prefer email to a call."
        >
          {(field) => (
            <Input
              {...field}
              type="email"
              value={values.email}
              onChange={(event) => onChange('email', event.target.value)}
              autoComplete="email"
              placeholder="e.g. you@example.com"
              invalid={Boolean(errors.email)}
            />
          )}
        </Field>

        <Field
          id="telegram"
          label="Telegram username"
          error={errorMessage(errors, 'telegram')}
          hint="If Telegram is the easiest way to reach you."
        >
          {(field) => (
            <Input
              {...field}
              value={values.telegram}
              onChange={(event) => onChange('telegram', event.target.value)}
              placeholder="e.g. @yourname"
              invalid={Boolean(errors.telegram)}
            />
          )}
        </Field>
      </div>
    </StepCard>
  )
}

/** Shown when the wizard's reference data could not be loaded. */
export function ConfigErrorPanel({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center">
      <h2 className="text-lg font-semibold text-red-900">We could not load the request form</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-red-800">{message}</p>
      <p className="mx-auto mt-2 max-w-md text-xs text-red-700">
        We need this information before we can show you the right subjects, currency and timezone.
      </p>
      <Button variant="primary" onClick={onRetry} className="mt-5">
        Try again
      </Button>
    </div>
  )
}

/** Shown while the wizard's reference data is being fetched. */
export function ConfigLoadingPanel() {
  return (
    <div
      role="status"
      className="rounded-xl border border-ink-200 bg-white px-6 py-16 text-center shadow-sm"
    >
      <p className="text-sm text-ink-500">Loading the request form…</p>
    </div>
  )
}
