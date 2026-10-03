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
  // Paired with the rate above. Generated independently on purpose: the point is
  // that a currency is always present whenever a rate is, and this suite would
  // not notice if the component started inventing one when it is not.
  hourlyRateCurrency: fc.option(fc.constantFrom('ETB', 'USD'), { nil: null }),
  studentLevels: fc.array(fc.constantFrom('High School', 'University'), { minLength: 1 }),
  // Tutor-authored free text, so the generator includes multi-language and
  // empty cases — the card has to cope with both (Requirement 30.6).
  languages: fc.array(
    fc.string({ minLength: 2, maxLength: 18 }).filter((value) => value.trim().length > 0),
    { maxLength: 4 },
  ),
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

        /*
          A "View Profile" link pointing at this tutor. It carries no market: the
          server decides once, from who is asking, which price this visitor is
          shown, so a link that named one could only re-assert what the card is
          already displaying.
        */
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
      hourlyRateCurrency: null,
      studentLevels: ['University'],
      languages: [],
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
      hourlyRateCurrency: null,
      studentLevels: ['University'],
      languages: [],
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
    hourlyRateCurrency: null,
    studentLevels: ['University'],
    languages: [],
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

  it('shows one price for a tutor priced in two markets', () => {
    // The card used to print a second line — "also 12.00 USD per hour" — which
    // put two numbers on screen for the same hour of teaching and left the visitor
    // to work out which one they would be charged. The API sends one price, so
    // this asserts the card renders exactly that one.
    const card = renderCard({ ...base, hourlyRate: 25, hourlyRateCurrency: 'ETB' })

    expect(card.text).toContain('25 ETB per hour')
    expect(card.text.match(/per hour/g)).toHaveLength(1)
  })

  it('renders a zero rate rather than hiding it', () => {
    // The API rejects a zero rate, so this cannot reach a card from the server.
    // It is kept because a formatter that turns 0 into nothing is one refactor away
    // from hiding a real number, and the day a zero-decimal market exists this is
    // the line that stops it.
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

// ---------------------------------------------------------------------------
// The row / grid split.
//
// The directory renders a wide horizontal card; the homepage featured section
// renders three across. Both must carry the same information, so the properties
// above are re-run against the grid variant rather than trusted by inspection.
// ---------------------------------------------------------------------------

describe('TutorCard — the grid variant carries the same information', () => {
  function renderGridCard(tutor: TutorCardDTO) {
    const { container } = render(
      <MemoryRouter>
        <TutorCard tutor={tutor} variant="grid" />
      </MemoryRouter>,
    )
    return { container, text: container.textContent ?? '', ...within(container) }
  }

  it('shows the identifying and actionable fields in both variants', () => {
    const tutor: TutorCardDTO = {
      id: '33333333-3333-4333-8333-333333333333',
      displayName: 'Ada Lovelace',
      headline: 'Mathematics and programming tutor',
      bio: 'I help students find the method behind the problem.',
      profilePhotoUrl: null,
      teachingMode: 'BOTH',
      location: 'Addis Ababa',
      hourlyRate: 25,
      hourlyRateCurrency: 'ETB',
      studentLevels: ['High School'],
      languages: ['English', 'Amharic'],
      subjects: [
        { id: 's1', name: 'Mathematics', slug: 'mathematics' },
        { id: 's2', name: 'Programming', slug: 'programming' },
      ],
      createdAt: '2024-03-01T00:00:00.000Z',
    }

    const row = renderCard(tutor)
    const grid = renderGridCard(tutor)

    // What a visitor needs in order to choose: who, what they teach, what they
    // teach it in, where they are, what it costs, and how to go further.
    for (const expected of [
      'Ada Lovelace',
      'Mathematics and programming tutor',
      'Mathematics',
      'Programming',
      'English',
      'Online & in person',
      'Addis Ababa',
      // The currency code travels with the number. A card that printed only "25"
      // would be showing a price whose unit nobody could identify.
      '25 ETB per hour',
      'View Profile',
    ]) {
      expect(row.text, `row variant is missing "${expected}"`).toContain(expected)
      expect(grid.text, `grid variant is missing "${expected}"`).toContain(expected)
    }

    // Plain route, in both variants. The market is the server's decision, so the
    // link does not get to restate it.
    const href = `/tutors/${tutor.id}`
    expect(row.getByRole('link', { name: /view profile/i })).toHaveAttribute('href', href)
    expect(grid.getByRole('link', { name: /view profile/i })).toHaveAttribute('href', href)
  })

  it('gives the row variant the bio excerpt and join date the grid variant has no room for', () => {
    // The grid variant is three cards across, so it carries the summary only.
    // Anything dropped there is still on the profile page, and nothing dropped is
    // the sort of claim that would mislead — a bio and a join date are context,
    // not a differentiator.
    const tutor: TutorCardDTO = {
      id: '66666666-6666-4666-8666-666666666666',
      displayName: 'Grace Hopper',
      headline: 'Programming tutor',
      bio: 'I teach debugging as a habit, not a rescue.',
      profilePhotoUrl: null,
      teachingMode: 'ONLINE',
      location: 'Remote',
      hourlyRate: 40,
      hourlyRateCurrency: 'ETB',
      studentLevels: ['University'],
      languages: ['English'],
      createdAt: '2024-03-01T00:00:00.000Z',
      subjects: [{ id: 's1', name: 'Programming', slug: 'programming' }],
    }

    const row = renderCard(tutor)
    const grid = renderGridCard(tutor)

    expect(row.text).toContain('I teach debugging as a habit')
    expect(row.text).toMatch(/on tedor since/i)

    expect(grid.text).not.toContain('I teach debugging as a habit')
    expect(grid.text).not.toMatch(/on tedor since/i)
  })

  it('never renders a fabricated metric in the grid variant either', async () => {
    await fc.assert(
      fc.asyncProperty(tutorArbitrary, async (tutor) => {
        const { text } = renderGridCard(tutor)

        for (const pattern of FABRICATED_METRIC_PATTERNS) {
          expect(text).not.toMatch(pattern)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('omits the join date when createdAt is not a real timestamp', () => {
    const { text } = renderCard({
      id: '44444444-4444-4444-8444-444444444444',
      displayName: 'Bad Date',
      headline: 'Tutor',
      bio: null,
      profilePhotoUrl: null,
      teachingMode: 'ONLINE',
      location: null,
      hourlyRate: null,
      hourlyRateCurrency: null,
      studentLevels: ['University'],
      languages: ['English'],
      createdAt: 'not-a-date',
      subjects: [],
    })

    expect(text).not.toMatch(/on tedor since/i)
    expect(text).not.toMatch(/invalid/i)
  })

  it('shows the join date when createdAt is valid', () => {
    const { text } = renderCard({
      id: '55555555-5555-4555-8555-555555555555',
      displayName: 'Real Date',
      headline: 'Tutor',
      bio: null,
      profilePhotoUrl: null,
      teachingMode: 'ONLINE',
      location: null,
      hourlyRate: null,
      hourlyRateCurrency: null,
      studentLevels: ['University'],
      languages: ['English'],
      createdAt: '2024-03-01T00:00:00.000Z',
      subjects: [],
    })

    expect(text).toMatch(/on tedor since/i)
  })
})
