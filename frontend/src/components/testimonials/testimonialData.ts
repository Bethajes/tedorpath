/**
 * Testimonial content, kept out of the UI entirely.
 *
 * ---------------------------------------------------------------------------
 * ⚠ EVERY ENTRY BELOW IS DEMO CONTENT. NONE OF IT IS A REAL PERSON. ⚠
 * ---------------------------------------------------------------------------
 *
 * The names are not the invented "Client name 1" of the previous version. The
 * first three use ordinary given names, because a row of identical "Demo
 * Learner" cards read as broken rather than provisional — but "obviously fake"
 * was never the only requirement. What makes these honest is the label, not the
 * name: every entry carries `isDemo: true`, which the card renders as a visible
 * "Sample" chip.
 *
 * A name is only as honest as the label beside it. With the chip on, "Hana"
 * reads as a placeholder waiting to be replaced; with it off, "Hana" would read
 * as a real person whose words we are borrowing. So the badge is not conditional
 * on the rest of the record looking tidy — TestimonialCard refuses to show
 * "Verified learner" on any demo entry no matter what the data says, and the two
 * states are mutually exclusive by construction.
 *
 * Requirement 14.2 says the homepage must not show testimonials unless they come
 * from real, identifiable users of the platform. That requirement is not
 * satisfied by this file, and this file is the reason it is easy to satisfy
 * later: the architecture distinguishes demo content from real content, so the
 * moment `GET /api/testimonials` exists the demo array is deleted and nothing in
 * the UI has to change.
 *
 * TO GO LIVE:
 *   1. Add `isDemo: false` only for a testimonial a real learner actually
 *      wrote, with their permission to publish it.
 *   2. Set `isVerified: true` only if the platform holds that learner's review.
 *      See the warning in TestimonialCard before doing this by hand.
 *   3. Delete every remaining demo entry. Three real quotes beat twenty with
 *      seventeen placeholders still in them.
 *
 * A quote must not imply a metric the platform does not measure. "My tutor was
 * patient and adapted the lesson" is fine; "I scored 95%" is a result claim that
 * needs the learner to be happy to stand behind it in public.
 *
 * ===========================================================================
 * FUTURE API
 * ===========================================================================
 *
 * `GET /api/testimonials` is expected to return:
 *
 *   { id, name, quote, subject, location, avatar, rating, isVerified }
 *
 * which is `Testimonial` minus `isDemo`. `toTestimonial` in this file is the seam:
 * wrap the response in it, hand the array to <TestimonialsSection>, and the
 * section renders real reviews with no other change. `isDemo` becomes a constant
 * `false` at that point rather than a per-record field.
 */

/**
 * One learner experience.
 *
 * Field-for-field what the API is expected to send, plus `isDemo`. Kept flat and
 * free of React types so the data layer stays importable from a script, a test or
 * a future server fetch without dragging in the component tree.
 */
export type Testimonial = {
  /** Stable id. The demo entries use `demo-*`; real ones will be database ids. */
  id: string
  /** The learner's display name. Never a fabricated real-seeming name. */
  name: string
  /** Words they actually wrote. One or two sentences. */
  quote: string
  /** The subject they were tutored in, in the platform's own vocabulary. */
  subject: string
  /** Where the learning happened. Omitted entirely when we would only guess. */
  location?: string
  /** Path or URL to their photo. Absent means the initials fallback is used. */
  avatar?: string
  /**
   * Out of 5, and only when the platform actually holds a score.
   *
   * `undefined` renders no stars at all — the card never falls back to a
   * default, because a default star row is an invented rating. Demo entries may
   * carry one to show the layout; real entries must not until the API sends it.
   */
  rating?: number
  /**
   * The platform holds this review and the learner agreed to it being public.
   *
   * Never set this on a demo entry. The card refuses to render the badge for
   * one, so a mistake here cannot put a "Verified learner" chip next to a
   * placeholder.
   */
  isVerified: boolean
  /** True for placeholder content. Rendered as a visible "Sample" chip. */
  isDemo: boolean
}

/**
 * Demo content, arranged to show the breadth the section is built for.
 *
 * The mix is doing real work rather than decoration. School, university,
 * professional and language learners; in-person and online; Ethiopia and
 * international — because a marketplace stream only reads as a marketplace if it
 * visibly contains more than one kind of learner. It is also the honest picture
 * of what the platform sells (see InternationalSection), with no claim attached
 * to any of it.
 *
 * ON THE RATINGS. Only the first five carry one, and they say `5` because a
 * number had to be chosen to show the layout. Three consequences, all intended:
 *
 *   - The rows do not fill with orange. Tedor orange is a highlight in this
 *     design system; a star row on every card spends it and leaves nothing for
 *     the accent to actually mean.
 *   - Both states are on screen at once, so the "no rating renders nothing" rule
 *     is visible rather than theoretical. The seven without a score are the shape
 *     real data will be in today, since the platform collects no ratings.
 *   - Neither direction of the stream ends up carrying all the stars.
 *
 * Every one of these is demo. When real records arrive from
 * `GET /api/testimonials`, `rating` comes from the server or is absent — the
 * card has no fallback, so nothing here can leak into a real card.
 */
export const DEMO_TESTIMONIALS: Testimonial[] = [
  {
    id: 'demo-1',
    name: 'Hana',
    quote:
      'Mathematics finally started making sense. My tutor explained each concept step by step and helped me become more confident.',
    subject: 'University mathematics',
    location: 'Addis Ababa',
    rating: 5,
    isDemo: true,
    isVerified: false,
  },
  {
    id: 'demo-2',
    name: 'Daniel',
    quote:
      'I needed help preparing for my university courses while studying remotely. The flexibility made a huge difference.',
    subject: 'University courses',
    location: 'Online',
    rating: 5,
    isDemo: true,
    isVerified: false,
  },
  {
    id: 'demo-3',
    name: 'Meron',
    quote:
      'Finding someone who understood exactly what I needed was easier than I expected.',
    subject: 'Exam preparation',
    location: 'Addis Ababa',
    rating: 5,
    isDemo: true,
    isVerified: false,
  },
  {
    id: 'demo-4',
    name: 'Demo Learner',
    quote:
      'My tutor explained programming using practical examples, which helped me understand how the concepts actually work.',
    subject: 'Programming',
    location: 'Online',
    rating: 5,
    isDemo: true,
    isVerified: false,
  },
  {
    id: 'demo-5',
    name: 'Demo Learner',
    quote:
      'The tutor was patient and adjusted the lessons based on what I already knew.',
    subject: 'English',
    location: 'Online',
    rating: 5,
    isDemo: true,
    isVerified: false,
  },
  {
    id: 'demo-6',
    name: 'Demo Parent',
    quote:
      'I wanted someone to explain the work my daughter was doing rather than just correct answers, and that is what we got from the first lesson.',
    subject: 'Mathematics',
    location: 'Addis Ababa',
    rating: undefined,
    isDemo: true,
    isVerified: false,
  },
  {
    id: 'demo-7',
    name: 'Demo Learner',
    quote:
      'Going over past papers with someone who knew the marking scheme made the format far less intimidating.',
    subject: 'Exam preparation',
    location: 'Addis Ababa',
    rating: undefined,
    isDemo: true,
    isVerified: false,
  },
  {
    id: 'demo-8',
    name: 'Demo Parent',
    quote:
      'What I valued was being able to read the tutor profile before making contact, and agreeing the times in writing first.',
    subject: 'English',
    location: 'Online',
    rating: undefined,
    isDemo: true,
    isVerified: false,
  },
  {
    id: 'demo-9',
    name: 'Demo Learner',
    quote:
      'The lessons started from what I could already do instead of from the start of the syllabus, which kept me moving forward.',
    subject: 'Chemistry',
    location: 'Online',
    rating: undefined,
    isDemo: true,
    isVerified: false,
  },
  {
    id: 'demo-10',
    name: 'Demo Learner',
    quote:
      'Sessions online meant I did not have to reorganize my whole week around travelling to a lesson.',
    subject: 'Mathematics',
    location: 'Ethiopia',
    rating: undefined,
    isDemo: true,
    isVerified: false,
  },
  {
    id: 'demo-11',
    name: 'Demo Learner',
    quote:
      'The tutor used diagrams to show how the algorithm actually runs, and that finally made it click.',
    subject: 'Programming',
    location: 'Online',
    rating: undefined,
    isDemo: true,
    isVerified: false,
  },
  {
    id: 'demo-12',
    name: 'Demo Parent',
    quote:
      'Booking was straightforward. I described what my son needed help with and the replies came back with the right kind of tutor.',
    subject: 'Exam preparation',
    location: 'Online',
    rating: undefined,
    isDemo: true,
    isVerified: false,
  },
]

/**
 * What the section renders today.
 *
 * Renamed rather than deleted when the API lands: point the import at the fetch
 * and this becomes the only line that changes.
 */
export const TESTIMONIALS: Testimonial[] = DEMO_TESTIMONIALS

/**
 * Split one list into two rows that travel in opposite directions.
 *
 * Alternating rather than slicing means both rows stay populated and both stay
 * varied however the list grows, and a new testimonial added anywhere in the
 * array reflows both rows without anyone editing the section. An odd-length list
 * leaves the shorter row one card down, which is invisible in a moving stream.
 *
 * No counts, totals or "showing X of Y" framing is derived from the array
 * anywhere: the impression of many learners has to come from the reader seeing
 * cards, not from a number we would be inventing.
 */
export function splitIntoRows(testimonials: readonly Testimonial[]): [Testimonial[], Testimonial[]] {
  return [
    testimonials.filter((_, index) => index % 2 === 0),
    testimonials.filter((_, index) => index % 2 === 1),
  ]
}

/**
 * Validate and normalise a `GET /api/testimonials` payload.
 *
 * Exists now, tested now, rather than being written on the day the endpoint is
 * built — an unvalidated cast would put `undefined` into every card field and
 * fail as a blank space in the layout rather than as a bad request. Anything that
 * cannot produce a readable card is dropped: a stream of cards is not a reason
 * to render an empty one.
 *
 * Demo content cannot arrive through here. `isDemo` is set to `false` because a
 * server that has no reason to know the concept of demo content cannot send it.
 */
export function toTestimonial(raw: unknown): Testimonial | null {
  if (typeof raw !== 'object' || raw === null) return null

  const record = raw as Record<string, unknown>
  const text = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined

  const id = text(record.id)
  const name = text(record.name)
  const quote = text(record.quote)
  const subject = text(record.subject)
  if (!id || !name || !quote || !subject) return null

  return {
    id,
    name,
    quote,
    subject,
    location: text(record.location),
    avatar: text(record.avatar),
    rating: toRating(record.rating),
    isVerified: record.isVerified === true,
    isDemo: false,
  }
}

/**
 * A rating is only ever a whole number in 1–5.
 *
 * Anything else — null, a string, 0, 9.4, NaN — is treated as "we do not know"
 * and renders as no stars at all. Clamping would be the friendlier-looking
 * choice and the dishonest one: it would turn a broken 9.4 into four stars.
 */
function toRating(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
    ? value
    : undefined
}
