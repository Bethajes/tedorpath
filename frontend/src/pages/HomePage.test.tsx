import { render, screen, waitFor } from '@testing-library/react'
import fc from 'fast-check'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HomePage } from './HomePage'
import { PageShell } from '@/components/layout/PageShell'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { resetAuthState } from '@/features/auth/authStore'
import { UNIVERSITIES } from '@/data/universities'
import type { PublicStats, TutorCardDTO } from '@/features/tutors/tutors.types'

/**
 * Full-page tests.
 *
 * The API is stubbed at the `fetch` boundary (the convention used across this
 * suite) so a real request path is exercised, and the page is wrapped in
 * `AuthProvider` + `MemoryRouter` because PageShell renders the Navbar (which
 * reads auth) and ScrollToHash (which reads the location).
 *
 * `matchMedia` is stubbed because jsdom never matches a media query, and the
 * scroll `Reveal` wrapper reads `prefers-reduced-motion` on mount.
 */

let fetchMock: ReturnType<typeof vi.fn>

/** Minimal MediaQueryList stand-in; jsdom never matches anything on its own. */
function stubMatchMedia() {
  vi.stubGlobal(
    'matchMedia',
    (media: string) =>
      ({
        media,
        matches: false,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  )
}

function ok(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const unauthenticated = () =>
  new Response(
    JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthenticated' } }),
    { status: 401, headers: { 'Content-Type': 'application/json' } },
  )

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

function statsResponse(overrides: Partial<PublicStats> = {}): PublicStats {
  return { approvedTutors: 12, subjects: 10, universities: 4, countries: 2, ...overrides }
}

/** Stubs every request the homepage makes, and throws on anything unexpected. */
function stubPage({ tutors, stats }: { tutors: TutorCardDTO[]; stats: PublicStats }) {
  fetchMock.mockImplementation((input: string) => {
    const url = new URL(input, 'http://localhost')
    switch (url.pathname) {
      case '/api/auth/me':
        return Promise.resolve(unauthenticated())
      case '/api/auth/providers':
        return Promise.resolve(ok({ providers: [] }))
      case '/api/public/stats':
        return Promise.resolve(ok(stats))
      case '/api/tutors':
        return Promise.resolve(
          ok({
            items: tutors,
            pagination: { page: 1, limit: 6, total: tutors.length, totalPages: tutors.length ? 1 : 0 },
          }),
        )
      default:
        throw new Error(`unexpected request: ${url.pathname}`)
    }
  })
}

beforeEach(() => {
  resetAuthState()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  stubMatchMedia()
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetAuthState()
})

function renderHomePage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
      </MemoryRouter>
    </AuthProvider>,
  )
}

const tutorArbitrary: fc.Arbitrary<TutorCardDTO> = fc.record({
  displayName: fc.stringMatching(/^[A-Z][a-z]+ [A-Z][a-z]+$/).map((s) => `Tutor ${s}`),
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

const statsArbitrary: fc.Arbitrary<PublicStats> = fc.record({
  approvedTutors: fc.integer({ min: 0, max: 100_000 }),
  subjects: fc.integer({ min: 0, max: 100_000 }),
  universities: fc.integer({ min: 0, max: 100_000 }),
  countries: fc.integer({ min: 0, max: 100_000 }),
})

/**
 * Resolves once the page's data-driven sections have settled.
 *
 * `tutors` is no longer asserted here: the homepage shows no profiles at all, so
 * the directory response drives nothing on this page. Waiting on the stats value
 * is enough to know the page has finished its fetches.
 */
async function waitForPageData(stats: PublicStats) {
  await waitFor(() => {
    const value = screen.queryByTestId('stat-value-approvedTutors')?.textContent ?? ''
    expect(value).toBe(stats.approvedTutors > 0 ? String(stats.approvedTutors) : 'Growing')
  })
}

// ---------------------------------------------------------------------------
// Feature: homepage-redesign, Property 1: Exactly one h1 on the homepage
// Validates: Requirements 2.1, 13.3
// ---------------------------------------------------------------------------

describe('HomePage — Property 1: exactly one h1', () => {
  it('has exactly one h1 for any combination of API responses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(tutorArbitrary, { minLength: 0, maxLength: 6 }),
        statsArbitrary,
        async (tutors, stats) => {
          stubPage({ tutors, stats })
          const { container, unmount } = renderHomePage()

    await waitForPageData(stats)

    // The whole document, not just a section: the Navbar, every section
    // and the Footer all live in the same tree.
    expect(container.querySelectorAll('h1')).toHaveLength(1)
          expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)

          unmount()
        },
      ),
      { numRuns: 100 },
    )
  })

  it('gives that h1 the required text', () => {
    stubPage({ tutors: [], stats: statsResponse() })
    renderHomePage()

    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.textContent).toContain('Find the right tutor.')
  })

  it('keeps the h1 unique when tutors are present and every count is non-zero', async () => {
    stubPage({
      tutors: [makeTutor(), makeTutor({ id: crypto.randomUUID(), displayName: 'Second Tutor' })],
      stats: statsResponse({ approvedTutors: 99, subjects: 40, universities: 6, countries: 5 }),
    })
    const { container } = renderHomePage()

    await waitForPageData({ approvedTutors: 99, subjects: 40, universities: 6, countries: 5 })

    // The page's many h2 sections must not introduce a second h1, whatever
    // the API returned.
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(container.querySelectorAll('h2').length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Requirement 13.4 — logical heading hierarchy
// ---------------------------------------------------------------------------

describe('HomePage — heading hierarchy', () => {
  it('never skips a level on the way down from the h1', () => {
    stubPage({ tutors: [], stats: statsResponse() })
    const { container } = renderHomePage()

    const levels = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(
      (heading) => Number(heading.tagName.slice(1)),
    )

    expect(levels[0]).toBe(1)
    expect(levels.length).toBeGreaterThan(5)

    for (let i = 1; i < levels.length; i += 1) {
      // Going deeper may only step one level at a time. Stepping back up any
      // distance is fine.
      expect(
        levels[i] - levels[i - 1],
        `heading levels went ${levels[i - 1]} → ${levels[i]}`,
      ).toBeLessThanOrEqual(1)
    }
  })

  it('gives every university logo an alt attribute', () => {
    stubPage({ tutors: [], stats: statsResponse() })
    const { container } = renderHomePage()

    const logos = Array.from(
      container.querySelectorAll<HTMLImageElement>('img[src^="/universities/"]'),
    )
    expect(logos.length).toBe(UNIVERSITIES.length)
    for (const logo of logos) {
      expect(logo.getAttribute('alt')?.trim()).toBeTruthy()
    }
  })
})

// ---------------------------------------------------------------------------
// Section order and anchors
// ---------------------------------------------------------------------------

describe('HomePage — section order', () => {
  it('assembles the sections in the intended order', () => {
    stubPage({ tutors: [], stats: statsResponse() })
    const { container } = renderHomePage()

    // Ordered list of the two landmarks each section can be identified by.
    const markers = Array.from(container.querySelectorAll('main > section, main > div > section'))
      .map((section) => section.getAttribute('aria-labelledby') ?? '')
      .filter(Boolean)

    // Hero has no aria-labelledby (its h1 is the page title, not a label for the
    // section), so it is matched separately below.
    const heroIndex = Array.from(container.querySelectorAll('main > section')).findIndex((s) =>
      s.querySelector('h1'),
    )
    const labelled = markers.filter((m) => m !== '')

    expect(heroIndex).toBe(0)
    expect(labelled).toEqual([
      'university-trust-heading',
      'stats-heading',
      'testimonials-heading',
      'international-heading',
    ])
    // The trust section moved to /about, so the homepage no longer carries it
    // or its anchor.
    expect(container.querySelector('#why-tedor')).toBeNull()
    // Neither does the learner/tutor connection section, which now lives on
    // /how-it-works.
    expect(container.querySelector('#connection-heading')).toBeNull()
  })

  it('every anchor any link points at exists on this page', () => {
    stubPage({ tutors: [], stats: statsResponse() })
    const { container } = renderHomePage()

    // Derived from the rendered chrome rather than hardcoded, so removing a
    // section and forgetting the link that pointed at it fails here instead of
    // shipping a link that scrolls nowhere. Both forms count: "/#x" from the
    // navbar/footer, "#x" from a link already on the page.
    const links = Array.from(container.querySelectorAll('a[href]'))
      .map((link) => link.getAttribute('href') ?? '')
      .filter((href) => href.length > 1)
      .flatMap((href) => {
        const target = href.includes('#') ? href.slice(href.indexOf('#')) : ''
        // An empty target is a link to the current page, not a dead anchor.
        return target.length > 1 ? [target] : []
      })

    for (const anchor of links) {
      expect(container.querySelector(anchor), `no target for ${anchor}`).not.toBeNull()
    }

    // The learning journey lives on /how-it-works now, so the homepage carries
    // no such anchor and both the navbar and the footer address the page.
    expect(container.querySelector('#how-it-works')).toBeNull()
    expect(links).not.toContain('/#how-it-works')
    const howItWorks = Array.from(container.querySelectorAll('a[href]'))
      .map((a) => a.getAttribute('href'))
      .filter((href) => href === '/how-it-works')
    expect(howItWorks.length).toBeGreaterThan(0)
  })

  it('no longer offers a homepage subject index, and nothing links to one', () => {
    stubPage({ tutors: [], stats: statsResponse() })
    const { container } = renderHomePage()

    expect(container.querySelector('#subjects')).toBeNull()
    // The hero's search card keeps its own "What do you want to learn?"
    // heading, so the section is identified by the copy only it had.
    expect(screen.queryByText(/find support across school subjects/i)).toBeNull()

    // A dangling '/#subjects' would still resolve as a valid route, so it has
    // to be checked as a string.
    const hrefs = Array.from(container.querySelectorAll('a[href]')).map((a) => a.getAttribute('href'))
    expect(hrefs).not.toContain('/#subjects')
  })
})

// ---------------------------------------------------------------------------
// The announcement strip is gone from the site, not just from this page
// ---------------------------------------------------------------------------

describe('HomePage — no announcement strip above the header', () => {
  it('renders the navbar without the notice on the homepage', () => {
    stubPage({ tutors: [], stats: statsResponse() })
    const { container } = renderHomePage()

    expect(screen.queryByText(/tutor profiles are reviewed by our team/i)).toBeNull()
    expect(screen.queryByRole('link', { name: /apply to teach/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /dismiss announcement/i })).toBeNull()

    // The header opens straight into the dark bar.
    const header = container.querySelector('header')
    expect(header?.firstElementChild?.className ?? '').not.toMatch(/notice/)
  })

  it('renders no notice on an interior page either', () => {
    // This used to be suppressed per route — the homepage opted out while every
    // other page kept the strip. The strip is gone, so the route has stopped
    // mattering and asserting it here is what stops it coming back on /tutors or
    // /how-it-works.
    stubPage({ tutors: [], stats: statsResponse() })
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/tutors']}>
          <PageShell>
            <p>Directory</p>
          </PageShell>
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(screen.queryByText(/tutor profiles are reviewed by our team/i)).toBeNull()
    expect(screen.queryByRole('link', { name: /apply to teach/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /dismiss announcement/i })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Requirement 15.1 — no link points at a route that does not exist
// ---------------------------------------------------------------------------

describe('HomePage — every link resolves to a real route', () => {
  /**
   * The public paths from app/router.tsx. A subset check by design: adding a
   * route does not break this, but renaming or removing one does.
   *
   * `/how-it-works` is here because the navbar links to it, which makes it a
   * path this page renders even though nothing inside <main> points at it.
   */
  const REAL_PATHS = new Set([
    '/',
    '/about',
    '/contact',
    '/how-it-works',
    '/login',
    '/register',
    '/request-tutor',
    '/tutors',
    '/become-a-tutor',
    '/tutor/application-status',
    '/admin',
    '/admin/login',
  ])

  it('links only to paths the router serves', () => {
    stubPage({
      tutors: [makeTutor({ id: '22222222-2222-4222-8222-222222222222' })],
      stats: statsResponse(),
    })
    const { container } = renderHomePage()

    const hrefs = Array.from(container.querySelectorAll('a[href]'))
      .map((a) => a.getAttribute('href') ?? '')
      .filter((href) => href.startsWith('/'))

    expect(hrefs.length).toBeGreaterThan(10)

    for (const href of hrefs) {
      // In-page anchors and query strings are stripped: only the path is routed.
      const path = href.split('#')[0].split('?')[0]
      if (path === '') continue
      expect(REAL_PATHS.has(path), `"${href}" points at a route that does not exist`).toBe(true)
    }
  })

  it('links no tutor profile at all, whatever the directory returns', async () => {
    const tutor = makeTutor({ id: '22222222-2222-4222-8222-222222222222' })
    stubPage({ tutors: [tutor], stats: statsResponse() })
    const { container } = renderHomePage()

    // The homepage shows no profiles — not cards, not names in a connecting
    // column. The directory and /how-it-works are the pages that do, so a tutor
    // in the response must not leak a /tutors/:id link onto this page.
    await waitForPageData(statsResponse())

    const hrefs = Array.from(container.querySelectorAll('a[href]')).map((a) => a.getAttribute('href'))
    expect(hrefs).not.toContain(`/tutors/${tutor.id}`)
    expect(screen.queryByRole('link', { name: /^alice/i })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Requirements 13.1, 13.2 — metadata
// ---------------------------------------------------------------------------

describe('HomePage — metadata', () => {
  it('declares the required title and description in the served HTML', () => {
    // The title and description live in index.html rather than in React because
    // they have to be present in the document for crawlers that never run JS.
    // `import.meta.glob` reads the real file at build time, so this fails if
    // either tag is removed or the copy drifts — the same way a crawler would
    // see it.
    const files = import.meta.glob('/index.html', { query: '?raw', import: 'default', eager: true })
    const html = files['/index.html'] as string

    expect(html).toContain('<title>Tedor Tutors | Find the Right Tutor</title>')
    expect(html).toMatch(/<meta\s+name="description"\s+content="[^"]{50,}"/)

    // The description has to actually describe the product, not be a placeholder.
    const description = /<meta\s+name="description"\s+content="([^"]+)"/.exec(html)?.[1] ?? ''
    expect(description).toMatch(/tutor/i)
  })
})
