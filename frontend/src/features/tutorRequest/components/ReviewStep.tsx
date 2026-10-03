import { Link } from 'react-router-dom'

import type { ConfigCurrency, OnboardingConfig } from '../tutorRequest.config'
import {
  educationLevelsFor,
  findCountry,
  findCurrency,
  findSubject,
  formatMoney,
  joinList,
} from '../tutorRequest.configUtils'
import { formatTimeRange, isCompleteTimeRange } from '../tutorRequest.schema'
import type { WizardStepId, WizardFormValues } from '../tutorRequest.steps'
import { needsLocation } from '../tutorRequest.steps'

/**
 * Step 11 — the review.
 *
 * Everything the client answered, in their own words where they wrote it and in
 * the catalogue's words where they picked one, with a link back to whichever step
 * owns it. Two reasons it exists rather than a submit button: an eleven-step form
 * is long enough that people forget what they said three screens ago, and an
 * admin triaging the queue has to be able to trust what they are reading.
 *
 * Nothing is invented here. A row the client did not answer says "Not answered"
 * rather than being filled with a plausible default, so a missing answer cannot
 * hide behind a summary line.
 */
export interface ReviewStepProps {
  config: OnboardingConfig
  values: WizardFormValues
  onEdit: (step: WizardStepId) => void
}

export function ReviewStep({ config, values, onEdit }: ReviewStepProps) {
  const country = findCountry(config, values.countryCode)
  const levels = educationLevelsFor(config, values.countryCode)
  const level =
    levels.find((entry) => entry.code === values.educationLevelCode) ??
    // The chosen level may belong to a curriculum other than the country's —
    // possible from a link built when the configuration was different, and
    // perfectly legal for a request.
    config.educationSystems
      .flatMap((system) => system.levels)
      .find((entry) => entry.code === values.educationLevelCode)

  const subjectNames = values.subjectIds
    .map((id) => findSubject(config, id)?.name)
    .filter((name): name is string => Boolean(name))

const goal = config.learningGoals.find((entry) => entry.code === values.learningGoal)
  const currency = findCurrency(config, values.budgetCurrency)

  /**
   * Shown when the selected currency is no longer in the catalogue.
   *
   * The code is still printed, because it is what the client actually selected
   * and what the admin will read; hiding it behind "not answered" would be a lie
   * about what is being sent.
   */
  const fallbackCurrency: ConfigCurrency | undefined = currency ?? {
    code: values.budgetCurrency,
    name: values.budgetCurrency,
    symbol: values.budgetCurrency,
    decimals: 2,
  }

  const amount = values.budgetAmount.trim() === '' ? null : Number(values.budgetAmount.replace(',', '.'))
  const completeRanges = values.preferredTimeRanges.filter(isCompleteTimeRange)

  return (
    <div className="space-y-4">
      <section
        aria-label="Request summary"
        className="rounded-xl border border-ink-200 bg-white shadow-sm"
      >
        <dl className="divide-y divide-ink-100">
          <Row label="Country" value={country?.name} onEdit={() => onEdit('country')}>
            {country ? (
              <p className="mt-1 text-xs text-ink-500">
                Budgets in {country.currencyCode}, lessons scheduled in {country.timezone}.
              </p>
            ) : null}
          </Row>

          <Row
            label="Education level"
            value={level?.name}
            onEdit={() => onEdit('education')}
            optional
          />

          <Row label="Subjects" value={joinList(subjectNames)} onEdit={() => onEdit('subjects')}>
            {values.subjectOther.trim() !== '' ? (
              <p className="mt-1 text-xs text-ink-500">
                Also described as: {values.subjectOther.trim()}
              </p>
            ) : null}
          </Row>

          <Row
            label="Main goal"
            value={goal?.name}
            onEdit={() => onEdit('goal')}
          >
            {values.learningGoalOther.trim() !== '' ? (
              <p className="mt-1 text-sm text-ink-700">{values.learningGoalOther.trim()}</p>
            ) : null}
          </Row>

          <Row
            label="Teaching mode"
            value={values.learningMode === 'In-person' ? 'In person' : values.learningMode}
            onEdit={() => onEdit('mode')}
          />

          <Row
            label="Location"
            value={values.preferredLocation.trim() || undefined}
            onEdit={() => onEdit('location')}
            note={
              !values.preferredLocation.trim() && needsLocation(values.learningMode)
                ? 'Required for in-person lessons.'
                : undefined
            }
          />

          <Row label="Availability" onEdit={() => onEdit('availability')}>
            <p className="text-sm text-ink-900">
              {values.preferredDayNames.length > 0 ? joinList(values.preferredDayNames) : 'Any day'}
            </p>
            {completeRanges.length > 0 ? (
              <p className="mt-1 text-sm text-ink-900">
                {completeRanges.map(formatTimeRange).join(' · ')}
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink-600">Any time</p>
            )}
            <p className="mt-1 text-xs text-ink-500">
              All times are in {values.timezone || 'no timezone chosen'}.
            </p>
          </Row>

          <Row
            label="Budget"
            onEdit={() => onEdit('budget')}
            value={
              amount === null ? undefined : formatMoney(amount, currency ?? fallbackCurrency)
            }
            note={
              amount === null
                ? undefined
                : `An amount of ${amount} in ${values.budgetCurrency}. We do not convert currencies.`
            }
          />

          <Row label="About the learner" value={values.helpDescription.trim()} onEdit={() => onEdit('details')} />

          <Row
            label="Anything else"
            value={values.additionalInfo.trim() || undefined}
            onEdit={() => onEdit('details')}
            optional
          />

          <Row label="Contact" onEdit={() => onEdit('contact')}>
            <p className="text-sm font-medium text-ink-900">{values.fullName.trim()}</p>
            <p className="text-sm text-ink-700">{values.phone.trim()}</p>
            {values.email.trim() !== '' ? (
              <p className="text-sm text-ink-700">{values.email.trim()}</p>
            ) : null}
            {values.telegram.trim() !== '' ? (
              <p className="text-sm text-ink-700">{values.telegram.trim()}</p>
            ) : null}
          </Row>
        </dl>
      </section>

      <p className="text-xs text-ink-500">
        Not ready? You can also{' '}
        <Link to="/tutors" className="font-medium text-brand-700 underline hover:no-underline">
          browse tutors
        </Link>{' '}
        and send a request from a tutor's profile instead.
      </p>
    </div>
  )
}

interface RowProps {
  label: string
  value?: string
  onEdit: () => void
  /** Shows the row even when there is no answer, marked as not provided. */
  optional?: boolean
  note?: string
  children?: React.ReactNode
}

function Row({ label, value, onEdit, optional = false, note, children }: RowProps) {
  return (
    <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:gap-6 sm:px-6">
      <div className="flex items-baseline justify-between gap-3 sm:w-48 sm:shrink-0 sm:justify-start">
        <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</dt>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${label.toLowerCase()}`}
          className="shrink-0 text-xs font-medium text-brand-700 underline hover:no-underline sm:ml-auto"
        >
          Edit
          {/*
            The row's name goes in `aria-label` rather than in a visually hidden
            span. A hidden span's text is concatenated with the visible text
            without a separator, so a screen reader announces "Editsubjects" —
            the accessible name has to be written as one string.
          */}
          <span className="sr-only">{label.toLowerCase()}</span>
        </button>
      </div>
      <dd className="min-w-0 flex-1 text-sm text-ink-900">
        {/*
          The answer first, then whatever extra context the row has. Both, not
          either: a row that showed "Lessons are scheduled in EAT" without saying
          where the client is would be a detail with nothing to attach to.
        */}
        {value && value.trim() !== '' ? (
          value
        ) : (
          <span className="text-ink-400">
            {optional ? 'Not answered' : 'Please go back and complete this'}
          </span>
        )}
        {children}
        {note ? <p className="mt-1 text-xs text-ink-500">{note}</p> : null}
      </dd>
    </div>
  )
}