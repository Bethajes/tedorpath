/**
 * API access for the public tutor directory.
 *
 * Built on the shared `getJson` wrapper so the base URL, credentials and
 * error handling stay in one place (`@/lib/api`). Both functions return the
 * unwrapped `data` payload; the envelope is handled by the wrapper.
 *
 * Requirements: 4.8, 5.1, 8.1
 */

import { getJson } from '@/lib/api'

import type {
  PublicStats,
  TutorDetailDTO,
  TutorFilters,
  TutorListResponse,
} from './tutors.types'

import {
  DEFAULT_TUTOR_PAGE_SIZE,
  MAX_TUTOR_PAGE_SIZE,
} from './tutors.types'

const TUTORS_PATH = '/api/tutors'
const PUBLIC_STATS_PATH = '/api/public/stats'

/**
 * Appends a filter to the query string only when it actually narrows results.
 *
 * An untouched filter panel yields empty strings, and `?q=&subject=` is not the
 * same as omitting them: the schema would still validate the empty values, and
 * the resulting URL is noise in the address bar and in the browser log.
 */
function setIfPresent(query: URLSearchParams, key: string, value: string | undefined): void {
  if (value !== undefined && value.trim() !== '') {
    query.set(key, value.trim())
  }
}

/**
 * `minRate` and `maxRate` are checked against null rather than truthiness:
 * a rate of 0 is a real filter ("free"), and `if (minRate)` would silently
 * drop it.
 */
function setIfNumber(
  query: URLSearchParams,
  key: string,
  value: number | undefined,
): void {
  if (value !== undefined && Number.isFinite(value)) {
    query.set(key, String(value))
  }
}

/**
 * Builds the query string for the directory.
 *
 * Exported so the page can put the current filter state in the URL without
 * duplicating this logic.
 */
export function buildTutorSearchParams(
  filters: TutorFilters = {},
  page: number = 1,
  limit: number = DEFAULT_TUTOR_PAGE_SIZE,
): URLSearchParams {
  const query = new URLSearchParams()

  setIfPresent(query, 'q', filters.q)
  setIfPresent(query, 'subject', filters.subject)
  setIfPresent(query, 'level', filters.studentLevel)
  setIfPresent(query, 'mode', filters.mode)
  setIfPresent(query, 'location', filters.location)
  setIfPresent(query, 'language', filters.language)
  setIfNumber(query, 'minRate', filters.minRate)
  setIfNumber(query, 'maxRate', filters.maxRate)
  setIfPresent(query, 'sort', filters.sort)

  // Always sent, so the request is explicit and the returned pagination can be
  // compared against what was asked for without guessing at server defaults.
  query.set('page', String(Math.max(1, Math.trunc(page))))

  // Clamped rather than trusted: the server rejects limit > 100 with a 400,
  // and a pager that computed 500 should not turn into an error state.
  const safeLimit = Number.isFinite(limit) ? Math.trunc(limit) : DEFAULT_TUTOR_PAGE_SIZE
  query.set('limit', String(Math.min(Math.max(1, safeLimit), MAX_TUTOR_PAGE_SIZE)))

  return query
}

/**
 * A page of approved tutor profiles, newest-first by default.
 *
 * Only APPROVED profiles are ever returned: the server filters, so a draft or
 * suspended tutor cannot appear here under any filter combination.
 *
 * @throws {ApiError} on a network failure or a rejected query value.
 */
export function listTutors(
  filters: TutorFilters = {},
  page: number = 1,
  limit: number = DEFAULT_TUTOR_PAGE_SIZE,
): Promise<TutorListResponse> {
  const query = buildTutorSearchParams(filters, page, limit)
  return getJson<TutorListResponse>(`${TUTORS_PATH}?${query.toString()}`)
}

/**
 * One tutor's public profile.
 *
 * The id is URL-encoded because it comes from a route parameter: without it a
 * crafted `/tutors/../admin` segment would escape the path.
 *
 * @throws {ApiError} with code `NOT_FOUND` when the profile does not exist or
 * is not APPROVED. The API deliberately does not distinguish the two, so a
 * caller must not treat a 404 as proof that the id was never valid.
 */
export function getTutor(id: string): Promise<TutorDetailDTO> {
  return getJson<TutorDetailDTO>(`${TUTORS_PATH}/${encodeURIComponent(id)}`)
}

/**
 * Platform-wide counts for the homepage.
 *
 * The endpoint is public and unauthenticated, and the numbers are the same ones
 * a visitor could infer from browsing the directory, so this is safe to call on
 * a page anyone can see.
 *
 * @throws {ApiError} on a network failure or a server error. Callers should
 * treat a failure as "counts unknown", not as zero: a zero is a real count that
 * the frontend renders as honest wording, while an unknown count must never be
 * substituted for a real one.
 *
 * Requirements: 4.2
 */
export function getPublicStats(): Promise<PublicStats> {
  return getJson<PublicStats>(PUBLIC_STATS_PATH)
}
