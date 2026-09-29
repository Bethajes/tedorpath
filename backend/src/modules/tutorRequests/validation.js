import { z } from 'zod'

import { EMAIL_PATTERN, PHONE_PATTERN, TELEGRAM_PATTERN } from '../../lib/validators.js'

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
 * NOTE: the option lists below mirror frontend/src/types/tutorRequest.ts. They
 * must be kept in sync when subjects or levels are added.
 */

export const SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'Programming',
  'AI & Technology',
  'University Course',
  'Exam Preparation',
  'Other',
]

export const EDUCATION_LEVELS = [
  'Primary School',
  'High School',
  'University',
  'Adult Learning',
  'Other',
]

export const LEARNING_MODES = ['Online', 'In-person', 'Either']

/** Optional text: trimmed, length-capped, and normalised to null when blank. */
const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))

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

    subject: z
      .string({ required_error: 'Subject is required.' })
      .trim()
      .min(1, 'Subject is required.')
      .refine((value) => SUBJECTS.includes(value), 'Subject is not a supported option.'),

    educationLevel: z
      .string({ required_error: 'Education level is required.' })
      .trim()
      .min(1, 'Education level is required.')
      .refine(
        (value) => EDUCATION_LEVELS.includes(value),
        'Education level is not a supported option.',
      ),

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
