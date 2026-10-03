/**
 * Copy the request wizard shares with the confirmation card, plus the discovery
 * vocabulary the homepage still uses.
 *
 * `SUBJECTS`, `EDUCATION_LEVELS` and `LEARNING_MODES` used to be the single
 * source of truth for what the request form would accept, duplicated in the API's
 * validation module. Both of those are gone: the wizard reads subjects, levels and
 * currencies from `GET /api/onboarding/config`, so adding one is a data change.
 *
 * They are still the vocabulary of the *discovery* surfaces — the homepage search
 * card and subject grid, and the tutor directory's filters — which are marketing
 * pages with a fixed set of links rather than forms. They are re-exported from
 * `@/types/tutorRequest` so those pages keep one list, and the labels they hold
 * are all present in the catalogue, so a link built from one resolves in the
 * other.
 */

import { EDUCATION_LEVELS, LEARNING_MODES, SUBJECTS } from '@/types/tutorRequest'

export { EDUCATION_LEVELS, LEARNING_MODES, SUBJECTS }

export const SUCCESS_HEADING = 'Request Received'
export const SUCCESS_MESSAGE =
  'Thank you for contacting Tedor Tutors. Our team will review your request and contact you shortly.'