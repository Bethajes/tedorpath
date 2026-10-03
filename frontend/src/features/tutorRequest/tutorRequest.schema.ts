import { z } from 'zod'

import { EMAIL_PATTERN, PHONE_PATTERN, TELEGRAM_PATTERN } from '@/lib/validators'

import type { OnboardingConfig } from './tutorRequest.config'
import type { TimeRange, WizardFormValues } from './tutorRequest.steps'
import { TEACHING_MODES, needsLocation } from './tutorRequest.steps'

/**
 * Validation and the request payload for the adaptive tutor-request wizard.
 *
 * TWO THINGS WORTH KNOWING
 *
 * 1. The schema is built from the configuration, not written once. "The location
 *    is required" depends on the teaching mode the client chose; "a subject and
 *    its free text must agree" depends on which subject is the escape hatch in
 *    the catalogue. Those rules are real and they belong in one schema, so the
 *    schema is a factory that closes over the configuration. Every field-level
 *    message still lives here rather than in a component.
 *
 * 2. The payload is built field by field, not by spreading the form. The API's
 *    schema is strict, so an empty optional field must be absent rather than
 *    present-and-blank. It also means the browser never decides what the
 *    `subject` and `educationLevel` columns say — it sends identifiers and the
 *    server resolves the labels, which is what keeps the database-driven
 *    catalogue authoritative.
 *
 * The one thing the browser does decide is the budget, and only as two separate
 * values. Nothing here converts between currencies or timezones.
 */

/** The catalogue's escape hatch, identified by its slug rather than its name. */
const OTHER_SUBJECT_SLUG = 'other'

/** The learning goal code that opens the "tell us in your own words" field. */
const OTHER_GOAL_CODE = 'other'

/** Guards against a request listing every subject in the catalogue. */
const MAX_SUBJECTS = 20

/** Optional free text: trimmed and length-capped. Blank stays blank. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `Please keep ${label} under ${max} characters.`)

/**
 * Is this a usable IANA timezone?
 *
 * Checked against the runtime's own database rather than against the list of
 * countries the platform serves: someone studying in Ethiopia may well be
 * sitting in Dublin, and a timezone the form refuses is a timezone a tutor
 * cannot schedule against.
 */
export function isValidTimeZone(value: string): boolean {
  if (value.trim() === '') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

/**
 * A `HH:MM` time, as the native time input produces it.
 *
 * Accepted as a string rather than parsed so the value can round-trip through
 * the form untouched; comparison is done on the numbers below.
 */
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Minutes since midnight, for comparing two windows. */
function minutesOfDay(value: string): number | null {
  const match = TIME_PATTERN.exec(value)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

/** True when a window is completely filled in and does not end before it starts. */
export function isCompleteTimeRange(range: TimeRange): boolean {
  const start = minutesOfDay(range.start)
  const end = minutesOfDay(range.end)
  return start !== null && end !== null && end > start
}

/** Renders a window the way the request and the admin screens read it. */
export function formatTimeRange(range: TimeRange): string {
  return `${range.start}–${range.end}`
}

/**
 * A budget amount as typed.
 *
 * Validated as a number only when non-empty, because the field is optional and
 * "not sure yet" is a legitimate answer. Comma grouping is accepted because
 * people paste budgets in that shape; everything else is rejected rather than
 * coerced, so a mistyped amount is never silently reinterpreted as a different
 * one.
 */
const budgetAmountField = z
  .string()
  .trim()
  .max(20, 'That budget looks too long. Please enter just the amount.')
  .refine(
    (value) => value === '' || /^\d{1,10}(?:[.,]\d{1,2})?$/.test(value),
    'Enter an amount as a number, for example 450 or 450.50.',
  )
  .refine(
    (value) => value === '' || Number(value.replace(',', '.')) > 0,
    'Enter an amount greater than zero, or leave it empty.',
  )

/**
 * Build the wizard's schema for a given configuration.
 *
 * Called once per visit, after the configuration has loaded, so the rules below
 * are derived from what the platform actually offers.
 */
export function buildWizardSchema(config: OnboardingConfig) {
  const otherSubjectId = config.subjects.find((s) => s.slug === OTHER_SUBJECT_SLUG)?.id
  const countryCodes = new Set(config.countries.map((country) => country.code))
  const levelCodes = new Set(
    config.educationSystems.flatMap((system) => system.levels.map((level) => level.code)),
  )
  const subjectIds = new Set(config.subjects.map((subject) => subject.id))
  const goalCodes = new Set(config.learningGoals.map((goal) => goal.code))
  const currencyCodes = new Set(config.currencies.map((currency) => currency.code))

  return z
    .object({
      countryCode: z
        .string()
        .min(1, 'Please choose the country you are based in.')
        .refine(
          (value) => countryCodes.has(value),
          'That country is no longer available. Please choose another.',
        ),

      educationLevelCode: z
        .string()
        .min(1, 'Please choose your education level.')
        .refine(
          (value) => levelCodes.has(value),
          'That education level is no longer available. Please choose another.',
        ),

      subjectIds: z
        .array(z.string())
        .max(MAX_SUBJECTS, `Please choose at most ${MAX_SUBJECTS} subjects.`)
        .min(1, 'Please choose at least one subject.')
        .refine(
          (values) => values.every((id) => subjectIds.has(id)),
          'One of the chosen subjects is no longer available. Please choose again.',
        ),

      subjectOther: optionalText(200, 'the subject description'),

      learningGoal: z
        .string()
        .min(1, 'Please choose what you are hoping to achieve.')
        .refine(
          (value) => goalCodes.has(value),
          'That goal is no longer available. Please choose another.',
        ),

      learningGoalOther: optionalText(200, 'your goal'),

      learningMode: z
        .enum(TEACHING_MODES, { message: 'Please choose how you would like to learn.' })
        .or(z.literal(''))
        .refine((value) => value !== '', 'Please choose how you would like to learn.'),

      preferredLocation: optionalText(120, 'the location'),

      preferredDayNames: z.array(z.string()).max(7, 'Please pick at most seven days.'),

      preferredTimeRanges: z
        .array(
          z.object({
            id: z.string(),
            start: z.string(),
            end: z.string(),
          }),
        )
        .max(10, 'Please add at most ten time ranges.')
        .refine(
          (ranges) => ranges.filter((range) => range.start !== '' || range.end !== '').every(isCompleteTimeRange),
          'Each time range needs a start and an end, and the end must be later than the start.',
        ),

      timezone: z
        .string()
        .trim()
        .min(1, 'Please choose the timezone you are in.')
        .max(64, 'That timezone looks too long.')
        .refine(
          (value) => isValidTimeZone(value),
          'Please use a timezone such as Africa/Addis_Ababa.',
        ),

      budgetAmount: budgetAmountField,

      // Not required on its own: the budget is optional, so the pair rule below
      // is what insists on a currency when an amount is present.
      budgetCurrency: z
        .string()
        .trim()
        .refine(
          (value) => value === '' || currencyCodes.has(value),
          'That currency is not available. Please choose another.',
        ),

      helpDescription: z
        .string()
        .trim()
        .min(10, 'Please tell us a little more — at least 10 characters.')
        .max(1000, 'Please keep your description under 1000 characters.'),

      additionalInfo: optionalText(500, 'additional information'),

      fullName: z
        .string()
        .trim()
        .min(2, 'Please enter your full name (at least 2 characters).')
        .max(80, 'Please keep your name under 80 characters.'),

      phone: z
        .string()
        .trim()
        .min(7, 'Please enter a phone number we can reach you on.')
        .max(20, 'Please keep your phone number under 20 characters.')
        .regex(PHONE_PATTERN, 'Use digits, spaces and the symbols + - ( ) only.'),

      telegram: optionalText(64, 'your Telegram username').refine(
        (value) => value === '' || TELEGRAM_PATTERN.test(value),
        'Enter a Telegram username like @yourname (up to 32 letters, numbers and _).',
      ),

      email: optionalText(255, 'your email').refine(
        (value) => value === '' || EMAIL_PATTERN.test(value),
        'Please enter a valid email address, or leave this field empty.',
      ),

      // Carried from a tutor's profile, never chosen here. The empty string is
      // the single representation of "no tutor chosen" inside the form, and the
      // payload builder drops the key entirely rather than sending it blank.
      tutorProfileId: z
        .string()
        .uuid('Tutor profile must be a valid ID.')
        .or(z.literal('')),
    })
    /**
     * The rules that involve more than one field, and the ones that depend on
     * the configuration rather than on the shape of one input.
     *
     * Each issue names its own path so the step that owns the field can show the
     * message next to the input, and the review screen can link to it.
     */
    .superRefine((values, ctx) => {
      const issue = (path: keyof WizardFormValues, message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message })

      // "Other" is a real subject in the catalogue, so ticking it has to say
      // what the actual subject is — otherwise the request reaches the team as
      // the single word "Other", which is the one thing that tells them nothing.
      if (otherSubjectId && values.subjectIds.includes(otherSubjectId) && !values.subjectOther) {
        issue('subjectOther', 'Please tell us which subject you mean.')
      }

      if (values.learningGoal === OTHER_GOAL_CODE && !values.learningGoalOther) {
        issue('learningGoalOther', 'Please tell us what you are hoping to achieve.')
      }

      // A location is required exactly when a tutor could turn up in a room.
      if (needsLocation(values.learningMode) && !values.preferredLocation) {
        issue('preferredLocation', 'Please tell us the city or area you would like lessons in.')
      }

      // The one rule in the whole product that is about money: an amount is
      // meaningless without the currency it is in, so the pair is required
      // together. The form never converts between them, and this is why it does
      // not have to.
      if (values.budgetAmount !== '' && !values.budgetCurrency) {
        issue('budgetCurrency', 'Please choose the currency this budget is in.')
      }
    })
}

/**
 * The body sent to `POST /api/tutor-requests`.
 *
 * Every key is optional except the ones the API has always required, because the
 * wizard collects them across eleven steps and the payload is assembled at the
 * end. Keys are omitted when empty rather than sent blank: the API schema is
 * strict, and "not answered" and "answered with nothing" are different things.
 */
export interface WizardRequestPayload {
  fullName: string
  phone: string
  learningMode: string
  helpDescription: string

  telegram?: string
  email?: string

  subjectIds?: string[]
  subjectOther?: string

  educationLevelCode?: string
  countryCode?: string
  timezone?: string

  learningGoal?: string
  learningGoalOther?: string

  preferredLocation?: string
  preferredDayNames?: string[]
  preferredTimeRanges?: string[]

  budgetAmount?: number
  budgetCurrency?: string

  additionalInfo?: string
  tutorProfileId?: string
}

/**
 * Turn the form's values into the request body.
 *
 * Blank strings are dropped, not normalised: an empty optional field is an
 * absent answer, and the service layer stores null for it either way, but
 * sending `""` would make the two indistinguishable in the API's own logs.
 */
export function toRequestPayload(values: WizardFormValues): WizardRequestPayload {
  const payload: WizardRequestPayload = {
    fullName: values.fullName,
    phone: values.phone,
    learningMode: values.learningMode,
    helpDescription: values.helpDescription,
  }

  const telegram = values.telegram.trim()
  if (telegram !== '') payload.telegram = telegram

  const email = values.email.trim()
  if (email !== '') payload.email = email

  const educationLevelCode = values.educationLevelCode.trim()
  if (educationLevelCode !== '') payload.educationLevelCode = educationLevelCode

  const countryCode = values.countryCode.trim()
  if (countryCode !== '') payload.countryCode = countryCode

  const timezone = values.timezone.trim()
  if (timezone !== '') payload.timezone = timezone

  const learningGoal = values.learningGoal.trim()
  if (learningGoal !== '') payload.learningGoal = learningGoal

  const learningGoalOther = values.learningGoalOther.trim()
  if (learningGoalOther !== '') payload.learningGoalOther = learningGoalOther

  const preferredLocation = values.preferredLocation.trim()
  if (preferredLocation !== '') payload.preferredLocation = preferredLocation

  const subjectOther = values.subjectOther.trim()
  if (subjectOther !== '') payload.subjectOther = subjectOther

  const additionalInfo = values.additionalInfo.trim()
  if (additionalInfo !== '') payload.additionalInfo = additionalInfo

  // Absent rather than an empty string: "no tutor chosen" has one
  // representation, and the API accepts the key being missing.
  const tutorProfileId = values.tutorProfileId.trim()
  if (tutorProfileId !== '') payload.tutorProfileId = tutorProfileId

  if (values.subjectIds.length > 0) payload.subjectIds = values.subjectIds

  if (values.preferredDayNames.length > 0) {
    payload.preferredDayNames = values.preferredDayNames
  }

  // Only windows that are completely filled in are sent; a half-typed row is a
  // draft, not an answer. The schema has already refused to advance past one.
  const ranges = values.preferredTimeRanges.filter(isCompleteTimeRange)
  if (ranges.length > 0) {
    payload.preferredTimeRanges = ranges.map(formatTimeRange)
  }

  // The budget goes over as two separate values. This is the whole point: the
  // number and its unit travel together, and nothing in the browser or the API
  // ever decides the unit on its own.
  if (values.budgetAmount.trim() !== '' && values.budgetCurrency !== '') {
    payload.budgetAmount = Number(values.budgetAmount.replace(',', '.'))
    payload.budgetCurrency = values.budgetCurrency
  }

  return payload
}