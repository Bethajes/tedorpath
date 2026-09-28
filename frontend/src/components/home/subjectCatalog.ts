import type { Subject } from '@/types/tutorRequest'

/**
 * How the supported subjects are grouped for discovery on the homepage.
 *
 * The list is derived from the single `SUBJECTS` constant that the request form
 * and the API already validate against, so a subject can never be advertised
 * here without also being accepted by the form.
 */

export interface SubjectEntry {
  /** Matches a value in `SUBJECTS` exactly — this is what gets submitted. */
  subject: Subject
  /** One short line explaining what a tutor can help with. */
  description: string
}

export interface SubjectGroup {
  id: string
  title: string
  summary: string
  subjects: SubjectEntry[]
}

export const SUBJECT_GROUPS: SubjectGroup[] = [
  {
    id: 'school-subjects',
    title: 'School Subjects',
    summary: 'Core subjects from primary through high school.',
    subjects: [
      {
        subject: 'Mathematics',
        description: 'Algebra, calculus, geometry and problem-solving technique.',
      },
      {
        subject: 'Physics',
        description: 'Mechanics, electricity, waves and worked examples.',
      },
      {
        subject: 'Chemistry',
        description: 'Reactions, bonding, quantities and lab concepts.',
      },
      {
        subject: 'Biology',
        description: 'Cells, genetics, ecology and human biology.',
      },
      {
        subject: 'English',
        description: 'Essay writing, comprehension, grammar and analysis.',
      },
    ],
  },
  {
    id: 'technology',
    title: 'Technology',
    summary: 'Practical, career-oriented technical skills.',
    subjects: [
      {
        subject: 'Programming',
        description: 'Python, JavaScript, algorithms and debugging.',
      },
      {
        subject: 'AI & Technology',
        description: 'Artificial intelligence, machine learning and modern tooling.',
      },
    ],
  },
  {
    id: 'university-and-exams',
    title: 'University & Exams',
    summary: 'Degree-level coursework and structured exam preparation.',
    subjects: [
      {
        subject: 'University Course',
        description: 'Module-specific help with lectures, assignments and exams.',
      },
      {
        subject: 'Exam Preparation',
        description: 'National, university and entrance exam preparation.',
      },
    ],
  },
]

/**
 * `Other` is deliberately kept out of the category grid: it is the fallback for
 * anything not listed, so it gets its own full-width invitation at the end of
 * the section instead of a category of its own.
 */
export const OTHER_SUBJECT_ENTRY: SubjectEntry = {
  subject: 'Other',
  description: 'Tell us what you need and our team will look for the right tutor.',
}
