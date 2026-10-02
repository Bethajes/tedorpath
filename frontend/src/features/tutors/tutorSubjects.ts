/**
 * The subjects a visitor can filter the directory by, as API slugs plus the
 * label to show.
 *
 * The list mirrors the backend seed data. A real implementation could fetch
 * `GET /api/subjects?active=true` and render whatever the server returns, but
 * that would need a loader and a loading state on every page that shows a picker.
 * Because the list is stable, it is a constant so the filter panel renders
 * immediately.
 *
 * The `label` of every entry is also a value in the request form's `SUBJECTS`
 * enum, which is what makes `slugToSubject` below a total function over this
 * list. Both enums describe the same ten subjects and are asserted against each
 * other in `tutorSubjects.test.ts` — if one gains an entry and the other does
 * not, that test fails rather than the filter quietly matching nothing.
 */

import type { Subject } from '@/types/tutorRequest'

export interface TutorSubjectOption {
  /** Sent to the API as the `subject` filter. */
  slug: string
  /** Shown to the visitor in the picker. */
  label: string
}

/** Ordered as the backend `SUBJECTS` constant. */
export const SUBJECT_OPTIONS: readonly TutorSubjectOption[] = [
  { slug: 'mathematics', label: 'Mathematics' },
  { slug: 'physics', label: 'Physics' },
  { slug: 'chemistry', label: 'Chemistry' },
  { slug: 'biology', label: 'Biology' },
  { slug: 'english', label: 'English' },
  { slug: 'programming', label: 'Programming' },
  { slug: 'ai-technology', label: 'AI & Technology' },
  { slug: 'university-course', label: 'University Course' },
  { slug: 'exam-preparation', label: 'Exam Preparation' },
  { slug: 'other', label: 'Other' },
]

const SUBJECT_BY_SLUG: ReadonlyMap<string, Subject> = new Map(
  SUBJECT_OPTIONS.map(({ slug, label }) => [slug, label as Subject]),
)

/**
 * The request-form subject a directory `subject` slug stands for, or `''` when
 * the slug is not one this app knows.
 *
 * The directory and the request form use different vocabularies for the same
 * concept: the API takes a slug (`mathematics`) and the form takes the display
 * name (`Mathematics`). A hand-edited `?subject=` can hold anything, so the
 * caller has to cope with a miss.
 */
export function slugToSubject(slug: string | undefined): Subject | '' {
  if (!slug) return ''
  return SUBJECT_BY_SLUG.get(slug) ?? ''
}
