import { describe, expect, it } from 'vitest'

import { SUBJECTS } from '@/types/tutorRequest'

import { SUBJECT_OPTIONS, slugToSubject } from './tutorSubjects'
import {
  buildTutorRequestHrefFromFilters,
  prefillFromTutorFilters,
} from './tutorRequestHref'
import type { TutorFilters } from './tutors.types'

/**
 * The slug the directory filter sends to the API.
 */
function subjectFilter(slug: string): TutorFilters {
  return { subject: slug }
}

describe('slugToSubject', () => {
  it('maps a known directory slug to the request form subject', () => {
    expect(slugToSubject('mathematics')).toBe('Mathematics')
    expect(slugToSubject('ai-technology')).toBe('AI & Technology')
  })

  it('returns an empty string for an absent slug', () => {
    expect(slugToSubject(undefined)).toBe('')
    expect(slugToSubject('')).toBe('')
  })

  it('returns an empty string for a slug it does not recognise', () => {
    // `?subject=` is taken straight from the URL, so it can hold anything.
    expect(slugToSubject('astrophysics')).toBe('')
  })
})

describe('SUBJECT_OPTIONS and the request form SUBJECTS enum', () => {
  it('covers every subject the request form offers', () => {
    // The two lists describe the same ten subjects. If one grows and the other
    // does not, a parent filtering the directory by the new subject would be
    // carried into a form that cannot hold it.
    const labels = SUBJECT_OPTIONS.map((option) => option.label)
    expect(new Set(labels)).toEqual(new Set(SUBJECTS))
  })

  it('has a unique slug per entry', () => {
    const slugs = SUBJECT_OPTIONS.map((option) => option.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})

describe('prefillFromTutorFilters', () => {
  it('carries subject, level and mode across', () => {
    expect(
      prefillFromTutorFilters({
        subject: 'physics',
        studentLevel: 'High School',
        mode: 'ONLINE',
      }),
    ).toEqual({
      subject: 'Physics',
      educationLevel: 'High School',
      learningMode: 'Online',
    })
  })

  it('maps each teaching mode to the learning mode that asks the same question', () => {
    expect(prefillFromTutorFilters({ mode: 'ONLINE' }).learningMode).toBe('Online')
    expect(prefillFromTutorFilters({ mode: 'IN_PERSON' }).learningMode).toBe('In-person')
    // A tutor who does either is the same answer to "which do you want?" as
    // "either suits you".
    expect(prefillFromTutorFilters({ mode: 'BOTH' }).learningMode).toBe('Either')
  })

  it('leaves fields empty when the corresponding filter is not set', () => {
    expect(prefillFromTutorFilters({})).toEqual({
      subject: '',
      educationLevel: '',
      learningMode: '',
    })
  })

  it('drops filters the request form has no field for', () => {
    const prefill = prefillFromTutorFilters({
      q: 'calculus',
      location: 'Manchester',
      language: 'Urdu',
      minRate: 10,
      maxRate: 30,
    })

    expect(prefill).toEqual({ subject: '', educationLevel: '', learningMode: '' })
  })
})

describe('buildTutorRequestHrefFromFilters', () => {
  it('is a bare route when nothing is filtered', () => {
    expect(buildTutorRequestHrefFromFilters({})).toBe('/request-tutor')
  })

  it('carries the active filters into the query string', () => {
    const href = buildTutorRequestHrefFromFilters({
      subject: 'chemistry',
      studentLevel: 'University',
      mode: 'BOTH',
    })

    const query = new URL(href, 'http://localhost').searchParams
    expect(query.get('subject')).toBe('Chemistry')
    expect(query.get('level')).toBe('University')
    expect(query.get('mode')).toBe('Either')
  })

  it('omits filters that are not set', () => {
    const href = buildTutorRequestHrefFromFilters({ subject: 'english' })

    expect(href).toBe('/request-tutor?subject=English')
  })

  it('ignores a subject slug the form could not hold', () => {
    const href = buildTutorRequestHrefFromFilters(subjectFilter('not-a-subject'))

    expect(href).toBe('/request-tutor')
  })
})
