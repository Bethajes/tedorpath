import { z } from 'zod'

import { EMAIL_PATTERN, PHONE_PATTERN, TELEGRAM_PATTERN } from '../../lib/validators.js'
import { isValidTimeZone } from '../../lib/timezones.js'

/**
 * Server-side validation for incoming tutor requests.
 *
 * The browser is never trusted: the public form validates for UX, this schema
 * is what actually protects the database.
 *
 * Field names match the existing frontend contract
 * (see frontend/src/features/tutorRequest/tutorRequest.schema.ts). The service
 * layer maps them onto database columns (`telegram` -> `telegramUsername`,
 * `helpDescription` -> `description`, `preferredLocation` -> `location`).
 *
 * Two eras of contract live here on purpose.
 *
 * The original single-page form sent `subject` and `educationLevel` as free text
 * from a fixed list that lived in both codebases. The wizard sends
 * `subjectIds` and `educationLevelCode` instead, and the option lists now live
 * in the database (see modules/onboarding). So the text fields are validated for
 * shape rather than membership, the identifiers are validated for shape here and
 * for existence in the service layer, and each pair is resolved to the text
 * column server-side. A request that sends only the old fields — a bookmarked
 * tab, an old cached bundle — still validates and still stores, which is what
 * makes this deployable without coordinating clients.
 *
 * The subject list in `modules/subjects` is no longer duplicated here. An
 * operator can add a subject to the catalogue and it appears in the wizard with
 * no code change, which is exactly the point of moving it to the database.
 */

/**
 * The learning modes.
 *
 * Still a closed list, unlike subjects: these are delivery methods, not
 * marketplace content, and the stored `learningMode` column is read by admin
 * filters that group on the exact string. Changing the wording would rewrite
 * the meaning of historical rows.
 */
export const LEARNING_MODES = ['Online', 'In-person', 'Either']

/**
 * Ceilings for the wizard's repeatable fields.
 *
 * Twenty subjects is far more than any real request lists and keeps a
 * pathological payload from turning into a thousand join rows.
 */
const MAX_SUBJECTS = 20
const MAX_TIME_RANGES = 10

/** Optional text: trimmed, length-capped, and normalised to null when blank. */
const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))

/** ISO 3166-1 alpha-2 country code. */
const countryCode = z
  .string()
  .trim()
  .toUpperCase()
  .length(2, 'Country code must be a two-letter ISO 3166-1 code.')

/** ISO 4217 currency code. */
const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .length(3, 'Currency must be a three-letter ISO 4217 code.')

export const tutorRequestSchema = z
  .object({
    fullName: z
      .string({ required_error: 'Full name is required.' })
      .trim()
      .min(2, 'Full name must be at least 2 characters.')
      .max(80, 'Full name must be at most 80 characters.'),

    phone: z
      .string({ required_error: 'Phone number is required.' })
      .trim()
      .min(7, 'Phone number must be at least 7 characters.')
      .max(20, 'Phone number must be at most 20 characters.')
      .regex(PHONE_PATTERN, 'Phone number may only contain digits, spaces and + - ( ).'),

    telegram: optionalText(64)
      .refine(
        (value) => value === null || TELEGRAM_PATTERN.test(value),
        'Telegram username must look like @yourname.',
      )
      .optional(),

    email: optionalText(255)
      .refine(
        (value) => value === null || EMAIL_PATTERN.test(value),
        'Email must be a valid email address.',
      )
      .optional(),

    /**
     * The subject as text, for the original form and for the service layer's
     * single readable summary column. Shape-checked only: the catalogue is
     * database-driven, so membership cannot be checked against a constant here.
     */
    subject: optionalText(100).optional(),

    /**
     * Subjects chosen in the wizard. Existence is a service-layer check because
     * it needs the database, but a well-formed id is checked here so a typo is a
     * validation failure rather than a 500.
     */
    subjectIds: z
      .array(z.string().uuid('Each subject must be a valid ID.'))
      .max(MAX_SUBJECTS, `Choose at most ${MAX_SUBJECTS} subjects.`)
      .optional(),

    /** Free text for the "Other" subject the client ticked. */
    subjectOther: optionalText(200).optional(),

    /** The education level as text. Shape-checked; see `subject`. */
    educationLevel: optionalText(80).optional(),

    /** The education system's level code, e.g. `eth-grade-9-10`. */
    educationLevelCode: z
      .string()
      .trim()
      .max(40, 'Education level code is too long.')
      .optional(),

    countryCode: countryCode.optional(),

    /**
     * IANA timezone the availability is expressed in.
     *
     * Validated against the runtime's timezone database rather than against a
     * stored list, so a timezone the platform does not suggest but the visitor
     * genuinely lives in is still accepted. It is stored, never converted.
     */
    timezone: optionalText(64)
      .refine(
        (value) => value === null || isValidTimeZone(value),
        'Timezone must be an IANA identifier such as Africa/Addis_Ababa.',
      )
      .optional(),

    learningGoal: optionalText(60).optional(),
    learningGoalOther: optionalText(200).optional(),

    learningMode: z
      .string({ required_error: 'Learning mode is required.' })
      .trim()
      .min(1, 'Learning mode is required.')
      .refine((value) => LEARNING_MODES.includes(value), 'Learning mode is not a supported option.'),

    helpDescription: z
      .string({ required_error: 'Description is required.' })
      .trim()
      .min(10, 'Description must be at least 10 characters.')
      .max(1000, 'Description must be at most 1000 characters.'),

    preferredLocation: optionalText(120).optional(),
    preferredDays: optionalText(120).optional(),
    preferredTime: optionalText(120).optional(),

    /**
     * Availability as sets: the days ticked, and the windows the client chose
     * in their own timezone.
     *
     * Sent by the wizard; the service composes the legacy `preferredDays` and
     * `preferredTime` sentences from them so the admin screens keep reading what
     * they always did. A request that sends only the sentences still works.
     */
    preferredDayNames: z
      .array(z.string().trim().min(1).max(20))
      .max(7, 'Pick at most seven days.')
      .optional(),

    preferredTimeRanges: z
      .array(z.string().trim().min(1).max(40))
      .max(MAX_TIME_RANGES, `Choose at most ${MAX_TIME_RANGES} time ranges.`)
      .optional(),

    /**
     * Budget as a number plus a currency code, and never one without the other.
     *
     * An amount with no currency beside it is precisely the failure this split
     * prevents: 500 is not a budget, it is a number whose unit is a guess. The
     * refinement below refuses to let that reach the database, and nothing
     * anywhere in the codebase converts between currencies.
     */
    budgetAmount: z
      .number({ error: 'Budget amount must be a number.' })
      .positive('Budget amount must be greater than zero.')
      .max(1_000_000_000, 'Budget amount is too large.')
      .multipleOf(0.01, 'Budget amount can have at most two decimal places.')
      .optional(),

    budgetCurrency: currencyCode.optional(),

    /** Legacy free-text budget. Still accepted, and stored verbatim. */
    budget: optionalText(80).optional(),

    additionalInfo: optionalText(500).optional(),

    /**
     * Optional link to the TutorProfile the client picked in the directory.
     *
     * Nullable and optional, and deliberately validated for shape only: whether
     * the profile exists is a service-layer check, because that needs the
     * database. Omitting the field entirely must keep working exactly as it did
     * before this column existed (Requirement 3.2), so there is no default and
     * no coercion here — the form simply does not send it.
     */
    tutorProfileId: z
      .string()
      .uuid('Tutor profile must be a valid ID.')
      .nullable()
      .optional(),
  })
  /**
   * A request has to say what it is about, but the wizard and the original form
   * say it in different ways. Rather than making one field optional and one
   * required — which would let a request through with neither — the pair is
   * checked here. The error is reported against `subjectIds` because that is
   * what the current form sends and therefore what the form will highlight.
   */
  .refine((value) => value.subject || (value.subjectIds?.length ?? 0) > 0, {
    message: 'At least one subject is required.',
    path: ['subjectIds'],
  })
  .refine((value) => value.educationLevel || value.educationLevelCode, {
    message: 'An education level is required.',
    path: ['educationLevelCode'],
  })
  .refine((value) => value.budgetAmount === undefined || value.budgetCurrency !== undefined, {
    message: 'A budget amount must be given together with its currency.',
    path: ['budgetCurrency'],
  })
  // Reject unexpected keys rather than silently discarding them.
  .strict()

/**
 * Parse and normalise a request body.
 *
 * @returns {{ ok: true, data: object } | { ok: false, fields: Array<{field: string, message: string}> }}
 */
export function validateTutorRequest(body) {
  const result = tutorRequestSchema.safeParse(body)

  if (result.success) {
    return { ok: true, data: result.data }
  }

  return {
    ok: false,
    fields: result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '_',
      message: issue.message,
    })),
  }
}
