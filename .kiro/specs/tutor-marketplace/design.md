# Tutor Marketplace — Extended Design Document

## Overview

This document extends the original tutor-marketplace design to cover the complete tutor verification workflow: photo upload bug fix, client-side validation, application reference IDs, post-submission status page, admin tutor review queue and workspace, rejection/needs-information workflows, tutor resubmission, enhanced public directory, and improved public profile pages.

All original design decisions (database models, API contracts, correctness properties 1–12) are preserved. This document adds new decisions layered on top of the existing implementation.

---

## Architecture

The new work follows the same layered architecture already in place:

```
Browser
  │
  ├─── /tutor/application-status        TutorApplicationStatusPage (new)
  ├─── /become-a-tutor                   TutorOnboardingPage (extended — early profile creation)
  ├─── /tutors                           TutorDirectoryPage (enhanced filters + language)
  ├─── /tutors/:id                       TutorProfilePage (enhanced layout)
  │
  └─── API Layer (existing Express app — extended)
         │
         ├─── POST /api/tutor-profile/submit     (extended: accepts REJECTED, NEEDS_INFORMATION)
         ├─── GET  /api/tutor-profile/me         (extended: includes applicationReference)
         │
         ├─── PATCH /api/admin/tutors/:id/status  (extended: NEEDS_INFORMATION, rejectionReason)
         ├─── PATCH /api/admin/tutors/:id/verification  (new: notes + checklist, no status change)
         │
         └─── PostgreSQL via Prisma 7
                └─── Migration: add applicationReference, rejectionReason, adminMessage,
                     adminNotes, verificationChecklist, verifiedAt, NEEDS_INFORMATION status,
                     extended VerificationStatus enum

Admin area
  │
  ├─── /admin/tutors                    AdminTutorsPage (new)
  └─── /admin/tutors/:id                AdminTutorReviewPage (new)
```

---

## Components and Interfaces

### New and modified backend

| Module | Change |
|---|---|
| `backend/prisma/schema.prisma` | Add `NEEDS_INFORMATION` to `ProfileStatus`; extend `VerificationStatus` to 5 values; add fields to `TutorProfile` |
| `backend/src/modules/tutorProfile/service.js` | `submitTutorProfile` accepts REJECTED + NEEDS_INFORMATION; generates `applicationReference` |
| `backend/src/modules/tutorProfile/validation.js` | No changes (completeness rules unchanged) |
| `backend/src/modules/adminTutors/service.js` | Extended `updateTutorProfileStatus`: requires rejectionReason for REJECTED; accepts NEEDS_INFORMATION with adminMessage; new `updateTutorVerification` function |
| `backend/src/modules/adminTutors/validation.js` | Extended: NEEDS_INFORMATION in MODERATION_STATUSES; rejectionReason schema; verification update schema |
| `backend/src/modules/adminTutors/controller.js` | New `patchTutorVerification` handler |
| `backend/src/modules/adminTutors/index.js` | New route: `PATCH /tutors/:id/verification` |

### New frontend

| Component | Path |
|---|---|
| `TutorApplicationStatusPage` | `frontend/src/features/tutorOnboarding/TutorApplicationStatusPage.tsx` |
| `AdminTutorsPage` | `frontend/src/pages/AdminTutorsPage.tsx` |
| `AdminTutorReviewPage` | `frontend/src/pages/AdminTutorReviewPage.tsx` |
| `adminTutors.api.ts` | `frontend/src/features/adminTutors/adminTutors.api.ts` |
| `adminTutors.types.ts` | `frontend/src/features/adminTutors/adminTutors.types.ts` |

### Modified frontend

| Component | Change |
|---|---|
| `TutorOnboardingPage.tsx` | Creates DRAFT on mount (before photo upload is possible) |
| `AdminShell.tsx` | Add "Tutors" link to `ADMIN_LINKS` |
| `adminPages.tsx` | Export `AdminTutorsPage`, `AdminTutorReviewPage` |
| `router.tsx` | Add `/admin/tutors` and `/admin/tutors/:id` routes; add `/tutor/application-status` route |
| `TutorDirectoryPage.tsx` | Add language filter to FilterPanel; update TutorCard to show language |
| `TutorProfilePage.tsx` | Enhanced layout with structured sections and side panel |
| `tutorOnboarding.types.ts` | Add `NEEDS_INFORMATION` to `profileStatus` union |

---

## Data Models

### Schema changes

New fields added to `TutorProfile`:

```prisma
// Human-readable application reference. Generated at first submission.
applicationReference String? @unique @db.VarChar(20)

// Rejection reason category (set by admin on REJECTED status).
rejectionReason      String? @db.VarChar(100)

// Admin message shown to the tutor (set on REJECTED or NEEDS_INFORMATION).
adminMessage         String? @db.VarChar(2000)

// Admin's internal review notes (not shown to tutor).
adminNotes           String? @db.VarChar(4000)

// JSON object recording which checklist items are checked.
// Shape: { govIdReceived, identityReviewed, educationDocReceived,
//          educationReviewed, certificateReceived, qualificationReviewed }
// All boolean, all default false.
verificationChecklist Json?

// When the admin last recorded a verification result.
verifiedAt           DateTime?
```

Updated `ProfileStatus` enum (add `NEEDS_INFORMATION`):

```prisma
enum ProfileStatus {
  DRAFT
  PENDING_REVIEW
  APPROVED
  SUSPENDED
  REJECTED
  NEEDS_INFORMATION
}
```

Updated `VerificationStatus` enum (replace 2-value with 5-value):

```prisma
enum VerificationStatus {
  UNVERIFIED
  DOCUMENTS_REQUESTED
  DOCUMENTS_RECEIVED
  VERIFIED
  NEEDS_MORE_INFORMATION
}
```

All existing rows with `UNVERIFIED` or `VERIFIED` values remain valid — the migration only adds new values. The existing two values are preserved.

### Application Reference generation

Reference format: `TT-YYYY-NNNNNN`

- `YYYY` = four-digit year of submission
- `NNNNNN` = zero-padded six-digit sequential count of all submitted profiles in that year

Implementation: at submission time, count existing non-DRAFT profiles with an `applicationReference` that starts with `TT-<year>-`, then use `count + 1` as the sequence number. Wrapped in a Prisma transaction to prevent duplicates under concurrent submissions.

Retained across resubmissions (REJECTED → PENDING_REVIEW, NEEDS_INFORMATION → PENDING_REVIEW): the field is only written once.

---

## API Changes

### `POST /api/tutor-profile/submit` (extended)

Accepts `profileStatus` in `['DRAFT', 'REJECTED', 'NEEDS_INFORMATION']`. Returns 400 for `PENDING_REVIEW` or `APPROVED`. On success, generates `applicationReference` if not already set, then sets status to `PENDING_REVIEW`.

Response now includes `applicationReference`.

### `PATCH /api/admin/tutors/:id/status` (extended)

New accepted values in the `status` field:

| New status | Extra required field | Description |
|---|---|---|
| `NEEDS_INFORMATION` | `adminMessage` (required) | Admin requests more info without rejecting |
| `REJECTED` | `rejectionReason` (required), `adminMessage` (optional) | Formal rejection with reason |

`rejectionReason` categories (validated enum):
- `MISSING_DOCUMENT`
- `EDUCATION_NEEDS_CLARIFICATION`
- `PROFILE_INCOMPLETE`
- `QUALIFICATION_NEEDS_VERIFICATION`
- `OTHER`

Schema (extended `updateStatusSchema`):
```
{
  status: 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'NEEDS_INFORMATION',
  verificationStatus?: VerificationStatus,
  rejectionReason?: RejectionReasonCategory,  // required when status === 'REJECTED'
  adminMessage?: string (max 2000),           // required when status === 'NEEDS_INFORMATION'
}
```

Validation: if `status === 'REJECTED'` and `rejectionReason` is absent → HTTP 422. If `status === 'NEEDS_INFORMATION'` and `adminMessage` is absent → HTTP 422.

### `PATCH /api/admin/tutors/:id/verification` (new)

Updates verification fields without changing `profileStatus`. Protected by `requireAdmin`.

Body:
```json
{
  "verificationStatus": "DOCUMENTS_RECEIVED",
  "adminNotes": "Government ID received. Education certificate pending.",
  "verificationChecklist": {
    "govIdReceived": true,
    "identityReviewed": false,
    "educationDocReceived": false,
    "educationReviewed": false,
    "certificateReceived": false,
    "qualificationReviewed": false
  }
}
```

All fields optional. Returns the updated profile.

### `GET /api/admin/tutors/:id` (extended response)

Now includes: `applicationReference`, `rejectionReason`, `adminMessage`, `adminNotes`, `verificationChecklist`, `verifiedAt`.

### `GET /api/tutor-profile/me` (extended response)

Now includes: `applicationReference`, `adminMessage` (shown to tutor when REJECTED or NEEDS_INFORMATION), `rejectionReason`.

---

## Frontend: Early Profile Creation (Photo Upload Bug Fix)

**Problem:** The `ProfilePhotoPicker` in `BasicInfoStep` calls `POST /api/tutor-profile/photo` immediately when a file is chosen. This endpoint calls `updateTutorProfile(req.user.id, ...)`, which requires an existing profile. A brand-new tutor has no profile yet, so the upload fails with "Start your tutor profile before adding a photo."

**Solution:** In `TutorOnboardingPage`, after confirming the user is authenticated and before rendering the wizard, attempt `GET /api/tutor-profile/me`. If the response is 404, call `POST /api/tutor-profile` with minimal defaults to create the DRAFT. This happens during the existing `loadProfile` phase, which already shows a loading state. The photo upload then always finds an existing profile.

Minimal create payload used on first visit:
```json
{
  "displayName": "<user.name from auth context>",
  "headline": "Tutor",
  "bio": "Profile in progress."
}
```

These are placeholder values that the tutor will overwrite in Step 1. They satisfy the `createTutorProfileSchema` (displayName, headline, bio required).

**No-duplicate guarantee:** The `createTutorProfile` service already returns `PROFILE_ALREADY_EXISTS` (409) if a profile exists. The frontend catches 409 and proceeds as if the load succeeded. The DB has a unique constraint on `userId`.

---

## Frontend: Client-Side Validation

Each onboarding step uses `react-hook-form` with its `register` API and `formState.errors`. The current implementation registers fields but does not attach validation rules. The fix is to add `register` options matching the Zod schema constraints.

Field-level rules to add (matching server-side Zod):

| Field | Rule |
|---|---|
| `displayName` | `required`, `maxLength: 100` |
| `headline` | `required`, `maxLength: 160` |
| `bio` | `required`, `maxLength: 2000` |
| `hourlyRate` | `min: 0`, `max: 9999.99`, validates as a number |
| `subjectIds` | `validate: arr => arr.length > 0` |
| `studentLevels` | `validate: arr => arr.length > 0` |
| `teachingMode` | `required` |

`location`, `experience`, `education`, `languages`, `availability` are optional and require no client-side required rule.

The `form.trigger()` call in `handleNext` already runs validation before advancing — the errors just do not display because no rules are registered. Adding rules to `register` will make them show in `formState.errors`, which the step components already read via `errors.fieldName?.message`.

---

## Frontend: Application Status Page

Route: `/tutor/application-status`

Auth-gated via `requireAuth` — redirects to login if unauthenticated.

Data source: `GET /api/tutor-profile/me`

State machine (one render path per status):

```
profileStatus === 'DRAFT'
  → "Your application is still in progress."
  → Link: "Continue your application" → /become-a-tutor

profileStatus === 'PENDING_REVIEW'
  → Application ID (with copy button)
  → Submission date
  → Status badge
  → Verification instructions block
  → Document checklist (static, informational)
  → Telegram/WhatsApp contact buttons

profileStatus === 'APPROVED'
  → "Your tutor profile has been approved."
  → Link to public profile: /tutors/:id
  → Next steps text

profileStatus === 'REJECTED'
  → Rejection reason category (human-readable label)
  → Admin message (if present)
  → "Update Application" button → /become-a-tutor

profileStatus === 'NEEDS_INFORMATION'
  → "Additional information is required."
  → Admin message
  → "Update Application" button → /become-a-tutor

profileStatus === 'SUSPENDED'
  → "Your profile is currently unavailable."
  → Contact Telegram/WhatsApp
```

Contact values sourced from `import.meta.env.VITE_CONTACT_TELEGRAM` and `import.meta.env.VITE_CONTACT_WHATSAPP`. When blank, the contact button is not rendered.

---

## Frontend: Admin Tutor Review Queue (`/admin/tutors`)

Follows the same structure as the existing `AdminRequestsPage`:
- `useAsyncData` for data fetching
- Debounced search input
- Status filter defaulting to `PENDING_REVIEW`
- Pagination

Each row in the list shows: applicant name (link to detail), headline (truncated), up to 3 subjects, teaching mode badge, location, hourly rate, submitted/updated date, status badge.

Uses `GET /api/admin/tutors` with `?status=PENDING_REVIEW&limit=20` as default.

Stat count of pending profiles shown in header (from pagination total when filtered to PENDING_REVIEW).

---

## Frontend: Admin Tutor Review Workspace (`/admin/tutors/:id`)

Five section layout with a sticky action panel:

```
┌─────────────────────────────────────┬─────────────────┐
│  Section 1: Application Summary     │  Action Panel   │
│  Section 2: About the Tutor         │  (sticky)       │
│  Section 3: Teaching                │                 │
│  Section 4: Public Profile Preview  │                 │
│  Section 5: Verification            │                 │
└─────────────────────────────────────┴─────────────────┘
```

**Action Panel** (sticky on desktop, fixed bottom bar on mobile):
- "Approve Tutor" (primary, green) — opens confirmation modal
- "Request More Information" (secondary) — opens message modal
- "Reject Application" (danger) — opens rejection form modal

**Modals:**

Approve confirmation:
```
"Approving this tutor will make their profile publicly visible in the tutor directory."
[ Cancel ]  [ Confirm Approval ]
```

Request More Information form:
```
Message to tutor *
[textarea]
[ Cancel ]  [ Send Request ]
```

Rejection form:
```
Reason *
[select: Missing document / Education needs clarification / Profile incomplete /
         Qualification needs verification / Other]
Additional message (optional)
[textarea]
[ Cancel ]  [ Reject Application ]
```

**Section 5 (Verification)** submits to `PATCH /api/admin/tutors/:id/verification`, not to the status endpoint. The checklist and notes can be saved at any time without changing the profile status.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The original properties 1–12 remain valid. The following new properties address the extended workflow.

---

**Property 13: NEEDS_INFORMATION profiles are not publicly visible**
*For any* TutorProfile with `profileStatus = NEEDS_INFORMATION`, `GET /api/tutors` must not return that profile and `GET /api/tutors/:id` must return HTTP 404.
**Validates: Requirements 19.6, 29.1, 29.2**

---

**Property 14: Application reference is generated exactly once per profile**
*For any* TutorProfile, calling `POST /api/tutor-profile/submit` for the first time must set `applicationReference` to a non-null value matching the `TT-YYYY-NNNNNN` pattern. Calling submit again (after REJECTED → PENDING_REVIEW or NEEDS_INFORMATION → PENDING_REVIEW) must leave `applicationReference` unchanged.
**Validates: Requirements 20.1, 20.2, 20.5, 20.6**

---

**Property 15: Application reference values are unique across all profiles**
*For any* two distinct TutorProfiles that have both been submitted, their `applicationReference` values must be different.
**Validates: Requirements 20.2**

---

**Property 16: Rejection requires a reason**
*For any* admin attempt to set a TutorProfile status to `REJECTED` without providing a `rejectionReason`, the system must return HTTP 422 and the profile's status must remain unchanged.
**Validates: Requirements 22.1, 22.5, 28.2**

---

**Property 17: Resubmission from REJECTED or NEEDS_INFORMATION transitions to PENDING_REVIEW**
*For any* TutorProfile with `profileStatus` in `{REJECTED, NEEDS_INFORMATION}` that satisfies completeness requirements, calling `POST /api/tutor-profile/submit` must transition the status to `PENDING_REVIEW` and must not change the `applicationReference`.
**Validates: Requirements 25.4, 25.5, 28.4**

---

**Property 18: Verification checklist updates do not change profile status**
*For any* TutorProfile, calling `PATCH /api/admin/tutors/:id/verification` with any valid payload must leave `profileStatus` unchanged.
**Validates: Requirements 27.3**

---

**Property 19: Admin message is required for NEEDS_INFORMATION**
*For any* admin attempt to set a TutorProfile status to `NEEDS_INFORMATION` without providing `adminMessage`, the system must return HTTP 422 and the profile status must remain unchanged.
**Validates: Requirements 19.3, 28.3**

---

## Error Handling

All new endpoints follow the existing envelope pattern:
```json
{ "success": false, "error": { "code": "...", "message": "...", "fields": [...] } }
```

New error codes:

| Scenario | HTTP | Code |
|---|---|---|
| REJECTED without rejectionReason | 422 | `REJECTION_REASON_REQUIRED` |
| NEEDS_INFORMATION without adminMessage | 422 | `ADMIN_MESSAGE_REQUIRED` |
| Submit from PENDING_REVIEW | 400 | `ALREADY_UNDER_REVIEW` |
| Submit from APPROVED | 400 | `ALREADY_APPROVED` |
| applicationReference collision (retry) | 500 | `INTERNAL_ERROR` (logged) |

---

## Testing Strategy

### Property-based testing

Same tools as before: **fast-check** in both backend (`.mjs` test files, node:test runner) and frontend (Vitest).

### New correctness property tests

| Property | Location |
|---|---|
| P13: NEEDS_INFORMATION not public | `backend/tests/tutors.property.test.mjs` (extend) |
| P14: Reference generated once | `backend/tests/tutorProfile.property.test.mjs` (extend) |
| P15: References unique | `backend/tests/tutorProfile.property.test.mjs` (extend) |
| P16: Rejection needs reason | `backend/tests/adminTutors.property.test.mjs` (new) |
| P17: Resubmission transition | `backend/tests/tutorProfile.property.test.mjs` (extend) |
| P18: Verification no status change | `backend/tests/adminTutors.property.test.mjs` (new) |
| P19: NEEDS_INFORMATION needs message | `backend/tests/adminTutors.property.test.mjs` (new) |

### Unit tests

New unit test files / extensions:

- `backend/tests/adminTutors.api.test.mjs` (extend): rejection with/without reason, NEEDS_INFORMATION with/without message, verification update endpoint
- `backend/tests/tutorProfile.api.test.mjs` (extend): resubmission from REJECTED, resubmission from NEEDS_INFORMATION, submit from PENDING_REVIEW returns 400, applicationReference generated and retained
- `backend/tests/tutors.api.test.mjs` (extend): NEEDS_INFORMATION profile returns 404 from public endpoint

### Tag format

All property tests tagged:
`**Feature: tutor-marketplace, Property N: <property text>**`
`**Validates: Requirements X.Y**`

Each property implemented by exactly one property-based test, running minimum 100 iterations (fast-check default).


---

## Correctness Properties (Extended)

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The following properties extend the original 12 from the base design. They are numbered 13 onward and follow the same PBT format.

---

**Property 13: NEEDS_INFORMATION profiles are not publicly visible**
*For any* TutorProfile with `profileStatus = NEEDS_INFORMATION` in the database, `GET /api/tutors` must not include that profile in its `items` array, and `GET /api/tutors/:id` must return HTTP 404 for that profile's ID. This extends Property 1 to cover the new status value.
**Validates: Requirements 19.6, 29.1, 29.2**

---

**Property 14: Application reference is generated exactly once per profile**
*For any* TutorProfile submitted for the first time, the `applicationReference` field must be set to a non-null value matching the pattern `TT-\d{4}-\d{6}`. For any subsequent resubmission (REJECTED → PENDING_REVIEW or NEEDS_INFORMATION → PENDING_REVIEW), the `applicationReference` must remain identical to the original value — it must not be regenerated or cleared.
**Validates: Requirements 20.1, 20.5, 20.6**

---

**Property 15: Application reference values are unique across all profiles**
*For any* two distinct TutorProfiles that have both been submitted at least once, their `applicationReference` values must be different strings. No two profiles may share a reference.
**Validates: Requirements 20.2**

---

**Property 16: Rejection requires a reason — profile status is protected**
*For any* admin request to `PATCH /api/admin/tutors/:id/status` that sets `status = 'REJECTED'` without a `rejectionReason` field, the system must return HTTP 422, and the profile's `profileStatus` must remain unchanged in the database after the failed request.
**Validates: Requirements 22.1, 22.5, 28.2**

---

**Property 17: Resubmission from REJECTED or NEEDS_INFORMATION transitions to PENDING_REVIEW without changing the reference**
*For any* complete TutorProfile (meeting all completeness requirements) whose `profileStatus` is `REJECTED` or `NEEDS_INFORMATION`, calling `POST /api/tutor-profile/submit` must: (a) return success, (b) set `profileStatus` to `PENDING_REVIEW`, and (c) leave `applicationReference` identical to its value before the call.
**Validates: Requirements 25.4, 25.5, 28.4**

---

**Property 18: Verification checklist updates never change profile status**
*For any* TutorProfile, calling `PATCH /api/admin/tutors/:id/verification` with any valid payload (any combination of `verificationStatus`, `adminNotes`, and `verificationChecklist` values) must leave `profileStatus` on the profile exactly unchanged. The verification endpoint is a separate concern from the status endpoint.
**Validates: Requirements 27.3**

---

**Property 19: NEEDS_INFORMATION requires an admin message — profile status is protected**
*For any* admin request to `PATCH /api/admin/tutors/:id/status` that sets `status = 'NEEDS_INFORMATION'` without an `adminMessage` field, the system must return HTTP 422, and the profile's `profileStatus` must remain unchanged in the database after the failed request.
**Validates: Requirements 19.3, 28.3**

---

**Property 20: Onboarding initialization is idempotent — exactly one DRAFT profile**
*For any* authenticated user, triggering the onboarding initialization logic (the sequence that creates a DRAFT profile if none exists) multiple times must result in exactly one TutorProfile record for that user in the database. The operation must never create duplicate profiles regardless of how many times it is invoked concurrently or sequentially.
**Validates: Requirements 17.1, 17.2**

---

## Property-Based Test Coverage Summary (Full)

| Property | Test location | Library |
|---|---|---|
| P1: APPROVED-only (original) | `backend/tests/tutors.property.test.mjs` | fast-check |
| P2: Filter correctness (original) | `backend/tests/tutors.property.test.mjs` | fast-check |
| P3: Pagination consistency (original) | `backend/tests/tutors.property.test.mjs` | fast-check |
| P4: Sort order invariant (original) | `backend/tests/tutors.property.test.mjs` | fast-check |
| P5: Private fields excluded (original) | `backend/tests/tutors.property.test.mjs` | fast-check |
| P6: New profile = DRAFT (original) | `backend/tests/tutorProfile.property.test.mjs` | fast-check |
| P7: Partial update (original) | `backend/tests/tutorProfile.property.test.mjs` | fast-check |
| P8: Ownership enforcement (original) | `backend/tests/tutorProfile.property.test.mjs` | fast-check |
| P9: TutorCard rendering (original) | `frontend/src/features/tutors/components/TutorCard.test.tsx` | fast-check |
| P10: Profile page rendering (original) | `frontend/src/features/tutorProfile/TutorProfilePage.test.tsx` | fast-check |
| P11: Slug derivation (original) | `backend/tests/slugUtils.property.test.mjs` | fast-check |
| P12: Subject round-trip (original) | `backend/tests/tutors.property.test.mjs` | fast-check |
| P13: NEEDS_INFORMATION not public | `backend/tests/tutors.property.test.mjs` (extend) | fast-check |
| P14: Reference generated once | `backend/tests/tutorProfile.property.test.mjs` (extend) | fast-check |
| P15: References unique | `backend/tests/tutorProfile.property.test.mjs` (extend) | fast-check |
| P16: Rejection needs reason | `backend/tests/adminTutors.property.test.mjs` (new) | fast-check |
| P17: Resubmission transition | `backend/tests/tutorProfile.property.test.mjs` (extend) | fast-check |
| P18: Verification no status change | `backend/tests/adminTutors.property.test.mjs` (new) | fast-check |
| P19: NEEDS_INFORMATION needs message | `backend/tests/adminTutors.property.test.mjs` (new) | fast-check |
| P20: Onboarding idempotent | `backend/tests/tutorProfile.property.test.mjs` (extend) | fast-check |
