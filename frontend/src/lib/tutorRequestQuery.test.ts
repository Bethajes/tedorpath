import { describe, expect, it } from 'vitest'

import { buildTutorRequestHref, parseTutorRequestPrefill } from './tutorRequestQuery'
import { tutorRequestSchema } from '@/features/tutorRequest/tutorRequest.schema'

/**
 * The chosen tutor has to survive the trip from a profile page to the stored
 * request.
 *
 * It used to be dropped in two places — nothing read `?tutorId=`, and the
 * schema had no field for it — so a client who deliberately chose a tutor
 * produced a request indistinguishable from one typed in cold. These cover the
 * two places the value is parsed, because either one losing it loses the whole
 * feature.
 */

const TUTOR_ID = 'a52b1a0f-03d2-48dc-8eca-8aa22f00a47c'

describe('parseTutorRequestPrefill — the chosen tutor', () => {
  it('reads a valid tutorId', () => {
    const prefill = parseTutorRequestPrefill(`?tutorId=${TUTOR_ID}`)

    expect(prefill.tutorProfileId).toBe(TUTOR_ID)
  })

  it('is empty when no tutor was chosen', () => {
    expect(parseTutorRequestPrefill('').tutorProfileId).toBe('')
    expect(parseTutorRequestPrefill('?subject=Mathematics').tutorProfileId).toBe('')
  })

  it('ignores a hand-edited id that is not a UUID', () => {
    // A hand-edited URL must not be able to seed the form with something the API
    // would reject on submit, after the client has already typed everything.
    for (const bad of ['not-a-uuid', '123', '../../etc/passwd', `${TUTOR_ID} OR 1=1`]) {
      expect(parseTutorRequestPrefill(`?tutorId=${encodeURIComponent(bad)}`).tutorProfileId).toBe('')
    }
  })

  it('carries the tutor alongside the other preferences', () => {
    const prefill = parseTutorRequestPrefill(
      `?tutorId=${TUTOR_ID}&subject=Mathematics&level=University&mode=Online`,
    )

    expect(prefill).toEqual({
      tutorProfileId: TUTOR_ID,
      subject: 'Mathematics',
      educationLevel: 'University',
      learningMode: 'Online',
    })
  })

  it('still applies the enum check to the other values', () => {
    // A bad tutor id must not stop the subject from being read, and vice versa.
    const prefill = parseTutorRequestPrefill('?tutorId=nope&subject=Underwater%20Basketweaving')

    expect(prefill.tutorProfileId).toBe('')
    expect(prefill.subject).toBe('')
  })
})

describe('buildTutorRequestHref', () => {
  it('omits a preference that was not chosen', () => {
    expect(buildTutorRequestHref({})).toBe('/request-tutor')
    expect(buildTutorRequestHref({ subject: '' })).toBe('/request-tutor')
  })

  it('includes the preferences that were chosen', () => {
    expect(buildTutorRequestHref({ subject: 'Physics' })).toBe(
      '/request-tutor?subject=Physics',
    )
  })
})

describe('tutorRequestSchema — tutorProfileId', () => {
  /**
   * A minimal valid submission.
   *
   * The optional text fields are required *strings* that may be empty rather
   * than optional keys, because the form always submits them; only `tutorProfileId`
   * and `verificationStatus`-style carry fields may be absent.
   */
  const valid = {
    fullName: 'Bethel Berihun',
    phone: '0912345678',
    telegram: '',
    email: '',
    subject: 'Mathematics',
    educationLevel: 'High School',
    learningMode: 'Online',
    helpDescription: 'I need help with calculus for my exam.',
    preferredLocation: '',
    preferredDays: '',
    preferredTime: '',
    budget: '',
    additionalInfo: '',
  }

  it('accepts a UUID', () => {
    const result = tutorRequestSchema.safeParse({ ...valid, tutorProfileId: TUTOR_ID })
    expect(result.success).toBe(true)
  })

  it('accepts an absent or empty value, because most people pick no tutor', () => {
    expect(tutorRequestSchema.safeParse({ ...valid }).success).toBe(true)
    expect(tutorRequestSchema.safeParse({ ...valid, tutorProfileId: '' }).success).toBe(true)
  })

  it('rejects a malformed id rather than sending it to the API', () => {
    const result = tutorRequestSchema.safeParse({ ...valid, tutorProfileId: 'nope' })
    expect(result.success).toBe(false)
  })
})
