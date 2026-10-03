import { LEARNING_MODES } from '@/types/tutorRequest'

/**
 * Query-string bridge between the homepage discovery UI and the request form.
 *
 * The homepage search card and the subject cards are discovery UI only — they do
 * not match anyone. All they do is carry the visitor's stated preferences across
 * to `/request-tutor`, where they become the starting values of the wizard.
 *
 * Only the teaching mode is checked against a fixed list here: it is a delivery
 * method with exactly three values, and the wizard cannot offer anything else.
 *
 * Subjects and education levels are deliberately *not* filtered against a list
 * any more. They live in the database (see backend/src/modules/onboarding), so
 * this parser bounds them by length instead and the wizard resolves them against
 * whatever the catalogue actually contains. A link to a subject added last week
 * therefore works, and a link to a subject that has since been renamed still
 * resolves through the level's aliases — neither of which was possible while the
 * options were a constant in this file.
 *
 * The tutor id is still validated as a UUID, for the same reason as before: a
 * hand-edited URL must not be able to seed the form with an id the API would
 * reject.
 */

/** Long enough for any real subject or level name, short enough to be a URL. */
const MAX_LABEL = 100

export interface TutorRequestPrefill {
  subject: string
  educationLevel: string
  learningMode: (typeof LEARNING_MODES)[number] | ''
  /**
   * The TutorProfile the client opened the form from, if any.
   *
   * Validated as a UUID for the same reason as the other values: a hand-edited
   * URL must not be able to seed the form with an id the API would reject.
   */
  tutorProfileId: string
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A bounded, non-empty string. Resolved against the catalogue by the wizard. */
function label(value: string | null | undefined): string {
  if (value == null) return ''
  const trimmed = value.trim()
  return trimmed === '' || trimmed.length > MAX_LABEL ? '' : trimmed
}

function mode(value: string | null | undefined): TutorRequestPrefill['learningMode'] {
  return value != null && (LEARNING_MODES as readonly string[]).includes(value)
    ? (value as TutorRequestPrefill['learningMode'])
    : ''
}

/** Read `?tutorId=&subject=&level=&mode=` from a location search string, ignoring junk. */
export function parseTutorRequestPrefill(search: string): TutorRequestPrefill {
  const params = new URLSearchParams(search)
  const tutorId = params.get('tutorId') ?? ''

  return {
    subject: label(params.get('subject')),
    educationLevel: label(params.get('level')),
    learningMode: mode(params.get('mode')),
    tutorProfileId: UUID_PATTERN.test(tutorId) ? tutorId : '',
  }
}

type PrefillInput = Partial<Record<keyof TutorRequestPrefill, string>>

/**
 * Build a `/request-tutor` href, omitting any preference that was not chosen.
 *
 * Only the teaching mode is dropped when it is not a supported value: a subject
 * or level that the wizard cannot resolve is still worth putting in the link,
 * because the wizard will simply ignore it and the rest of the link is still
 * useful. Dropping it here would silently discard the other preferences too.
 */
export function buildTutorRequestHref(prefill: PrefillInput = {}): string {
  const params = new URLSearchParams()

  const subject = label(prefill.subject)
  if (subject) params.set('subject', subject)

  const level = label(prefill.educationLevel)
  if (level) params.set('level', level)

  const teachingMode = mode(prefill.learningMode)
  if (teachingMode) params.set('mode', teachingMode)

  const query = params.toString()
  return query ? `/request-tutor?${query}` : '/request-tutor'
}