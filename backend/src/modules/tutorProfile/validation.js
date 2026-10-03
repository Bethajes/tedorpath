import { z } from 'zod'

import { UPLOAD_URL_PREFIX } from '../uploads/storage.js'

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

// Helper for optional text fields: trimmed, max length, transforms empty to null.
//
// `null` is accepted as an *input* as well as produced as an *output*. The
// transform normalises '' to null, so any client that reads a field back and
// sends it again unchanged would otherwise post `null` — which the untransformed
// string schema would reject. The wizard does exactly that: it loads the draft,
// keeps the profile in form state, and resubmits the whole object, so every
// blank optional field arrives here as null. Accepting null keeps that
// round-trip valid while still storing null in the database.
const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === '' ? null : value))

// Helper for required text fields
const requiredText = (fieldName, max) =>
  z
    .string({ required_error: `${fieldName} is required.` })
    .trim()
    .min(1, `${fieldName} is required.`)
    .max(max, `${fieldName} must be at most ${max} characters.`)

// Helper for a per-market hourly rate.
//
// Strictly positive: a rate of zero is not a price, and a tutor who wants to
// offer a free first lesson leaves that market unpriced instead — which the
// directory reports honestly rather than advertising free lessons. The ceiling is
// shared by every market so two numbers on the same screen stay comparable.
const rateField = () =>
  z
    .number()
    .positive('An hourly rate must be greater than zero.')
    .max(9999.99, 'An hourly rate cannot exceed 9999.99.')
    .nullable()
    .optional()

/**
 * A market code on the rates map.
 *
 * Normalised to upper case so `etb` and `ETB` are one market rather than two, and
 * deliberately not constrained to the codes that exist today: whether a code names
 * a market the platform sells in is a question about the `markets` table, so it is
 * answered by the service against that table and reported as a normal field error.
 */
const rateMarketCode = () =>
  z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'A market code is required.')
    .max(8, 'That market code is not valid.')

/**
 * The rates, keyed by market code.
 *
 * A map rather than a named field per market, so adding a market does not change
 * this contract. The market codes themselves are checked against the `markets`
 * table in the service, because they are data.
 */
const ratesField = () => z.record(rateMarketCode(), rateField()).optional()

/**
 * The pre-markets shape, still accepted.
 *
 * `hourlyRateEtb` / `hourlyRateUsd` were how a rate was expressed before
 * markets were data. Accepting them keeps a bundle already in a tutor's browser
 * cache working; they are folded into `rates` by the service, which is the only
 * place the two representations meet.
 */

/**
 * A profile photo is either an externally hosted http(s) URL or one of our own
 * uploads.
 *
 * The `javascript:` family is the reason this is a whitelist rather than a
 * "not obviously bad" check: the value is rendered into an `img src` on public
 * tutor pages, and a stored `javascript:` URL would be a stored-XSS vector.
 * A relative `/api/uploads/...` path is accepted so the upload endpoint can
 * record a photo without knowing the public origin.
 */
const profilePhotoUrlField = () =>
  optionalText(2048).refine(
    (value) =>
      value === undefined ||
      value === null ||
      value.startsWith('http://') ||
      value.startsWith('https://') ||
      value.startsWith(`${UPLOAD_URL_PREFIX}/`),
    'Profile photo URL must be a valid URL.',
  )

/**
 * Schema for creating a new tutor profile.
 *
 * Only displayName, headline, and bio are required at creation time — the
 * wizard collects the remaining fields across later steps and saves them via
 * PATCH. teachingMode defaults to ONLINE so the NOT NULL DB column is always
 * satisfied; the actual value is collected in step 4 and overwritten.
 * Completeness is enforced at submit time by validateProfileCompleteness.
 */
export const createTutorProfileSchema = z
  .object({
    displayName: requiredText('Display name', 100),
    headline: requiredText('Headline', 160),
    bio: requiredText('Bio', 2000),
    location: optionalText(120),
    profilePhotoUrl: profilePhotoUrlField(),
    teachingMode: z.enum(['ONLINE', 'IN_PERSON', 'BOTH']).optional(),
    studentLevels: z.array(z.enum(EDUCATION_LEVELS)).optional(),
    languages: z.array(z.string().trim().max(50)).optional(),
    availability: optionalText(300),
    rates: ratesField(),
    hourlyRateEtb: rateField(),
    hourlyRateUsd: rateField(),
    experience: optionalText(2000),
    education: optionalText(2000),
    subjectIds: z.array(z.string().uuid()).optional(),
  })
  .strict()

/**
 * Schema for partially updating a tutor profile.
 * All fields are optional for PATCH.
 *
 * `userId` is accepted but never trusted: it is the identifier a client would
 * tamper with to reach somebody else's profile, so the service compares it to
 * the session user and rejects a mismatch with 403 (Requirement 6.4). Keeping
 * it out of the schema entirely would only turn the attack into a confusing
 * 422 "unrecognized key" instead of a clear authorization failure.
 */
export const updateTutorProfileSchema = z
  .object({
    userId: z.string().uuid('User ID must be a UUID.').optional(),
    displayName: z.string().trim().min(1, 'Display name cannot be empty.').max(100).optional(),
    headline: z.string().trim().min(1, 'Headline cannot be empty.').max(160).optional(),
    bio: z.string().trim().min(1, 'Bio cannot be empty.').max(2000).optional(),
    location: optionalText(120),
    profilePhotoUrl: profilePhotoUrlField(),
    teachingMode: z.enum(['ONLINE', 'IN_PERSON', 'BOTH']).optional(),
    studentLevels: z.array(z.enum(EDUCATION_LEVELS)).optional(),
    languages: z.array(z.string().trim().max(50)).optional(),
    availability: optionalText(300),
    rates: ratesField(),
    hourlyRateEtb: rateField(),
    hourlyRateUsd: rateField(),
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
  /*
   * BOTH markets priced, not one.
   *
   * This used to require a price in at least one market, on the reasoning that a
   * tutor who only takes local bookings is a valid profile. That is now a
   * requirement on registration instead, and deliberately so:
   *
   *   - Ethiopia is the platform's default market, so an unpriced ETB rate is a
   *     tutor whose primary listing has no price on it at all.
   *   - A parent in the United States is served the international rate. A tutor who
   *     has not stated one is invisible to them — not shown at an assumed price,
   *     simply absent, which is a worse outcome than being asked the question at
   *     signup.
   *
   * The two rates stay independent: neither is derived from the other and there is
   * no exchange rate in this product, so both are values the tutor typed.
   *
   * Enumerated over the rate map rather than naming two markets, so a market added
   * to the registry later does not quietly become optional.
   */
  const rates = profile.rates ?? {}
  const missingMarkets = Object.keys(rates).filter((code) => rates[code] == null)

  if (missingMarkets.length === Object.keys(rates).length) {
    // Nothing priced at all. Reported as `rates`, which is the field the tutor
    // actually filled in — listing every market would read as four separate
    // mistakes when the answer is "none of them".
    missingFields.push('rates')
  } else {
    for (const code of missingMarkets) {
      missingFields.push(`rates.${code}`)
    }
  }
  
  // At least one subject required
  if (!profile.subjects || profile.subjects.length === 0) missingFields.push('subjects')
  
  // At least one student level required
  if (!profile.studentLevels || profile.studentLevels.length === 0) missingFields.push('studentLevels')

  return missingFields
}