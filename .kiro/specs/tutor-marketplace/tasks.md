# Implementation Plan

> Tasks 1–23 (original spec) are marked complete. This plan covers tasks 24 onward, implementing the extended tutor verification workflow.

- [x] 1. Database foundation — Subject, TutorProfile, and schema migrations
- [x] 1.1 Write property test for slug derivation utility (Property 11)
- [x] 2. Subject seeding and slug utility
- [x] 2.1 Write property test for Subject active filter (Property 1 prerequisite — slug utility)
- [x] 3. Public tutor directory API — `GET /api/tutors`
- [x] 3.1 Write property test: only APPROVED profiles returned (Property 1)
- [x] 3.2 Write property test: filter correctness (Property 2)
- [x] 3.3 Write property test: pagination envelope consistency (Property 3)
- [x] 3.4 Write property test: sort order invariant (Property 4)
- [x] 3.5 Write unit tests for tutor directory API
- [x] 4. Public tutor profile API — `GET /api/tutors/:id`
- [x] 4.1 Write property test: private fields never exposed (Property 5)
- [x] 4.2 Write unit tests for tutor profile API
- [x] 5. Checkpoint — ensure all tests pass, ask the user if questions arise.
- [x] 6. Authenticated tutor profile management API
- [x] 6.1 Write property test: new profile defaults to DRAFT (Property 6)
- [x] 6.2 Write property test: partial update correctness (Property 7)
- [x] 6.3 Write property test: ownership enforcement (Property 8)
- [x] 6.4 Write unit tests for tutor profile management API
- [x] 7. Admin tutor moderation API
- [x] 7.1 Write unit tests for admin tutor moderation API
- [x] 8. TutorRequest backward compatibility — tutorProfileId extension
- [x] 8.1 Write property test: subject round-trip (Property 12)
- [x] 8.2 Write unit tests for TutorRequest tutorProfileId integration
- [x] 9. Development seed data
- [x] 10. Checkpoint — ensure all tests pass, ask the user if questions arise.
- [x] 11. Frontend types and API client for tutors
- [x] 12. TutorCard component
- [x] 12.1 Write property test: TutorCard renders required fields (Property 9)
- [x] 13. EmptyState component
- [x] 14. FilterPanel component
- [x] 15. TutorDirectoryPage — `/tutors`
- [x] 15.1 Write unit tests for TutorDirectoryPage
- [x] 16. TutorProfilePage — `/tutors/:id`
- [x] 16.1 Write property test: profile page renders all required fields (Property 10)
- [x] 17. Register `/tutors` and `/tutors/:id` routes
- [x] 18. Checkpoint — ensure all tests pass, ask the user if questions arise.
- [x] 19. Tutor onboarding flow — `/become-a-tutor`
- [x] 20. Register `/become-a-tutor` route
- [x] 21. Homepage integration
- [x] 22. Navbar update
- [x] 23. Final Checkpoint — ensure all tests pass, ask the user if questions arise.

---

## Extended Workflow — Tasks 24 onward

- [x] 24. Database migration — extended ProfileStatus, VerificationStatus, and new TutorProfile fields
  - Add `NEEDS_INFORMATION` to `ProfileStatus` enum in `backend/prisma/schema.prisma`
  - Replace `VerificationStatus` enum with 5 values: `UNVERIFIED`, `DOCUMENTS_REQUESTED`, `DOCUMENTS_RECEIVED`, `VERIFIED`, `NEEDS_MORE_INFORMATION`
  - Add fields to `TutorProfile`: `applicationReference String? @unique @db.VarChar(20)`, `rejectionReason String? @db.VarChar(100)`, `adminMessage String? @db.VarChar(2000)`, `adminNotes String? @db.VarChar(4000)`, `verificationChecklist Json?`, `verifiedAt DateTime?`
  - Run `npx prisma migrate dev --name add_verification_workflow` in `backend/`
  - Verify migration applies cleanly and all existing tests still pass
  - _Requirements: 19.1, 19.2, 20.1, 22.4, 26.1, 26.2, 27.1, 27.2_

- [x] 25. Extend `submitTutorProfile` service — applicationReference generation and resubmission support
  - Update `backend/src/modules/tutorProfile/service.js` `submitTutorProfile` to:
    - Accept `profileStatus` in `['DRAFT', 'REJECTED', 'NEEDS_INFORMATION']` — return `{ code: 'ALREADY_UNDER_REVIEW' }` for `PENDING_REVIEW`, `{ code: 'ALREADY_APPROVED' }` for `APPROVED`
    - Generate `applicationReference` in format `TT-YYYY-NNNNNN` if not already set: count existing profiles with references starting `TT-<year>-`, use `count + 1`, zero-pad to 6 digits, wrap the count query and update in a Prisma transaction
    - Retain existing `applicationReference` on resubmission
  - Update `backend/src/modules/tutorProfile/controller.js` to return 400 (not 500) for `ALREADY_UNDER_REVIEW` and `ALREADY_APPROVED` codes
  - _Requirements: 20.1, 20.2, 20.3, 20.5, 20.6, 25.4, 25.5, 28.4, 28.5, 28.6_

- [x] 25.1 Write property test: application reference generated once and retained (Property 14)
  - Add to `backend/tests/tutorProfile.property.test.mjs`
  - **Feature: tutor-marketplace-extended, Property 14: Application reference is generated exactly once per profile**
  - **Validates: Requirements 20.1, 20.5, 20.6**

- [x] 25.2 Write property test: application references are unique (Property 15)
  - Add to `backend/tests/tutorProfile.property.test.mjs`
  - **Feature: tutor-marketplace-extended, Property 15: Application reference values are unique across all profiles**
  - **Validates: Requirements 20.2**

- [x] 25.3 Write property test: resubmission transitions to PENDING_REVIEW (Property 17)
  - Add to `backend/tests/tutorProfile.property.test.mjs`
  - **Feature: tutor-marketplace-extended, Property 17: Resubmission from REJECTED or NEEDS_INFORMATION transitions to PENDING_REVIEW**
  - **Validates: Requirements 25.4, 25.5, 28.4**

- [ ]* 25.4 Write property test: onboarding initialization is idempotent (Property 20)
  - Add to `backend/tests/tutorProfile.property.test.mjs`
  - **Feature: tutor-marketplace-extended, Property 20: Onboarding initialization is idempotent — exactly one DRAFT profile**
  - **Validates: Requirements 17.1, 17.2**

- [ ]* 25.5 Write unit tests for extended submit endpoint
  - Extend `backend/tests/tutorProfile.api.test.mjs`
  - Cover: submit from DRAFT generates applicationReference, submit from REJECTED succeeds and retains reference, submit from NEEDS_INFORMATION succeeds and retains reference, submit from PENDING_REVIEW returns 400, submit from APPROVED returns 400
  - _Requirements: 20.1, 20.5, 25.4, 25.5, 28.4, 28.5, 28.6, 34.2, 34.5_

- [ ] 26. Extend `getMyTutorProfile` service response — include applicationReference and admin feedback fields
  - Update the response shape in `backend/src/modules/tutorProfile/service.js` `getMyTutorProfile` to include: `applicationReference`, `adminMessage`, `rejectionReason`
  - These fields are needed by the frontend status page to show rejection reasons and admin messages
  - _Requirements: 20.3, 21.5, 21.6, 22.7_

- [x] 27. Extend admin tutor status endpoint — NEEDS_INFORMATION and rejection reason support
  - Update `backend/src/modules/adminTutors/validation.js`:
    - Add `NEEDS_INFORMATION` to `MODERATION_STATUSES`
    - Add `rejectionReason` field to `updateStatusSchema` (required when `status === 'REJECTED'`)
    - Add `adminMessage` field (required when `status === 'NEEDS_INFORMATION'`, optional when `status === 'REJECTED'`)
    - Add `REJECTION_REASONS` enum: `MISSING_DOCUMENT`, `EDUCATION_NEEDS_CLARIFICATION`, `PROFILE_INCOMPLETE`, `QUALIFICATION_NEEDS_VERIFICATION`, `OTHER`
    - Add cross-field validation: if `status === 'REJECTED'` and `rejectionReason` is absent → validation error; if `status === 'NEEDS_INFORMATION'` and `adminMessage` is absent → validation error
  - Update `backend/src/modules/adminTutors/service.js` `updateTutorProfileStatus` to write `rejectionReason` and `adminMessage` fields alongside status
  - Update `backend/src/modules/adminTutors/controller.js` to handle the new error codes `REJECTION_REASON_REQUIRED` and `ADMIN_MESSAGE_REQUIRED` with 422 responses
  - _Requirements: 19.3, 22.1, 22.2, 22.3, 22.4, 22.5, 28.2, 28.3, 34.3, 34.6_

- [x] 27.1 Write property test: rejection requires reason — status protected (Property 16)
  - Create `backend/tests/adminTutors.property.test.mjs`
  - **Feature: tutor-marketplace-extended, Property 16: Rejection requires a reason — profile status is protected**
  - **Validates: Requirements 22.1, 22.5, 28.2**

- [x] 27.2 Write property test: NEEDS_INFORMATION requires message — status protected (Property 19)
  - Add to `backend/tests/adminTutors.property.test.mjs`
  - **Feature: tutor-marketplace-extended, Property 19: NEEDS_INFORMATION requires an admin message — profile status is protected**
  - **Validates: Requirements 19.3, 28.3**

- [ ]* 27.3 Write unit tests for extended admin status endpoint
  - Extend `backend/tests/adminTutors.api.test.mjs`
  - Cover: REJECTED without rejectionReason returns 422, REJECTED with reason succeeds and persists reason, NEEDS_INFORMATION without adminMessage returns 422, NEEDS_INFORMATION with message succeeds and persists message, existing approved/suspended/rejected tests still pass
  - _Requirements: 19.3, 22.1, 22.5, 28.2, 28.3, 34.3, 34.6_

- [x] 28. Add verification update endpoint — `PATCH /api/admin/tutors/:id/verification`
  - Add `updateTutorVerification(id, data)` to `backend/src/modules/adminTutors/service.js`: updates `verificationStatus`, `adminNotes`, `verificationChecklist`, and `verifiedAt` (set to now when provided) without touching `profileStatus`
  - Add validation schema `updateVerificationSchema` to `backend/src/modules/adminTutors/validation.js`: all fields optional, `verificationChecklist` validated as an object with 6 boolean keys
  - Add `patchTutorVerification` handler to `backend/src/modules/adminTutors/controller.js`
  - Register `PATCH /tutors/:id/verification` route in `backend/src/modules/adminTutors/index.js`
  - Update `DETAIL_COLUMNS` in service to include all new fields (`applicationReference`, `rejectionReason`, `adminMessage`, `adminNotes`, `verificationChecklist`, `verifiedAt`)
  - _Requirements: 26.3, 26.4, 26.5, 27.3, 27.4, 27.5_

- [x] 28.1 Write property test: verification updates never change profile status (Property 18)
  - Add to `backend/tests/adminTutors.property.test.mjs`
  - **Feature: tutor-marketplace-extended, Property 18: Verification checklist updates never change profile status**
  - **Validates: Requirements 27.3**

- [ ]* 28.2 Write unit tests for verification update endpoint
  - Extend `backend/tests/adminTutors.api.test.mjs`
  - Cover: requires admin token, updates verificationStatus without changing profileStatus, saves adminNotes, saves verificationChecklist, sets verifiedAt, invalid checklist keys rejected, unknown profile returns 404
  - _Requirements: 26.3, 27.3, 27.4, 27.5, 34.4_

- [x] 29. Extend public tutors property test — NEEDS_INFORMATION not visible (Property 13)
  - Add to `backend/tests/tutors.property.test.mjs`
  - **Feature: tutor-marketplace-extended, Property 13: NEEDS_INFORMATION profiles are not publicly visible**
  - **Validates: Requirements 19.6, 29.1, 29.2**

- [ ]* 29.1 Write unit tests for NEEDS_INFORMATION visibility
  - Extend `backend/tests/tutors.api.test.mjs`
  - Cover: NEEDS_INFORMATION profile returns 404 from GET /api/tutors/:id, NEEDS_INFORMATION profile not in GET /api/tutors list
  - _Requirements: 19.6, 29.2, 34.1_

- [x] 30. Checkpoint — ensure all backend tests pass, ask the user if questions arise.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 31. Fix photo upload bug — early DRAFT profile creation in onboarding
  - Update `frontend/src/features/tutorOnboarding/TutorOnboardingPage.tsx` `loadProfile` function:
    - When `GET /api/tutor-profile/me` returns 404, call `createTutorProfile` with minimal defaults (`displayName` from auth user's name, `headline: 'Tutor'`, `bio: 'Profile in progress.'`)
    - Treat a 409 response from `createTutorProfile` as success (profile exists, reload it)
    - Set `profileExists = true` after either path succeeds
    - If profile creation fails for any other reason, show a user-facing error and do not render the wizard until resolved
  - Update `frontend/src/features/tutorOnboarding/tutorOnboarding.types.ts` to add `NEEDS_INFORMATION` to the `profileStatus` union type on `MyTutorProfile`
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 19.1_

- [x] 32. Add client-side validation to onboarding steps
  - Update `frontend/src/features/tutorOnboarding/steps/BasicInfoStep.tsx`: add `validate` / `required` / `maxLength` rules to `register('displayName', {...})`, `register('headline', {...})`, `register('bio', {...})`
  - Update `frontend/src/features/tutorOnboarding/steps/SubjectsStep.tsx`: add `validate: arr => arr.length > 0 || 'Please select at least one subject.'` rule
  - Update `frontend/src/features/tutorOnboarding/steps/LevelsStep.tsx`: add `validate: arr => arr.length > 0 || 'Please select at least one level.'` rule
  - Update `frontend/src/features/tutorOnboarding/steps/TeachingModeStep.tsx`: add `required` rule to `teachingMode`
  - Update `frontend/src/features/tutorOnboarding/steps/PricingStep.tsx`: add `min: 0`, `max: 9999.99`, numeric coercion validation to `hourlyRate` field; clearly mark it as required per backend schema
  - Ensure each step displays `errors.fieldName?.message` beside each field (most steps already read this, just needs the rules wired in)
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

- [x] 33. Add configuration-driven contact values
  - Add `VITE_CONTACT_TELEGRAM` and `VITE_CONTACT_WHATSAPP` to `frontend/.env.example` with empty default values and a comment explaining they are safe to leave blank
  - Create `frontend/src/lib/contactConfig.ts` exporting `TELEGRAM_CONTACT = import.meta.env.VITE_CONTACT_TELEGRAM ?? ''` and `WHATSAPP_CONTACT = import.meta.env.VITE_CONTACT_WHATSAPP ?? ''`
  - _Requirements: 32.1, 32.2, 32.5_

- [x] 34. Create TutorApplicationStatusPage — `/tutor/application-status`
  - Create `frontend/src/features/tutorOnboarding/TutorApplicationStatusPage.tsx`:
    - Auth-gated: redirect to `/login?next=/tutor/application-status` if not authenticated
    - Load profile via `GET /api/tutor-profile/me`
    - Render different content per `profileStatus`:
      - `DRAFT`: "Your application is still in progress." + "Continue your application" link to `/become-a-tutor`
      - `PENDING_REVIEW`: application reference ID with copy button, submission date, status badge, verification instructions, document checklist (Government ID, Education document, Certificate if applicable, Additional qualifications), Telegram + WhatsApp contact buttons (hidden when config values are empty), message that review begins after documents received
      - `APPROVED`: approval message, link to public profile `/tutors/:id`, next steps
      - `REJECTED`: rejection reason category label, adminMessage (if set), "Update Application" button to `/become-a-tutor`
      - `NEEDS_INFORMATION`: "Additional information is required." message, adminMessage, "Update Application" button
      - `SUSPENDED`: unavailability message, contact info
    - Copy-to-clipboard button for `applicationReference` uses `navigator.clipboard.writeText`
    - Contact buttons sourced from `contactConfig.ts`
  - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.9, 21.10, 32.3, 32.4_

- [x] 35. Register `/tutor/application-status` route and add post-submit navigation
  - Add `TutorApplicationStatusPage` as a lazy export in `frontend/src/app/publicPages.tsx`
  - Add `{ path: '/tutor/application-status', element: <TutorApplicationStatusPage /> }` to `frontend/src/app/router.tsx`
  - Update `TutorOnboardingPage.tsx` success state: instead of a congratulations screen, navigate to `/tutor/application-status` after successful submission
  - _Requirements: 21.1_

- [x] 36. Create admin types and API client for tutor review
  - Create `frontend/src/features/adminTutors/adminTutors.types.ts`:
    - `AdminTutorProfile` interface (full profile including all new fields: `applicationReference`, `rejectionReason`, `adminMessage`, `adminNotes`, `verificationChecklist`, `verifiedAt`)
    - `AdminTutorListItem` interface (list view fields)
    - `RejectionReasonCategory` type and human-readable labels
    - `VerificationStatus` type (5 values)
    - `VerificationChecklist` interface (6 boolean fields)
    - `AdminTutorListResponse` with pagination
  - Create `frontend/src/features/adminTutors/adminTutors.api.ts`:
    - `fetchAdminTutors({ page, limit, status, search })` → `GET /api/admin/tutors`
    - `fetchAdminTutor(id)` → `GET /api/admin/tutors/:id`
    - `updateTutorStatus(id, payload)` → `PATCH /api/admin/tutors/:id/status`
    - `updateTutorVerification(id, payload)` → `PATCH /api/admin/tutors/:id/verification`
  - _Requirements: 23.1, 24.1_

- [x] 37. Create AdminTutorsPage — `/admin/tutors`
  - Create `frontend/src/pages/AdminTutorsPage.tsx`:
    - Uses `AdminShell` layout
    - Fetches via `fetchAdminTutors` with `useAsyncData`
    - Default status filter: `PENDING_REVIEW`
    - Status filter options: All, DRAFT, PENDING_REVIEW, APPROVED, REJECTED, SUSPENDED, NEEDS_INFORMATION
    - Text search input (debounced 300ms) searching applicant name and headline
    - Table/list rows showing: applicant name (link to `/admin/tutors/:id`), headline (truncated to 80 chars), up to 3 subjects as badges, teaching mode, location, hourly rate, submitted date, status badge
    - Pagination controls
    - Empty state when no results match current filter
    - Newest applications first (API default)
    - Result count in page description
  - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7, 23.8, 23.9_

- [x] 38. Update AdminShell navigation — add "Tutors" link
  - Update `frontend/src/components/layout/AdminShell.tsx` `ADMIN_LINKS` array to add `{ to: '/admin/tutors', label: 'Tutors', end: false }`
  - Place it after "Tutor Requests" in the list
  - _Requirements: 33.1, 33.2, 33.3_

- [x] 39. Register admin tutor routes
  - Add `AdminTutorsPage` and `AdminTutorReviewPage` as lazy exports in `frontend/src/app/adminPages.tsx`
  - Add to `frontend/src/app/router.tsx`:
    - `{ path: '/admin/tutors', element: admin(<AdminTutorsPage />) }`
    - `{ path: '/admin/tutors/:id', element: admin(<AdminTutorReviewPage />) }`
  - _Requirements: 23.1, 24.1_

- [x] 40. Create AdminTutorReviewPage — `/admin/tutors/:id`
  - Create `frontend/src/pages/AdminTutorReviewPage.tsx`:
    - Section 1 — Application Summary: profile photo (with placeholder), display name, headline, location, current status badge, applicationReference, submission date (createdAt), last updated date
    - Section 2 — About the Tutor: bio, experience, education, languages (comma-joined), availability
    - Section 3 — Teaching: subjects as badges, student levels as badges, teaching mode, hourly rate
    - Section 4 — Public Profile Preview: renders a read-only card-style view of the profile fields as they will appear publicly; clearly labelled "This is a preview — the profile is not publicly visible until approved"; links to `/tutors/:id` only when status is APPROVED
    - Section 5 — Verification: current verificationStatus select, verification checklist (6 checkboxes: Gov ID received, Identity reviewed, Education doc received, Education reviewed, Certificate received, Qualification reviewed), adminNotes textarea, "Save Verification Notes" button (calls `updateTutorVerification`), external verification disclaimer label
    - Sticky action panel (right sidebar on desktop, fixed bottom bar on mobile): "Approve Tutor" button, "Request More Information" button, "Reject Application" button
    - Approve modal: confirmation text per design, Cancel + Confirm Approval buttons
    - Request More Information modal: adminMessage textarea (required), Cancel + Send Request buttons
    - Reject modal: rejectionReason select (5 options with human-readable labels), optional adminMessage textarea, Cancel + Reject Application buttons
    - When profile is NEEDS_INFORMATION or REJECTED, display the stored adminMessage prominently at top of page in a highlighted banner
  - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7, 24.8, 24.9, 24.10, 24.11, 24.12, 24.13, 24.14, 33.3_

- [x] 41. Checkpoint — ensure all tests pass, ask the user if questions arise.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 42. Support REJECTED and NEEDS_INFORMATION states in tutor onboarding wizard
  - Update `frontend/src/features/tutorOnboarding/TutorOnboardingPage.tsx`:
    - When profile is loaded with `profileStatus` of `REJECTED` or `NEEDS_INFORMATION`, allow the wizard to proceed normally (editable) 
    - When profile is `PENDING_REVIEW`, show a read-only message: "Your application is under review. You cannot edit it at this time." with a link to the status page
    - When profile is `APPROVED`, redirect to the status page
    - When profile is `SUSPENDED`, redirect to the status page
  - _Requirements: 25.1, 25.2, 25.3, 28.4_

- [x] 43. Improve TutorProfilePage — enhanced layout with sections and side panel
  - Update `frontend/src/features/tutorProfile/TutorProfilePage.tsx`:
    - Top section: profile photo, displayName (h1), headline, location, teaching mode badge, hourly rate, languages (comma-joined)
    - Primary CTA: "Request This Tutor" button → `/request-tutor?tutorId=<id>`
    - Secondary link: "View Subjects" anchor scrolling to subjects section
    - Main content columns (two-column on desktop):
      - Left/main: About section (bio), Subjects section (subject badges), Student Levels section, Experience section (if set), Education section (if set), Availability section (if set), Teaching Mode section
      - Right/side panel: "Interested in this tutor?" card with "Request a Tutor" button → `/request-tutor?tutorId=<id>`
    - No fabricated reviews, ratings, hours, or satisfaction metrics
    - Correct heading hierarchy (h1 → h2 sections), accessible image alt text
  - _Requirements: 31.1, 31.2, 31.3, 31.4, 31.5, 31.6, 31.7_

- [x] 44. Improve TutorDirectoryPage and FilterPanel — add language filter
  - Update `frontend/src/features/tutors/components/FilterPanel.tsx` to add a Language text/select input that passes a `language` filter parameter
  - Update `frontend/src/features/tutors/TutorDirectoryPage.tsx` to include `language` in filter state and URL params
  - Update `frontend/src/features/tutors/tutors.types.ts` to add `language?: string` to `TutorFilters`
  - Update `backend/src/modules/tutors/service.js` `listTutors` to filter by language when provided (case-insensitive `has` on the `languages` array)
  - Update `backend/src/modules/tutors/validation.js` to accept `language` query param
  - Update TutorCard to show languages (up to 2) when present
  - _Requirements: 30.1, 30.2, 30.4, 30.6, 30.7_

- [x] 45. Final Checkpoint — ensure all tests pass, ask the user if questions arise.
  - Ensure all tests pass, ask the user if questions arise.
