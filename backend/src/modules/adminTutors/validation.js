import { z } from 'zod'

/**
 * Validation for the admin tutor moderation API.
 *
 * The admin may move a profile between moderation states and set the
 * verification flag; it may never edit the content the tutor wrote. Keeping
 * the writable set this narrow is the whole point of the allow-list.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

/** Every state a profile can be in. Mirrors the Prisma ProfileStatus enum. */
export const PROFILE_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'SUSPENDED',
  'REJECTED',
  'NEEDS_INFORMATION',
]

/**
 * The states an admin may move a profile *to*.
 *
 * Deliberately narrower than PROFILE_STATUSES: a moderation decision is one of
 * these four. DRAFT and PENDING_REVIEW belong to the tutor's own workflow and
 * are never set by an admin, so offering them here would let the admin forge a
 * submission or quietly return an approved tutor to draft.
 *
 * NEEDS_INFORMATION is here because it *is* a moderation decision — asking a
 * tutor for more information rather than rejecting them (Requirement 19.3). It
 * is not a tutor-owned state like PENDING_REVIEW, so unlike those it is safe
 * for an admin to set.
 */
export const MODERATION_STATUSES = ['APPROVED', 'REJECTED', 'SUSPENDED', 'NEEDS_INFORMATION']

/**
 * The reason categories an admin may attach to a REJECTED profile.
 *
 * A category rather than free text, so the rejection can be counted and the
 * applicant sees a consistent explanation. `OTHER` is the escape hatch for
 * anything the list does not cover; the admin's own words go in `adminMessage`.
 */
export const REJECTION_REASONS = [
  'MISSING_DOCUMENT',
  'EDUCATION_NEEDS_CLARIFICATION',
  'PROFILE_INCOMPLETE',
  'QUALIFICATION_NEEDS_VERIFICATION',
  'OTHER',
]

/**
 * Mirrors the Prisma VerificationStatus enum.
 *
 * Wider than the two states this endpoint used to accept: the extended
 * verification workflow (Requirements 26.3, 27.3) needs a way to say
 * "documents requested" and "documents received" without implying the tutor is
 * either unverified or fully verified.
 */
export const VERIFICATION_STATUSES = [
  'UNVERIFIED',
  'DOCUMENTS_REQUESTED',
  'DOCUMENTS_RECEIVED',
  'VERIFIED',
  'NEEDS_MORE_INFORMATION',
]

/**
 * The six external document checks an admin records during verification.
 *
 * Fixed keys, all boolean, all defaulting to false. Fixed rather than free-form
 * so two admins verifying the same tutor record the same six decisions, and so
 * a stale key from an older payload cannot silently be dropped.
 * Requirements: 26.5, 27.5
 */
export const VERIFICATION_CHECKLIST_KEYS = [
  'govIdReceived',
  'identityReviewed',
  'educationDocReceived',
  'educationReviewed',
  'certificateReceived',
  'qualificationReviewed',
]

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

/**
 * Query-string integer. An absent value falls back to `fallback`; anything
 * present must parse as an integer inside the allowed range, otherwise the
 * request is rejected rather than silently clamped.
 */
function queryInt(fallback, { min, max, label }) {
  return z
    .string()
    .optional()
    .transform((value) => (value === undefined || value === '' ? String(fallback) : value))
    .pipe(
      z.coerce
        .number({ error: `${label} must be a number.` })
        .int(`${label} must be a whole number.`)
        .min(min, `${label} must be at least ${min}.`)
        .max(max, `${label} must be at most ${max}.`),
    )
}

export const listQuerySchema = z.object({
  page: queryInt(1, { min: 1, max: 100_000, label: 'page' }),
  limit: queryInt(DEFAULT_LIMIT, { min: 1, max: MAX_LIMIT, label: 'limit' }),
  // 'all' keeps the filter optional in the query string without a sentinel
  // value leaking into the database query.
  status: z.enum(['all', ...PROFILE_STATUSES]).optional().default('all'),
  // Free-text search across the applicant's name and headline. Optional and
  // length-capped; a blank value is normalised to undefined so it never reaches
  // the query as an empty `contains` filter that would match everything or
  // nothing depending on the driver (Requirement 23.4).
  q: z
    .string()
    .trim()
    .max(100, 'Search text must be 100 characters or fewer.')
    .optional()
    .transform((value) => (value === undefined || value === '' ? undefined : value)),
})

/**
 * The moderation payload.
 *
 * `verificationStatus` is optional and defaults to nothing at all — it is NOT
 * given a value here. Requirement 7.5 makes verification an explicit act: an
 * admin who sends only `status: 'APPROVED'` must leave verificationStatus
 * exactly as it was, and the service distinguishes "absent" from "UNVERIFIED"
 * by testing for `undefined`. Defaulting it in the schema would silently
 * unverify every already-verified tutor the first time they were approved.
 *
 * The cross-field rules below are the reason this is a `superRefine` rather than
 * plain field validation: whether a reason is required depends on the status
 * being requested, which no individual field check can see. Each issue carries
 * its own `errorCode` so the controller can answer with a specific error code
 * (REJECTION_REASON_REQUIRED / ADMIN_MESSAGE_REQUIRED) instead of collapsing
 * every problem into one generic message.
 * Requirements: 19.3, 22.1, 22.2, 22.3, 22.4, 22.5
 */
export const updateStatusSchema = z
  .object({
    status: z.enum(MODERATION_STATUSES, {
      error: `Status must be one of: ${MODERATION_STATUSES.join(', ')}.`,
    }),
    verificationStatus: z.enum(VERIFICATION_STATUSES, {
      error: `Verification status must be one of: ${VERIFICATION_STATUSES.join(', ')}.`,
    }).optional(),
    rejectionReason: z
      .enum(REJECTION_REASONS, {
        error: `Rejection reason must be one of: ${REJECTION_REASONS.join(', ')}.`,
      })
      .optional(),
    adminMessage: z
      .string({ error: 'Admin message must be text.' })
      .trim()
      .max(2000, 'Admin message must be 2000 characters or fewer.')
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    // Rejecting without saying why gives the applicant nothing to fix, so a
    // reason is mandatory on REJECTED (Requirement 22.1).
    if (value.status === 'REJECTED' && value.rejectionReason === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['rejectionReason'],
        message: 'A rejection reason is required when rejecting a tutor.',
        params: { errorCode: 'REJECTION_REASON_REQUIRED' },
      })
    }

    // NEEDS_INFORMATION exists only to tell the tutor what is missing, so an
    // empty message defeats the purpose. Blank and whitespace-only are both
    // treated as absent, because a message of spaces tells nobody anything.
    // Requirement 22.2.
    if (value.status === 'NEEDS_INFORMATION' && !value.adminMessage) {
      ctx.addIssue({
        code: 'custom',
        path: ['adminMessage'],
        message: 'An admin message is required when requesting more information.',
        params: { errorCode: 'ADMIN_MESSAGE_REQUIRED' },
      })
    }
  })

/**
 * The verification payload.
 *
 * Every field optional, and none of them `profileStatus` — saving a checklist
 * or a note must never be a way to move a profile between moderation states
 * (Requirement 27.3). That separation is why this is a second endpoint rather
 * than another field on `updateStatusSchema`.
 *
 * The checklist is validated as a partial object of the six known boolean keys
 * and is `.strict()`, so a typo'd or stale key is a 422 rather than a silently
 * dropped value (Requirement 27.5).
 */
export const updateVerificationSchema = z
  .object({
    verificationStatus: z
      .enum(VERIFICATION_STATUSES, {
        error: `Verification status must be one of: ${VERIFICATION_STATUSES.join(', ')}.`,
      })
      .optional(),
    adminNotes: z
      .string({ error: 'Verification notes must be text.' })
      .trim()
      .max(4000, 'Verification notes must be 4000 characters or fewer.')
      .optional(),
    verificationChecklist: z
      .object(
        Object.fromEntries(
          VERIFICATION_CHECKLIST_KEYS.map((key) => [
            key,
            z.boolean({ error: `Verification checklist "${key}" must be true or false.` }),
          ]),
        ),
      )
      .strict()
      .partial()
      .optional(),
    // Accepted as an explicit date when an admin is recording a result for an
    // earlier day. Omit it and the service stamps the current time — see
    // `updateTutorVerification`. A string is accepted so the admin UI can post
    // an <input type="date"> value without a timezone of its own.
    verifiedAt: z
      .iso.datetime({ error: 'Verification date must be an ISO 8601 datetime.' })
      .transform((value) => new Date(value))
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    error: 'Provide at least one field to update.',
  })

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const idParamSchema = z.string().refine((value) => UUID_PATTERN.test(value), {
  message: 'Tutor profile id must be a valid UUID.',
})

export const LIMITS = { DEFAULT_LIMIT, MAX_LIMIT }
