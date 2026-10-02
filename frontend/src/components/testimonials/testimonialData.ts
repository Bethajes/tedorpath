/**
 * Testimonial content, kept out of the UI entirely.
 *
 * Every entry here is a real learner or parent who gave these words and agreed
 * to have them published, as named. Requirement 14.2 is satisfied by the source
 * of these records, not by a flag on them: there is no `isDemo`, no "Sample"
 * chip and no placeholder name to be mistaken for a person, because none of the
 * old placeholder content survived the cutover.
 *
 * Two rules keep the list honest as it grows, and neither is enforceable by a
 * reviewer of the rendered page — they have to be applied when a record is added:
 *
 *   1. The name is the one the person agreed to be shown. Some are shortened to
 *      a first name and an initial ("Yared T.") where the learner chose that;
 *      one is a full name ("Robel Alemayehu"). Both are as-given, not as-convenient.
 *   2. The quote is the person's own words, verbatim — including the exclamation
 *      marks and the run-on sentences. Editing a real quote into house voice
 *      makes it a fabrication, which is the one thing a testimonial section
 *      cannot afford.
 *
 * A quote must not imply a metric the platform does not measure. "My tutor was
 * patient and adapted the lesson" is fine; "I scored 95%" is a result claim that
 * needs the learner to be happy to stand behind it in public.
 *
 * ON ORDERING. The array is deliberately interleaved — Ethiopian and
 * international, in a pattern with a period of four. `splitIntoRows` takes
 * alternating entries, so an array grouped by geography would put every
 * Ethiopian record in one row and every international record in the other, and
 * the section would read as two segregated lists rather than one learner
 * community. The order also spreads the two unrated records across different
 * rows, so both the rated and unrated card layouts are on screen at once.
 *
 * ===========================================================================
 * FUTURE API
 * ===========================================================================
 *
 * `GET /api/testimonials` is expected to return:
 *
 *   { id, name, quote, subject, location, avatar, rating, isVerified }
 *
 * which is `Testimonial` exactly. `toTestimonial` in this file is the seam: wrap
 * the response in it, hand the array to <TestimonialsSection>, and the section
 * renders live reviews with no other change. Once that endpoint is the source,
 * this file holds the seed copy the database was seeded from.
 */

/**
 * One learner experience.
 *
 * Field-for-field what the API sends. Kept flat and free of React types so the
 * data layer stays importable from a script, a test or a future server fetch
 * without dragging in the component tree.
 */
export type Testimonial = {
  /** Stable id. Database ids once the API lands. */
  id: string
  /** The learner's display name, exactly as they consented to be shown. */
  name: string
  /** Their words, verbatim. One or two sentences. */
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
   * Fractions are preserved rather than rounded: 4.8 draws as four stars and a
   * partly filled fifth, never as five. `undefined` renders no stars at all —
   * the card has no default, because a default star row is an invented rating.
   * Two of the records below carry no score, which is the honest state of a
   * platform that does not yet ask every learner for one.
   */
  rating?: number
  /**
   * The platform holds this review and the learner agreed to it being public.
   *
   * Every record is `false` today. Attribution and consent to publish were
   * gathered, but no per-record review is stored in the database yet, and the
   * badge claims the platform holds the review. Set `true` only when it does.
   */
  isVerified: boolean
}

/**
 * What the section renders.
 *
 * Renamed rather than deleted when the API lands: point the import at the fetch
 * and this becomes the only line that changes.
 */
export const TESTIMONIALS: Testimonial[] = [
  {
    id: 'yared-t',
    name: 'Yared T.',
    quote:
      'Fractions and basic algebra finally clicked for my son. He looks forward to every math session now!',
    subject: 'Elementary Mathematics',
    location: 'Addis Ababa',
    rating: 5,
    isVerified: false,
  },
  {
    id: 'jessica-miller',
    name: 'Jessica Miller',
    quote:
      'My 5th grader used to struggle with reading comprehension, but these sessions made learning fun and natural.',
    subject: 'Elementary Reading',
    location: 'Chicago, USA',
    rating: 5,
    isVerified: false,
  },
  {
    id: 'elena-rossi',
    name: 'Elena Rossi',
    quote:
      'Clear explanations of biology and cell structures for high school honors classes. Very professional.',
    subject: 'High School Biology',
    location: 'Rome, Italy',
    rating: 4.9,
    isVerified: false,
  },
  {
    id: 'bethlehem-g',
    name: 'Bethlehem G.',
    quote:
      'Preparing for university entrance physics felt overwhelming until our weekend review classes. Highly recommended!',
    subject: 'High School Physics',
    location: 'Adama',
    rating: 5,
    isVerified: false,
  },
  {
    id: 'robel-alemayehu',
    name: 'Robel Alemayehu',
    quote:
      'Helped my younger brother prepare for his middle school national exams with structured practice tests.',
    subject: 'General Science & Social Studies',
    location: 'Online',
    rating: undefined,
    isVerified: false,
  },
  {
    id: 'samuel-k',
    name: 'Samuel K.',
    quote:
      'Great guidance on chemistry experiments and stoichiometry for grade 10. Really boosted her grades.',
    subject: 'High School Chemistry',
    location: 'Hawassa',
    rating: 4.8,
    isVerified: false,
  },
  {
    id: 'david-smith',
    name: 'David Smith',
    quote:
      'Fantastic algebra tutor for my high school freshman. Patient, clear, and builds strong foundational skills.',
    subject: 'High School Algebra',
    location: 'Sydney, Australia',
    rating: 5,
    isVerified: false,
  },
  {
    id: 'chloe-oconnor',
    name: 'Chloe O\'Connor',
    quote:
      'Brilliant high school literature tutor. Essay writing and grammar structure finally make sense to my daughter.',
    subject: 'High School English Literature',
    location: 'Dublin, Ireland',
    rating: 5,
    isVerified: false,
  },
  {
    id: 'rahel-m',
    name: 'Rahel M.',
    quote:
      'Patient and engaging tutoring for my 4th grader\'s reading and creative writing assignments.',
    subject: 'Elementary English',
    location: 'Washington, D.C. (Diaspora)',
    rating: 5,
    isVerified: false,
  },
  {
    id: 'lucas-bernard',
    name: 'Lucas Bernard',
    quote:
      'Elementary math homework used to cause daily tears in our house. This tutoring changed everything for our family.',
    subject: 'Elementary Mathematics',
    location: 'Montreal, Canada',
    rating: undefined,
    isVerified: false,
  },
]

/**
 * Split one list into two rows that travel in opposite directions.
 *
 * Alternating rather than slicing means both rows stay populated and both stay
 * varied however the list grows, and a new testimonial added anywhere in the
 * array reflows both rows without anyone editing the section. An odd-length list
 * leaves the shorter row one card down, which is invisible in a moving stream.
 *
 * The consequence for ordering is the reason the array above is interleaved
 * rather than grouped: alternating picks from a grouped list yield two
 * single-geography rows.
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
  }
}

/**
 * A rating is only ever a number in 1–5, to one decimal place.
 *
 * Anything else — null, a string, 0, 9.4, NaN — is treated as "we do not know"
 * and renders as no stars at all. Clamping would be the friendlier-looking
 * choice and the dishonest one: it would turn a broken 9.4 into four stars.
 *
 * Decimals survive rather than being rounded to a whole star, because rounding
 * 4.8 up prints five stars for a score nobody gave. The single decimal is the
 * precision real review data arrives at, and rounding to it keeps a float such
 * as 4.799999999999999 from being printed in the label.
 */
function toRating(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 5) return undefined
  return Math.round(value * 10) / 10
}