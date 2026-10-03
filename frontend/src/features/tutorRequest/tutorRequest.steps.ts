/**
 * The wizard's steps.
 *
 * One list, used for the progress indicator, the Back/Next gating, the review
 * summary and the "jump to the step that needs attention" links after a failed
 * submit. Keeping it as data rather than as eleven branches inside the component
 * is what lets the stepper, the validation and the summary agree with each other
 * without any of them knowing the others exist.
 */

import { LEARNING_MODES } from '@/types/tutorRequest'

/**
 * Delivery methods.
 *
 * Re-exported from the shared legacy enum rather than redeclared, because the
 * stored `learningMode` column and the admin's filters group on these exact
 * strings and a second definition is a second thing to forget to update.
 */
export const TEACHING_MODES = LEARNING_MODES

export type TeachingMode = (typeof TEACHING_MODES)[number]

/** The three teaching modes, with the copy that explains each one. */
export const TEACHING_MODE_OPTIONS: ReadonlyArray<{
  value: TeachingMode
  label: string
  description: string
}> = [
  {
    value: 'Online',
    label: 'Online',
    description: 'Live video lessons, wherever you are.',
  },
  {
    value: 'In-person',
    label: 'In person',
    description: 'Face-to-face lessons at an agreed location.',
  },
  {
    value: 'Either',
    label: 'Either is fine',
    description: 'We are open to online lessons and in-person ones.',
  },
]

/**
 * A mode that can involve meeting a tutor.
 *
 * Used to decide whether the location step is required: someone who will only
 * meet a tutor face to face has to say where, while someone learning entirely
 * online does not.
 */
export function needsLocation(mode: string): boolean {
  return mode === 'In-person' || mode === 'Either'
}

/**
 * The days of the week, in the order a week is taught.
 *
 * Values are the display names the request stores, so a stored request reads as
 * plain English without the admin having to know a code. Not configurable: a
 * week is the same seven days everywhere the platform operates, and making them
 * a database table would buy nothing.
 */
export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number]

/** One availability window, in the client's own timezone. */
export interface TimeRange {
  /** Stable key for React and for removal; not sent to the API. */
  id: string
  /** `HH:MM`, 24-hour, as `<input type="time">` gives it. */
  start: string
  end: string
}

let timeRangeCounter = 0

/**
 * A blank availability window.
 *
 * The id is only ever used to key the row in the list and to identify which row
 * the Remove button belongs to, so a counter is enough — and it makes the value
 * reproducible, which matters for tests.
 */
export function createTimeRange(start = '', end = ''): TimeRange {
  timeRangeCounter += 1
  return { id: `range-${timeRangeCounter}`, start, end }
}

/** The step identifiers, in order. */
export type WizardStepId =
  | 'country'
  | 'education'
  | 'subjects'
  | 'goal'
  | 'mode'
  | 'location'
  | 'availability'
  | 'budget'
  | 'details'
  | 'contact'
  | 'review'

export interface WizardStep {
  id: WizardStepId
  /** Short label for the progress indicator. */
  label: string
  /** The question the step asks, as its heading. */
  heading: string
  /** One line of explanation under the heading. */
  description: string
  /**
   * The fields this step owns.
   *
   * `Next` validates exactly these, so a person is never blocked by a field
   * they cannot see yet — and the review step's "Edit" links can send them back
   * to the one step that owns what went wrong.
   */
  fields: readonly (keyof WizardFormValues)[]
}

/**
 * The eleven steps of the wizard.
 *
 * The flow the product specified is ten, from country through review, and it is
 * followed exactly — with one addition. A tutor request has to reach someone:
 * the API has always required a name and a phone number, and there is nowhere
 * sensible to collect them inside the ten specified steps. So "Your details" sits
 * between the additional-requirements step and the review, and the review shows
 * the contact details alongside everything else.
 */
export const WIZARD_STEPS: readonly WizardStep[] = [
  {
    id: 'country',
    label: 'Country',
    heading: 'Where are you based?',
    description:
      'Your country sets the currency your budget is shown in, the timezone lessons are scheduled in, and the education levels you can choose from. You can change it later.',
    fields: ['countryCode'],
  },
  {
    id: 'education',
    label: 'Education level',
    heading: 'What level are you studying at?',
    description: 'We use this to suggest the subjects that are most useful right now.',
    fields: ['educationLevelCode'],
  },
  {
    id: 'subjects',
    label: 'Subjects',
    heading: 'Which subjects do you need help with?',
    description: 'Choose as many as you like — most requests involve more than one.',
    fields: ['subjectIds', 'subjectOther'],
  },
  {
    id: 'goal',
    label: 'Goal',
    heading: 'What are you hoping to achieve?',
    description:
      'This tells our team who to send you, so an exam next month and a hobby you have just picked up go to different tutors.',
    fields: ['learningGoal', 'learningGoalOther'],
  },
  {
    id: 'mode',
    label: 'Teaching mode',
    heading: 'How would you like to learn?',
    description: 'Every tutor on Tedor Tutors lists what they offer.',
    fields: ['learningMode'],
  },
  {
    id: 'location',
    label: 'Location',
    heading: 'Where would you like to meet?',
    description: 'Only needed if you have chosen in-person lessons.',
    fields: ['preferredLocation'],
  },
  {
    id: 'availability',
    label: 'Availability',
    heading: 'When are you free?',
    description:
      'Pick the days and the times that usually work. We schedule everything in the timezone you choose.',
    fields: ['preferredDayNames', 'preferredTimeRanges', 'timezone'],
  },
  {
    id: 'budget',
    label: 'Budget',
    heading: 'What budget are you working with?',
    description:
      'Optional. An amount without a currency is not a budget, so please tell us both if you have one in mind.',
    fields: ['budgetAmount', 'budgetCurrency'],
  },
  {
    id: 'details',
    label: 'About the learner',
    heading: 'Tell us a little more',
    description:
      'The topic, where you have got stuck and any deadlines help us find the right tutor.',
    fields: ['helpDescription', 'additionalInfo'],
  },
  {
    id: 'contact',
    label: 'Your details',
    heading: 'How can we reach you?',
    description: 'We use these to arrange your first lesson. Nothing here is public.',
    fields: ['fullName', 'phone', 'telegram', 'email'],
  },
  {
    id: 'review',
    label: 'Review',
    heading: 'Check your request',
    description: 'Nothing is sent until you press send.',
    fields: [],
  },
]

/**
 * Which step owns each field.
 *
 * Used when the API names a field it would not accept — a catalogue that changed
 * under an open form — so the client can be taken to the screen where the answer
 * actually is, instead of being told to go and look for it.
 */
export const STEP_FIELD_INDEX = new Map<keyof WizardFormValues, number>(
  WIZARD_STEPS.flatMap((step, index) => step.fields.map((field) => [field, index])),
)

export function stepIndexOf(id: WizardStepId): number {
  return WIZARD_STEPS.findIndex((step) => step.id === id)
}

export const LAST_STEP_INDEX = WIZARD_STEPS.length - 1

/** Form field names. Declared after `WIZARD_STEPS`, which references them. */
export interface WizardFormValues {
  // Step 1 — country
  countryCode: string

  // Step 2 — education level
  educationLevelCode: string

  // Step 3 — subjects
  subjectIds: string[]
  /** The client's own wording, shown when "Other" is one of the subjects. */
  subjectOther: string

  // Step 4 — learning goal
  learningGoal: string
  learningGoalOther: string

  // Step 5 — teaching mode
  learningMode: '' | TeachingMode

  // Step 6 — location
  preferredLocation: string

  // Step 7 — availability
  preferredDayNames: string[]
  preferredTimeRanges: TimeRange[]
  /** IANA identifier, e.g. `Africa/Addis_Ababa`. */
  timezone: string

  // Step 8 — budget
  /** Kept as typed rather than parsed, so the field can hold "500." mid-typing. */
  budgetAmount: string
  /** ISO 4217 code. Defaults to the country's currency; never assumed. */
  budgetCurrency: string

  // Step 9 — about the learner
  helpDescription: string
  additionalInfo: string

  // Step 10 — contact details
  fullName: string
  phone: string
  telegram: string
  email: string

  // Carried from a tutor's profile, never chosen here.
  tutorProfileId: string
}

/**
 * Ethiopia, the wizard's default answer.
 *
 * Preselected rather than left blank because the site is an Ethiopian marketplace
 * and the overwhelming majority of people opening this form are in Ethiopia. An
 * empty country box is a dead first step for them: a required field with nothing in
 * it, in the one place where they are certain of the answer.
 *
 * It is still a real question, not a hidden default. The step names the country that
 * is preselected, the picker opens with it in the box, and the consequence — which
 * currency, and which of a tutor's prices they will be shown — is spelled out
 * underneath before they go any further. Somebody outside Ethiopia sees one clear
 * thing to change.
 *
 * Must match a row in `countries`; the schema revalidates the code against the
 * loaded configuration, so a config without Ethiopia fails visibly rather than
 * silently falling back to an empty answer.
 */
export const DEFAULT_COUNTRY_CODE = 'ET'

export const EMPTY_FORM_VALUES: WizardFormValues = {
  countryCode: DEFAULT_COUNTRY_CODE,
  educationLevelCode: '',
  subjectIds: [],
  subjectOther: '',
  learningGoal: '',
  learningGoalOther: '',
  learningMode: '',
  preferredLocation: '',
  preferredDayNames: [],
  preferredTimeRanges: [],
  timezone: '',
  budgetAmount: '',
  budgetCurrency: '',
  helpDescription: '',
  additionalInfo: '',
  fullName: '',
  phone: '',
  telegram: '',
  email: '',
  tutorProfileId: '',
}