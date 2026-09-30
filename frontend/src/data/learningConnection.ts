/**
 * Content for the "one platform, different learning goals" connection section.
 *
 * ---------------------------------------------------------------------------
 * ⚠ DEMO_TUTORS IS PLACEHOLDER CONTENT AND IS NEVER SHOWN WHILE THE DIRECTORY
 *   HAS ANY APPROVED PROFILE IN IT. ⚠
 * ---------------------------------------------------------------------------
 *
 * WHY THERE IS A DEMO SET AT ALL
 * -----------------------------
 * On a new deployment the approved directory is empty, and an empty middle
 * column would leave the section showing a bridge with nothing crossing it. The
 * demo tutors exist to keep the composition legible in that state, and they are
 * handled as strictly as the demo testimonials:
 *
 *   - They are only rendered when `GET /api/tutors` returns nothing.
 *   - `isDemo: true` puts a visible "Sample" chip on every one of them.
 *   - No university, no qualification, no years of experience, no rating and no
 *     review count is attached to any of them. `DEMO_TUTORS` is typed as a
 *     shape with exactly four fields because that is exactly what it is allowed
 *     to say.
 *
 * Once one approved profile exists, this array stops being read at all.
 * Requirement 14.4.
 */

/**
 * A tutor as this section is allowed to describe one.
 *
 * Deliberately narrower than `TutorCardDTO`. Everything the API can supply —
 * photo, subjects, teaching mode, location, levels — maps in; nothing that would
 * need inventing has a slot to go in, which is the point. There is no field here
 * for a university, a qualification or a rating, so no caller can populate one.
 */
export interface ConnectionTutor {
  id: string
  /** First name only, unless the tutor has only a single-word display name. */
  firstName: string
  subjects: string[]
  location: string | null
  teachingMode: string
  /** Resolved photo URL, or null for the initials fallback. */
  photoUrl: string | null
  /** Links to the real profile. Demo entries point at the directory instead. */
  profilePath: string
  isDemo: boolean
}

/**
 * The learning goals the platform serves.
 *
 * A taxonomy, not a claim: these are categories of tutoring request the product
 * is built to handle, which is why the request form asks for subject and level
 * in the first place. No counts, no "most popular", no growth figures.
 */
export const LEARNER_GOALS: { title: string; detail: string; icon: string }[] = [
  { title: 'University courses', detail: 'Degree-level subjects', icon: 'cap' },
  { title: 'Exam preparation', detail: 'Entrance and national exams', icon: 'target' },
  { title: 'Career skills', detail: 'Technical and professional', icon: 'code' },
  { title: 'School support', detail: 'Primary through secondary', icon: 'book' },
  { title: 'Language learning', detail: 'English and academic writing', icon: 'chat' },
]

/**
 * Stand-in tutors for an empty directory.
 *
 * Subjects and teaching modes are plausible for the platform and nothing more —
 * no institution, no credential, no experience figure, because none of those
 * would be true of anybody. When the directory has approved profiles these are
 * never rendered.
 */
export const DEMO_TUTORS: ConnectionTutor[] = [
  {
    id: 'demo-tutor-1',
    firstName: 'Demo Tutor',
    subjects: ['Mathematics'],
    location: 'Addis Ababa',
    teachingMode: 'Online and in person',
    photoUrl: null,
    profilePath: '/tutors',
    isDemo: true,
  },
  {
    id: 'demo-tutor-2',
    firstName: 'Demo Tutor',
    subjects: ['English', 'Academic Writing'],
    location: null,
    teachingMode: 'Online',
    photoUrl: null,
    profilePath: '/tutors',
    isDemo: true,
  },
  {
    id: 'demo-tutor-3',
    firstName: 'Demo Tutor',
    subjects: ['Programming', 'Computer Science'],
    location: 'Online',
    teachingMode: 'Online',
    photoUrl: null,
    profilePath: '/tutors',
    isDemo: true,
  },
]

/** How many tutors the bridge shows. Three keeps the rows readable. */
export const CONNECTION_TUTOR_LIMIT = 3
