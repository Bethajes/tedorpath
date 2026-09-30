import { z } from 'zod'

import { EMAIL_PATTERN, PHONE_PATTERN, TELEGRAM_PATTERN } from '@/lib/validators'
import { EDUCATION_LEVELS, LEARNING_MODES, SUBJECTS } from '@/types/tutorRequest'

/** Optional free-text field: empty string is allowed, otherwise length-limited. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `Please keep ${label} under ${max} characters.`)

export const tutorRequestSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Please enter your full name (at least 2 characters).')
    .max(80, 'Please keep your name under 80 characters.'),

  phone: z
    .string()
    .trim()
    .min(7, 'Please enter a phone number we can reach you on.')
    .max(20, 'Please keep your phone number under 20 characters.')
    .regex(
      PHONE_PATTERN,
      'Use digits, spaces and the symbols + - ( ) only.',
    ),

  // The 64-char field cap is the documented limit, but Telegram itself caps
  // handles at 32 characters, so TELEGRAM_PATTERN is the binding constraint.
  telegram: optionalText(64, 'your Telegram username').refine(
    (value) => value === '' || TELEGRAM_PATTERN.test(value),
    'Enter a Telegram username like @yourname (up to 32 letters, numbers and _).',
  ),

  email: optionalText(255, 'your email').refine(
    (value) => value === '' || EMAIL_PATTERN.test(value),
    'Please enter a valid email address, or leave this field empty.',
  ),

  subject: z
    .enum(SUBJECTS, { message: 'Please choose the subject you need help with.' })
    .or(z.literal(''))
    .refine((value) => value !== '', 'Please choose the subject you need help with.'),

  educationLevel: z
    .enum(EDUCATION_LEVELS, { message: 'Please choose your education level.' })
    .or(z.literal(''))
    .refine((value) => value !== '', 'Please choose your education level.'),

  learningMode: z
    .enum(LEARNING_MODES, { message: 'Please choose how you would like to learn.' })
    .or(z.literal(''))
    .refine((value) => value !== '', 'Please choose how you would like to learn.'),

  helpDescription: z
    .string()
    .trim()
    .min(10, 'Please tell us a little more — at least 10 characters.')
    .max(1000, 'Please keep your description under 1000 characters.'),

  preferredLocation: optionalText(120, 'your preferred location'),
  preferredDays: optionalText(120, 'your preferred days'),
  preferredTime: optionalText(120, 'your preferred time'),
  budget: optionalText(80, 'your budget'),
  additionalInfo: optionalText(500, 'additional information'),

  /**
   * The tutor the client chose from a profile, as a TutorProfile id.
   *
   * Optional, because most people reach the form without a tutor in mind and
   * must still be able to use it. The empty string is accepted here and dropped
   * before the request is sent, so "no tutor chosen" has one representation
   * inside the form instead of two.
   *
   * Carried rather than chosen in the form itself: a client who picked a tutor
   * should not be able to change that decision by editing a dropdown, because
   * the tutor is the thing being asked for, not a preference.
   */
  tutorProfileId: z
    .string()
    .uuid('Tutor profile must be a valid ID.')
    .or(z.literal(''))
    .optional(),
})

export type TutorRequestValues = z.input<typeof tutorRequestSchema>

/**
 * Validated shape. Differs from the input in that the three dropdowns are
 * guaranteed to hold a real choice rather than the empty string.
 */
export type TutorRequestPayload = z.output<typeof tutorRequestSchema>
