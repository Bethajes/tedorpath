# Homepage Redesign — Design Document

## Overview

This document defines the design for redesigning the Tedor Tutors public homepage (`/`) into a premium international tutoring marketplace homepage. The redesign is a frontend-only concern with one small backend addition (a public stats endpoint). All existing routes, APIs, database models, authentication, onboarding, and admin functionality are preserved.

The visual direction is a premium, modern marketplace aesthetic: Tedor blue (`brand-600`) as primary, Tedor orange (`accent-500`) as accent, white/light backgrounds, professional dark text, generous whitespace, subtle shadows, and excellent typography. No fabricated data. No fake statistics.

---

## Architecture

```
Browser
  │
  └── / (HomePage)
        │
        ├── Navbar (existing, enhanced)
        ├── Hero (enhanced TutorSearchCard + TedorLearningGraphic)
        ├── UniversityTrustStrip (new)
        ├── StatsSection (new — reads GET /api/public/stats)
        ├── VerificationSteps (new — replaces HowItWorks)
        ├── FeaturedTutors (new — reads GET /api/tutors?limit=6)
        ├── InternationalSection (new)
        ├── SubjectGrid (existing, preserved)
        ├── BecomeATutorSection (new — replaces BrandStory)
        ├── FinalCTA (enhanced CTASection)
        └── Footer (existing, enhanced)

Backend addition:
  GET /api/public/stats  (new — tutors module or standalone route)
    Returns: { approvedTutors, subjects, universities, countries }
    All counts from real DB records
```

---

## Components and Interfaces

### New and modified frontend components

| Component | Path | Status |
|---|---|---|
| `HomePage` | `frontend/src/pages/HomePage.tsx` | Modified — new section order |
| `Navbar` | `frontend/src/components/layout/Navbar.tsx` | Modified — enhanced nav links, mobile menu |
| `Hero` | `frontend/src/components/home/Hero.tsx` | Modified — headline update, enhanced layout |
| `UniversityTrustStrip` | `frontend/src/components/home/UniversityTrustStrip.tsx` | New |
| `StatsSection` | `frontend/src/components/home/StatsSection.tsx` | New |
| `VerificationSteps` | `frontend/src/components/home/VerificationSteps.tsx` | New (replaces HowItWorks for homepage) |
| `FeaturedTutors` | `frontend/src/components/home/FeaturedTutors.tsx` | New |
| `InternationalSection` | `frontend/src/components/home/InternationalSection.tsx` | New |
| `BecomeATutorSection` | `frontend/src/components/home/BecomeATutorSection.tsx` | New (replaces BrandStory) |
| `CTASection` | `frontend/src/components/home/CTASection.tsx` | Modified — headline update |
| `Footer` | `frontend/src/components/layout/Footer.tsx` | Modified — expanded columns |
| `universities.ts` | `frontend/src/data/universities.ts` | New — centralised data file |

### Preserved components (no logic changes)

| Component | Notes |
|---|---|
| `TutorSearchCard` | Existing logic preserved; may receive minor style enhancements |
| `TedorLearningGraphic` | Preserved as-is; embedded in Hero |
| `SubjectGrid` | Preserved as-is |
| `TutorCard` | Preserved as-is; reused in FeaturedTutors |
| `PageShell` | Preserved — wraps all pages |
| `Logo` | Preserved as-is |

### New backend

| Module | Path |
|---|---|
| `publicStatsController` | `backend/src/modules/tutors/statsController.js` |
| Route registration | `backend/src/modules/tutors/index.js` (add `GET /stats`) |

---

## Data Models

No database schema changes. The stats endpoint uses existing tables:

```sql
-- approvedTutors: COUNT(*) FROM tutor_profiles WHERE profileStatus = 'APPROVED'
-- subjects: COUNT(DISTINCT subjects.id) FROM subjects WHERE active = true
-- universities: derived from approved tutors' education field (text scan) — if too unreliable, omit
-- countries: COUNT(DISTINCT location) FROM tutor_profiles WHERE profileStatus = 'APPROVED'
```

`universities` count is intentionally conservative: it counts distinct non-null `education` entries or is omitted if the data isn't reliable enough to show. The frontend handles zero gracefully.

### University data file

```typescript
// frontend/src/data/universities.ts
export interface UniversityEntry {
  name: string
  /** Path relative to /public, e.g. "/universities/aau.png" */
  logo: string
}

export const UNIVERSITIES: UniversityEntry[] = [
  { name: 'Addis Ababa University', logo: '/universities/aau.png' },
  { name: 'Addis Ababa Science and Technology University', logo: '/universities/aastu.png' },
]
```

Logo files are placed at `frontend/public/universities/`. Only universities with actual logo files in that directory are included. Logos for AAU and AASTU are the two confirmed inclusions; others may be added when real tutor data and logo files exist.

### Public stats API response shape

```typescript
interface PublicStats {
  approvedTutors: number
  subjects: number
  universities: number
  countries: number
}
// Envelope: { success: true, data: PublicStats }
```

---

## Section-by-Section Design

### A. Navbar

The existing dark (`bg-ink-950`) navbar is preserved. Enhancements:
- Add "Subjects" and "How It Works" links to the desktop navigation
- On mobile, all links appear in the dropdown with a "Find a Tutor" CTA at the bottom
- The "Request a Tutor" CTA becomes "Find a Tutor" to align with the primary homepage copy
- Existing auth-awareness (UserMenu, Sign in) is unchanged

Navigation items (desktop):
1. Find a Tutor → `/tutors`
2. How It Works → `/#how-it-works`
3. Subjects → `/#subjects`
4. Become a Tutor → `/become-a-tutor`
5. About → `/about`

Right side:
- Sign in → `/login` (when anonymous)
- UserMenu (when authenticated)
- Primary CTA: "Find a Tutor" → `/tutors`

### B. Hero

Two-column layout on desktop (text + graphic), stacked on mobile.

Left column:
- Badge pill: "International Tutoring Marketplace" with accent dot
- `<h1>`: "Find the Right Tutor for Your Goals"
- Supporting text (updated to international language)
- `TutorSearchCard` (existing — Subject, Level, Mode selects + Find a Tutor button)
- "Become a Tutor" secondary link
- Three trust points (text only, no fabricated numbers)

Right column:
- `TedorLearningGraphic` (existing — preserved with all animation logic)

The `TutorSearchCard` is the discovery interface. Its navigation behaviour (`/tutors?subject=...&level=...&mode=...`) is unchanged.

### C. University Trust Strip

Horizontal strip on `bg-ink-50` with:
- Small label: "TUTORS WITH BACKGROUNDS FROM"
- University logos displayed horizontally, filtered to only logos that exist
- On mobile: `overflow-x-auto` scrollable row
- Each logo: greyscale by default, brand colour on hover (CSS `filter: grayscale(1)` → `grayscale(0)`)

Implementation: the component maps over `UNIVERSITIES` and renders an `<img>` for each. An `onError` handler removes any logo whose file fails to load (same pattern as TutorCard avatar).

### D. Stats Section

Responsive 2×2 grid (mobile) → 4-column row (desktop).

Stat cards:
1. Approved Tutors (`approvedTutors` from API)
2. Subjects (`subjects` from API)
3. Universities (`universities` from API)
4. Countries (`countries` from API)

Zero handling: when a count is 0 or the API call fails, the card shows honest text instead:
- 0 tutors → "Growing"
- 0 subjects → "Many"
- 0 universities → "Several"
- 0 countries → "Multiple"

The API call uses `useEffect` + `fetch` directly (not `useAsyncData`) to avoid blocking the page render. Stats are a nice-to-have enhancement, not critical path.

### E. Verification Steps

Four-step numbered layout, horizontal on desktop, vertical on mobile.

Steps:
1. **Tutors Apply** — "Every tutor starts by submitting their profile, subjects, experience, and teaching information."
2. **We Review** — "Our team reviews each application: profile completeness, teaching experience, and education background."
3. **Credentials Are Reviewed** — "Required supporting documents are submitted to the Tedor team through the channels provided. Our team reviews them."
4. **Approved Profiles Go Live** — "Only tutors whose applications pass review are displayed publicly on the Tedor Tutors marketplace."

No mention of automated systems, background check databases, or instant verification.

### F. Featured Tutors

Fetches `GET /api/tutors?limit=6&sort=newest` on mount. Renders existing `TutorCard` components in a 3-column grid (desktop) / 1-column (mobile).

Empty state: "Tutor profiles are being reviewed. Check back soon." — shown when 0 results returned.

"View all tutors" link → `/tutors`.

The component uses the existing `listTutors` API function from `frontend/src/features/tutors/tutors.api.ts`.

### G. International Section

Dark background card (brand-800 or ink-900) with:
- Large heading: "Quality tutoring, wherever you are."
- Supporting text about online learning, flexible scheduling, international access
- Feature list: Online tutoring, Flexible scheduling, School and university subjects, Exam preparation, Programming and technology
- CTA: "Find a Tutor" → `/tutors`
- Decorative SVG composition (connection dots / subtle world-map-inspired lines — no geographic claims)

### H. Subjects

Reuse existing `SubjectGrid` component without changes. The section has `id="subjects"` for anchor navigation.

### I. Become a Tutor

Two-column card layout on `bg-ink-50`:
- Left: Heading "Share what you know. Help someone grow." + description + "Applications are reviewed before profiles are published."
- Right: "Become a Tutor" CTA button → `/become-a-tutor`

### J. Final CTA

Enhanced `CTASection` with updated headline "Ready to find your tutor?" and two buttons: "Find a Tutor" (primary, white on brand-800) and "Become a Tutor" (secondary, outline).

### K. Footer

Enhanced with four columns:
1. **Tedor Tutors**: About, How It Works, Find a Tutor, Become a Tutor
2. **Learn**: Mathematics, Science, Programming, Languages, Exam Preparation (all → `/tutors?subject=<slug>`)
3. **Account**: Log in, Sign up
4. **Support**: Contact

No invented contact details. Copyright line is dynamic.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

**Property 1: Exactly one h1 on the homepage**
*For any* render of the HomePage component, the rendered DOM must contain exactly one element with the role `heading` at level 1. No more, no fewer.
**Validates: Requirements 2.1, 13.3**

---

**Property 2: Hero CTA navigation preserves selected filters**
*For any* combination of subject, level, and mode values selected in the Hero discovery form (including empty/omitted values), submitting the form must navigate to `/tutors` with exactly the non-empty selected values present as URL query parameters and no unexpected parameters added.
**Validates: Requirements 2.3, 2.5**

---

**Property 3: Featured tutors match API response**
*For any* API response from `GET /api/tutors` containing N tutor items, the FeaturedTutors section must render exactly N tutor cards — no more and no fewer — and each card must display data that corresponds to the matching item in the API response (name, headline).
**Validates: Requirements 6.1, 6.3, 14.4**

---

**Property 4: Stats section displays API values or honest fallback**
*For any* API response from `GET /api/public/stats`, every non-zero count value must appear visibly in the StatsSection rendered output. When a count is zero, the rendered output must not contain the literal text "0" as a standalone statistic label.
**Validates: Requirements 4.2, 4.3**

---

**Property 5: University trust strip uses only data-file entries**
*For any* render of the UniversityTrustStrip component, the number of university logo images attempted to be rendered must equal the number of entries in the `UNIVERSITIES` data file. No university name may appear in the rendered output that is not in the `UNIVERSITIES` data file.
**Validates: Requirements 3.5, 3.7**

---

## Error Handling

### Stats API failure
If `GET /api/public/stats` fails (network error, 500), the StatsSection falls back to displaying `null` for all counts and renders the honest fallback text for each metric. No error message is shown to the user — the section degrades gracefully.

### Featured tutors API failure
If `GET /api/tutors` fails, the FeaturedTutors section shows the same empty state as a zero-result response: "Tutor profiles are being reviewed. Check back soon."

### University logo 404
Each `<img>` in `UniversityTrustStrip` has an `onError` handler that sets `display: none` on the image container, preventing broken image icons.

---

## Testing Strategy

### Unit testing

Unit tests verify specific examples and edge cases:
- Homepage renders without crashing
- Exactly one h1 is present
- Hero CTA links resolve to correct routes
- UniversityTrustStrip does not display universities not in the data file
- FeaturedTutors shows the "View all tutors" link
- Become a Tutor CTA links to `/become-a-tutor`
- Footer renders all four columns
- Mobile menu toggle works (open/close)
- Escape key closes mobile menu

### Property-based testing

Property-based tests use **fast-check** (already a dependency in `frontend/package.json`) run under Vitest.

Each property test is tagged with the format:
`**Feature: homepage-redesign, Property N: <property text>**`
`**Validates: Requirements X.Y**`

Each correctness property is implemented by exactly one property-based test running a minimum of 100 iterations.

**P1** — Exactly one h1: generate random sets of mocked API data (tutors, stats), render the page, assert exactly one h1 in the DOM. (Vitest + fast-check)

**P2** — Hero CTA navigation: generate random subject/level/mode combinations, fill the form, submit, assert the resulting URL contains exactly the expected parameters.

**P3** — Featured tutors match API response: generate random arrays of 0–6 `TutorCardDTO` objects, stub the API to return them, assert exactly that many cards are rendered with the correct names.

**P4** — Stats section values: generate random `PublicStats` objects, stub the API, assert all non-zero values appear in the rendered output.

**P5** — University trust strip: this is a unit test (data-file integrity) rather than a property test since the data file is static.

Test file locations:
- `frontend/src/pages/HomePage.test.tsx` — unit tests + property tests P1, P3, P4
- `frontend/src/components/home/Hero.test.tsx` — property test P2
- `frontend/src/components/home/UniversityTrustStrip.test.tsx` — unit tests for P5
