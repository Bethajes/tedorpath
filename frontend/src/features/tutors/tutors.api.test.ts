import { describe, expect, it } from 'vitest'

import { buildTutorSearchParams } from './tutors.api'
import { DEFAULT_TUTOR_PAGE_SIZE, MAX_TUTOR_PAGE_SIZE } from './tutors.types'

/**
 * Tests for the directory query-string builder.
 *
 * `buildTutorSearchParams` is pure and is the one place where a filter can be
 * silently dropped, so it is worth pinning directly. Each case below is a bug
 * this implementation is specifically written to avoid.
 */
describe('buildTutorSearchParams', () => {
  it('always sends page and limit so the response is explainable', () => {
    const query = buildTutorSearchParams()

    expect(query.get('page')).toBe('1')
    expect(query.get('limit')).toBe(String(DEFAULT_TUTOR_PAGE_SIZE))
  })

  it('omits filters that are absent or blank', () => {
    const query = buildTutorSearchParams({
      q: '',
      subject: '   ',
      location: undefined,
      mode: undefined,
    })

    expect(query.has('q')).toBe(false)
    expect(query.has('subject')).toBe(false)
    expect(query.has('location')).toBe(false)
    expect(query.has('mode')).toBe(false)
  })

  it('trims filter values', () => {
    const query = buildTutorSearchParams({ q: '  calculus  ', location: ' Addis ' })

    expect(query.get('q')).toBe('calculus')
    expect(query.get('location')).toBe('Addis')
  })

  it('sends a zero rate instead of dropping it', () => {
    // A rate of 0 is a real filter — "free". A truthiness check would send
    // nothing and quietly show the whole directory instead.
    const query = buildTutorSearchParams({ minRate: 0 })

    expect(query.get('minRate')).toBe('0')
  })

  it('sends non-zero and zero rates alike', () => {
    const query = buildTutorSearchParams({ minRate: 10, maxRate: 0 })

    expect(query.get('minRate')).toBe('10')
    expect(query.get('maxRate')).toBe('0')
  })

  it('drops a non-finite rate rather than sending NaN', () => {
    const query = buildTutorSearchParams({ minRate: Number.NaN, maxRate: Number.POSITIVE_INFINITY })

    expect(query.has('minRate')).toBe(false)
    expect(query.has('maxRate')).toBe(false)
  })

  it('clamps the page size to the server maximum', () => {
    // The server answers 400 above 100, so an over-eager pager must not
    // become an error state.
    const query = buildTutorSearchParams({}, 1, 5000)

    expect(query.get('limit')).toBe(String(MAX_TUTOR_PAGE_SIZE))
  })

  it('clamps a zero, negative or fractional page size into range', () => {
    expect(buildTutorSearchParams({}, 1, 0).get('limit')).toBe('1')
    expect(buildTutorSearchParams({}, 1, -10).get('limit')).toBe('1')
    expect(buildTutorSearchParams({}, 1, 7.9).get('limit')).toBe('7')
  })

  it('falls back to the default when the page size is not a number', () => {
    expect(buildTutorSearchParams({}, 1, Number.NaN).get('limit')).toBe(
      String(DEFAULT_TUTOR_PAGE_SIZE),
    )
  })

  it('never lets the page number go below one', () => {
    expect(buildTutorSearchParams({}, 0).get('page')).toBe('1')
    expect(buildTutorSearchParams({}, -3).get('page')).toBe('1')
    expect(buildTutorSearchParams({}, 2.7).get('page')).toBe('2')
  })

  it('maps the filter names onto the query parameter names the API expects', () => {
    const query = buildTutorSearchParams({
      q: 'maths',
      subject: 'mathematics',
      studentLevel: 'High School',
      mode: 'BOTH',
      sort: 'price_asc',
    })

    expect(Object.fromEntries(query)).toMatchObject({
      q: 'maths',
      subject: 'mathematics',
      // The UI says "studentLevel"; the API parameter is `level`.
      level: 'High School',
      mode: 'BOTH',
      sort: 'price_asc',
    })
  })

  it('encodes values that need it', () => {
    const query = buildTutorSearchParams({ studentLevel: 'High School', q: 'a&b=c' })

    // Round-trips through URLSearchParams, so the wire format is valid.
    expect(new URLSearchParams(query.toString()).get('q')).toBe('a&b=c')
    expect(query.toString()).toContain('level=High+School')
  })
})
