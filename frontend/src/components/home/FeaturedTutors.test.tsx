import { render, screen, waitFor } from '@testing-library/react'
import fc from 'fast-check'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FeaturedTutors } from './FeaturedTutors'
import type { TutorCardDTO, TutorListResponse } from '@/features/tutors/tutors.types'

/**
 * The API is stubbed at the `fetch` boundary, matching the convention used by
 * the directory and profile page tests. Stubbing the module instead would let
 * the section pass while requesting the wrong URL or mishandling the envelope.
 */

const EMPTY_STATE = 'Tutor profiles are being reviewed. Check back soon.'

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function makeTutor(overrides: Partial<TutorCardDTO> = {}): TutorCardDTO {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    displayName: 'Alice Tutor',
    headline: 'Expert maths tutor',
    bio: 'I help students excel in mathematics.',
    profilePhotoUrl: null,
    teachingMode: 'ONLINE',
    location: 'Addis Ababa',
    hourlyRate: 50,
    studentLevels: ['High School'],
    languages: ['English'],
    subjects: [{ id: 'sub-1', name: 'Mathematics', slug: 'mathematics' }],
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeListResponse(items: TutorCardDTO[]): TutorListResponse {
  return {
    items,
    pagination: {
      page: 1,
      limit: 6,
      total: items.length,
      totalPages: items.length === 0 ? 0 : 1,
    },
  }
}

function ok(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Stubs the directory request and fails loudly on any other path. */
function stubTutors(items: TutorCardDTO[]) {
  fetchMock.mockImplementation((input: string) => {
    const url = new URL(input, 'http://localhost')
    if (url.pathname === '/api/tutors') return Promise.resolve(ok(makeListResponse(items)))
    throw new Error(`unexpected request: ${url.pathname}`)
  })
}

function stubFailure() {
  fetchMock.mockImplementation((input: string) => {
    const url = new URL(input, 'http://localhost')
    if (url.pathname === '/api/tutors') {
      return Promise.resolve(
        new Response(
          JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Nope' } }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }
    throw new Error(`unexpected request: ${url.pathname}`)
  })
}

function renderSection() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<FeaturedTutors />} />
        <Route path="/tutors" element={<h1>Tutor directory</h1>} />
        <Route path="/tutors/:id" element={<h1>Tutor profile</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

/**
 * A card is an `<article>`; the section is the only thing on the page that
 * renders them, so this counts featured tutors and nothing else.
 */
function renderedCards(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('article'))
}

function cardText(card: HTMLElement): string {
  return card.textContent ?? ''
}

const tutorArbitrary: fc.Arbitrary<TutorCardDTO> = fc.record({
  displayName: fc
    .stringMatching(/^[A-Z][a-z]+ [A-Z][a-z]+$/)
    .map((s) => `Tutor ${s}`)
    .filter((s) => s.trim().length > 0),
  headline: fc.constant('Expert maths tutor'),
  bio: fc.constant('I help students excel in mathematics.'),
  profilePhotoUrl: fc.constant(null),
  teachingMode: fc.constant('ONLINE' as const),
  location: fc.constant('Addis Ababa'),
  hourlyRate: fc.integer({ min: 1, max: 200 }),
  studentLevels: fc.constant(['High School']),
  languages: fc.constant(['English']),
  subjects: fc.constant([]),
  createdAt: fc.constant('2026-09-01T00:00:00.000Z'),
  id: fc.uuid(),
})

/** 0–6 cards, which is exactly the range the section asks the API for. */
const tutorListArbitrary = fc.array(tutorArbitrary, { minLength: 0, maxLength: 6 })

// ---------------------------------------------------------------------------
// Feature: homepage-redesign, Property 3: Featured tutors match API response
// Validates: Requirements 6.1, 6.3, 14.4
// ---------------------------------------------------------------------------

describe('FeaturedTutors — Property 3: featured tutors match the API response', () => {
  it('renders exactly as many cards as the API returned', async () => {
    await fc.assert(
      fc.asyncProperty(tutorListArbitrary, async (items) => {
        stubTutors(items)
        const { container, unmount } = renderSection()

        await waitFor(() => {
          // Either the cards are there, or the empty state is — never neither.
          const settled =
            renderedCards(container).length === items.length ||
            screen.queryByText(EMPTY_STATE) !== null
          expect(settled).toBe(true)
        })

        expect(renderedCards(container)).toHaveLength(items.length)

        unmount()
      }),
      { numRuns: 100 },
    )
  })

  it('gives every card the display name and headline of its API item', async () => {
    await fc.assert(
      fc.asyncProperty(tutorListArbitrary, async (items) => {
        stubTutors(items)
        const { container, unmount } = renderSection()

        await waitFor(() => {
          expect(renderedCards(container)).toHaveLength(items.length)
        })

        const cards = renderedCards(container)
        items.forEach((item, index) => {
          const text = cardText(cards[index])
          expect(text).toContain(item.displayName)
          expect(text).toContain(item.headline)
        })

        unmount()
      }),
      { numRuns: 100 },
    )
  })

  it('shows no card for a tutor the API did not return', async () => {
    await fc.assert(
      fc.asyncProperty(tutorListArbitrary, fc.stringMatching(/^[A-Z][a-z]+ [A-Z][a-z]+$/), async (items, absentName) => {
        // Only meaningful when the name cannot collide with a generated one.
        fc.pre(absentName !== '' && !items.some((i) => i.displayName.includes(absentName)))

        stubTutors(items)
        const { container, unmount } = renderSection()

        await waitFor(() => {
          expect(renderedCards(container)).toHaveLength(items.length)
        })

        expect(container.textContent ?? '').not.toContain(absentName)

        unmount()
      }),
      { numRuns: 100 },
    )
  })

  it('links each card to that tutor’s profile route', async () => {
    await fc.assert(
      fc.asyncProperty(tutorListArbitrary, async (items) => {
        stubTutors(items)
        const { container, unmount } = renderSection()

        await waitFor(() => {
          expect(renderedCards(container)).toHaveLength(items.length)
        })

        const hrefs = Array.from(container.querySelectorAll('a'))
          .map((a) => a.getAttribute('href'))
          .filter((href): href is string => href !== null)

        for (const item of items) {
          expect(hrefs).toContain(`/tutors/${item.id}`)
        }

        unmount()
      }),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// Requirements 6.1, 6.2 — the request itself
// ---------------------------------------------------------------------------

describe('FeaturedTutors — how it asks for tutors', () => {
  it('asks the public directory for a limited page, once', async () => {
    stubTutors([])
    renderSection()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    const url = new URL(fetchMock.mock.calls[0][0] as string, 'http://localhost')
    expect(url.pathname).toBe('/api/tutors')
    // Requirement 6.2: a limited number, not the whole directory.
    expect(url.searchParams.get('limit')).toBe('6')
    expect(url.searchParams.get('page')).toBe('1')
  })
})

// ---------------------------------------------------------------------------
// Requirement 6.5 — honest empty state
// ---------------------------------------------------------------------------

describe('FeaturedTutors — empty state', () => {
  it('shows the honest empty state for zero results', async () => {
    stubTutors([])
    const { container } = renderSection()

    await waitFor(() => {
      expect(screen.getByText(EMPTY_STATE)).toBeInTheDocument()
    })
    expect(renderedCards(container)).toHaveLength(0)
  })

  it('shows the same empty state when the request fails', async () => {
    stubFailure()
    const { container } = renderSection()

    await waitFor(() => {
      expect(screen.getByText(EMPTY_STATE)).toBeInTheDocument()
    })
    expect(renderedCards(container)).toHaveLength(0)
  })

  it('shows no placeholder tutor data when there is nothing to show', async () => {
    stubTutors([])
    const { container } = renderSection()

    await waitFor(() => {
      expect(screen.getByText(EMPTY_STATE)).toBeInTheDocument()
    })

    // No invented tutor names, and no fabricated metrics on the cards either.
    const text = (container.textContent ?? '').toLowerCase()
    for (const word of ['rating', 'reviews', 'lessons taught', 'students taught', 'response time']) {
      expect(text).not.toContain(word)
    }
  })
})

// ---------------------------------------------------------------------------
// Requirements 6.4, 6.6 — no invented metrics, and a way onward
// ---------------------------------------------------------------------------

describe('FeaturedTutors — no fabricated data', () => {
  it('renders only what the directory returned, with no invented metrics', async () => {
    const items = [makeTutor(), makeTutor({ id: crypto.randomUUID(), displayName: 'Second Tutor' })]
    stubTutors(items)
    const { container } = renderSection()

    await waitFor(() => {
      expect(renderedCards(container)).toHaveLength(2)
    })

    const text = (container.textContent ?? '').toLowerCase()
    for (const word of ['stars', 'rated', 'reviews', 'success rate', 'satisfaction', 'students']) {
      expect(text, `"${word}" is not in the TutorCard DTO and must not be invented`).not.toContain(word)
    }
  })
})

describe('FeaturedTutors — the "view all" link', () => {
  it('links to the existing /tutors route', async () => {
    stubTutors([makeTutor()])
    renderSection()

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /view all tutors/i })).toBeInTheDocument()
    })

    expect(screen.getByRole('link', { name: /view all tutors/i }).getAttribute('href')).toBe('/tutors')
  })

  it('is present in the empty state too, so there is always a way onward', async () => {
    stubTutors([])
    renderSection()

    await waitFor(() => {
      expect(screen.getByText(EMPTY_STATE)).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /browse all tutors/i }).getAttribute('href')).toBe('/tutors')
  })
})
