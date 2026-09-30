# Requirements Document

## Introduction

This document defines the requirements for redesigning the Tedor Tutors public homepage into a premium international tutoring marketplace homepage. The redesign must not break any existing functionality — authentication, tutor onboarding, admin workflows, API contracts, database models, and routing are all preserved. This is a public homepage and UI/UX redesign only.

The goal is to make both Ethiopian/local high-paying clients and international online clients feel that Tedor Tutors is a credible, professional tutoring platform.

## Glossary

- **Homepage**: The public page served at the `/` route in the frontend application.
- **Hero Section**: The primary above-the-fold area of the homepage containing the main headline and discovery interface.
- **TrustStrip**: The horizontal strip below the Hero showing university backgrounds of tutors.
- **UniversityLogo**: An image representing a university associated with one or more approved tutor profiles.
- **StatsSection**: The section displaying numerical trust indicators backed by real application data.
- **VerificationSteps**: The section explaining how Tedor finds and verifies tutors, reflecting the actual workflow.
- **FeaturedTutors**: The section on the homepage displaying a curated set of APPROVED tutor profiles.
- **TutorCard**: The existing frontend component (`frontend/src/features/tutors/components/TutorCard.tsx`) rendering one tutor profile.
- **InternationalSection**: The section on the homepage targeting international learners, emphasising online tutoring.
- **SubjectSection**: The section showing subject categories that link into the tutor directory.
- **BecomeATutorSection**: The section targeting prospective tutors.
- **FinalCTA**: The final call-to-action section before the footer.
- **Navbar**: The existing site navigation component at `frontend/src/components/layout/Navbar.tsx`.
- **Footer**: The existing site footer component at `frontend/src/components/layout/Footer.tsx`.
- **PageShell**: The existing layout wrapper at `frontend/src/components/layout/PageShell.tsx` that renders Navbar, main content, and Footer.
- **APPROVED**: The `ProfileStatus` value indicating a tutor profile is publicly visible.
- **PublicStatsAPI**: A new backend endpoint `GET /api/public/stats` returning real aggregate counts.
- **Brand colours**: Tedor blue (`brand-600` = `#0f78c4`) as primary, Tedor orange (`accent-500` = `#f5801f`) as accent.
- **Section**: A full-width `<section>` element on the homepage with consistent vertical spacing.
- **Container**: The existing `Container` component enforcing `max-w-7xl` centred layout with gutters.
- **WCAG 2.1 AA**: The Web Content Accessibility Guidelines version 2.1, level AA conformance.

---

## Requirements

---

### Requirement 1 — Navbar Update

**User Story:** As a visitor, I want a professional marketplace navigation bar that clearly communicates Tedor Tutors' identity and gives me fast access to all key areas, so that I can orient myself and navigate the site without friction.

#### Acceptance Criteria

1. WHEN the Navbar renders on desktop, THE Navbar SHALL display the Tedor Tutors logo mark and wordmark on the left, navigation links ("Find a Tutor", "How It Works", "Subjects", "Become a Tutor", "About") in the centre, and ("Sign in", "Find a Tutor" primary CTA button) on the right.
2. WHEN the Navbar renders on a viewport width below 1024px, THE Navbar SHALL display the logo and a hamburger button; navigation links SHALL be hidden inside a slide-down or dropdown mobile menu toggled by the hamburger.
3. WHEN the mobile menu is open, THE mobile menu SHALL display all navigation links as full-width tappable rows and SHALL be dismissible by pressing Escape or clicking outside.
4. WHEN a navigation link matches the current route, THE Navbar SHALL apply an active visual indicator to that link.
5. THE Navbar SHALL remain sticky at the top of the viewport as the user scrolls.
6. THE Navbar SHALL use the Tedor blue and white brand identity, maintaining sufficient contrast between navigation labels and the background per WCAG 2.1 AA.
7. WHEN a user is authenticated, THE Navbar SHALL show the existing UserMenu component instead of the "Sign in" link.

---


### Requirement 2 — Hero Section

**User Story:** As a visitor, I want a strong, premium hero section that communicates Tedor Tutors' value proposition and lets me start searching for a tutor immediately, so that I can take action within seconds of landing on the page.

#### Acceptance Criteria

1. THE Hero Section SHALL contain exactly one `<h1>` element on the entire page, headed "Find the right tutor. Move toward your goals."

   > **Amended** — the original wording was "Find the Right Tutor for Your Goals". The headline was changed to the two-line "Find the right tutor. / Move toward your goals." during the marketplace-visual pass, and `HomePage.test.tsx` and `Hero.test.tsx` were updated with it. The constraint that actually matters — exactly one `<h1>` on the page — is unchanged and still asserted.

2. THE Hero Section SHALL contain a supporting paragraph describing Tedor Tutors as connecting learners with qualified tutors for school, university, professional skills, exam preparation, and more — online or in person.
3. THE Hero Section SHALL contain a marketplace-style discovery form with fields for Subject, Student level, and Teaching mode, plus a primary "Find a Tutor" submit button that navigates to the existing `/tutors` route with the selected values as URL parameters.
4. THE Hero Section SHALL contain a secondary "Become a Tutor" link that navigates to the existing `/become-a-tutor` route.
5. WHEN the Hero discovery form is submitted, THE system SHALL navigate to the existing `/tutors` route, preserving all non-empty field values as URL query parameters (`subject`, `level`, `mode`) using the existing `TutorSearchCard` logic.
6. THE Hero Section SHALL contain a visual composition on the right side on desktop viewports, which may be the existing `TedorLearningGraphic` component or a redesigned equivalent.
7. WHEN the viewport is below 768px, THE Hero Section SHALL stack the text and discovery form above the visual composition.
8. THE Hero Section SHALL display a short list of trust points beneath the discovery form without fabricating statistics, ratings, or counts.
9. THE Hero visual composition SHALL respect `prefers-reduced-motion` by disabling or substantially reducing motion when the media query matches.

---

### Requirement 3 — University Trust Strip

**User Story:** As a visitor, I want to see that tutors have academic backgrounds from real universities, so that I trust the platform is connecting me with educated and credible tutors.

#### Acceptance Criteria

1. THE TrustStrip SHALL appear immediately below the Hero Section.
2. THE TrustStrip heading SHALL use wording such as "Tutors with backgrounds from leading universities" — it SHALL NOT use wording implying institutional partnership such as "Our partner universities" or "Partner institutions".
3. THE TrustStrip SHALL display university logos horizontally, showing between 4 and 8 logos on desktop viewports.
4. WHEN the TrustStrip is viewed on a mobile viewport, THE TrustStrip logos SHALL be displayed in a horizontally scrollable row or a responsive grid.
5. THE TrustStrip SHALL source university data from a centralised data file at `frontend/src/data/universities.ts` exporting an array of `{ name: string; logo: string }` objects.
6. THE university logo files SHALL be placed under `frontend/public/universities/`.
7. THE TrustStrip SHALL only display universities for which a logo file actually exists under `frontend/public/universities/`.
8. WHEN a university logo image fails to load, THE system SHALL hide that logo entry rather than showing a broken image.
9. THE TrustStrip SHALL add subtle hover effects to each logo (e.g. slight opacity increase or scale).

---

### Requirement 4 — Statistics Section

**User Story:** As a visitor, I want to see evidence of scale and quality on the platform, so that I trust Tedor Tutors is a real, active marketplace rather than an empty directory.

#### Acceptance Criteria

1. THE StatsSection SHALL display numerical indicators for at least: approved tutor count, subject count, and university count represented by tutors.
2. THE StatsSection SHALL source all displayed numbers from the existing application database via the `GET /api/public/stats` endpoint — it SHALL NOT hard-code numbers.
3. WHEN the `GET /api/public/stats` endpoint returns a count of zero for any metric, THE StatsSection SHALL display honest non-numerical wording such as "Growing community" instead of "0 tutors".
4. THE `GET /api/public/stats` endpoint SHALL be created in the backend at `backend/src/modules/tutors/` (or a new `publicStats` module) returning `{ approvedTutors, subjects, universities, countries }` calculated from real database records.
5. THE StatsSection SHALL use visually large numbers with concise labels, displayed in a responsive grid of 2 columns on mobile and 4 columns on desktop.
6. THE StatsSection numbers and labels SHALL NOT include fabricated ratings, testimonials, success rates, or satisfaction scores.

---

### Requirement 5 — How Tedor Verifies Tutors Section

**User Story:** As a visitor, I want to understand how Tedor selects and verifies tutors, so that I trust the platform has a quality process rather than accepting anyone who applies.

#### Acceptance Criteria

1. THE VerificationSteps section SHALL contain a heading "How we build a trusted tutor community".
2. THE VerificationSteps section SHALL describe exactly four steps in order: (01) Tutors Apply, (02) We Review, (03) Credentials Are Reviewed, (04) Approved Profiles Go Live.
3. THE step descriptions SHALL accurately reflect the current actual workflow: tutors apply, the team reviews, the team requests and reviews submitted documents through configured contact channels, only approved profiles are public.
4. THE VerificationSteps section SHALL NOT claim automated background checks, identity verification technology, instant credential verification, or certifications the platform does not actually perform.
5. WHEN the VerificationSteps section is rendered, THE section SHALL display each step with a numbered visual indicator, a short title, and a one-to-two sentence description.
6. WHERE a "Learn how tutor approval works" link is included, THE link SHALL navigate to an existing route in the application (e.g. `/become-a-tutor`).

---

### Requirement 6 — Featured Tutors Section

**User Story:** As a visitor, I want to see real tutor profiles on the homepage so that I can immediately assess the calibre of tutors available and feel confident the platform has good options.

#### Acceptance Criteria

1. THE FeaturedTutors section SHALL display only profiles with `profileStatus = APPROVED`.
2. THE FeaturedTutors section SHALL source tutor data from the existing `GET /api/tutors` public endpoint, requesting a limited number (e.g. 3–6 profiles).
3. THE FeaturedTutors section SHALL reuse the existing `TutorCard` component (`frontend/src/features/tutors/components/TutorCard.tsx`) to render each tutor.
4. THE FeaturedTutors section SHALL NOT display fabricated ratings, reviews, lesson counts, response times, student counts, or satisfaction scores.
5. WHEN the `GET /api/tutors` endpoint returns zero APPROVED profiles, THE FeaturedTutors section SHALL render an honest empty state (e.g. "Tutor profiles are being reviewed. Check back soon.") and SHALL NOT show placeholder or fake tutor data.
6. THE FeaturedTutors section SHALL contain a "View all tutors" link navigating to the existing `/tutors` route.
7. WHEN the FeaturedTutors section renders on desktop, THE tutors SHALL be displayed in a 3-column grid.
8. WHEN the FeaturedTutors section renders on a mobile viewport, THE tutors SHALL be displayed in a 1-column layout.

---

### Requirement 7 — International Learning Section

**User Story:** As an international student or parent, I want the homepage to address me directly with language about online learning and global access, so that I understand Tedor Tutors is relevant to me even if I am not physically in Ethiopia.

#### Acceptance Criteria

1. THE InternationalSection SHALL contain a heading communicating quality tutoring regardless of location (e.g. "Quality tutoring, wherever you are.").
2. THE InternationalSection SHALL describe online tutoring, flexible scheduling, English-language instruction, and international student access.
3. THE InternationalSection SHALL NOT claim "24/7 tutors", "guaranteed results", "world's best tutors", or any other unsupported superlative.
4. THE InternationalSection SHALL visually reinforce the international and online nature of the platform through layout and iconography, without requiring external stock images.
5. THE InternationalSection SHALL contain at least one CTA navigating to the existing `/tutors` or `/request-tutor` route.

---

### Requirement 8 — Subjects Section

**User Story:** As a visitor, I want to browse subjects directly from the homepage so that I can quickly find and navigate to tutors for the topic I need help with.

#### Acceptance Criteria

1. THE SubjectSection SHALL contain a heading "Learn what matters to you".
2. THE SubjectSection SHALL display subject categories using data from the existing `frontend/src/components/home/subjectCatalog.ts` file.
3. WHEN a visitor clicks a subject card or link, THE system SHALL navigate to the existing `/tutors` route with the subject slug as a URL parameter (e.g. `/tutors?subject=mathematics`).
4. THE SubjectSection SHALL reuse the existing `SubjectGrid` component or refactor it as the primary subject display, ensuring no duplicate component is created.
5. THE SubjectSection SHALL NOT create routes or subject pages that do not already exist.

---

### Requirement 9 — Become a Tutor Section

**User Story:** As a prospective tutor, I want a dedicated section on the homepage clearly inviting me to apply, so that I understand the opportunity and know how to start.

#### Acceptance Criteria

1. THE BecomeATutorSection SHALL contain a heading inviting tutors to apply (e.g. "Share what you know. Help someone grow.").
2. THE BecomeATutorSection SHALL contain a "Become a Tutor" CTA button navigating to the existing `/become-a-tutor` route.
3. THE BecomeATutorSection SHALL include text clarifying that applications are reviewed before profiles go live — it SHALL NOT imply automatic or instant approval.
4. THE BecomeATutorSection SHALL NOT be the primary section of the homepage; it SHALL appear after the FeaturedTutors and InternationalSection.

---

### Requirement 10 — Final CTA Section

**User Story:** As a visitor who has scrolled to the bottom of the homepage, I want a strong final call-to-action encouraging me to either find a tutor or become one, so that I have a clear next step.

#### Acceptance Criteria

1. THE FinalCTA section SHALL contain a heading "Ready to find your tutor?".
2. THE FinalCTA section SHALL contain a "Find a Tutor" primary button navigating to `/tutors`.
3. THE FinalCTA section SHALL contain a "Become a Tutor" secondary button navigating to `/become-a-tutor`.
4. THE FinalCTA section SHALL use the Tedor blue and orange brand identity.
5. THE FinalCTA section SHALL NOT fabricate statistics, testimonials, or guarantees.

---

### Requirement 11 — Footer Update

**User Story:** As a visitor who has finished reading the homepage, I want a professional multi-column footer with links to all key areas of the site, so that I can navigate to any section without scrolling back to the top.

#### Acceptance Criteria

1. THE Footer SHALL include a column for "Tedor Tutors" with links to About, How It Works, Find a Tutor, and Become a Tutor.
2. THE Footer SHALL include a column for "Learn" with links to subject pages (Mathematics, Science, Programming, Languages, Exam Preparation) navigating to `/tutors?subject=<slug>`.
3. THE Footer SHALL include a column for "Account" with links to Log in and Sign up.
4. THE Footer SHALL include a column for "Support" with a link to Contact.
5. THE Footer SHALL display a copyright line with the current year computed dynamically.
6. THE Footer SHALL NOT display phone numbers, email addresses, social media handles, or physical addresses that do not exist in the project's configuration.
7. WHEN contact details are configured via environment variables (e.g. `VITE_CONTACT_TELEGRAM`), THE Footer MAY display those contact channels.

---

### Requirement 12 — Visual Design and Responsiveness

**User Story:** As a visitor on any device, I want the homepage to look premium, trustworthy, and professional at all screen sizes, so that I feel confident the platform is credible.

#### Acceptance Criteria

1. THE homepage SHALL render correctly at viewport widths of 320px, 375px, 425px, 768px, 1024px, 1280px, and 1440px.
2. THE homepage SHALL use the Tedor blue (`brand-600`) as the primary action colour and Tedor orange (`accent-500`) as the accent colour throughout.
3. THE homepage SHALL use generous whitespace, subtle shadows, thin borders, and controlled border-radius to create a premium aesthetic.
4. THE homepage SHALL use a consistent typographic hierarchy: one `<h1>`, `<h2>` per section, and `<h3>` for subsections.
5. WHEN CSS animations are present on the homepage, THE animations SHALL respect the `prefers-reduced-motion` media query by disabling or significantly reducing motion.
6. THE homepage SHALL not use generic stock imagery.
7. THE homepage SHALL maintain a minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text against their backgrounds, per WCAG 2.1 AA.

---

### Requirement 13 — SEO and Accessibility

**User Story:** As a developer or SEO specialist, I want the homepage to have correct metadata, semantic HTML, and keyboard accessibility, so that the page is discoverable and usable by all visitors including those using assistive technology.

#### Acceptance Criteria

1. THE homepage `<title>` SHALL be "Tedor Tutors | Find the Right Tutor".
2. THE homepage SHALL have a `<meta name="description">` tag with content describing Tedor Tutors as a tutor-finding platform.
3. THE homepage SHALL have exactly one `<h1>` element.
4. THE homepage SHALL have a logical heading hierarchy (`h1` → `h2` → `h3`) with no skipped levels.
5. WHEN images convey meaningful content, THE images SHALL have descriptive `alt` text.
6. WHEN images are purely decorative, THE images SHALL be marked with `alt=""` or `aria-hidden="true"`.
7. THE homepage SHALL be fully navigable by keyboard, with visible focus states on all interactive elements.
8. THE homepage interactive elements SHALL have accessible names (via `aria-label`, `aria-labelledby`, or visible text).

---

### Requirement 14 — No Fabricated Data

**User Story:** As a potential customer, I want all claims, statistics, and credentials on the homepage to be backed by real data, so that I trust the platform is honest and will not mislead me.

#### Acceptance Criteria

1. THE homepage SHALL NOT display any tutor count, student count, lesson count, review count, rating, satisfaction score, success percentage, years of experience, or response time that is not sourced from the live application database.
2. THE homepage SHALL NOT display testimonials unless they are from real, identifiable users of the platform.
3. THE homepage SHALL NOT claim university partnerships unless a formal institutional agreement exists.
4. THE homepage SHALL NOT display a tutor profile card with fabricated data such as a hardcoded name, photo, or bio that does not correspond to a real APPROVED profile in the database.
5. WHEN a statistic cannot be backed by real data, THE homepage SHALL either omit that statistic or use honest non-numerical language (e.g. "Growing community" instead of "500+ students").

---

### Requirement 15 — Preserve Existing Functionality

**User Story:** As a developer, I want confidence that the homepage redesign does not break any existing routes, API endpoints, or application features, so that users and admins are not impacted by the visual redesign.

#### Acceptance Criteria

1. WHEN the homepage redesign is applied, THE routes `/`, `/find-tutor`, `/request-tutor`, `/become-a-tutor`, `/about`, `/contact`, `/login`, `/register`, `/tutors`, `/tutors/:id`, `/tutor/application-status`, `/admin/*` SHALL all continue to work.
2. THE homepage redesign SHALL NOT modify any backend API endpoint response shapes.
3. THE homepage redesign SHALL NOT modify any database models or migrations.
4. THE homepage redesign SHALL NOT modify the authentication flow.
5. THE homepage redesign SHALL NOT modify the tutor onboarding wizard.
6. THE homepage redesign SHALL NOT modify the admin review workflow.
7. WHEN existing homepage components (TutorSearchCard, TedorLearningGraphic, SubjectGrid, HowItWorks, etc.) are refactored, THE component logic and navigation behaviour SHALL be preserved.
