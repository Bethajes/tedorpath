import { EDUCATION_LEVELS, LEARNING_MODES, SUBJECTS } from '@/types/tutorRequest'

export { EDUCATION_LEVELS, LEARNING_MODES, SUBJECTS }

/** Placeholder shown on the empty "select" option of each required dropdown. */
export const SELECT_PLACEHOLDER = 'Please select…'

export const FORM_SECTIONS = {
  information: {
    title: 'Your Information',
    description: 'So we know how to reach you.',
  },
  learning: {
    title: 'What You Want to Learn',
    description: 'This helps us understand the kind of support you need.',
  },
  preferences: {
    title: 'Your Preferences',
    description: 'Optional — share anything that would make tutoring work better for you.',
  },
  additional: {
    title: 'Additional Information',
    description: 'Anything else you would like us to know.',
  },
} as const

export const SUBMIT_LABEL = 'Send Tutor Request'
export const SUBMITTING_LABEL = 'Sending…'

export const SUCCESS_HEADING = 'Request Received'
export const SUCCESS_MESSAGE =
  'Thank you for contacting Tedor Tutors. Our team will review your request and contact you shortly.'
