/**
 * Everything the /how-it-works page says, in one place.
 *
 * Copy and configuration only — no JSX, no icons (those live in
 * `howItWorksIcons.tsx`, keyed by the ids below, the same split
 * `subjectCatalog.ts` and `SubjectIcon.tsx` use). Keeping the words apart from
 * the components means the page's argument can be reviewed, corrected or
 * shortened without touching a layout.
 *
 * NOTHING HERE INVENTS A FACT. No tutor counts, no ratings, no response times
 * and no testimonials: the platform collects none of those, so any such figure
 * would be fiction (Requirement 14). The one number band on the page reads the
 * live `GET /api/public/stats` endpoint, and every claim below describes a
 * process that exists — a person reads the request, a person reviews the tutor,
 * and a person on the team will re-match a learner who is not happy.
 */

/** Which of the three line icons a step uses. */
export type StepIconId = 'request' | 'match' | 'lesson'

export interface Step {
  /** Two-digit position, shown in the badge and by the list semantics. */
  number: string
  title: string
  description: string
  icon: StepIconId
  /**
   * One short line under the title answering "how long does this take?" or
   * "who does this?" — the question a reader has at each step and the reason
   * they keep reading.
   */
  meta: string
  /** Three specifics worth seeing without expanding anything. */
  points: readonly string[]
}

export const STEPS: readonly Step[] = [
  {
    number: '01',
    title: 'Tell us what you need',
    description:
      'Fill in a short request: the subject, your level, your goals and any deadline. It takes about two minutes, and nothing you write is published anywhere.',
    icon: 'request',
    meta: 'About two minutes',
    points: ['Subject and level', 'Your goals and deadlines', 'Online or in person'],
  },
  {
    number: '02',
    title: 'We find your tutor',
    description:
      'Our team reads the request and handpicks tutors whose subject knowledge, availability and teaching style fit what you described. A person makes the match, not an algorithm.',
    icon: 'match',
    meta: 'Reviewed by our team',
    points: ['Subject expertise', 'Availability', 'Teaching style'],
  },
  {
    number: '03',
    title: 'Start learning, your way',
    description:
      'Connect with your tutor for the first session and agree the times that work. Sessions run over video or face to face. If the fit is not right, tell us and we will find you another tutor at no extra charge.',
    icon: 'lesson',
    meta: 'Online or in person',
    points: ['Times that suit you', 'Video or face to face', 'Free re-match if needed'],
  },
]

/**
 * The three claims under the hero's calls to action.
 *
 * Deliberately no figures. They are the same three things the homepage makes in
 * its trust points, and each one is a fact about how the platform works rather
 * than a number we would have to earn.
 */
export const HERO_TRUST_POINTS: readonly string[] = [
  'Reviewed by our team, not an algorithm',
  'Online or in person, wherever you are',
  'School, university, professional skills and exam preparation',
]

/**
 * The reassurance list beside the "right fit, or we fix it" promise.
 *
 * Same constraint as the FAQ: each line describes something that actually
 * happens, so there is no "background checked", "certified" or "guaranteed
 * results" here.
 */
export const PROMISE_POINTS: readonly { title: string; description: string }[] = [
  {
    title: 'Tell us what went wrong',
    description: 'A message to the team is enough. There is no form to complete and no argument to win.',
  },
  {
    title: 'We send another tutor',
    description:
      'We go back to the pool and look again, taking what you disliked into account the second time.',
  },
  {
    title: 'No extra charge',
    description: 'Re-matching you is our problem to solve, not an extra line on your bill.',
  },
]

/**
 * The live statistics band.
 *
 * `key` is a field of `PublicStats` — the response shape of
 * `GET /api/public/stats`, which counts real database records. `fallback` is
 * shown instead of the number when the count is zero, unknown or the request
 * failed; those wordings are vague on purpose, because a specific figure here
 * would be a claim the platform has not earned, and "0 tutors" reads as a dead
 * marketplace rather than a new one.
 *
 * Requirements 4.2, 4.3, 4.5, 14.5 — the same rules `StatsSection` follows on
 * the homepage, deliberately not relaxed on this page.
 */
export const STAT_DEFINITIONS: readonly {
  key: 'approvedTutors' | 'subjects' | 'universities' | 'countries'
  label: string
  sub: string
  fallback: string
}[] = [
  {
    key: 'approvedTutors',
    label: 'Approved tutors',
    sub: 'live on the platform now',
    fallback: 'Growing',
  },
  {
    key: 'subjects',
    label: 'Subjects covered',
    sub: 'from primary maths upward',
    fallback: 'Many',
  },
  {
    key: 'universities',
    label: 'University backgrounds',
    sub: 'represented by our tutors',
    fallback: 'Several',
  },
  {
    key: 'countries',
    label: 'Countries represented',
    sub: 'where sessions are taught',
    fallback: 'Multiple',
  },
]

export interface Faq {
  question: string
  answer: string
}

export const FAQS: readonly Faq[] = [
  {
    question: 'How long until I hear back after submitting a request?',
    answer:
      'A person on our team reads every request and comes back to you about it. If you have a deadline, put it in the form and we will work to it.',
  },
  {
    question: 'Can I choose between online and in-person sessions?',
    answer:
      'Yes. You can say online, in person, or either, and we will only suggest tutors who already work that way. Most sessions happen online, in English.',
  },
  {
    question: 'What if the tutor is not a good fit?',
    answer:
      'Tell us and we will find you a replacement at no extra charge. Matching a learner to a tutor is a judgement, and we would rather redo it than have you stick with it.',
  },
  {
    question: 'How are tutors vetted?',
    answer:
      'Every tutor applies with their subjects, experience and education, and a member of our team reviews the application. Where we need supporting documents we ask for them, and a person reviews what arrives. Only tutors who pass that review get a public profile.',
  },
  {
    question: 'What subjects can I get help with?',
    answer:
      'From primary school mathematics and English through to university calculus, physics, programming and exam preparation. If you are not sure where your question fits, ask us and we will point you the right way.',
  },
]
