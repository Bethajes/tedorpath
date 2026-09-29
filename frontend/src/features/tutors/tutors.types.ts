/**
 * Types for the public tutor directory API.
 *
 * These mirror the responses of `GET /api/tutors` and `GET /api/tutors/:id`
 * as they are actually built in the backend
 * (`backend/src/modules/tutors/service.js`). Field names, nullability and the
 * subject shapes are taken from the two DTO mappers rather than from a
 * hand-written sketch, so a change on the server shows up here as a type error
 * at the call site instead of as `undefined` in the UI.
 *
 * Requirements: 4.8, 5.1, 8.1
 */

import type { EducationLevel } from '@/types/tutorRequest'

/**
 * How a tutor is willing to teach.
 *
 * Note this is NOT the request form's `LearningMode` ('Online' / 'In-person' /
 * 'Either'): a profile states what the tutor offers, a request states what the
 * client wants, and the two are deliberately different vocabularies.
 */
export const TEACHING_MODES = ['ONLINE', 'IN_PERSON', 'BOTH'] as const
export type TeachingMode = (typeof TEACHING_MODES)[number]

/**
 * How a teaching mode is worded for a visitor.
 *
 * The API stores an enum; a visitor needs words. It lives here rather than in
 * the card or the profile page so the directory and the profile can never end
 * up describing the same mode differently.
 */
export const TEACHING_MODE_LABELS: Record<TeachingMode, string> = {
  ONLINE: 'Online',
  IN_PERSON: 'In person',
  BOTH: 'Online & in person',
}

/** Sort options accepted by the API. Mirrors SORT_OPTIONS on the server. */
export const TUTOR_SORT_OPTIONS = [
  'recommended',
  'price_asc',
  'price_desc',
  'newest',
] as const
export type TutorSortOption = (typeof TUTOR_SORT_OPTIONS)[number]

/** Default sort, matching the server-side default. */
export const DEFAULT_TUTOR_SORT: TutorSortOption = 'recommended'

/** The server's default page size and hard cap (Requirement 4.8). */
export const DEFAULT_TUTOR_PAGE_SIZE = 12
export const MAX_TUTOR_PAGE_SIZE = 100

/**
 * A student level, reusing the form's enum rather than declaring a third copy
 * of the same five values. Used for the *filter* below, where the value comes
 * from a picker the app controls.
 *
 * It is deliberately not used for `studentLevels` on the responses: those are
 * read back from the database, which may hold a level added after this file
 * was written, and claiming otherwise would be a lie the type system could not
 * catch.
 */
export type TutorStudentLevel = EducationLevel

/**
 * A subject as it appears on a card: the list endpoint selects only these
 * three columns.
 */
export interface TutorCardSubject {
  id: string
  name: string
  slug: string
}

/**
 * A subject on the detail endpoint, which additionally selects `category`.
 *
 * The two are distinct types on purpose — widening the card shape to include
 * `category` would type-check a value that is never sent by the list endpoint,
 * and the resulting `undefined` would only appear at runtime.
 */
export interface TutorSubject extends TutorCardSubject {
  category: string
}

/** Fields both DTOs share, with identical types. */
interface TutorPublicFields {
  id: string
  displayName: string
  headline: string
  profilePhotoUrl: string | null
  teachingMode: TeachingMode
  location: string | null
  /** Parsed to a number by the server; null when the tutor has not set one. */
  hourlyRate: number | null
  /** Whatever levels the profile stored — see TutorStudentLevel. */
  studentLevels: string[]
  /** ISO 8601; a JSON string, not a Date, once it reaches the browser. */
  createdAt: string
}

/**
 * One row in the directory list.
 *
 * `bio` is truncated to 200 characters by the server, so it is for a teaser
 * only.
 *
 * There is deliberately no `updatedAt` here. The server's card SELECT fetches
 * the column, but the DTO mapper never copies it into the response, so it is
 * absent from the wire format — declaring it here would be a field that always
 * reads `undefined`.
 */
export interface TutorCardDTO extends TutorPublicFields {
  bio: string | null
  subjects: TutorCardSubject[]
}

/**
 * A single tutor's public profile, with the full bio and the extra sections
 * that only matter once a tutor has been picked.
 */
export interface TutorDetailDTO extends TutorPublicFields {
  bio: string | null
  languages: string[]
  availability: string | null
  experience: string | null
  education: string | null
  subjects: TutorSubject[]
}

/**
 * Filter state for the directory.
 *
 * `page` and `limit` are NOT part of this: they are passed to `listTutors`
 * separately, so there is no ambiguity about which one wins.
 *
 * Every value is optional and the empty string means "not filtering" — that is
 * what an untouched filter panel produces, and the API layer drops those
 * rather than sending `?q=`.
 */
export interface TutorFilters {
  /** Free-text search across displayName, headline and subject names. */
  q?: string
  /** Subject slug, e.g. `mathematics`. */
  subject?: string
  studentLevel?: TutorStudentLevel
  mode?: TeachingMode
  /** Case-insensitive substring match. */
  location?: string
  minRate?: number
  maxRate?: number
  sort?: TutorSortOption
}

/** Pagination metadata. Requirement 4.8 fixes the envelope shape. */
export interface TutorPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

/** The `data` payload of a successful `GET /api/tutors`. */
export interface TutorListResponse {
  items: TutorCardDTO[]
  pagination: TutorPagination
}
