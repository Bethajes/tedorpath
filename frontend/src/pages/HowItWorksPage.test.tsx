import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HowItWorksPage } from './HowItWorksPage'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { resetAuthState } from '@/features/auth/authStore'
import { STAT_DEFINITIONS } from '@/components/howItWorks/howItWorksContent'
import { STEPS } from '@/components/howItWorks/howItWorksContent'
import { FAQS } from '@/components/howItWorks/howItWorksContent'
import type { PublicStats } from '@/features/tutors/tutors.types'

/**
 * Full-page tests for /how-it-works.
 *
 * Same conventions as `HomePage.test.tsx`: the API is stubbed at the `fetch`
 * boundary so a real request path is exercised, and the page is wrapped in
 * `AuthProvider` + `MemoryRouter` because PageShell renders the Navbar (which
 * reads auth) and ScrollToHash (which reads the location).
 *
 * jsdom has no `IntersectionObserver`, which is the environment the page's
 * scroll-reveal falls back to. That makes one of these tests — "content is
 * visible when the observer is missing" — a check on real behaviour rather than
 * a mock: it is exactly the case that would otherwise leave the page blank.
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

function fail(status = 500) {
  return new Response(
    JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Nope' } }),
    { status, headers: { 'Content-Type': 'application/json' } },
  )
}

const unauthenticated = () =>
  new Response(
    JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthenticated' } }),
    { status: 401, headers: { 'Content-Type': 'application/json' } },
  )

const STATS: PublicStats = { approvedTutors: 12, subjects: 10, universities: 4, countries: 2 }

/** Stubs every request the page makes, and throws on anything unexpected. */
function stubPage(reply: () => Response = () => ok(STATS)) {
  fetchMock.mockImplementation((input: string) => {
    const url = new URL(input, 'http://localhost')
    switch (url.pathname) {
      case '/api/auth/me':
        return Promise.resolve(unauthenticated())
      case '/api/auth/providers':
        return Promise.resolve(ok({ providers: [] }))
      case '/api/public/stats':
        return Promise.resolve(reply())
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
  stubPage()
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetAuthState()
})

function renderPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/how-it-works']}>
        <HowItWorksPage />
      </MemoryRouter>
    </AuthProvider>,
  )
}

/** Resolves once the statistics band has settled. */
async function waitForStats() {
  await waitFor(() => {
    expect(screen.queryByTestId('tt-stat-approvedTutors')?.textContent).toBe('12')
  })
}

function statValue(key: string): string {
  return screen.getByTestId(`tt-stat-${key}`).textContent ?? ''
}

// ---------------------------------------------------------------------------
// Requirement 13.3 / 13.4 — one h1, and a heading hierarchy with no gaps
// ---------------------------------------------------------------------------

describe('HowItWorksPage — document structure', () => {
  it('renders exactly one h1', () => {
    const { container } = renderPage()

    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('goes h1 → h2 → h3 without skipping a level', () => {
    const { container } = renderPage()
    const levels = [...container.querySelectorAll('main h1, main h2, main h3')].map((heading) =>
      Number(heading.tagName.slice(1)),
    )

    expect(levels[0]).toBe(1)
    levels.slice(1).forEach((level, index) => {
      // A heading may repeat its predecessor's level or step down by one, but
      // never jump from h1 straight to h3.
      expect(level - levels[index]).toBeLessThanOrEqual(1)
    })
  })

  it('gives every section a heading, so no section is unlabelled', () => {
    const { container } = renderPage()
    const sections = [...container.querySelectorAll('main section')]

    // Hero, steps, statistics, promise, FAQ and the closing call to action.
    expect(sections).toHaveLength(6)
    for (const section of sections) {
      const heading = section.querySelector('h1, h2')
      expect(heading, 'every section needs a heading').not.toBeNull()
    }
  })
})

// ---------------------------------------------------------------------------
// The three-step structure, preserved
// ---------------------------------------------------------------------------

describe('HowItWorksPage — the three steps', () => {
  /** The steps list. Scoped to <main>: the footer has lists of its own. */
  function stepList(container: HTMLElement): HTMLElement {
    const list = container.querySelector('main ol')
    expect(list).not.toBeNull()
    return list as HTMLElement
  }

  it('renders one card per step, in order, inside a list', () => {
    const { container } = renderPage()
    // Direct children only: each card also contains a list of its own.
    const cards = [...stepList(container).querySelectorAll<HTMLElement>(':scope > li')]

    expect(cards).toHaveLength(STEPS.length)
    expect(STEPS).toHaveLength(3)

    STEPS.forEach((step, index) => {
      const card = cards[index]
      expect(within(card).getByRole('heading', { name: step.title })).toBeInTheDocument()
      expect(within(card).getByText(step.description)).toBeInTheDocument()
      expect(within(card).getByText(step.meta)).toBeInTheDocument()
      for (const point of step.points) {
        expect(within(card).getByText(point)).toBeInTheDocument()
      }
    })
  })

  it('numbers the steps visually without announcing the number twice', () => {
    const { container } = renderPage()
    const cards = [...stepList(container).querySelectorAll<HTMLElement>(':scope > li')]

    // The badge is aria-hidden; the position is conveyed by the list itself.
    STEPS.forEach((step, index) => {
      const badge = within(cards[index]).getByText(step.number)
      expect(badge.closest('[aria-hidden="true"]')).not.toBeNull()
    })
  })
})

// ---------------------------------------------------------------------------
// Requirement 4.2 / 4.3 — the trust statistics are the real ones
// ---------------------------------------------------------------------------

describe('HowItWorksPage — trust statistics', () => {
  it('shows the counts the API returned, labelled', async () => {
    renderPage()
    await waitForStats()

    expect(statValue('approvedTutors')).toBe('12')
    expect(statValue('subjects')).toBe('10')
    expect(statValue('universities')).toBe('4')
    expect(statValue('countries')).toBe('2')

    for (const definition of STAT_DEFINITIONS) {
      expect(screen.getByText(definition.label)).toBeInTheDocument()
    }
  })

  it('requests the public stats endpoint rather than hard-coding numbers', async () => {
    renderPage()
    await waitForStats()

    const statsCalls = fetchMock.mock.calls.filter(
      ([input]) => new URL(input as string, 'http://localhost').pathname === '/api/public/stats',
    )
    expect(statsCalls).toHaveLength(1)
  })

  it('says so in words when every count is zero', async () => {
    stubPage(() => ok({ approvedTutors: 0, subjects: 0, universities: 0, countries: 0 }))
    const { container } = renderPage()

    await waitFor(() => {
      expect(statValue('approvedTutors')).toBe('Growing')
    })

    for (const definition of STAT_DEFINITIONS) {
      expect(statValue(definition.key)).toBe(definition.fallback)
    }
    // "0 tutors" reads as a dead marketplace; a zero is never printed.
    expect(container.textContent ?? '').not.toMatch(
      /\b0\s+(tutors?|subjects?|universit(?:y|ies)|countr(?:y|ies))\b/i,
    )
  })

  it('degrades to the same wording when the request fails', async () => {
    stubPage(() => fail(500))
    const { container } = renderPage()

    await waitFor(() => {
      expect(statValue('approvedTutors')).toBe('Growing')
    })

    const text = (container.textContent ?? '').toLowerCase()
    for (const word of ['error', 'failed', 'unavailable', 'retry']) {
      expect(text).not.toMatch(new RegExp(`\\b${word}\\b`))
    }
  })
})

// ---------------------------------------------------------------------------
// Requirement 14 — nothing on this page is invented
// ---------------------------------------------------------------------------

describe('HowItWorksPage — no fabricated claims', () => {
  it('carries no rating, star score or invented count', async () => {
    const { container } = renderPage()
    await waitForStats()

    const text = container.textContent ?? ''
    // The hand-written "500+ / 4.9 ★ / 300+ / < 24 h" band this page replaced.
    expect(text).not.toContain('4.9')
    expect(text).not.toContain('★')
    expect(text).not.toContain('500+')
    expect(text).not.toContain('300+')

    // Word-bounded: "start learning" is not a star rating.
    for (const word of ['rating', 'star', 'testimonial', 'success rate', 'satisfaction']) {
      expect(text, `"${word}" must not appear on this page`).not.toMatch(
        new RegExp(`\\b${word}\\b`, 'i'),
      )
    }
  })

  it('makes no claim the platform cannot back', () => {
    const { container } = renderPage()
    const text = container.textContent ?? ''

    // Requirement 5.4: review is done by a person, not by a background-check
    // service, and no credential is verified instantly.
    for (const claim of ['background check', 'certified', 'guaranteed results']) {
      expect(text.toLowerCase(), `"${claim}" must not appear on this page`).not.toContain(claim)
    }
  })
})

// ---------------------------------------------------------------------------
// The FAQ and the call to action
// ---------------------------------------------------------------------------

describe('HowItWorksPage — questions and next step', () => {
  it('renders every question with its answer available in the document', () => {
    renderPage()

    for (const faq of FAQS) {
      const question = screen.getByText(faq.question)
      const disclosure = question.closest('details')
      expect(disclosure).not.toBeNull()
      expect(within(disclosure as HTMLElement).getByText(faq.answer)).toBeInTheDocument()
    }
  })

  it('links to routes that exist, and nowhere else', () => {
    const { container } = renderPage()
    const hrefs = [...container.querySelectorAll('main a[href]')].map((link) =>
      link.getAttribute('href'),
    )

    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) {
      const path = href?.split('?')[0]
      expect(
        [
          '/',
          '/tutors',
          '/request-tutor',
          '/about',
          '/contact',
          '/become-a-tutor',
          '/login',
          '/register',
        ],
        `${href} is not a route in the app`,
      ).toContain(path)
    }
  })

  it('offers both ways in — a request and a browse — above the fold', () => {
    renderPage()

    expect(screen.getAllByRole('link', { name: /get started/i })[0]).toHaveAttribute(
      'href',
      '/request-tutor',
    )
    expect(screen.getAllByRole('link', { name: /browse tutors/i })[0]).toHaveAttribute(
      'href',
      '/tutors',
    )
  })
})

// ---------------------------------------------------------------------------
// The scroll reveal must never be able to hide the page
// ---------------------------------------------------------------------------

describe('HowItWorksPage — the scroll reveal cannot hide content', () => {
  it('reveals every block when IntersectionObserver is unavailable', () => {
    // The case this guard exists for: jsdom has no IntersectionObserver, and
    // so does any browser old enough to lack it. Every reveal must settle on
    // its visible state rather than staying at opacity 0 forever.
    const { container } = renderPage()

    const reveals = [...container.querySelectorAll('[data-revealed]')]
    expect(reveals.length).toBeGreaterThan(0)
    for (const element of reveals) {
      expect(element.getAttribute('data-revealed')).toBe('true')
    }
  })

  it('marks a block hidden until it is observed, then reveals it once', async () => {
    const observers: ((entries: unknown[]) => void)[] = []
    const disconnect = vi.fn()

    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: unknown[]) => void) {
          observers.push(callback)
        }
        observe() {}
        unobserve() {}
        disconnect = disconnect
      },
    )

    const { container } = renderPage()

    const hidden = container.querySelectorAll('[data-revealed="false"]')
    expect(hidden.length).toBeGreaterThan(0)

    // Fire every registered observer with an intersecting entry, as a scroll
    // into view would.
    for (const callback of observers) {
      callback([{ isIntersecting: true }])
    }

    await waitFor(() => {
      expect(container.querySelectorAll('[data-revealed="false"]')).toHaveLength(0)
    })
  })
})
