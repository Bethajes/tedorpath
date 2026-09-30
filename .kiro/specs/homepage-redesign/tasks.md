# Implementation Plan — Homepage Redesign

- [ ] 1. Backend: Add public stats endpoint
  - Create `backend/src/modules/tutors/statsController.js` with a `getPublicStats` handler that queries: COUNT of APPROVED tutor_profiles, COUNT of active subjects, COUNT of distinct non-null locations from APPROVED profiles
  - Register `GET /stats` route in `backend/src/modules/tutors/index.js`
  - The response shape must be `{ success: true, data: { approvedTutors, subjects, universities, countries } }`
  - All counts are computed from real database records via Prisma — no hardcoded values
  - _Requirements: 4.2, 4.4_

- [ ] 1.1 Write unit test for public stats endpoint
  - Add a test to `backend/tests/tutors.api.test.mjs` covering: endpoint returns 200 with the correct envelope shape, all four count fields are non-negative integers, no authentication required
  - _Requirements: 4.2, 4.4_

- [ ] 2. Frontend data file: universities.ts
  - Create `frontend/src/data/universities.ts` exporting `UNIVERSITIES: UniversityEntry[]` with entries for Addis Ababa University (`/universities/aau.png`) and Addis Ababa Science and Technology University (`/universities/aastu.png`)
  - Create the directory `frontend/public/universities/`
  - Add placeholder SVG logo files at `frontend/public/universities/aau.svg` and `frontend/public/universities/aastu.svg` using simple text-based SVG with the university abbreviation — no external images required
  - Export the `UniversityEntry` interface `{ name: string; logo: string }`
  - _Requirements: 3.5, 3.6, 3.7_

- [ ] 3. Frontend API utility: public stats
  - Add `getPublicStats(): Promise<PublicStats>` to `frontend/src/features/tutors/tutors.api.ts` using the existing `getJson` helper calling `/api/public/stats`
  - Add the `PublicStats` interface to `frontend/src/features/tutors/tutors.types.ts`
  - _Requirements: 4.2_

- [ ] 4. New component: UniversityTrustStrip
  - Create `frontend/src/components/home/UniversityTrustStrip.tsx`
  - Map over `UNIVERSITIES` from the data file and render each as a greyscale `<img>` that transitions to colour on hover
  - Each `<img>` must have an `onError` handler that hides the container when the image 404s
  - Heading text: "Tutors with backgrounds from" (no partnership claims)
  - Horizontal scrollable on mobile, fixed row on desktop
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7, 3.8, 3.9_

- [ ] 4.1 Write unit test for UniversityTrustStrip
  - Create `frontend/src/components/home/UniversityTrustStrip.test.tsx`
  - Test: heading does not contain "partner", each university name from UNIVERSITIES appears in the DOM, component renders without error when UNIVERSITIES is empty
  - **Feature: homepage-redesign, Property 5: University trust strip uses only data-file entries**
  - **Validates: Requirements 3.5, 3.7**

- [ ] 5. New component: StatsSection
  - Create `frontend/src/components/home/StatsSection.tsx`
  - On mount, call `getPublicStats()` and store results in local state (useEffect + useState, not useAsyncData — stats are enhancement not critical)
  - Render 4 stat cards in a 2×2 grid on mobile, 4-column row on desktop
  - For each stat: when count > 0 display the count as a large number with a label; when count === 0 or API fails, display honest fallback text ("Growing", "Many", "Several", "Multiple")
  - No fabricated numbers
  - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

- [ ] 5.1 Write property test for StatsSection
  - Add to `frontend/src/pages/HomePage.test.tsx` (or create `frontend/src/components/home/StatsSection.test.tsx`)
  - Use fast-check to generate random PublicStats objects (non-negative integers), stub `getPublicStats`, verify non-zero counts appear in rendered output and zero counts do not appear as "0 tutors" / "0 subjects" etc.
  - **Feature: homepage-redesign, Property 4: Stats section displays API values or honest fallback**
  - **Validates: Requirements 4.2, 4.3**

- [ ] 6. New component: VerificationSteps
  - Create `frontend/src/components/home/VerificationSteps.tsx`
  - Render 4 numbered steps with titles and descriptions reflecting the actual workflow (apply → review → credentials reviewed → approved goes live)
  - No mention of automated background checks, instant verification, or certificates the platform doesn't perform
  - Optional "Learn how tutor approval works" link → `/become-a-tutor`
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ] 7. New component: FeaturedTutors
  - Create `frontend/src/components/home/FeaturedTutors.tsx`
  - On mount, call `listTutors({}, 1, 6)` from the existing `tutors.api.ts`
  - Render results using the existing `TutorCard` component from `frontend/src/features/tutors/components/TutorCard.tsx`
  - Desktop: 3-column grid; mobile: 1-column
  - Empty state: "Tutor profiles are being reviewed. Check back soon." — shown when 0 results or API error
  - "View all tutors" link → `/tutors`
  - No fabricated data; no hardcoded tutor info
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [ ] 7.1 Write property test for FeaturedTutors
  - Create or add to `frontend/src/pages/HomePage.test.tsx`
  - Use fast-check to generate random arrays of 0–6 TutorCardDTO objects, stub the `listTutors` API, verify exactly that many cards render with matching display names
  - **Feature: homepage-redesign, Property 3: Featured tutors match API response**
  - **Validates: Requirements 6.1, 6.3, 14.4**

- [ ] 8. New component: InternationalSection
  - Create `frontend/src/components/home/InternationalSection.tsx`
  - Heading: "Quality tutoring, wherever you are."
  - Supporting text about online tutoring, flexible scheduling, international student access
  - Feature list: Online tutoring, Flexible scheduling, School and university subjects, Exam preparation, Programming and technology
  - CTA button: "Find a Tutor" → `/tutors`
  - Decorative SVG composition (connection dots / subtle network lines) — no stock images
  - No claims of "24/7", "guaranteed results", or unsupported superlatives
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 9. New component: BecomeATutorSection
  - Create `frontend/src/components/home/BecomeATutorSection.tsx`
  - Heading: "Share what you know. Help someone grow."
  - Description and note that applications are reviewed before profiles go live
  - "Become a Tutor" CTA → `/become-a-tutor`
  - Does not imply automatic or instant approval
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 10. Update Hero section
  - Update `frontend/src/components/home/Hero.tsx`:
    - Change the hero badge pill text to "International Tutoring Marketplace"
    - Update the supporting paragraph to use international-facing language (online or in person, school, university, professional skills, exam preparation)
    - Preserve all existing `TutorSearchCard` and `TedorLearningGraphic` logic unchanged
    - Add a secondary "Become a Tutor" text link below the search card
    - Ensure `prefers-reduced-motion` is still respected (already handled by `TedorLearningGraphic`)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.7, 2.8, 2.9_

- [ ] 11. Update CTASection
  - Update `frontend/src/components/home/CTASection.tsx`:
    - Change headline to "Ready to find your tutor?"
    - Primary button: "Find a Tutor" → `/tutors`
    - Secondary button: "Become a Tutor" → `/become-a-tutor`
    - Preserve existing brand-800 dark background and SVG decoration
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 12. Update Navbar
  - Update `frontend/src/components/layout/Navbar.tsx`:
    - Add "Subjects" (`/#subjects`) and ensure "How It Works" (`/#how-it-works`) are in the nav items list
    - Update the desktop primary CTA from "Request a Tutor" to "Find a Tutor" → `/tutors`
    - Update the mobile menu to match (same links, "Find a Tutor" CTA)
    - Preserve all existing auth-aware behaviour (UserMenu, Sign in, status checks)
    - Preserve Escape-key close logic and hamburger toggle
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [ ] 13. Update Footer
  - Update `frontend/src/components/layout/Footer.tsx`:
    - Replace existing columns with four columns: "Tedor Tutors" (About, How It Works, Find a Tutor, Become a Tutor), "Learn" (Mathematics, Science, Programming, Languages, Exam Preparation — each linking to `/tutors?subject=<slug>`), "Account" (Log in, Sign up), "Support" (Contact)
    - Preserve dynamic copyright year
    - Do not add phone numbers, emails, social links, or physical addresses
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [ ] 14. Update HomePage — assemble all sections
  - Update `frontend/src/pages/HomePage.tsx` to assemble sections in the correct order:
    Hero → UniversityTrustStrip → StatsSection → VerificationSteps → FeaturedTutors → InternationalSection → SubjectGrid → BecomeATutorSection → CTASection
  - Add `id="how-it-works"` to VerificationSteps section (for anchor navigation from Navbar)
  - Update `<title>` and meta description in `index.html` or via a document title hook: "Tedor Tutors | Find the Right Tutor"
  - Ensure each section uses the `section-y` CSS class for consistent vertical rhythm
  - _Requirements: 2.1, 12.1, 12.4, 13.1, 13.2, 13.3, 13.4, 15.1_

- [ ] 15. Checkpoint — ensure all tests pass, ask the user if questions arise.
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Write property test: exactly one h1 on HomePage
  - Create `frontend/src/pages/HomePage.test.tsx`
  - Use fast-check to generate random mock API responses (tutors list, stats), render the full HomePage with mocked APIs, assert exactly 1 h1 element is present in the DOM
  - **Feature: homepage-redesign, Property 1: Exactly one h1 on the homepage**
  - **Validates: Requirements 2.1, 13.3**

- [ ] 17. Write property test: Hero form navigation
  - Create `frontend/src/components/home/Hero.test.tsx`
  - Use fast-check to generate random subject/level/mode combinations (including empty strings), render Hero, fill and submit form, assert the resulting navigation URL has exactly the expected non-empty parameters
  - **Feature: homepage-redesign, Property 2: Hero CTA navigation preserves selected filters**
  - **Validates: Requirements 2.3, 2.5**

- [ ] 18. Final Checkpoint — ensure all tests pass, ask the user if questions arise.
  - Ensure all tests pass, ask the user if questions arise.
