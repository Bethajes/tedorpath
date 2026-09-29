# Implementation Plan

- [x] 1. Database foundation — Subject, TutorProfile, and schema migrations
  - Add `ProfileStatus`, `VerificationStatus`, `TeachingMode` enums to `backend/prisma/schema.prisma`
  - Add `Subject` model with `id`, `name`, `slug`, `category`, `description`, `active`, timestamps, and `tutorProfiles` relation
  - Add `TutorProfile` model with all fields from the design (displayName, headline, bio, location, profilePhotoUrl, teachingMode, studentLevels, languages, availability, hourlyRate, experience, education, profileStatus, verificationStatus, timestamps) and relations to `User`, `TutorProfileSubject`, and `TutorRequest`
  - Add `TutorProfileSubject` join table model
  - Extend `TutorRequest` with nullable `tutorProfileId` → `TutorProfile` (`onDelete: SetNull`)
  - Extend `User` with `tutorProfile TutorProfile?` back-relation
  - Run `prisma migrate dev` to generate the migration SQL
  - _Requirements: 1.1, 1.2, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1_

- [x] 1.1 Write property test for slug derivation utility (Property 11)
  - Install `fast-check` in the backend (`npm install --save-dev fast-check`)
  - Create `backend/tests/slugUtils.property.test.mjs`
  - **Feature: tutor-marketplace, Property 11: Subject slug derivation is URL-safe for any input name**
  - **Validates: Requirements 1.2**

- [x] 2. Subject seeding and slug utility
  - Create `backend/src/lib/slug.js` — pure function `toSlug(name)` that lowercases and replaces spaces/special chars with hyphens
  - Create `backend/prisma/seed.js` that seeds `Subject` rows from the `SUBJECTS` constant (name, slug via `toSlug`, category, description) and is guarded to refuse execution when `NODE_ENV=production`
  - Add `"db:seed": "node prisma/seed.js"` to `backend/package.json`
  - _Requirements: 1.2, 1.3, 13.1_

- [x] 2.1 Write property test for Subject active filter (Property 1 prerequisite — slug utility)
  - Extend `backend/tests/slugUtils.property.test.mjs` to verify `toSlug` produces unique slugs for the seeded subject names
  - **Feature: tutor-marketplace, Property 11: Subject slug derivation is URL-safe for any input name**
  - **Validates: Requirements 1.2**

- [x] 3. Public tutor directory API — `GET /api/tutors`
  - Create `backend/src/modules/tutors/validation.js` — Zod schema for all query parameters (`q`, `subject`, `level`, `mode`, `location`, `minRate`, `maxRate`, `sort`, `page`, `limit`)
  - Create `backend/src/modules/tutors/service.js` — `listTutors({ q, subject, level, mode, location, minRate, maxRate, sort, page, limit })` using Prisma with `profileStatus: 'APPROVED'` always applied; builds `where` and `orderBy` from params; returns `{ items: TutorCardDTO[], pagination }` using `findMany` + `count` in parallel
  - Create `backend/src/modules/tutors/controller.js` — `listTutorsHandler(req, res)` calling validation then service
  - Create `backend/src/modules/tutors/index.js` — `Router` with `GET /` → `listTutorsHandler`
  - Mount in `backend/src/app.js` as `app.use('/api/tutors', tutorsRouter)`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11_

- [x] 3.1 Write property test: only APPROVED profiles returned (Property 1)
  - Create `backend/tests/tutors.property.test.mjs`
  - **Feature: tutor-marketplace, Property 1: Only approved profiles appear in the public directory**
  - **Validates: Requirements 4.1**

- [x] 3.2 Write property test: filter correctness (Property 2)
  - Add to `backend/tests/tutors.property.test.mjs`
  - **Feature: tutor-marketplace, Property 2: Applied filters are always satisfied by every returned profile**
  - **Validates: Requirements 4.3, 4.4, 4.5, 4.6, 4.7**

- [x] 3.3 Write property test: pagination envelope consistency (Property 3)
  - Add to `backend/tests/tutors.property.test.mjs`
  - **Feature: tutor-marketplace, Property 3: Pagination envelope is mathematically consistent**
  - **Validates: Requirements 4.8, 4.11**

- [x] 3.4 Write property test: sort order invariant (Property 4)
  - Add to `backend/tests/tutors.property.test.mjs`
  - **Feature: tutor-marketplace, Property 4: Sorting order invariant**
  - **Validates: Requirements 4.9, 4.10**

- [x] 3.5 Write unit tests for tutor directory API
  - Create `backend/tests/tutors.api.test.mjs`
  - Cover: empty result, search by q, each individual filter, combined filters, pagination, sort modes, invalid params rejected, limit capped at 100, only APPROVED returned
  - _Requirements: 4.1–4.11_

- [x] 4. Public tutor profile API — `GET /api/tutors/:id`
  - Add `getTutorById(id)` to `backend/src/modules/tutors/service.js` — selects TutorDetailDTO fields, filters `profileStatus = APPROVED`, returns `null` for not-found or non-approved
  - Add `getTutorHandler(req, res)` to `backend/src/modules/tutors/controller.js` — returns 404 when service returns `null`
  - Add `GET /:id` route in `backend/src/modules/tutors/index.js`
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 4.1 Write property test: private fields never exposed (Property 5)
  - Add to `backend/tests/tutors.property.test.mjs`
  - **Feature: tutor-marketplace, Property 5: Public API responses never contain private fields**
  - **Validates: Requirements 2.8, 5.4, 16.1**

- [x] 4.2 Write unit tests for tutor profile API
  - Add to `backend/tests/tutors.api.test.mjs`
  - Cover: valid approved profile, non-existent ID (404), DRAFT/PENDING/SUSPENDED/REJECTED IDs (all 404), private fields absent from response
  - _Requirements: 5.1–5.4_

- [x] 5. Checkpoint — ensure all tests pass, ask the user if questions arise.

- [ ] 6. Authenticated tutor profile management API
  - Create `backend/src/modules/tutorProfile/validation.js` — Zod schemas for create and patch payloads
  - Create `backend/src/modules/tutorProfile/service.js`:
    - `createTutorProfile(userId, data)` — creates with `profileStatus: DRAFT`, returns 409 if profile already exists for userId
    - `updateTutorProfile(userId, data)` — partial update, verifies ownership server-side, returns 403 if userId doesn't match
    - `getMyTutorProfile(userId)` — returns full profile including draft fields
    - `submitTutorProfile(userId)` — validates completeness (displayName, headline, bio, ≥1 subject, ≥1 level, teachingMode, hourlyRate), transitions to PENDING_REVIEW or returns 422 with missing field list
  - Create `backend/src/modules/tutorProfile/controller.js` with handlers for each operation
  - Create `backend/src/modules/tutorProfile/index.js` — Router with all routes behind `requireAuth`
  - Mount in `backend/src/app.js` as `app.use('/api/tutor-profile', tutorProfileRouter)`
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [ ] 6.1 Write property test: new profile defaults to DRAFT (Property 6)
  - Create `backend/tests/tutorProfile.property.test.mjs`
  - **Feature: tutor-marketplace, Property 6: New profile always defaults to DRAFT**
  - **Validates: Requirements 2.3, 2.4, 6.1**

- [ ] 6.2 Write property test: partial update correctness (Property 7)
  - Add to `backend/tests/tutorProfile.property.test.mjs`
  - **Feature: tutor-marketplace, Property 7: Partial update touches only specified fields**
  - **Validates: Requirements 6.3**

- [ ] 6.3 Write property test: ownership enforcement (Property 8)
  - Add to `backend/tests/tutorProfile.property.test.mjs`
  - **Feature: tutor-marketplace, Property 8: Profile ownership is enforced server-side**
  - **Validates: Requirements 6.4, 16.2, 16.3**

- [ ] 6.4 Write unit tests for tutor profile management API
  - Create `backend/tests/tutorProfile.api.test.mjs`
  - Cover: create requires auth, duplicate create returns 409, patch updates only specified fields, patch by non-owner returns 403, /me returns correct profile, submit with complete profile succeeds, submit with missing fields returns 422
  - _Requirements: 6.1–6.7_

- [ ] 7. Admin tutor moderation API
  - Create `backend/src/modules/adminTutors/service.js`:
    - `listTutorProfiles({ page, limit, status })` — returns all profiles with pagination
    - `getTutorProfileAdmin(id)` — returns full profile including moderation fields
    - `updateTutorProfileStatus(id, status)` — validates status is APPROVED/REJECTED/SUSPENDED, updates, returns 422 for invalid status
  - Create `backend/src/modules/adminTutors/controller.js` with handlers
  - Create `backend/src/modules/adminTutors/index.js` — Router with all routes behind `requireAdmin`
  - Mount in `backend/src/app.js` inside the existing `/api/admin` prefix
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 7.1 Write unit tests for admin tutor moderation API
  - Create `backend/tests/adminTutors.api.test.mjs`
  - Cover: list requires admin token, detail requires admin token, valid status change applied, invalid status rejected with 422, APPROVED does not automatically set verificationStatus to VERIFIED unless payload says so
  - _Requirements: 7.1–7.5_

- [ ] 8. TutorRequest backward compatibility — tutorProfileId extension
  - Update `backend/src/modules/tutorRequests/validation.js` to accept optional `tutorProfileId` (UUID string or null)
  - Update `backend/src/modules/tutorRequests/service.js` `createTutorRequest` to accept and persist `tutorProfileId`; if provided, verify the referenced TutorProfile exists (any status is fine — the client already chose them); return 400 if not found
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 8.1 Write property test: subject round-trip (Property 12)
  - Add to `backend/tests/tutors.property.test.mjs`
  - **Feature: tutor-marketplace, Property 12: Subject-to-profile many-to-many relationship round-trips**
  - **Validates: Requirements 1.5, 2.5**

- [ ] 8.2 Write unit tests for TutorRequest tutorProfileId integration
  - Add to `backend/tests/tutors.api.test.mjs` (or a new file)
  - Cover: general request (no tutorProfileId) still works, request with valid tutorProfileId links correctly, request with non-existent UUID returns 400
  - _Requirements: 3.2, 3.3, 3.4_

- [ ] 9. Development seed data
  - Extend `backend/prisma/seed.js` to create 3 demo TutorProfiles (displayName: "Demo Tutor 1/2/3") each with APPROVED status, linked subjects, levels, and teachingMode, guarded behind `NODE_ENV !== 'production'` check
  - Create 3 demo User rows for the seed profiles (email: `demo1@dev.local`, etc.) only if not already present
  - Log a warning and exit without creating records if `NODE_ENV=production`
  - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [ ] 10. Checkpoint — ensure all tests pass, ask the user if questions arise.

- [ ] 11. Frontend types and API client for tutors
  - Create `frontend/src/features/tutors/tutors.types.ts` with `TutorCardDTO`, `TutorDetailDTO`, `TutorFilters`, `TutorListResponse`, `TutorSortOption` TypeScript types matching the API contracts in the design document
  - Create `frontend/src/features/tutors/tutors.api.ts` with `listTutors(filters, page, limit)` and `getTutor(id)` functions using the existing `api.ts` fetch wrapper
  - _Requirements: 4.8, 5.1, 8.1_

- [ ] 12. TutorCard component
  - Create `frontend/src/features/tutors/components/TutorCard.tsx`
  - Display: profile photo (with accessible `alt` and placeholder avatar when `profilePhotoUrl` is null), displayName, headline, up to 2 subject names, teachingMode badge, location (when present), hourlyRate (when present), "View Profile" button navigating to `/tutors/:id`
  - Apply Tedor design: white background, subtle border, shadow, 16–20 px border-radius, Tedor blue CTA
  - No fabricated metrics
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 12.1 Write property test: TutorCard renders required fields (Property 9)
  - Install `fast-check` in the frontend (`npm install --save-dev fast-check`)
  - Create `frontend/src/features/tutors/components/TutorCard.test.tsx`
  - **Feature: tutor-marketplace, Property 9: TutorCard renders all required public fields**
  - **Validates: Requirements 9.1, 9.4**

- [ ] 13. EmptyState component
  - Create `frontend/src/features/tutors/components/EmptyState.tsx`
  - Display: heading "Find the right tutor", descriptive message, "Request a Tutor" CTA linking to `/request-tutor`
  - Accept optional `isFiltered` prop to vary message ("No tutors match these filters" vs. "No tutors available yet")
  - _Requirements: 8.2, 19_

- [ ] 14. FilterPanel component
  - Create `frontend/src/features/tutors/components/FilterPanel.tsx`
  - Controls: Subject (select from active subjects), Level (select from EDUCATION_LEVELS), Teaching Mode (ONLINE/IN_PERSON/BOTH), Location (text), Hourly Rate range (min/max numeric inputs)
  - On desktop: renders as a sidebar
  - On mobile: renders as a slide-in drawer/sheet triggered by a "Filters" button
  - Each filter change calls an `onChange` callback; does not directly fetch
  - Full keyboard navigation and ARIA labels on all controls
  - _Requirements: 8.7, 8.8, 10.1–10.5_

- [ ] 15. TutorDirectoryPage — `/tutors`
  - Create `frontend/src/features/tutors/TutorDirectoryPage.tsx`
  - Layout: page heading, search bar (`q` param), `FilterPanel` sidebar/drawer, sort dropdown, paginated grid of `TutorCard` components, `EmptyState` when items is empty
  - Reads URL search params on mount to initialize filter and search state (supports `/tutors?subject=mathematics` deep-linking from homepage)
  - On search/filter change, updates URL search params and fetches via `tutors.api.ts`
  - Shows loading skeleton while fetch is in flight
  - Pagination controls update `page` param
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

- [ ] 15.1 Write unit tests for TutorDirectoryPage
  - Create `frontend/src/features/tutors/TutorDirectoryPage.test.tsx`
  - Cover: renders search bar and filter panel, shows TutorCards when API returns data, shows EmptyState when API returns empty items, loading indicator while fetching, filter changes update URL params, pagination controls work
  - _Requirements: 8.1–8.8_

- [ ] 16. TutorProfilePage — `/tutors/:id`
  - Create `frontend/src/features/tutorProfile/TutorProfilePage.tsx`
  - Layout: profile photo, displayName, headline, full bio, subjects list, student levels, teaching mode, location, hourly rate, education, experience, languages, availability, "Request This Tutor" button
  - "Request This Tutor" — if authenticated: navigate to `/request-tutor?tutorId=<id>`; if not authenticated: navigate to `/login` with state `{ from: '/request-tutor?tutorId=<id>' }` so `RequireAuth` / `LoginPage` redirect correctly after sign-in
  - Fetches via `getTutor(id)`; renders `NotFoundPage` on 404
  - No fabricated reviews or metrics
  - Correct heading hierarchy, accessible image alt text
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 12.1, 12.2, 12.3_

- [ ] 16.1 Write property test: profile page renders all required fields (Property 10)
  - Create `frontend/src/features/tutorProfile/TutorProfilePage.test.tsx`
  - **Feature: tutor-marketplace, Property 10: Tutor profile page renders all public profile fields**
  - **Validates: Requirements 10.1, 10.3**

- [ ] 17. Register `/tutors` and `/tutors/:id` routes
  - Add `TutorDirectoryPage` and `TutorProfilePage` as lazy-loaded exports in `frontend/src/app/publicPages.tsx`
  - Add `{ path: '/tutors', element: <TutorDirectoryPage /> }` and `{ path: '/tutors/:id', element: <TutorProfilePage /> }` to `frontend/src/app/router.tsx`
  - Verify all existing routes still resolve correctly
  - _Requirements: 8.1, 10.1_

- [ ] 18. Checkpoint — ensure all tests pass, ask the user if questions arise.

- [ ] 19. Tutor onboarding flow — `/become-a-tutor`
  - Create `frontend/src/features/tutorOnboarding/tutorOnboarding.types.ts` — step data types and wizard state
  - Create `frontend/src/features/tutorOnboarding/tutorOnboarding.api.ts` — wrappers for `POST /api/tutor-profile`, `PATCH /api/tutor-profile`, `GET /api/tutor-profile/me`, `POST /api/tutor-profile/submit`
  - Create `frontend/src/features/tutorOnboarding/steps/` directory with one component per step:
    - `BasicInfoStep.tsx` (displayName, headline, bio, location, profilePhotoUrl)
    - `SubjectsStep.tsx` (multi-select from active subjects)
    - `LevelsStep.tsx` (multi-select from EDUCATION_LEVELS)
    - `TeachingModeStep.tsx` (ONLINE/IN_PERSON/BOTH + location hint)
    - `ExperienceStep.tsx` (experience text area)
    - `EducationStep.tsx` (education text area)
    - `PricingStep.tsx` (hourlyRate, languages, availability)
    - `ProfilePreviewStep.tsx` (read-only summary before submit)
  - Create `frontend/src/features/tutorOnboarding/TutorOnboardingPage.tsx` — wizard shell that: checks auth (redirects to login with `?next=/become-a-tutor` if not signed in), loads existing DRAFT from `/api/tutor-profile/me` if present, steps through the 8 steps, auto-saves on step navigation via `PATCH /api/tutor-profile`, calls `POST /api/tutor-profile/submit` on final step, shows validation errors from API
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 20. Register `/become-a-tutor` route
  - Add `TutorOnboardingPage` as a lazy export in `publicPages.tsx`
  - Add `{ path: '/become-a-tutor', element: <TutorOnboardingPage /> }` to `router.tsx`
  - _Requirements: 11.1_

- [ ] 21. Homepage integration
  - Update the "Find a Tutor" CTA button/link in `frontend/src/pages/HomePage.tsx` (or the relevant component) to navigate to `/tutors`
  - Update each subject card in `frontend/src/components/home/SubjectGrid.tsx` (or equivalent) to navigate to `/tutors?subject=<slug>` where the slug is derived from the subject name
  - The `Other` subject card should link to `/request-tutor` instead of the directory
  - _Requirements: 14.1, 14.2, 14.3_

- [ ] 22. Navbar update
  - Update `frontend/src/components/layout/Navbar.tsx` to include "Find a Tutor" link (`/tutors`) and "Become a Tutor" link (`/become-a-tutor`)
  - Ensure mobile nav menu includes both new links
  - Keep all existing nav items (How It Works, About, Sign in/User menu, etc.)
  - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [ ] 23. Final Checkpoint — ensure all tests pass, ask the user if questions arise.
