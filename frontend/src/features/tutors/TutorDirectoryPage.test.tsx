import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { resetAuthState } from '@/features/auth/authStore'
import { TutorDirectoryPage } from './TutorDirectoryPage'
import type { TutorCardDTO, TutorListResponse } from './tutors.types'

/**
 * Unit tests for TutorDirectoryPage.
 *
 * The API is stubbed at the `fetch` boundary, so these verify UI behaviour:
 * rendering the search bar and filter panel, TutorCards from API data, the
 * EmptyState when no items are returned, the loading skeleton while in-flight,
 * filter and search changes updating URL params, and pagination controls.
 *
 * Requirements: 8.1–8.8
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeTutor(overrides: Partial<TutorCardDTO> = {}): TutorCardDTO {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    displayName: 'Alice Tutor',
    headline: 'Expert math tutor',
    bio: 'I help students excel in mathematics.',
    profilePhotoUrl: null,
    teachingMode: 'ONLINE',
    location: 'Addis Ababa',
    hourlyRate: 50,
    hourlyRateCurrency: 'ETB',
    studentLevels: ['High School'],
    languages: ['English', 'Amharic'],
    subjects: [{ id: 'sub-1', name: 'Mathematics', slug: 'mathematics' }],
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeListResponse(
  items: TutorCardDTO[],
  overrides: Partial<TutorListResponse['pagination']> = {},
): TutorListResponse {
  return {
    items,
    pagination: {
      page: 1,
      limit: 12,
      total: items.length,
      totalPages: items.length === 0 ? 0 : 1,
      ...overrides,
    },
  }
}

const ok = (data: unknown) => jsonResponse({ success: true, data })

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  resetAuthState()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubApi(items: TutorCardDTO[], paginationOverrides: Partial<TutorListResponse['pagination']> = {}) {
  fetchMock.mockImplementation((input: string) => {
    const url = new URL(input, 'http://localhost')
    // Auth check — always return unauthenticated so Navbar renders a sign-in link.
    if (url.pathname === '/api/auth/me') {
      return Promise.resolve(new Response(JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthenticated' } }), { status: 401, headers: { 'Content-Type': 'application/json' } }))
    }
    if (url.pathname === '/api/auth/providers') {
      return Promise.resolve(ok({ providers: [] }))
    }
    // Tutor directory
    return Promise.resolve(ok(makeListResponse(items, paginationOverrides)))
  })
}

/** Renders the page inside a MemoryRouter + AuthProvider so PageShell/Navbar works. */
function renderPage(initialPath = '/tutors') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/tutors" element={<TutorDirectoryPage />} />
          <Route path="/request-tutor" element={<h1>Request Tutor</h1>} />
          <Route path="/tutors/:id" element={<h1>Tutor Profile</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

// ---------------------------------------------------------------------------
// Requirement 8.1 — page structure
// ---------------------------------------------------------------------------

describe('page structure (Requirement 8.1)', () => {
  it('renders the page heading', async () => {
    stubApi([])
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: /find a tutor/i })).toBeInTheDocument()
  })

  it('renders a search bar', async () => {
    stubApi([])
    renderPage()

    expect(screen.getByRole('search')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: /search tutors/i })).toBeInTheDocument()
  })

  it('renders the filter panel sidebar (desktop)', async () => {
    stubApi([])
    renderPage()

    expect(screen.getByRole('complementary', { name: /filter tutors/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Requirement 8.6 — loading skeleton
// ---------------------------------------------------------------------------

describe('loading state (Requirement 8.6)', () => {
  it('shows a loading indicator while the API call is in flight', async () => {
    let resolve!: (v: Response) => void
    const gate = new Promise<Response>((res) => { resolve = res })
    fetchMock.mockReturnValue(gate)

    renderPage()

    expect(screen.getByLabelText(/loading tutors/i)).toBeInTheDocument()

    // Resolve to unblock, then confirm skeleton disappears.
    resolve(ok(makeListResponse([makeTutor()])) as unknown as Response)
    await waitFor(() =>
      expect(screen.queryByLabelText(/loading tutors/i)).not.toBeInTheDocument(),
    )
  })
})

// ---------------------------------------------------------------------------
// Requirement 8.1, 8.3 — TutorCards rendered
// ---------------------------------------------------------------------------

describe('showing tutor cards (Requirements 8.1, 8.3)', () => {
  it('renders a TutorCard for each item returned by the API', async () => {
    stubApi([
      makeTutor({ id: 'id-1', displayName: 'Alice Tutor' }),
      makeTutor({ id: 'id-2', displayName: 'Bob Tutor' }),
    ])
    renderPage()

    expect(await screen.findByText('Alice Tutor')).toBeInTheDocument()
    expect(screen.getByText('Bob Tutor')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Requirement 8.2 — EmptyState
// ---------------------------------------------------------------------------

describe('empty state (Requirement 8.2)', () => {
  it('shows the empty state with a CTA when the API returns no items', async () => {
    stubApi([])
    renderPage()

    const ctaLinks = await screen.findAllByRole('link', { name: /request a tutor/i })
    expect(ctaLinks.length).toBeGreaterThanOrEqual(1)
  })

  it('does not show TutorCards when items is empty', async () => {
    stubApi([])
    renderPage()

    await waitFor(() =>
      expect(screen.queryByLabelText(/loading tutors/i)).not.toBeInTheDocument(),
    )
    // The empty state heading should be visible, not a card list.
    expect(screen.queryByRole('list', { name: 'Tutors' })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Requirement 8.3 — search updates URL params
// ---------------------------------------------------------------------------

describe('search bar (Requirement 8.3)', () => {
  it('sends the search query to the API as the q parameter', async () => {
    stubApi([])
    renderPage()

    const searchBox = screen.getByRole('searchbox', { name: /search tutors/i })
    await userEvent.type(searchBox, 'calculus')
    await userEvent.click(screen.getByRole('button', { name: /submit search/i }))

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(([url]) => url)
      expect(calls.some((u: string) => u.includes('q=calculus'))).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// Requirement 8.4 — filter changes trigger API call
// ---------------------------------------------------------------------------

describe('filter panel (Requirement 8.4)', () => {
  it('includes the subject filter in the API call when a subject is selected', async () => {
    stubApi([])
    renderPage()

    const subjectSelect = await screen.findByRole('combobox', { name: /filter by subject/i })
    await userEvent.selectOptions(subjectSelect, 'mathematics')

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(([url]) => url)
      expect(calls.some((u: string) => u.includes('subject=mathematics'))).toBe(true)
    })
  })

  it('includes the mode filter in the API call when a mode is selected', async () => {
    stubApi([])
    renderPage()

    const modeSelect = await screen.findByRole('combobox', { name: /filter by teaching mode/i })
    await userEvent.selectOptions(modeSelect, 'ONLINE')

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(([url]) => url)
      expect(calls.some((u: string) => u.includes('mode=ONLINE'))).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// Requirement 8.5 — pagination controls
// ---------------------------------------------------------------------------

describe('pagination (Requirement 8.5)', () => {
  it('shows pagination controls when there are multiple pages', async () => {
    stubApi([makeTutor()], { total: 30, totalPages: 3, page: 1, limit: 12 })
    renderPage()

    expect(await screen.findByRole('navigation', { name: /pagination/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
  })

  it('navigates to the next page on Next click', async () => {
    stubApi([makeTutor()], { total: 30, totalPages: 3, page: 1, limit: 12 })
    renderPage()

    await screen.findByRole('navigation', { name: /pagination/i })
    await userEvent.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(([url]) => url)
      expect(calls.some((u: string) => u.includes('page=2'))).toBe(true)
    })
  })

  it('does not show pagination when there is only one page', async () => {
    stubApi([makeTutor()], { total: 1, totalPages: 1 })
    renderPage()

    await waitFor(() =>
      expect(screen.queryByLabelText(/loading tutors/i)).not.toBeInTheDocument(),
    )
    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Request a tutor escape hatch
// ---------------------------------------------------------------------------

describe('request a tutor panel', () => {
  it('is shown when tutors are returned, so a parent with no suitable match can still ask', async () => {
    stubApi([makeTutor()])
    renderPage()

    expect(
      await screen.findByRole('heading', { name: /can't find the right tutor/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /post a tutor request/i }),
    ).toBeInTheDocument()
  })

  it('is shown when the API fails, not only when the list is empty', async () => {
    fetchMock.mockImplementation((input: string) => {
      const url = new URL(input, 'http://localhost')
      if (url.pathname === '/api/auth/me') {
        return Promise.resolve(new Response(JSON.stringify({}), { status: 401 }))
      }
      if (url.pathname === '/api/auth/providers') {
        return Promise.resolve(ok({ providers: [] }))
      }
      return Promise.resolve(jsonResponse({ success: false, error: { code: 'SERVER_ERROR' } }, 500))
    })
    renderPage()

    expect(
      await screen.findByRole('link', { name: /post a tutor request/i }),
    ).toBeInTheDocument()
  })

  it('links to a bare request form when no filters are active', async () => {
    stubApi([makeTutor()])
    renderPage()

    await screen.findByRole('link', { name: /post a tutor request/i })
    expect(screen.getByRole('link', { name: /post a tutor request/i })).toHaveAttribute(
      'href',
      '/request-tutor',
    )
  })

  it('carries the active filters into the request form', async () => {
    stubApi([])
    renderPage('/tutors?subject=physics&level=University&mode=ONLINE')

    const link = await screen.findByRole('link', { name: /post a tutor request/i })
    const href = new URL(link.getAttribute('href') ?? '', 'http://localhost')

    expect(href.pathname).toBe('/request-tutor')
    expect(href.searchParams.get('subject')).toBe('Physics')
    expect(href.searchParams.get('level')).toBe('University')
    expect(href.searchParams.get('mode')).toBe('Online')
  })
})

// ---------------------------------------------------------------------------
// Deep-linking (Requirement 8.1)
// ---------------------------------------------------------------------------

describe('deep-linking', () => {
  it('initialises the subject filter from the URL on mount', async () => {
    stubApi([])
    renderPage('/tutors?subject=mathematics')

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(([url]) => url)
      expect(calls.some((u: string) => u.includes('subject=mathematics'))).toBe(true)
    })
  })
})
