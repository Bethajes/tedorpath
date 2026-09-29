# Requirements Document

## Introduction

Tedor Tutors is expanding from a simple tutor-request website into a real tutoring marketplace. This feature introduces a public tutor directory at `/tutors`, individual tutor profile pages at `/tutors/:id`, a tutor onboarding flow at `/become-a-tutor`, admin moderation for tutor profiles, and deep integration with the existing tutor-request form. The feature is built in phased chunks: database models first, then backend APIs, then frontend UI, then onboarding, admin moderation, and finally homepage integration. All existing routes, authentication, and admin functionality must remain intact.

## Glossary

- **TutorProfile**: The database record containing a tutor's public-facing professional information, linked one-to-one with a User.
- **Subject**: A database-backed topic a tutor can teach (e.g., Mathematics, Physics). Derived from the project's existing `SUBJECTS` constant.
- **StudentLevel**: The learner level a tutor supports (e.g., Primary School, High School, University). Derived from the existing `EDUCATION_LEVELS` constant.
- **TeachingMode**: The delivery method a tutor offers — `ONLINE`, `IN_PERSON`, or `BOTH`.
- **ProfileStatus**: The lifecycle state of a TutorProfile: `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `SUSPENDED`, or `REJECTED`.
- **VerificationStatus**: Whether the admin team has verified a tutor's stated credentials: `UNVERIFIED` or `VERIFIED`.
- **TutorDirectory**: The public page at `/tutors` listing all approved TutorProfiles.
- **TutorCard**: A reusable frontend component representing one TutorProfile in a list.
- **TutorRequest**: The existing model for client-submitted tutoring requests. Remains fully functional and gains an optional `tutorProfileId` foreign key.
- **Seed Data**: Clearly-marked demo TutorProfiles created only in development environments. Never exposed in production.
- **Pagination**: Server-side page/limit slicing of query results. Maximum `limit` of 100; default 12.
- **Admin**: A user with `UserRole.ADMIN` or a request carrying the shared admin token, as protected by the existing `requireAdmin` middleware.
- **Authenticated User**: A request carrying a valid, unexpired, unrevoked session cookie validated by the existing `requireAuth` middleware.
- **Slug**: A URL-safe lowercase hyphenated string uniquely identifying a Subject (e.g., `mathematics`, `ai-technology`).

---

## Requirements

### Requirement 1 — Subject Model

**User Story:** As a developer, I want a single database-backed Subject model derived from the existing `SUBJECTS` constant, so that tutor profiles and the request form always share the same list of supported topics without duplication.

#### Acceptance Criteria

1. THE Subject model SHALL store `id`, `name`, `slug`, `category`, `description`, and `active` fields.
2. WHEN a Subject record is created, THE system SHALL derive the `slug` from `name` by lowercasing and replacing spaces and special characters with hyphens, and SHALL enforce uniqueness on `slug`.
3. THE system SHALL seed the Subject table with exactly the subjects already present in the backend `SUBJECTS` constant: Mathematics, Physics, Chemistry, Biology, English, Programming, AI & Technology, University Course, Exam Preparation, and Other.
4. WHEN a Subject is marked `active = false`, THE system SHALL exclude that Subject from all public-facing subject lists and filter options.
5. THE Subject model SHALL support a many-to-many relationship with TutorProfile so that one tutor can teach multiple subjects.

---

### Requirement 2 — TutorProfile Model

**User Story:** As a developer, I want a TutorProfile model linked to the existing User model, so that Tedor can store and manage tutor-specific information without modifying the core user authentication data.

#### Acceptance Criteria

1. THE TutorProfile model SHALL be linked one-to-one with the existing User model via a non-nullable `userId` foreign key with `onDelete: Cascade`.
2. THE TutorProfile model SHALL store: `displayName`, `headline`, `bio`, `location`, `profilePhotoUrl`, `hourlyRate`, `experience`, `education`, `languages`, `availability`, `profileStatus`, `verificationStatus`, `createdAt`, and `updatedAt`.
3. THE TutorProfile model SHALL store `profileStatus` as an enum with values `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `SUSPENDED`, and `REJECTED`, defaulting to `DRAFT`.
4. THE TutorProfile model SHALL store `verificationStatus` as an enum with values `UNVERIFIED` and `VERIFIED`, defaulting to `UNVERIFIED`.
5. THE TutorProfile model SHALL support a many-to-many relationship with Subject through a join table.
6. THE TutorProfile model SHALL support a many-to-many relationship with StudentLevel, using the levels already defined in the backend `EDUCATION_LEVELS` constant.
7. THE TutorProfile model SHALL store `teachingMode` as an enum with values `ONLINE`, `IN_PERSON`, and `BOTH`.
8. WHEN a TutorProfile is retrieved for public display, THE system SHALL exclude all private User fields: `passwordHash`, session tokens, `emailVerifiedAt`, `phoneVerifiedAt`, admin notes, and internal moderation data.

---

### Requirement 3 — TutorRequest Integration

**User Story:** As a client, I want the option to link a tutor-request to a specific TutorProfile I found in the directory, so that the Tedor team knows exactly which tutor I want.

#### Acceptance Criteria

1. THE TutorRequest model SHALL gain a nullable `tutorProfileId` foreign key referencing TutorProfile, with `onDelete: SetNull`.
2. WHEN a TutorRequest is submitted without a `tutorProfileId`, THE system SHALL accept and persist it exactly as before, maintaining full backward compatibility with the existing request form.
3. WHEN a TutorRequest is submitted with a valid `tutorProfileId`, THE system SHALL link the request to the referenced TutorProfile.
4. WHEN a `tutorProfileId` is provided that does not reference an existing TutorProfile, THE system SHALL reject the request with a validation error.
5. THE `/request-tutor` page SHALL accept an optional `?tutorId=` query parameter and pre-populate the selected tutor context in the form.

---

### Requirement 4 — Tutor Directory API

**User Story:** As a visitor, I want to search and filter approved tutors through a backend API, so that the browser does not download every profile and filtering happens efficiently in PostgreSQL.

#### Acceptance Criteria

1. THE system SHALL expose `GET /api/tutors` returning only TutorProfiles with `profileStatus = APPROVED`.
2. WHEN `GET /api/tutors` is called with a `q` query parameter, THE system SHALL return TutorProfiles whose subjects, `headline`, or `displayName` match the search term using a case-insensitive PostgreSQL query.
3. WHEN `GET /api/tutors` is called with a `subject` query parameter, THE system SHALL return only TutorProfiles linked to a Subject whose `slug` matches the parameter value.
4. WHEN `GET /api/tutors` is called with a `level` query parameter, THE system SHALL return only TutorProfiles that support the specified StudentLevel.
5. WHEN `GET /api/tutors` is called with a `mode` query parameter of `ONLINE`, `IN_PERSON`, or `BOTH`, THE system SHALL return only TutorProfiles with a matching `teachingMode`.
6. WHEN `GET /api/tutors` is called with a `location` query parameter, THE system SHALL return only TutorProfiles whose `location` field contains the search term using a case-insensitive match.
7. WHEN `GET /api/tutors` is called with a `minRate` or `maxRate` query parameter, THE system SHALL return only TutorProfiles whose `hourlyRate` falls within the specified range.
8. THE `GET /api/tutors` endpoint SHALL support `page` and `limit` query parameters, with `limit` capped at 100 and a default of 12, and SHALL return a pagination envelope: `{ success, data: { items, pagination: { page, limit, total, totalPages } } }`.
9. THE `GET /api/tutors` endpoint SHALL support a `sort` query parameter with values `recommended`, `price_asc`, `price_desc`, and `newest`.
10. WHEN `sort=recommended` is used, THE system SHALL order results by a deterministic relevance score: exact subject match first, then text match in headline, then most recently approved.
11. IF `GET /api/tutors` returns zero results, THE system SHALL return `{ success: true, data: { items: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } } }` rather than an error.

---

### Requirement 5 — Tutor Profile API

**User Story:** As a visitor, I want to fetch a single tutor's public profile, so that I can read their full details before deciding to request them.

#### Acceptance Criteria

1. THE system SHALL expose `GET /api/tutors/:id` returning the full public TutorProfile for the specified `id`.
2. WHEN `GET /api/tutors/:id` is called for a TutorProfile whose `profileStatus` is not `APPROVED`, THE system SHALL return HTTP 404.
3. WHEN `GET /api/tutors/:id` is called with an `id` that does not exist, THE system SHALL return HTTP 404.
4. THE `GET /api/tutors/:id` response SHALL include related subjects, supported levels, and teaching mode, but SHALL exclude all private User fields listed in Requirement 2.8.

---

### Requirement 6 — Tutor Profile Management API

**User Story:** As a tutor, I want to create and edit my own profile through authenticated API endpoints, so that I control my marketplace presence while Tedor controls what gets approved.

#### Acceptance Criteria

1. WHEN an authenticated user calls `POST /api/tutor-profile`, THE system SHALL create a TutorProfile linked to that user's `id` with `profileStatus = DRAFT`.
2. WHEN an authenticated user calls `POST /api/tutor-profile` and a TutorProfile already exists for that user, THE system SHALL return HTTP 409 Conflict.
3. WHEN an authenticated user calls `PATCH /api/tutor-profile`, THE system SHALL update only the fields present in the request body for the TutorProfile owned by the authenticated user.
4. WHEN a user attempts to `PATCH` a TutorProfile they do not own by modifying the identifier in the request, THE system SHALL reject the request with HTTP 403 Forbidden.
5. THE system SHALL expose `GET /api/tutor-profile/me` returning the full TutorProfile (including draft fields) for the authenticated user.
6. WHEN an authenticated user calls `POST /api/tutor-profile/submit`, THE system SHALL transition the TutorProfile `profileStatus` from `DRAFT` to `PENDING_REVIEW` if the profile meets minimum completeness requirements: `displayName`, `headline`, `bio`, at least one subject, at least one student level, `teachingMode`, and `hourlyRate`.
7. WHEN `POST /api/tutor-profile/submit` is called and the profile does not meet minimum completeness, THE system SHALL return HTTP 422 with a list of the missing fields.

---

### Requirement 7 — Admin Tutor Moderation API

**User Story:** As an admin, I want to list, review, and change the status of tutor profiles, so that only suitable tutors become publicly visible in the marketplace.

#### Acceptance Criteria

1. THE system SHALL expose `GET /api/admin/tutors` protected by the existing `requireAdmin` middleware, returning all TutorProfiles with full detail.
2. THE system SHALL expose `GET /api/admin/tutors/:id` protected by `requireAdmin`, returning a single TutorProfile including moderation history fields.
3. THE system SHALL expose `PATCH /api/admin/tutors/:id/status` protected by `requireAdmin`, accepting a `status` field of `APPROVED`, `REJECTED`, or `SUSPENDED`.
4. WHEN `PATCH /api/admin/tutors/:id/status` is called with a value not in the allowed set, THE system SHALL return HTTP 422.
5. WHEN a TutorProfile status is changed to `APPROVED`, THE system SHALL set `verificationStatus` to `VERIFIED` only when explicitly indicated by the admin payload; otherwise `verificationStatus` remains unchanged.

---

### Requirement 8 — Public Tutor Directory Page

**User Story:** As a visitor, I want to browse a responsive tutor directory at `/tutors` with search and filter controls, so that I can discover tutors appropriate to my needs.

#### Acceptance Criteria

1. WHEN a visitor navigates to `/tutors`, THE system SHALL display a search bar, a filter panel, and a list of TutorCards.
2. WHEN the tutor list is empty for the current search and filter state, THE system SHALL display a professional empty state with a call-to-action linking to `/request-tutor`.
3. WHEN a visitor submits a search query, THE system SHALL send the query to `GET /api/tutors` as the `q` parameter and update the displayed TutorCards without a full page reload.
4. WHEN a visitor selects a filter value, THE system SHALL include the corresponding query parameter in the next `GET /api/tutors` call.
5. THE directory page SHALL support pagination controls that update the `page` parameter sent to the API.
6. WHILE the API call is in flight, THE system SHALL display a loading indicator in place of TutorCards.
7. THE directory page SHALL be fully responsive: on mobile, filters SHALL open as a drawer/sheet rather than a sidebar.
8. THE directory page SHALL comply with WCAG 2.1 AA: semantic HTML, keyboard-navigable filters and cards, visible focus states, and proper ARIA labels on interactive controls.

---

### Requirement 9 — TutorCard Component

**User Story:** As a visitor, I want each tutor to be shown in a clear, consistent card, so that I can quickly compare tutors without opening each profile.

#### Acceptance Criteria

1. THE TutorCard component SHALL display: profile photo (with alt text), display name, headline, up to two subject names, teaching mode indicator, location (when present), and hourly rate (when present).
2. WHEN a TutorProfile has no `profilePhotoUrl`, THE TutorCard SHALL display a placeholder avatar that does not show a broken image.
3. THE TutorCard SHALL include a "View Profile" button that navigates to `/tutors/:id`.
4. THE TutorCard SHALL not display any fabricated metrics: no star ratings, no "hours taught" counts, no satisfaction percentages, and no testimonials unless backed by real data models.
5. THE TutorCard SHALL use the Tedor design system: white background, subtle border, box shadow, 16–20 px border-radius, Tedor blue for the primary CTA, and Tedor orange as an optional accent.

---

### Requirement 10 — Tutor Profile Page

**User Story:** As a visitor, I want to read a tutor's full profile at `/tutors/:id`, so that I have enough information to decide whether to request them.

#### Acceptance Criteria

1. WHEN a visitor navigates to `/tutors/:id` for an approved tutor, THE system SHALL display: profile photo, display name, headline, full bio, subjects list, student levels list, teaching mode, location (when present), hourly rate (when present), education, and experience.
2. WHEN a visitor navigates to `/tutors/:id` for a tutor that does not exist or whose profile is not `APPROVED`, THE system SHALL display the existing 404 page.
3. THE tutor profile page SHALL include a "Request This Tutor" button that links to `/request-tutor?tutorId=<id>`.
4. THE tutor profile page SHALL not display fabricated reviews, ratings, tutoring-hours counts, or satisfaction scores.
5. THE tutor profile page SHALL comply with WCAG 2.1 AA requirements including a correct heading hierarchy and accessible image alt text.

---

### Requirement 11 — Tutor Onboarding Flow

**User Story:** As a prospective tutor, I want a guided multi-step onboarding flow at `/become-a-tutor`, so that I can build my profile incrementally and submit it for Tedor review.

#### Acceptance Criteria

1. WHEN an unauthenticated visitor navigates to `/become-a-tutor`, THE system SHALL redirect them to the login page and return them to `/become-a-tutor` after authentication.
2. THE onboarding flow SHALL be divided into discrete steps: Basic Information, Teaching Subjects, Student Levels, Teaching Mode, Experience, Education, Pricing, and Profile Preview.
3. WHEN a user completes the final step and clicks "Submit for Review", THE system SHALL call `POST /api/tutor-profile/submit` and transition the profile to `PENDING_REVIEW`.
4. WHEN the profile does not meet the completeness requirements defined in Requirement 6.6, THE system SHALL display the list of missing fields and prevent submission.
5. WHEN a user returns to `/become-a-tutor` with an existing DRAFT profile, THE system SHALL load and display their saved progress.

---

### Requirement 12 — Authentication Gate for Requesting a Tutor

**User Story:** As a visitor, I want to be able to browse tutors without logging in, but when I click "Request This Tutor" I want a smooth prompt to sign in that preserves my tutor selection.

#### Acceptance Criteria

1. THE `/tutors` and `/tutors/:id` pages SHALL be accessible without authentication.
2. WHEN an unauthenticated visitor clicks "Request This Tutor" on a tutor profile, THE system SHALL redirect to the login page with a `?next=/request-tutor?tutorId=<id>` parameter so the intended destination is preserved.
3. WHEN the user completes authentication, THE system SHALL redirect them to the originally intended `/request-tutor?tutorId=<id>` URL.

---

### Requirement 13 — Development Seed Data

**User Story:** As a developer, I want a seed script that creates clearly-marked demo TutorProfiles in development, so that I can test the directory and profile pages without real tutor data.

#### Acceptance Criteria

1. THE seed script SHALL create demo TutorProfiles only when the `NODE_ENV` environment variable is not `production`.
2. THE seed script SHALL use obviously fictional identities: names such as "Demo Tutor 1", "Demo Tutor 2", and "Demo Tutor 3".
3. THE seed script SHALL mark each demo profile with a `displayName` prefix of "Demo" so they are trivially identifiable.
4. WHEN the seed script is executed in a `production` environment, THE system SHALL log a warning and exit without creating any records.

---

### Requirement 14 — Homepage Integration

**User Story:** As a visitor, I want the homepage "Find a Tutor" CTA and subject cards to link directly into the tutor directory, so that the homepage is a natural entry point to the marketplace.

#### Acceptance Criteria

1. WHEN a visitor clicks the "Find a Tutor" CTA on the homepage, THE system SHALL navigate to `/tutors`.
2. WHEN a visitor clicks a subject card on the homepage (e.g., Mathematics), THE system SHALL navigate to `/tutors?subject=<slug>` (e.g., `/tutors?subject=mathematics`).
3. THE `Other` subject entry on the homepage SHALL link to `/request-tutor` rather than the tutor directory.

---

### Requirement 15 — Navigation Update

**User Story:** As a visitor, I want the site navigation to include "Find a Tutor" and "Become a Tutor" links, so that the marketplace is discoverable from every page.

#### Acceptance Criteria

1. THE navbar SHALL include a "Find a Tutor" link navigating to `/tutors`.
2. THE navbar SHALL include a "Become a Tutor" link navigating to `/become-a-tutor`.
3. THE navbar SHALL remain fully responsive on mobile with a proper navigation menu.
4. THE existing navigation links (How It Works, About, and any admin links) SHALL remain present and functional.

---

### Requirement 16 — Security and Data Privacy

**User Story:** As a user, I want the public tutor API to expose only safe profile information, so that private authentication data and internal records are never leaked.

#### Acceptance Criteria

1. THE `GET /api/tutors` and `GET /api/tutors/:id` endpoints SHALL never include: `passwordHash`, session tokens, `emailVerifiedAt`, `phoneVerifiedAt`, raw email address, phone number, or admin notes in any response.
2. THE `PATCH /api/tutor-profile` endpoint SHALL verify server-side that the authenticated user owns the TutorProfile before applying any changes.
3. WHEN a `PATCH /api/tutor-profile` request references a TutorProfile belonging to a different user, THE system SHALL return HTTP 403 without modifying any data.
4. THE `GET /api/admin/tutors` and related admin endpoints SHALL be protected by the existing `requireAdmin` middleware and SHALL return HTTP 401 for unauthenticated requests.
