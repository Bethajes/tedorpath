/**
 * Turns the directory's current filter state into a `/request-tutor` href.
 *
 * A parent who searches the directory and finds nobody suitable should not have
 * to describe their search again. The filters they already set are the answer to
 * half of the form, so they are carried across as prefill.
 *
 * The two features name the same things differently, and that is deliberate:
 *
 * | Directory filter | Request form field | Value                          |
 * | ---------------- | ------------------ | ------------------------------ |
 * | `subject`        | `subject`          | slug → display name            |
 * | `studentLevel`   | `educationLevel`   | identical values               |
 * | `mode`           | `learningMode`     | `ONLINE` → `Online`, …         |
 * | `q`              | —                  | free text, no equivalent       |
 * | `location`       | —                  | see `prefillFromTutorFilters`  |
 * | `language`       | —                  | no field on the form           |
 * | `minRate`/`maxRate` | —               | the form has a free-text budget |
 *
 * Only the first three carry over: they are the choices the form asks the same
 * question about, and everything else would either be dropped or silently
 * written into the wrong field.
 */

import { buildTutorRequestHref } from '@/lib/tutorRequestQuery'
import type { LearningMode, Subject } from '@/types/tutorRequest'

import { slugToSubject } from './tutorSubjects'
import type { TeachingMode, TutorFilters } from './tutors.types'

/**
 * A tutor states what they offer; a client states what they want. `BOTH` is a
 * tutor who will do either, which for a client is the same as "Either".
 */
const LEARNING_MODE_BY_TEACHING_MODE: Record<TeachingMode, LearningMode> = {
  ONLINE: 'Online',
  IN_PERSON: 'In-person',
  BOTH: 'Either',
}

export interface TutorRequestPrefillInput {
  subject: Subject | ''
  educationLevel: string
  learningMode: LearningMode | ''
}

/**
 * The subset of the form's prefill the directory can fill in.
 *
 * Typed as the loose `Subject | ''` / `LearningMode | ''` the bridge already
 * uses rather than a stricter shape, so the handoff stays a single conversion
 * the existing `buildTutorRequestHref` validation can police.
 */
export function prefillFromTutorFilters(filters: TutorFilters): TutorRequestPrefillInput {
  return {
    subject: slugToSubject(filters.subject),
    // The directory's `studentLevel` is typed as the form's own `EducationLevel`
    // (see `TutorStudentLevel`), so this is a pass-through, not a lookup.
    educationLevel: filters.studentLevel ?? '',
    learningMode: filters.mode ? LEARNING_MODE_BY_TEACHING_MODE[filters.mode] : '',
  }
}

/**
 * A `/request-tutor` href pre-filled with everything the current directory
 * search can express. Falls back to a bare `/request-tutor` when no filter is
 * active, so the form opens blank rather than half-filled.
 */
export function buildTutorRequestHrefFromFilters(filters: TutorFilters): string {
  return buildTutorRequestHref(prefillFromTutorFilters(filters))
}
