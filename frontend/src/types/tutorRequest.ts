/**
 * Shared enums and input type for the tutor request form.
 *
 * Note: these are plain const arrays (not TypeScript `enum`s) so the values are
 * erasable and can be shared with the API layer later without code generation.
 */

export const SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'Programming',
  'AI & Technology',
  'University Course',
  'Exam Preparation',
  'Other',
] as const

export type Subject = (typeof SUBJECTS)[number]

export const EDUCATION_LEVELS = [
  'Primary School',
  'High School',
  'University',
  'Adult Learning',
  'Other',
] as const

export type EducationLevel = (typeof EDUCATION_LEVELS)[number]

export const LEARNING_MODES = ['Online', 'In-person', 'Either'] as const

export type LearningMode = (typeof LEARNING_MODES)[number]

/** Shape submitted by the tutor request form. */
export interface TutorRequestInput {
  fullName: string
  phone: string
  telegram: string
  email: string
  subject: Subject | ''
  educationLevel: EducationLevel | ''
  learningMode: LearningMode | ''
  helpDescription: string
  preferredLocation: string
  preferredDays: string
  preferredTime: string
  budget: string
  additionalInfo: string
}
