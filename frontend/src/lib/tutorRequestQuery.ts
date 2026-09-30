import type { EducationLevel, LearningMode, Subject } from '@/types/tutorRequest'
import { EDUCATION_LEVELS, LEARNING_MODES, SUBJECTS } from '@/types/tutorRequest'

/**
 * Query-string bridge between the homepage discovery UI and the request form.
 *
 * The homepage search card and the subject cards are discovery UI only — they
 * do not match anyone. All they do is carry the visitor's stated preferences
 * across to `/request-tutor`, where they become the starting values of the
 * existing form.
 *
 * Every incoming value is checked against the same enums the form and the API
 * validate against, so a hand-edited URL can never put the form into a state
 * it could not otherwise reach.
 */

export interface TutorRequestPrefill {
  subject: Subject | ''
  educationLevel: EducationLevel | ''
  learningMode: LearningMode | ''
  /**
   * The TutorProfile the client opened the form from, if any.
   *
   * Validated as a UUID for the same reason as the other values: a hand-edited
   * URL must not be able to seed the form with an id the API would reject.
   */
  tutorProfileId: string
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function pick<T extends string>(value: string | null | undefined, allowed: readonly T[]): T | '' {
  return value != null && (allowed as readonly string[]).includes(value) ? (value as T) : ''
}

/** Read `?tutorId=&subject=&level=&mode=` from a location search string, ignoring junk. */
export function parseTutorRequestPrefill(search: string): TutorRequestPrefill {
  const params = new URLSearchParams(search)
  const tutorId = params.get('tutorId') ?? ''

  return {
    subject: pick(params.get('subject'), SUBJECTS),
    educationLevel: pick(params.get('level'), EDUCATION_LEVELS),
    learningMode: pick(params.get('mode'), LEARNING_MODES),
    tutorProfileId: UUID_PATTERN.test(tutorId) ? tutorId : '',
  }
}

type PrefillInput = Partial<Record<keyof TutorRequestPrefill, string>>

/** Build a `/request-tutor` href, omitting any preference that was not chosen. */
export function buildTutorRequestHref(prefill: PrefillInput = {}): string {
  const params = new URLSearchParams()

  const subject = pick(prefill.subject, SUBJECTS)
  if (subject) params.set('subject', subject)

  const level = pick(prefill.educationLevel, EDUCATION_LEVELS)
  if (level) params.set('level', level)

  const mode = pick(prefill.learningMode, LEARNING_MODES)
  if (mode) params.set('mode', mode)

  const query = params.toString()
  return query ? `/request-tutor?${query}` : '/request-tutor'
}
