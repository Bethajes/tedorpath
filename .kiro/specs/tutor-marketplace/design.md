# Tutor Marketplace — Design Document

## Overview

This document describes the design for transforming Tedor Tutors into a real tutoring marketplace. The feature adds a public tutor directory (`/tutors`), individual tutor profile pages (`/tutors/:id`), a tutor onboarding flow (`/become-a-tutor`), admin moderation for tutor profiles, and deep integration with the existing tutor-request form — all while keeping every current route, API endpoint, and authentication mechanism intact.

The implementation proceeds in discrete chunks (database → backend API → frontend UI → onboarding → admin → integration) to keep each change reviewable and deployable independently.

---

## Architecture

```
Browser
  │
  ├─── /tutors                   TutorDirectoryPage (new)
  ├─── /tutors/:id               TutorProfilePage (new)
  ├─── /become-a-tutor           TutorOnboardingPage (new, auth-gated)
  ├─── /request-tutor?tutorId=…  existing RequestTutorPage (extended)
  │
  └─── API Layer (REST, existing Express app)
         │
         ├─── GET  /api/tutors              public directory
         ├─── GET  /api/tutors/:id          public profile
         ├─── POST /api/tutor-profile       create (requireAuth)
         ├─── PATCH /api/tutor-profile      update own profile (requireAuth)
         ├─── GET  /api/tutor-profile/me    own draft profile (requireAuth)
         ├─── POST /api/tutor-profile/submit  submit for review (requireAuth)
         │
         └─── GET  /api/admin/tutors        admin list (requireAdmin)
              GET  /api/admin/tutors/:id    admin detail (requireAdmin)
              PATCH /api/admin/tutors/:id/status  moderate (requireAdmin)
         │
         └─── PostgreSQL via Prisma 7
```

All new backend modules follow the existing `controller → service → Prisma` three-layer pattern established in `tutorRequests` and `adminRequests`. No new framework dependencies are added to the backend.

---

## Components and Interfaces

### Backend modules

| Module | Path | Responsibility |
|---|---|---|
| `tutors` | `backend/src/modules/tutors/` | Public directory + profile endpoints |
| `tutorProfile` | `backend/src/modules/tutorProfile/` | Authenticated profile CRUD |
| `adminTutors` | `backend/src/modules/adminTutors/` | Admin moderation endpoints |

Each module contains: `index.js` (router), `controller.js`, `service.js`, `validation.js`.

### Frontend features

| Feature | Path | Responsibility |
|---|---|---|
| `tutors` | `frontend/src/features/tutors/` | Directory page, TutorCard, filters, search |
| `tutorProfile` | `frontend/src/features/tutorProfile/` | Public profile page |
| `tutorOnboarding` | `frontend/src/features/tutorOnboarding/` | `/become-a-tutor` multi-step flow |

### Key frontend components

- **`TutorCard`** — reusable card for the directory list and any future embedding
- **`TutorDirectoryPage`** — search bar + filter sidebar/drawer + paginated card grid
- **`TutorProfilePage`** — full public profile layout
- **`FilterPanel`** — subject, level, mode, location, price range filters; opens as a drawer on mobile
- **`TutorOnboardingForm`** — multi-step wizard using react-hook-form + Zod
- **`EmptyState`** — professional "no results" component with CTA

---

## Data Models

### New Prisma enums

```prisma
enum ProfileStatus {
  DRAFT
  PENDING_REVIEW
  APPROVED
  SUSPENDED
  REJECTED
}

enum VerificationStatus {
  UNVERIFIED
  VERIFIED
}

enum TeachingMode {
  ONLINE
  IN_PERSON
  BOTH
}
```

### Subject model

```prisma
model Subject {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @unique @db.VarChar(100)
  slug        String   @unique @db.VarChar(100)
  category    String   @db.VarChar(60)
  description String?  @db.VarChar(300)
  active      Boolean  @default(true)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tutorProfiles TutorProfileSubject[]

  @@map("subjects")
}
```

Seeded from the backend `SUBJECTS` constant:
- Mathematics, Physics, Chemistry, Biology, English → category `"School Subjects"`
- Programming, AI & Technology → category `"Technology"`
- University Course, Exam Preparation → category `"University & Exams"`
- Other → category `"Other"`

Slugs: `mathematics`, `physics`, `chemistry`, `biology`, `english`, `programming`, `ai-technology`, `university-course`, `exam-preparation`, `other`.

### StudentLevel — simple string enum stored on TutorProfile

Rather than a separate model, student levels are stored as a PostgreSQL text array column on TutorProfile. Values must match the backend `EDUCATION_LEVELS` constant: `Primary School`, `High School`, `University`, `Adult Learning`, `Other`.

### TutorProfile model

```prisma
model TutorProfile {
  id                 String             @id @default(uuid()) @db.Uuid

  userId             String             @unique @db.Uuid
  user               User               @relation(fields: [userId], references: [id], onDelete: Cascade)

  displayName        String             @db.VarChar(100)
  headline           String             @db.VarChar(160)
  bio                String             @db.VarChar(2000)
  location           String?            @db.VarChar(120)
  profilePhotoUrl    String?            @db.VarChar(2048)

  teachingMode       TeachingMode
  studentLevels      String[]           // values from EDUCATION_LEVELS
  languages          String[]           @default(["English"])
  availability       String?            @db.VarChar(300)

  hourlyRate         Decimal?           @db.Decimal(10, 2)
  experience         String?            @db.VarChar(2000)
  education          String?            @db.VarChar(2000)

  profileStatus      ProfileStatus      @default(DRAFT)
  verificationStatus VerificationStatus @default(UNVERIFIED)

  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  subjects           TutorProfileSubject[]
  tutorRequests      TutorRequest[]

  @@index([profileStatus])
  @@index([createdAt])
  @@map("tutor_profiles")
}

model TutorProfileSubject {
  tutorProfileId String       @db.Uuid
  subjectId      String       @db.Uuid
  tutorProfile   TutorProfile @relation(fields: [tutorProfileId], references: [id], onDelete: Cascade)
  subject        Subject      @relation(fields: [subjectId], references: [id], onDelete: Cascade)

  @@id([tutorProfileId, subjectId])
  @@map("tutor_profile_subjects")
}
```

### TutorRequest extension

```prisma
// Added to TutorRequest:
tutorProfileId  String?       @db.Uuid
tutorProfile    TutorProfile? @relation(fields: [tutorProfileId], references: [id], onDelete: SetNull)
```

### User extension

```prisma
// Added to User:
tutorProfile    TutorProfile?
```

---

## API Contracts

### `GET /api/tutors`

Query parameters:

| Param | Type | Description |
|---|---|---|
| `q` | string | Full-text search across `displayName`, `headline`, subject names |
| `subject` | string | Subject slug |
| `level` | string | Student level value |
| `mode` | `ONLINE \| IN_PERSON \| BOTH` | Teaching mode |
| `location` | string | Case-insensitive contains on `location` |
| `minRate` | number | Minimum `hourlyRate` |
| `maxRate` | number | Maximum `hourlyRate` |
| `sort` | `recommended \| price_asc \| price_desc \| newest` | Sort order |
| `page` | integer ≥ 1 | Default `1` |
| `limit` | integer 1–100 | Default `12` |

Response shape:
```json
{
  "success": true,
  "data": {
    "items": [ /* TutorCardDTO[] */ ],
    "pagination": { "page": 1, "limit": 12, "total": 0, "totalPages": 0 }
  }
}
```

`TutorCardDTO` fields (never includes private User fields):
```
id, displayName, headline, bio (first 200 chars), profilePhotoUrl,
teachingMode, location, hourlyRate, studentLevels,
subjects: [{ id, name, slug }]
```

### `GET /api/tutors/:id`

Returns `TutorDetailDTO` (superset of card DTO):
```
id, displayName, headline, bio (full), profilePhotoUrl,
teachingMode, location, hourlyRate, studentLevels, languages,
availability, experience, education,
subjects: [{ id, name, slug, category }],
createdAt
```

HTTP 404 for non-existent or non-APPROVED profiles.

### Sorting logic for `recommended`

1. Exact subject match (the `subject` filter param or `q` matches a subject name exactly) — weight 3
2. Headline contains search term (`q`) — weight 2  
3. Display name or subject name contains search term — weight 1
4. Most recently `updatedAt` as tiebreaker

This is computed via a Prisma raw query using `CASE WHEN` expressions. It is fully documented and deterministic — it is not called "best tutor".

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


**Property 1: Only approved profiles appear in the public directory**
*For any* set of TutorProfiles in the database — regardless of their profileStatus mix — the `GET /api/tutors` endpoint must return only profiles whose `profileStatus` is `APPROVED`. No DRAFT, PENDING_REVIEW, SUSPENDED, or REJECTED profile should ever appear in the public response.
**Validates: Requirements 4.1**

---

**Property 2: Applied filters are always satisfied by every returned profile**
*For any* combination of filter parameters (`subject`, `level`, `mode`, `location`, `minRate`, `maxRate`) sent to `GET /api/tutors`, every profile in the `items` array must satisfy all supplied filter conditions simultaneously. No returned profile may violate any active filter.
**Validates: Requirements 4.3, 4.4, 4.5, 4.6, 4.7**

---

**Property 3: Pagination envelope is mathematically consistent**
*For any* paginated response from `GET /api/tutors`, the metadata must satisfy: `totalPages = ceil(total / limit)` (or 0 when total is 0), `items.length <= limit`, and `page` is within the valid range. The same property holds when `total = 0` (empty state returns a valid envelope, not an error).
**Validates: Requirements 4.8, 4.11**

---

**Property 4: Sorting order invariant**
*For any* call to `GET /api/tutors` with `sort=price_asc`, each consecutive pair of items must have `items[i].hourlyRate <= items[i+1].hourlyRate` (nulls last). With `sort=price_desc`, the reverse must hold. With `sort=newest`, each consecutive pair must have `items[i].createdAt >= items[i+1].createdAt`.
**Validates: Requirements 4.9, 4.10**

---

**Property 5: Public API responses never contain private fields**
*For any* TutorProfile retrieved via `GET /api/tutors` or `GET /api/tutors/:id`, the serialized JSON response must not contain any of: `passwordHash`, `tokenHash`, `revokedAt`, `emailVerifiedAt`, `phoneVerifiedAt`, `adminNotes`, `phone`, or `email` (private user contact). This must hold for all profiles and all response shapes.
**Validates: Requirements 2.8, 5.4, 16.1**

---

**Property 6: New profile always defaults to DRAFT**
*For any* authenticated user creating a TutorProfile via `POST /api/tutor-profile` with any valid payload, the persisted profile must have `profileStatus = DRAFT` and `verificationStatus = UNVERIFIED`. No newly created profile may start in any other status.
**Validates: Requirements 2.3, 2.4, 6.1**

---

**Property 7: Partial update touches only specified fields**
*For any* PATCH payload sent to `/api/tutor-profile`, only the fields present in the payload should change in the stored TutorProfile; all fields absent from the payload must retain their prior values unchanged.
**Validates: Requirements 6.3**

---

**Property 8: Profile ownership is enforced server-side**
*For any* two distinct authenticated users A and B, user A calling `PATCH /api/tutor-profile` in a way that would modify user B's profile must receive HTTP 403. The stored profile of user B must remain unchanged after the attempt.
**Validates: Requirements 6.4, 16.2, 16.3**

---

**Property 9: TutorCard renders all required public fields**
*For any* valid `TutorCardDTO` object, the rendered `TutorCard` component must contain: the tutor's display name, headline, at least one subject name, teaching mode indicator, and a "View Profile" link pointing to `/tutors/<id>`. The rendered output must not include any string matching fabricated metric patterns (e.g., star ratings, "X hours", "X% satisfaction").
**Validates: Requirements 9.1, 9.4**

---

**Property 10: Tutor profile page renders all public profile fields**
*For any* approved `TutorDetailDTO`, the rendered `TutorProfilePage` must contain: display name, headline, full bio, all subject names, all student levels, teaching mode, and a "Request This Tutor" button linking to `/request-tutor?tutorId=<id>`.
**Validates: Requirements 10.1, 10.3**

---

**Property 11: Subject slug derivation is URL-safe for any input name**
*For any* subject name string, the slug derivation function must produce a result that: contains only lowercase letters, digits, and hyphens; does not start or end with a hyphen; and is non-empty (assuming the input is non-empty after trimming).
**Validates: Requirements 1.2**

---

**Property 12: Subject-to-profile many-to-many relationship round-trips**
*For any* TutorProfile associated with any non-empty set of subjects, querying the profile with its subjects included must return exactly the same set of subject IDs that were associated — no more, no fewer.
**Validates: Requirements 1.5, 2.5**

---

## Error Handling

### Backend

All endpoints follow the existing envelope pattern:

```json
// Success
{ "success": true, "data": { ... } }

// Failure
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Human message", "fields": [...] } }
```

| Scenario | HTTP status | Error code |
|---|---|---|
| Profile not found or not APPROVED | 404 | `NOT_FOUND` |
| Validation failure | 400/422 | `VALIDATION_ERROR` |
| Duplicate profile (POST on existing) | 409 | `PROFILE_ALREADY_EXISTS` |
| Ownership violation | 403 | `FORBIDDEN` |
| Unauthenticated (protected endpoint) | 401 | `UNAUTHORIZED` |
| Admin endpoint without token | 401 | `UNAUTHORIZED` |
| Invalid status in admin PATCH | 422 | `VALIDATION_ERROR` |
| Profile not complete enough to submit | 422 | `INCOMPLETE_PROFILE` |

### Frontend

- Network errors surfaced via the `useAsyncData` hook pattern already established in the codebase
- Empty search/filter results render `EmptyState` (never a blank page or error state)
- Non-existent or non-approved tutor profile → renders the existing `NotFoundPage`
- Auth redirect for "Request This Tutor" preserves the `?tutorId=` parameter in the `?next=` redirect target

---

## Testing Strategy

### Property-based testing

The frontend uses **Vitest** (already installed). For property-based testing, the project will use **fast-check**, a TypeScript-native PBT library compatible with Vitest.

Backend tests use Node.js's built-in `node:test` runner (already in use). For backend property-based tests, **fast-check** will also be used via `import fc from 'fast-check'` in `.mjs` test files.

Each property-based test must:
- Be tagged with a comment in this exact format: `**Feature: tutor-marketplace, Property N: <property text>**`
- Run a minimum of **100 iterations** (fast-check default is 100; this will be left at default or set explicitly)
- Reference the correctness property number from this document

### Unit tests

Backend unit tests use the existing `node:test` + real database pattern from `backend/tests/`. Key test areas:

- `GET /api/tutors` — empty result, search, each filter type, pagination math, sort orders, invalid params, max limit, APPROVED-only guarantee
- `GET /api/tutors/:id` — valid profile, nonexistent, non-APPROVED statuses
- `POST/PATCH /api/tutor-profile` — authentication required, ownership check, partial update correctness
- `POST /api/tutor-profile/submit` — complete profile succeeds, incomplete profile returns 422 with field list
- `PATCH /api/admin/tutors/:id/status` — valid transitions, invalid status rejected
- `POST /api/tutor-requests` — backward compatibility (no tutorProfileId), with valid tutorProfileId, with invalid tutorProfileId

Frontend unit tests use **Vitest + Testing Library** (already installed). Key test areas:

- `TutorCard` renders required fields and "View Profile" link
- `TutorDirectoryPage` renders search bar, filter panel, and card list; empty state for zero results
- `TutorProfilePage` renders all public fields and "Request This Tutor" CTA
- Filter changes update the URL query parameters
- Auth redirect for unauthenticated "Request This Tutor" click

### Property-based test coverage summary

| Property | Test location | Library |
|---|---|---|
| P1: APPROVED-only | backend tests | fast-check |
| P2: Filter correctness | backend tests | fast-check |
| P3: Pagination consistency | backend tests | fast-check |
| P4: Sort order invariant | backend tests | fast-check |
| P5: Private fields excluded | backend tests | fast-check |
| P6: New profile = DRAFT | backend tests | fast-check |
| P7: Partial update | backend tests | fast-check |
| P8: Ownership enforcement | backend tests | fast-check |
| P9: TutorCard rendering | frontend tests | fast-check |
| P10: Profile page rendering | frontend tests | fast-check |
| P11: Slug derivation | backend/util tests | fast-check |
| P12: Subject round-trip | backend tests | fast-check |
