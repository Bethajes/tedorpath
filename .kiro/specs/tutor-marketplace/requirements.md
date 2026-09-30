# Requirements Document

## Introduction

This document extends the existing Tedor Tutors tutor marketplace spec. The original spec established the database models, backend APIs, public directory, tutor profile pages, onboarding wizard, and admin list/status endpoints. This extension completes and improves the end-to-end tutor verification workflow, covering: a photo-upload bug fix, proper client-side validation, rejected-application recovery, human-readable application reference IDs, a post-submission status page, a dedicated admin tutor review queue with verification checklist, a richer admin review workspace, a NEEDS_INFORMATION workflow, improved approval and rejection flows, an enhanced public tutor directory, and improved public tutor profile pages. All existing routes, APIs, authentication, tests, and data models must be preserved.

---

## Glossary

- **TutorProfile**: The database record containing a tutor's public-facing professional information, linked one-to-one with a User.
- **ProfileStatus**: The lifecycle state of a TutorProfile: `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `SUSPENDED`, `REJECTED`, or `NEEDS_INFORMATION`.
- **NEEDS_INFORMATION**: A new ProfileStatus value meaning the admin has requested additional information from the tutor without formally rejecting the application.
- **ApplicationReference**: A human-readable identifier for a submitted tutor application, e.g. `TT-2026-000123`. Stored on TutorProfile. Never exposes the internal UUID.
- **VerificationStatus**: Whether the admin has recorded that a tutor's credentials have been externally verified: `UNVERIFIED`, `DOCUMENTS_REQUESTED`, `DOCUMENTS_RECEIVED`, `VERIFIED`, or `NEEDS_MORE_INFORMATION`.
- **ExternalVerification**: The process by which the admin team receives verification documents through Telegram or WhatsApp, then records the result in the system. The system does not receive or store the actual documents.
- **AdminReviewNote**: Free-text notes stored by an admin during a review session.
- **RejectionReason**: A structured reason (category + optional custom message) recorded when an admin rejects a tutor application.
- **Subject**: A database-backed topic a tutor can teach. Derived from the existing `SUBJECTS` constant.
- **StudentLevel**: The learner level a tutor supports. Stored as a text array on TutorProfile.
- **TeachingMode**: Delivery method: `ONLINE`, `IN_PERSON`, or `BOTH`.
- **TutorDirectory**: The public page at `/tutors` listing all APPROVED TutorProfiles.
- **TutorCard**: A frontend component representing one TutorProfile in a list.
- **TutorRequest**: The existing model for client-submitted tutoring requests, with optional `tutorProfileId` link.
- **Admin**: A request carrying the shared admin token, validated by the existing `requireAdmin` middleware.
- **Authenticated User**: A request carrying a valid, unexpired session cookie validated by the existing `requireAuth` middleware.
- **Telegram/WhatsApp Contact**: Configurable contact values stored in environment variables, not hard-coded. Used to direct tutors to submit verification documents.
- **AdminShell**: The existing admin layout component with sidebar navigation.

---

## Requirements

---

### Requirement 17 — Photo Upload Bug Fix

**User Story:** As a tutor, I want the profile photo upload to work the first time I visit the onboarding wizard, so that I am not blocked by a "start your profile first" error before I have had a chance to save anything.

#### Acceptance Criteria

1. WHEN a tutor navigates to `/become-a-tutor` for the first time, THE system SHALL create a DRAFT TutorProfile record for that tutor before the photo upload is attempted, so that the upload endpoint always finds an existing profile.
2. WHEN a tutor navigates to `/become-a-tutor` and a DRAFT TutorProfile already exists for that user, THE system SHALL load the existing profile and resume from saved data without creating a duplicate.
3. WHEN a tutor attempts to upload a profile photo and no TutorProfile exists for their user ID, THE photo upload endpoint SHALL return a clear error rather than a silent failure.
4. IF a DRAFT TutorProfile creation fails during onboarding initialisation, THEN THE system SHALL display a user-facing error message and SHALL NOT allow the tutor to proceed to photo upload until the issue is resolved.

---

### Requirement 18 — Client-Side Validation

**User Story:** As a tutor, I want the onboarding form to show validation errors immediately beside each field, so that I understand exactly what needs to be corrected before I try to advance.

#### Acceptance Criteria

1. WHEN a tutor attempts to advance past a step with required fields left empty, THE onboarding wizard SHALL display an inline error message beside each invalid field without submitting to the server.
2. THE onboarding wizard SHALL mark required fields visually distinct from optional fields, using a consistent indicator.
3. WHEN a tutor submits a step with validation errors, THE system SHALL preserve all entered values and SHALL NOT reset the form.
4. WHEN the `hourlyRate` field is present, THE system SHALL validate that it is a positive number within the range accepted by the backend (0 to 9999.99) before allowing the step to advance.
5. WHEN a tutor corrects a validation error and advances, THE system SHALL clear the inline error message for that field.
6. THE client-side validation rules SHALL agree with the server-side Zod schema rules so that a value accepted by the client is also accepted by the server.

---

### Requirement 19 — NEEDS_INFORMATION Profile Status

**User Story:** As an admin, I want to request additional information from a tutor without formally rejecting their application, so that minor issues can be resolved without discouraging the tutor.

#### Acceptance Criteria

1. THE TutorProfile model SHALL support a `NEEDS_INFORMATION` ProfileStatus value in addition to the existing `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `SUSPENDED`, and `REJECTED` values.
2. WHEN a new `NEEDS_INFORMATION` ProfileStatus is added to the Prisma schema, THE system SHALL generate and apply a database migration before any code uses the new value.
3. WHEN an admin sets a profile to `NEEDS_INFORMATION`, THE system SHALL require an admin message explaining what additional information is needed.
4. WHEN a tutor's profile is in `NEEDS_INFORMATION` status, THE tutor application status page SHALL display the message: "Additional information is required." and SHALL show the admin's message.
5. WHEN a tutor with a `NEEDS_INFORMATION` profile updates and resubmits their application, THE system SHALL transition the profile status from `NEEDS_INFORMATION` to `PENDING_REVIEW`.
6. THE `NEEDS_INFORMATION` status SHALL NOT make the profile publicly visible.

---

### Requirement 20 — Application Reference ID

**User Story:** As a tutor, I want a human-readable application reference ID assigned at submission time, so that I can quote it when sending verification documents to the Tedor team.

#### Acceptance Criteria

1. WHEN a tutor submits a profile for review, THE system SHALL generate and store a unique human-readable `applicationReference` on the TutorProfile, formatted as `TT-YYYY-NNNNNN` where `YYYY` is the submission year and `NNNNNN` is a zero-padded sequential number.
2. WHEN an `applicationReference` is generated, THE system SHALL ensure it is unique across all TutorProfiles in the database.
3. THE `applicationReference` SHALL be included in the response of `POST /api/tutor-profile/submit` and in `GET /api/tutor-profile/me`.
4. THE `applicationReference` SHALL be displayed prominently on the post-submission status page with a copy-to-clipboard button.
5. WHEN a rejected tutor corrects and resubmits their application, THE system SHALL retain the existing `applicationReference` rather than generating a new one.
6. WHEN a NEEDS_INFORMATION tutor resubmits their application, THE system SHALL retain the existing `applicationReference`.

---

### Requirement 21 — Post-Submission Application Status Page

**User Story:** As a tutor, I want a dedicated application status page that shows my current status, verification instructions, and contact details, so that I always know where my application stands and what to do next.

#### Acceptance Criteria

1. THE system SHALL provide a tutor application status page accessible to authenticated tutors at a route consistent with the existing routing architecture (e.g., `/tutor/application-status`).
2. WHEN a tutor's profile is in `PENDING_REVIEW` status, THE status page SHALL display: the application reference ID, the submission date, the current status label, verification instructions, the Tedor Telegram contact, the Tedor WhatsApp contact, a required document checklist, and a message explaining that review begins after the required documents are submitted.
3. WHEN a tutor's profile is in `DRAFT` status, THE status page SHALL display a message indicating the application is still in progress and provide a link to continue the onboarding wizard.
4. WHEN a tutor's profile is in `APPROVED` status, THE status page SHALL display a message confirming approval, a link to the tutor's public profile, and suggested next steps.
5. WHEN a tutor's profile is in `REJECTED` status, THE status page SHALL display the rejection reason, a description of what needs to be corrected, and an "Update Application" button that navigates to the onboarding wizard.
6. WHEN a tutor's profile is in `NEEDS_INFORMATION` status, THE status page SHALL display the admin's information request message and an "Update Application" button.
7. WHEN a tutor's profile is in `SUSPENDED` status, THE status page SHALL display a message that the profile is currently unavailable and provide contact information for the Tedor team.
8. THE Telegram and WhatsApp contact values displayed on the status page SHALL be sourced from application configuration and SHALL NOT be hard-coded in the frontend source.
9. THE required document checklist on the status page SHALL include: Government-issued identification, Education or academic qualification document, Teaching or professional certificate (if applicable), and Additional qualifications relevant to subjects taught.
10. THE status page SHALL display a copy-to-clipboard button beside the application reference ID.

---

### Requirement 22 — Rejection Workflow

**User Story:** As an admin, I want to record a structured rejection reason when rejecting a tutor application, so that the tutor understands exactly what needs to be corrected.

#### Acceptance Criteria

1. WHEN an admin sets a TutorProfile status to `REJECTED`, THE system SHALL require a rejection reason to be provided before the status change is accepted.
2. THE rejection reason SHALL include a category selected from: "Missing verification document", "Education information needs clarification", "Profile information incomplete", "Qualification needs verification", and "Other".
3. THE system SHALL allow an optional custom admin message in addition to the category.
4. WHEN a rejection reason is recorded, THE system SHALL store both the category and the custom message on the TutorProfile.
5. IF an admin attempts to reject a profile without providing a reason, THEN THE system SHALL return HTTP 422 and SHALL NOT change the profile status.
6. THE rejection reason and custom message SHALL be included in `GET /api/admin/tutors/:id` responses.
7. THE rejection reason and custom message SHALL be visible to the tutor on the application status page.

---

### Requirement 23 — Admin Tutor Review Queue

**User Story:** As an admin, I want a professional tutor review queue at `/admin/tutors`, so that I can efficiently process pending applications.

#### Acceptance Criteria

1. THE system SHALL provide an admin tutor review queue at `/admin/tutors`, protected by the existing `requireAdmin` middleware.
2. THE `/admin/tutors` page SHALL be accessible from the AdminShell navigation sidebar under the label "Tutors".
3. THE review queue SHALL display for each application: applicant name, headline, subjects (up to 3), teaching mode, location, hourly rate, submitted date, and current status.
4. THE review queue SHALL default to showing only `PENDING_REVIEW` profiles.
5. THE review queue SHALL support filtering by status: All, DRAFT, PENDING_REVIEW, APPROVED, REJECTED, SUSPENDED, and NEEDS_INFORMATION.
6. THE review queue SHALL support a text search across applicant name and headline.
7. THE review queue SHALL display results with the newest applications first.
8. THE review queue SHALL support pagination.
9. WHEN the review queue is empty for the current filter, THE system SHALL display a clear empty state rather than a blank area.

---

### Requirement 24 — Admin Tutor Review Page

**User Story:** As an admin, I want a complete review workspace at `/admin/tutors/:id` showing the full tutor profile, verification checklist, and moderation controls, so that I can make informed decisions without navigating away.

#### Acceptance Criteria

1. THE system SHALL provide an admin tutor review page at `/admin/tutors/:id`, protected by the existing `requireAdmin` middleware.
2. THE review page SHALL display the Application Summary section containing: profile photo, display name, headline, location, current status, application reference ID, submission date, and last updated date.
3. THE review page SHALL display the About the Tutor section containing: bio, experience, education, languages, and availability.
4. THE review page SHALL display the Teaching section containing: subjects, student levels, teaching mode, and hourly rate.
5. THE review page SHALL display a Public Profile Preview section that shows the admin what the public profile will look like before approval, clearly labelled as a preview and not a public page.
6. THE review page SHALL display a Verification section with: current verification status, a checklist for recording external document verification results, verification notes field, and verification date.
7. THE verification checklist SHALL contain: Government ID received, Identity reviewed, Education document received, Education information reviewed, Relevant certificate received, and Qualification reviewed.
8. THE review page verification status SHALL use values: UNVERIFIED, DOCUMENTS_REQUESTED, DOCUMENTS_RECEIVED, VERIFIED, and NEEDS_MORE_INFORMATION.
9. THE Verification section SHALL include a label stating: "External document verification — Documents are submitted to the Tedor Tutors team through Telegram or WhatsApp."
10. THE review page SHALL provide clearly labelled moderation action buttons: "Approve Tutor", "Request More Information", and "Reject Application".
11. WHEN an admin clicks "Approve Tutor", THE system SHALL display a confirmation dialog stating: "Approving this tutor will make their profile publicly visible in the tutor directory." The admin SHALL confirm before the status is changed.
12. WHEN an admin clicks "Reject Application", THE system SHALL display a form requiring a rejection reason category and an optional custom message before allowing submission.
13. WHEN an admin clicks "Request More Information", THE system SHALL display a form requiring a message before allowing submission.
14. WHEN the review page loads for a profile in `NEEDS_INFORMATION` or `REJECTED` status, THE system SHALL display the stored admin message prominently.

---

### Requirement 25 — Tutor Resubmission After Rejection or NEEDS_INFORMATION

**User Story:** As a rejected or information-requested tutor, I want to edit my profile and resubmit, so that I can address the feedback and get approved without starting from scratch.

#### Acceptance Criteria

1. WHEN a tutor's profile is in `REJECTED` status, THE system SHALL allow the tutor to edit all profile fields through the existing onboarding wizard.
2. WHEN a tutor's profile is in `NEEDS_INFORMATION` status, THE system SHALL allow the tutor to edit all profile fields through the existing onboarding wizard.
3. WHEN a tutor with a `REJECTED` or `NEEDS_INFORMATION` profile clicks "Update Application", THE system SHALL navigate them to the onboarding wizard pre-populated with their existing profile data.
4. WHEN a tutor with a `REJECTED` or `NEEDS_INFORMATION` profile submits their updated profile, THE system SHALL transition the status to `PENDING_REVIEW` and SHALL retain the existing `applicationReference`.
5. THE `submitTutorProfile` backend service SHALL accept resubmission from `REJECTED` and `NEEDS_INFORMATION` states in addition to `DRAFT`.
6. WHEN a tutor's profile is in `APPROVED` status, THE system SHALL NOT allow submission via the `POST /api/tutor-profile/submit` endpoint.
7. WHEN a tutor's profile is in `PENDING_REVIEW` status, THE system SHALL NOT allow submission via the `POST /api/tutor-profile/submit` endpoint.

---

### Requirement 26 — Verification Status Enhancement

**User Story:** As an admin, I want to record the current state of external document verification with more granularity than UNVERIFIED/VERIFIED, so that I can accurately track where each application stands in the verification process.

#### Acceptance Criteria

1. THE VerificationStatus enum SHALL be extended to include: `UNVERIFIED`, `DOCUMENTS_REQUESTED`, `DOCUMENTS_RECEIVED`, `VERIFIED`, and `NEEDS_MORE_INFORMATION`.
2. WHEN the VerificationStatus enum is extended in the Prisma schema, THE system SHALL generate and apply a database migration before any code uses the new values.
3. THE admin `PATCH /api/admin/tutors/:id/status` endpoint SHALL accept any of the five VerificationStatus values.
4. THE admin review page SHALL display and allow updating the VerificationStatus independently of the ProfileStatus.
5. THE VerificationStatus update SHALL be stored alongside the verification checklist results and notes.

---

### Requirement 27 — Admin Review Notes and Verification Checklist Persistence

**User Story:** As an admin, I want my review notes and verification checklist selections to be saved against a profile, so that another admin can continue where I left off.

#### Acceptance Criteria

1. THE TutorProfile model SHALL store admin review notes as a nullable text field.
2. THE TutorProfile model SHALL store a verification checklist as a JSON field recording which checklist items have been checked.
3. WHEN an admin saves verification notes and checklist state, THE system SHALL persist them via a dedicated endpoint and SHALL NOT require a status change to trigger persistence.
4. THE admin review page SHALL load any previously saved notes and checklist state when the page is opened.
5. WHEN verification notes are updated, THE system SHALL store a verification timestamp.

---

### Requirement 28 — APPROVED/REJECTED/PENDING_REVIEW Status Transition Rules

**User Story:** As a system, I want clear rules about which status transitions are allowed from which states, so that profiles cannot enter invalid states.

#### Acceptance Criteria

1. THE backend SHALL enforce that `APPROVED` status is only settable by an admin via `PATCH /api/admin/tutors/:id/status`.
2. THE backend SHALL enforce that `REJECTED` status is only settable by an admin via `PATCH /api/admin/tutors/:id/status` and only when a rejection reason is provided.
3. THE backend SHALL enforce that `NEEDS_INFORMATION` status is only settable by an admin via a dedicated endpoint or the status update endpoint with an admin message.
4. THE `POST /api/tutor-profile/submit` endpoint SHALL accept requests from profiles in `DRAFT`, `REJECTED`, or `NEEDS_INFORMATION` status only.
5. WHEN a tutor's profile is in `PENDING_REVIEW` status, THE system SHALL return HTTP 400 from `POST /api/tutor-profile/submit` indicating the profile is already under review.
6. WHEN a tutor's profile is in `APPROVED` status, THE system SHALL return HTTP 400 from `POST /api/tutor-profile/submit` indicating the profile is already approved.

---

### Requirement 29 — Public Profile Visibility Rules

**User Story:** As a user, I want to be certain that only APPROVED tutor profiles are ever publicly visible, so that unvetted tutors cannot appear in search results or have accessible profile pages.

#### Acceptance Criteria

1. THE `GET /api/tutors` endpoint SHALL only return profiles with `profileStatus = APPROVED`.
2. THE `GET /api/tutors/:id` endpoint SHALL return HTTP 404 for profiles with `profileStatus` of `DRAFT`, `PENDING_REVIEW`, `NEEDS_INFORMATION`, `REJECTED`, or `SUSPENDED`.
3. WHEN a tutor's profile transitions to `APPROVED`, THE profile SHALL become immediately accessible via `GET /api/tutors/:id`.
4. WHEN a tutor's profile transitions from `APPROVED` to `SUSPENDED` or `REJECTED`, THE profile SHALL immediately become inaccessible via `GET /api/tutors/:id` and SHALL no longer appear in `GET /api/tutors`.
5. THE public tutor directory page at `/tutors` SHALL never display profiles in any status other than `APPROVED`.

---

### Requirement 30 — Enhanced Public Tutor Directory

**User Story:** As a visitor, I want the public tutor directory to feel like a professional tutoring marketplace with clear filtering and well-structured tutor cards, so that I can confidently browse and compare tutors.

#### Acceptance Criteria

1. THE tutor directory page SHALL have a left sidebar with filters for: Subject, Student level, Teaching mode, Location, Price range (minimum and maximum hourly rate), and Language.
2. THE main content area SHALL display a search bar, a result count, a sort control, and a grid of TutorCards.
3. WHEN a filter or search is changed, THE system SHALL update the displayed TutorCards without a full page reload.
4. TutorCards SHALL display: profile photo (with accessible placeholder when absent), display name, headline, up to three subject names, a short bio excerpt (up to 200 characters), teaching mode, location (when present), languages (up to two), and hourly rate (when present).
5. TutorCards SHALL NOT display fabricated metrics including ratings, reviews, number of students, number of lessons, verification badges based on unverified data, response times, or testimonials.
6. WHEN the directory is viewed on a mobile device, THE filters SHALL be accessible via a "Filters" button that opens a drawer or sheet rather than a persistent sidebar.
7. THE directory SHALL display a result count indicating how many tutors match the current search and filter criteria.

---

### Requirement 31 — Enhanced Public Tutor Profile Page

**User Story:** As a visitor, I want a clear, professional public tutor profile page with a prominent "Request This Tutor" action, so that I can make an informed decision and easily initiate contact.

#### Acceptance Criteria

1. THE tutor profile page SHALL display in a top section: profile photo, display name, headline, location, teaching mode, hourly rate, and languages.
2. THE tutor profile page SHALL include a prominent "Request This Tutor" primary CTA and a secondary "View Subjects" anchor.
3. THE main content area SHALL display sections for: About (bio), Subjects, Student Levels, Experience, Education, Availability, and Teaching Mode.
4. THE profile page SHALL include a side panel with an "Interested in this tutor?" prompt and a "Request a Tutor" button.
5. WHEN a visitor clicks "Request This Tutor" or "Request a Tutor", THE system SHALL navigate to `/request-tutor?tutorId=<id>` preserving the tutor's ID so the request form can display the selected tutor context.
6. THE tutor profile page SHALL NOT display fabricated reviews, ratings, tutoring-hours counts, or satisfaction scores.
7. THE tutor profile page SHALL use a correct heading hierarchy and accessible image alt text compliant with WCAG 2.1 AA.

---

### Requirement 32 — Configuration-Driven Contact Values

**User Story:** As an operator, I want the Telegram and WhatsApp contact details to be configurable via environment variables, so that they can be changed without redeploying the frontend code.

#### Acceptance Criteria

1. THE Telegram contact username or link SHALL be sourced from an environment variable (e.g., `VITE_CONTACT_TELEGRAM`) and SHALL default to an empty string if not set.
2. THE WhatsApp contact number or link SHALL be sourced from an environment variable (e.g., `VITE_CONTACT_WHATSAPP`) and SHALL default to an empty string if not set.
3. WHEN the Telegram contact value is empty, THE status page SHALL NOT display a broken Telegram link.
4. WHEN the WhatsApp contact value is empty, THE status page SHALL NOT display a broken WhatsApp link.
5. THE contact values SHALL NOT be committed to version control as real account identifiers.

---

### Requirement 33 — Admin Navigation Update

**User Story:** As an admin, I want "Tutors" to appear in the admin sidebar navigation, so that I can access the tutor review queue without having to remember the URL.

#### Acceptance Criteria

1. THE AdminShell navigation SHALL include a "Tutors" link navigating to `/admin/tutors`.
2. THE "Tutors" link SHALL appear in the sidebar between "Tutor Requests" and any other items in the navigation order that makes sense for the workflow.
3. THE "Tutors" link SHALL be highlighted as active when the current path starts with `/admin/tutors`.

---

### Requirement 34 — Testing the Extended Workflow

**User Story:** As a developer, I want comprehensive tests for every new workflow element, so that regressions in the verification and review flow are caught automatically.

#### Acceptance Criteria

1. THE test suite SHALL verify that DRAFT, PENDING_REVIEW, NEEDS_INFORMATION, REJECTED, and SUSPENDED profiles are not returned by `GET /api/tutors` or `GET /api/tutors/:id`.
2. THE test suite SHALL verify that a tutor submitting from `REJECTED` or `NEEDS_INFORMATION` status transitions to `PENDING_REVIEW` and retains the existing `applicationReference`.
3. THE test suite SHALL verify that an admin rejection without a reason returns HTTP 422 and does not change the profile status.
4. THE test suite SHALL verify that an admin can save verification notes and checklist data independently of a status change.
5. THE test suite SHALL verify that the `applicationReference` is generated at submission time and is unique.
6. THE test suite SHALL verify that PATCH /api/admin/tutors/:id/status accepts NEEDS_INFORMATION as a valid target status when an admin message is provided.
7. THE test suite SHALL verify that all existing tests continue to pass after the schema migration is applied.
