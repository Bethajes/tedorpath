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

import type { Market } from './market'

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
  /**
   * The rate for the market this listing was requested in, parsed to a number by
   * the server. Null when the tutor does not price in that market — which is a
   * different answer from zero.
   *
   * `hourlyRateCurrency` travels with it rather than being assumed, so a client
   * can never render a number it has not been told the unit of.
   */
  hourlyRate: number | null
  hourlyRateCurrency: string | null
  //
  // Only the visitor's own market is sent. The API does not return the other
  // market's rate, so there is no second price available for a component to
  // display by accident — which is the failure this field used to make possible.
  /** Whatever levels the profile stored — see TutorStudentLevel. */
  studentLevels: string[]
  /**
   * Teaching languages. Sent on the card as well as the detail response so a
   * visitor filtering by language can see why a tutor matched.
   * Requirement: 30.6
   */
  languages: string[]
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
  /**
   * Teaching language, matched case-insensitively against a tutor's `languages`.
   *
   * Free text, like `location`, because the array is tutor-authored: the
   * onboarding form takes a comma-separated list, so the possible values are
   * whatever tutors typed and an enum would exclude most of them.
   * Requirements: 30.2, 30.4
   */
  language?: string
  /**
   * The market the rates are read in.
   *
   * A visitor's, not a tutor's: `minRate=10` is a different question for someone
   * in Addis than for someone in London. The server filters, sorts and prices on
   * this same value, so the filter and the displayed price can never answer two
   * different questions.
   */
  market?: Market
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

/**
 * The `data` payload of a successful `GET /api/public/stats`.
 *
 * Every field is a live count of real database records — there is no client-side
 * default and nothing here is seeded, so a zero is a real zero rather than a
 * missing value. Callers must render honest non-numerical wording for a zero
 * instead of printing it.
 *
 * `universities` and `countries` count the distinct `education` and `location`
 * values written on APPROVED profiles. Both fields are tutor-authored free text,
 * so these are "how many distinct entries approved tutors have given", not a
 * verified institution or country list.
 *
 * Requirements: 4.2, 4.4
 */
export interface PublicStats {
  /** APPROVED tutor profiles — the profiles actually visible in the directory. */
  approvedTutors: number
  /** Subjects that are active, i.e. offered in the pickers and the filters. */
  subjects: number
  /** Distinct non-blank education entries across APPROVED profiles. */
  universities: number
  /** Distinct non-blank location entries across APPROVED profiles. */
  countries: number
}
