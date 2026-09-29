import { z } from 'zod'

/**
 * Validation for tutor profile management endpoints.
 *
 * This module handles validation for:
 * - Creating a new tutor profile (POST /api/tutor-profile)
 * - Updating an existing profile (PATCH /api/tutor-profile)
 * - Submitting a profile for review (POST /api/tutor-profile/submit)
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */

// Teaching modes from Prisma schema
export const TEACHING_MODES = ['ONLINE', 'IN_PERSON', 'BOTH']

// Education levels from existing constant (must match frontend/backend)
export const EDUCATION_LEVELS = [
  'Primary School',
  'High School',
  'University',
  'Adult Learning',
  'Other',
]

// Helper for optional text fields: trimmed, max length, transforms empty to null
const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .optional()

// Helper for required text fields
const requiredText = (fieldName, max) =>
  z
    .string({ required_error: `${fieldName} is required.` })
    .trim()
    .min(1, `${fieldName} is required.`)
    .max(max, `${fieldName} must be at most ${max} characters.`)

// Helper for decimal field (hourlyRate)
const decimalField = () =>
  z
    .number()
    .min(0, 'Hourly rate cannot be negative.')
    .max(9999.99, 'Hourly rate cannot exceed 9999.99.')
    .nullable()
    .optional()

/**
 * Schema for creating a new tutor profile.
 * All fields except userId are optional for draft creation.
 */
export const createTutorProfileSchema = z
  .object({
    displayName: requiredText('Display name', 100),
    headline: requiredText('Headline', 160),
    bio: requiredText('Bio', 2000),
    location: optionalText(120),
    profilePhotoUrl: optionalText(2048).refine(
      (value) => value === undefined || value === null || value.startsWith('http'),
      'Profile photo URL must be a valid URL.',
    ),
    teachingMode: z.enum(['ONLINE', 'IN_PERSON', 'BOTH'], {
      required_error: 'Teaching mode is required.',
    }),
    studentLevels: z
      .array(z.enum(EDUCATION_LEVELS), { required_error: 'At least one student level is required.' })
      .min(1, 'At least one student level is required.'),
    languages: z.array(z.string().trim().max(50)).min(1, 'At least one language is required.').optional(),
    availability: optionalText(300),
    hourlyRate: decimalField(),
    experience: optionalText(2000),
    education: optionalText(2000),
    subjectIds: z.array(z.string().uuid()).min(1, 'At least one subject is required.').optional(),
  })
  .strict()

/**
 * Schema for partially updating a tutor profile.
 * All fields are optional for PATCH.
 */
export const updateTutorProfileSchema = z
  .object({
    displayName: z.string().trim().min(1, 'Display name cannot be empty.').max(100).optional(),
    headline: z.string().trim().min(1, 'Headline cannot be empty.').max(160).optional(),
    bio: z.string().trim().min(1, 'Bio cannot be empty.').max(2000).optional(),
    location: optionalText(120),
    profilePhotoUrl: optionalText(2048).refine(
      (value) => value === undefined || value === null || value.startsWith('http'),
      'Profile photo URL must be a valid URL.',
    ),
    teachingMode: z.enum(['ONLINE', 'IN_PERSON', 'BOTH']).optional(),
    studentLevels: z.array(z.enum(EDUCATION_LEVELS)).optional(),
    languages: z.array(z.string().trim().max(50)).optional(),
    availability: optionalText(300),
    hourlyRate: decimalField(),
    experience: optionalText(2000),
    education: optionalText(2000),
    subjectIds: z.array(z.string().uuid()).optional(),
  })
  .strict()

/**
 * Parse and normalize a create profile request body.
 *
 * @returns {{ ok: true, data: object } | { ok: false, fields: Array<{field: string, message: string}> }}
 */
export function validateCreateTutorProfile(body) {
  const result = createTutorProfileSchema.safeParse(body)

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

/**
 * Parse and normalize a patch profile request body.
 *
 * @returns {{ ok: true, data: object } | { ok: false, fields: Array<{field: string, message: string}> }}
 */
export function validateUpdateTutorProfile(body) {
  const result = updateTutorProfileSchema.safeParse(body)

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

/**
 * Validate profile completeness for submission.
 * Requirements: 6.6, 6.7
 */
export function validateProfileCompleteness(profile) {
  const missingFields = []

  // Required fields for submission
  if (!profile.displayName) missingFields.push('displayName')
  if (!profile.headline) missingFields.push('headline')
  if (!profile.bio) missingFields.push('bio')
  if (!profile.teachingMode) missingFields.push('teachingMode')
  if (profile.hourlyRate === null || profile.hourlyRate === undefined) missingFields.push('hourlyRate')
  
  // At least one subject required
  if (!profile.subjects || profile.subjects.length === 0) missingFields.push('subjects')
  
  // At least one student level required
  if (!profile.studentLevels || profile.studentLevels.length === 0) missingFields.push('studentLevels')

  return missingFields
}