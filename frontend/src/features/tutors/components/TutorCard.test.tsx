import { render, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import type { TutorCardDTO } from '../tutors.types'

import { TutorCard } from './TutorCard'

/**
 * **Feature: tutor-marketplace, Property 9: TutorCard renders all required public fields**
 * **Validates: Requirements 9.1, 9.4**
 */

/**
 * Renders one card and returns queries scoped to *that* card.
 *
 * The scope matters: a property test renders many cards in a single `it`, and
 * `screen` searches the whole document, so the second iteration would find the
 * first iteration's "View Profile" link too and fail on a duplicate.
 */
function renderCard(tutor: TutorCardDTO) {
  const { container } = render(
    <MemoryRouter>
      <TutorCard tutor={tutor} />
    </MemoryRouter>,
  )

  return {
    container,
    text: container.textContent ?? '',
    ...within(container),
  }
}

/**
 * A TutorCardDTO in the shape the list endpoint really sends.
 *
 * Text is generated without leading/trailing whitespace, because the card
 * truncates long values for layout: a name padded with spaces would make the
 * "contains the display name" assertion fail for reasons that have nothing to
 * do with the component.
 */
const tutorArbitrary: fc.Arbitrary<TutorCardDTO> = fc.record({
  id: fc.uuid(),
  displayName: fc
    .string({ minLength: 1, maxLength: 40 })
    .filter((value) => value.trim().length > 0),
  headline: fc
    .string({ minLength: 1, maxLength: 80 })
    .filter((value) => value.trim().length > 0),
  bio: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
  profilePhotoUrl: fc.option(fc.webUrl(), { nil: null }),
  teachingMode: fc.constantFrom('ONLINE', 'IN_PERSON', 'BOTH'),
  location: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: null }),
  hourlyRate: fc.option(
    fc.integer({ min: 0, max: 500 }).map((value) => value / 100),
    { nil: null },
  ),
  studentLevels: fc.array(fc.constantFrom('High School', 'University'), { minLength: 1 }),
  createdAt: fc.constant(new Date('2024-01-01T00:00:00.000Z').toISOString()),
  subjects: fc.array(
    fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 30 }).filter((value) => value.trim().length > 0),
      slug: fc.stringMatching(/^[a-z0-9-]{1,30}$/),
    }),
    { minLength: 1, maxLength: 4 },
  ),
})

/**
 * Patterns Requirement 9.4 forbids on the card.
 *
 * A star rating, a lesson count, a satisfaction percentage or a testimonial
 * count. The card has no data model behind any of these, so rendering one would
 * be inventing a number (Requirement 9.4).
 */
const FABRICATED_METRIC_PATTERNS: readonly RegExp[] = [
  /\d(\.\d)?\s*★/u,
  /★\s*\d/u,
  /\bstars?\b/iu,
  /\b\d[\d,]*\+?\s*hours?\b/iu,
  /\b\d+\s*%\s*(satisfaction|happy|rated)/iu,
  /\b\d[\d,]*\+?\s*(lessons?|sessions?|classes?)\s*(taught|completed)?/iu,
  /\b\d[\d,]*\+?\s*(happy\s+)?(students?|learners?)\b/iu,
  /\b\d[\d,]*\+?\s*reviews?\b/iu,
  /\b\d+\s*(\/\s*5)\b/u,
]

describe('Property 9: TutorCard renders all required public fields', () => {
  it('renders every required field for any valid TutorCardDTO', async () => {
    await fc.assert(
      fc.asyncProperty(tutorArbitrary, async (tutor) => {
        const card = renderCard(tutor)

        // Display name and headline.
        expect(card.text).toContain(tutor.displayName)
        expect(card.text).toContain(tutor.headline)

        // At least one subject name.
        expect(card.text).toContain(tutor.subjects[0].name)

        // Teaching mode indicator: the enum value is stored, words are shown.
        const modeLabel = {
          ONLINE: 'Online',
          IN_PERSON: 'In person',
          BOTH: 'Online & in person',
        }[tutor.teachingMode]
        expect(card.text).toContain(modeLabel)

        // A "View Profile" link pointing at this tutor.
        const link = card.getByRole('link', { name: /view profile/i })
        expect(link).toHaveAttribute('href', `/tutors/${tutor.id}`)
      }),
      { numRuns: 100 },
    )
  })

  it('never renders a fabricated metric for any valid TutorCardDTO', async () => {
    await fc.assert(
      fc.asyncProperty(tutorArbitrary, async (tutor) => {
        const { text } = renderCard(tutor)

        for (const pattern of FABRICATED_METRIC_PATTERNS) {
          expect(text).not.toMatch(pattern)
        }
      }),
      { numRuns: 100 },
    )
  })
})

describe('TutorCard (Requirement 9.2 — placeholder avatar)', () => {
  it('shows a placeholder, not a broken image, when there is no photo', () => {
    const tutor: TutorCardDTO = {
      id: 'a1',
      displayName: 'Ada Lovelace',
      headline: 'Mathematics',
      bio: null,
      profilePhotoUrl: null,
      teachingMode: 'ONLINE',
      location: null,
      hourlyRate: null,
      studentLevels: ['University'],
      createdAt: '2024-01-01T00:00:00.000Z',
      subjects: [{ id: 's1', name: 'Mathematics', slug: 'mathematics' }],
    }
    const card = renderCard(tutor)

    // The real failure mode Requirement 9.2 guards against: an <img> with a
    // missing or empty src renders the browser's broken-image glyph.
    expect(card.container.querySelector('img')).toBeNull()
    expect(
      card.getByRole('img', { name: /ada lovelace profile photo placeholder/i }),
    ).toBeInTheDocument()
  })

  it('gives both the photo and the placeholder the same accessible name', () => {
    // `profilePhotoUrl` is the field under test, so it is left out of the base
    // and supplied per case rather than defaulted once.
    const base: Omit<TutorCardDTO, 'profilePhotoUrl'> = {
      id: 'a1',
      displayName: 'Ada Lovelace',
      headline: 'Mathematics',
      bio: null,
      teachingMode: 'ONLINE',
      location: null,
      hourlyRate: null,
      studentLevels: ['University'],
      createdAt: '2024-01-01T00:00:00.000Z',
      subjects: [{ id: 's1', name: 'Mathematics', slug: 'mathematics' }],
    }

    const withPhoto = renderCard({ ...base, profilePhotoUrl: 'https://example.com/a.png' })
    expect(withPhoto.getByRole('img', { name: 'Ada Lovelace profile photo' })).toHaveAttribute(
      'src',
      'https://example.com/a.png',
    )

    const withoutPhoto = renderCard({ ...base, profilePhotoUrl: null })
    expect(
      withoutPhoto.getByRole('img', { name: 'Ada Lovelace profile photo placeholder' }),
    ).toBeInTheDocument()
  })
})

describe('TutorCard (Requirement 9.1 — conditional fields)', () => {
  const base: TutorCardDTO = {
    id: 'a1',
    displayName: 'Ada Lovelace',
    headline: 'Mathematics',
    bio: null,
    profilePhotoUrl: null,
    teachingMode: 'ONLINE',
    location: null,
    hourlyRate: null,
    studentLevels: ['University'],
    createdAt: '2024-01-01T00:00:00.000Z',
    subjects: [{ id: 's1', name: 'Mathematics', slug: 'mathematics' }],
  }

  it('omits location and rate entirely when they are null', () => {
    const card = renderCard(base)

    expect(card.text).not.toContain('per hour')
    expect(card.queryByText('Location')).toBeNull()
  })

  it('shows location and rate when present', () => {
    const card = renderCard({ ...base, location: 'Addis Ababa', hourlyRate: 25 })

    expect(card.text).toContain('Addis Ababa')
    expect(card.text).toContain('25 per hour')
  })

  it('shows a zero rate rather than treating it as absent', () => {
    // 0 is a real price. A truthiness check would hide the one tutor who is
    // free, which is exactly the person a visitor is looking for.
    const card = renderCard({ ...base, hourlyRate: 0 })

    expect(card.text).toContain('0 per hour')
  })

  it('shows at most two subject names and counts the rest', () => {
    const { text } = renderCard({
      ...base,
      subjects: [
        { id: 's1', name: 'Mathematics', slug: 'mathematics' },
        { id: 's2', name: 'Physics', slug: 'physics' },
        { id: 's3', name: 'Chemistry', slug: 'chemistry' },
        { id: 's4', name: 'Biology', slug: 'biology' },
      ],
    })

    expect(text).toContain('Mathematics')
    expect(text).toContain('Physics')
    expect(text).not.toContain('Chemistry')
    expect(text).not.toContain('Biology')
    expect(text).toContain('+2 more')
  })

  it('does not show a "+N more" chip when there are at most two subjects', () => {
    const { text } = renderCard({
      ...base,
      subjects: [
        { id: 's1', name: 'Mathematics', slug: 'mathematics' },
        { id: 's2', name: 'Physics', slug: 'physics' },
      ],
    })

    expect(text).not.toContain('more')
  })
})
