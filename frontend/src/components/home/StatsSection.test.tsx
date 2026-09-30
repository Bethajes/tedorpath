import { render, screen, waitFor } from '@testing-library/react'
import fc from 'fast-check'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { StatsSection } from './StatsSection'
import type { PublicStats } from '@/features/tutors/tutors.types'

/**
 * The API is stubbed at the `fetch` boundary rather than by mocking
 * `@/features/tutors/tutors.api`, so the component exercises the real request
 * path — URL, envelope unwrapping and error handling included. A mocked
 * `getPublicStats` would let a wrong endpoint or a wrong response shape pass.
 */

const STATS_PATH = '/api/public/stats'

/** The four fields of `PublicStats`, so the two sides cannot drift apart. */
const STAT_KEYS: (keyof PublicStats)[] = ['approvedTutors', 'subjects', 'universities', 'countries']

/** The wording a card shows when its count is zero or unknown. */
const FALLBACKS: Record<keyof PublicStats, string> = {
  approvedTutors: 'Growing',
  subjects: 'Many',
  universities: 'Several',
  countries: 'Multiple',
}

/** The unit label under each count. */
const LABELS: Record<keyof PublicStats, string> = {
  approvedTutors: 'Approved tutors',
  subjects: 'Subjects taught',
  universities: 'University backgrounds',
  countries: 'Countries represented',
}

/**
 * A "0 tutors" style claim: a zero immediately followed by a unit word. The
 * section must never produce one, because a zero is an empty marketplace, not
 * a marketplace with nothing in it.
 */
const ZERO_CLAIM = /\b0\s+(tutors?|subjects?|universit(?:y|ies)|countr(?:y|ies))\b/i

const statsArbitrary: fc.Arbitrary<PublicStats> = fc.record({
  approvedTutors: fc.integer({ min: 0, max: 100_000 }),
  subjects: fc.integer({ min: 0, max: 100_000 }),
  universities: fc.integer({ min: 0, max: 100_000 }),
  countries: fc.integer({ min: 0, max: 100_000 }),
})

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function fail(status = 500) {
  return new Response(
    JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Nope' } }),
    { status, headers: { 'Content-Type': 'application/json' } },
  )
}

/** Stubs the one request this section makes and fails loudly on any other. */
function stubStats(reply: () => Response | Promise<Response>) {
  fetchMock.mockImplementation((input: string) => {
    const url = new URL(input, 'http://localhost')
    if (url.pathname === STATS_PATH) return Promise.resolve(reply())
    throw new Error(`unexpected request: ${url.pathname}`)
  })
}

function renderSection() {
  return render(
    <MemoryRouter>
      <StatsSection />
    </MemoryRouter>,
  )
}

/** The rendered value of a single stat card, e.g. "42" or "Growing". */
function cardValue(key: keyof PublicStats): string {
  return screen.getByTestId(`stat-value-${key}`).textContent ?? ''
}

/** The value a card should be showing for a given count. */
function expectedValue(count: number, key: keyof PublicStats): string {
  return count > 0 ? String(count) : FALLBACKS[key]
}

/** Resolves once every card has settled, so a slow card is never read as absent. */
async function waitForAllCards(stats: PublicStats) {
  await waitFor(() => {
    for (const key of STAT_KEYS) {
      expect(cardValue(key)).toBe(expectedValue(stats[key], key))
    }
  })
}

// ---------------------------------------------------------------------------
// Feature: homepage-redesign, Property 4: Stats section displays API values or
// honest fallback
// Validates: Requirements 4.2, 4.3
// ---------------------------------------------------------------------------

describe('StatsSection — Property 4: API values or honest fallback', () => {
  it('shows every non-zero count as the exact number the API returned', async () => {
    await fc.assert(
      fc.asyncProperty(statsArbitrary, async (stats) => {
        stubStats(() => ok(stats))
        const { container, unmount } = renderSection()

        await waitForAllCards(stats)

        for (const key of STAT_KEYS) {
          if (stats[key] > 0) {
            expect(container.textContent).toContain(String(stats[key]))
            expect(cardValue(key)).toBe(String(stats[key]))
          }
        }

        unmount()
      }),
      { numRuns: 100 },
    )
  })

  it('never renders a zero as a "0 <unit>" claim', async () => {
    await fc.assert(
      fc.asyncProperty(statsArbitrary, async (stats) => {
        stubStats(() => ok(stats))
        const { container, unmount } = renderSection()

        await waitForAllCards(stats)

        expect(container.textContent ?? '').not.toMatch(ZERO_CLAIM)
        // A zero is replaced by wording, never printed.
        for (const key of STAT_KEYS) {
          if (stats[key] === 0) {
            expect(cardValue(key)).toBe(FALLBACKS[key])
          }
        }

        unmount()
      }),
      { numRuns: 100 },
    )
  })

  it('shows honest wording for every metric when every count is zero', async () => {
    // Driven by a generated payload that is then zeroed out: whatever the API
    // was going to say, an all-zero platform must come out as all wording.
    await fc.assert(
      fc.asyncProperty(statsArbitrary, async (_stats) => {
        const allZero: PublicStats = {
          approvedTutors: 0,
          subjects: 0,
          universities: 0,
          countries: 0,
        }
        stubStats(() => ok(allZero))
        const { container, unmount } = renderSection()

        await waitFor(() => {
          expect(cardValue('approvedTutors')).toBe(FALLBACKS.approvedTutors)
        })

        for (const key of STAT_KEYS) {
          expect(cardValue(key)).toBe(FALLBACKS[key])
        }
        expect(container.textContent ?? '').not.toMatch(ZERO_CLAIM)
        expect(container.textContent).not.toContain('0')

        unmount()
      }),
      { numRuns: 100 },
    )
  })

  it('shows real numbers and wording side by side in a mixed response', async () => {
    await fc.assert(
      fc.asyncProperty(statsArbitrary, statsArbitrary, async (a, b) => {
        // Pin at least one field non-zero and at least one zero, so both
        // branches of the property are always exercised together.
        const stats: PublicStats = {
          approvedTutors: Math.max(1, a.approvedTutors),
          subjects: b.subjects,
          universities: Math.max(1, a.universities),
          countries: b.countries,
        }
        stubStats(() => ok(stats))
        const { container, unmount } = renderSection()

        await waitForAllCards(stats)

        expect(container.textContent).toContain(String(stats.approvedTutors))
        expect(container.textContent).toContain(String(stats.universities))
        if (stats.subjects === 0) expect(container.textContent).toContain(FALLBACKS.subjects)
        else expect(container.textContent).toContain(String(stats.subjects))
        if (stats.countries === 0) expect(container.textContent).toContain(FALLBACKS.countries)
        else expect(container.textContent).toContain(String(stats.countries))

        unmount()
      }),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// Requirement 4.2 — the numbers come from the API, not from this file
// ---------------------------------------------------------------------------

describe('StatsSection — numbers are sourced from the API', () => {
  it('requests the public stats endpoint, once', async () => {
    stubStats(() => ok({ approvedTutors: 1, subjects: 2, universities: 3, countries: 4 }))
    renderSection()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    expect(new URL(fetchMock.mock.calls[0][0] as string, 'http://localhost').pathname).toBe(STATS_PATH)
  })

  it('hard-codes no number: the same section shows different values for different responses', async () => {
    stubStats(() => ok({ approvedTutors: 7, subjects: 8, universities: 9, countries: 10 }))
    const first = renderSection()

    await waitFor(() => {
      expect(cardValue('approvedTutors')).toBe('7')
    })
    expect(cardValue('subjects')).toBe('8')
    expect(cardValue('universities')).toBe('9')
    expect(cardValue('countries')).toBe('10')
    first.unmount()

    stubStats(() => ok({ approvedTutors: 111, subjects: 222, universities: 333, countries: 444 }))
    renderSection()

    await waitFor(() => {
      expect(cardValue('approvedTutors')).toBe('111')
    })
    expect(cardValue('subjects')).toBe('222')
    expect(cardValue('universities')).toBe('333')
    expect(cardValue('countries')).toBe('444')
  })
})

// ---------------------------------------------------------------------------
// Requirement 4.3 — graceful degradation
// ---------------------------------------------------------------------------

describe('StatsSection — a failed request degrades to honest wording', () => {
  it('falls back to wording for every metric when the endpoint returns 500', async () => {
    stubStats(() => fail(500))
    renderSection()

    await waitFor(() => {
      expect(cardValue('approvedTutors')).toBe(FALLBACKS.approvedTutors)
    })
    for (const key of STAT_KEYS) {
      expect(cardValue(key)).toBe(FALLBACKS[key])
    }
  })

  it('falls back to wording when the network request rejects', async () => {
    stubStats(() => Promise.reject(new TypeError('Failed to fetch')))
    renderSection()

    await waitFor(() => {
      expect(cardValue('approvedTutors')).toBe(FALLBACKS.approvedTutors)
    })
  })

  it('shows no error message — the section is an enhancement, not a feature gate', async () => {
    stubStats(() => fail(500))
    const { container } = renderSection()

    await waitFor(() => {
      expect(cardValue('approvedTutors')).toBe(FALLBACKS.approvedTutors)
    })

    const text = (container.textContent ?? '').toLowerCase()
    for (const word of ['error', 'failed', 'unavailable', 'retry']) {
      expect(text).not.toContain(word)
    }
  })

  it('ignores a malformed payload rather than rendering NaN or undefined', async () => {
    // A response that is not the documented shape must not put "NaN" on the
    // homepage. The values simply stay unknown.
    stubStats(() => ok({ approvedTutors: 'lots', subjects: null }))
    const { container } = renderSection()

    await waitFor(() => {
      expect(cardValue('approvedTutors')).toBe(FALLBACKS.approvedTutors)
    })

    const text = container.textContent ?? ''
    expect(text).not.toMatch(/NaN|undefined|null/)
    for (const key of STAT_KEYS) {
      expect(cardValue(key)).toBe(FALLBACKS[key])
    }
  })

  it('renders the heading immediately, before the request resolves', () => {
    // The page must not wait on stats to show anything: they are an
    // enhancement, so the section is present from the first paint.
    stubStats(() => new Promise<Response>(() => {}))
    renderSection()

    expect(screen.getByRole('heading', { name: /the platform today/i })).toBeInTheDocument()
    expect(cardValue('approvedTutors')).toBe(FALLBACKS.approvedTutors)
  })
})

// ---------------------------------------------------------------------------
// Requirement 4.5 — layout and labelling
// ---------------------------------------------------------------------------

describe('StatsSection — presentation', () => {
  it('renders exactly four labelled stat cards', async () => {
    const stats = { approvedTutors: 5, subjects: 6, universities: 7, countries: 8 }
    stubStats(() => ok(stats))
    const { container } = renderSection()

    await waitForAllCards(stats)

    expect(container.querySelectorAll('dd')).toHaveLength(4)
    expect(container.querySelectorAll('dt')).toHaveLength(4)
  })

  it('labels every count, so a number is never shown without a unit', async () => {
    const stats = { approvedTutors: 5, subjects: 6, universities: 7, countries: 8 }
    stubStats(() => ok(stats))
    renderSection()

    await waitForAllCards(stats)

    for (const label of Object.values(LABELS)) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })
})

// ---------------------------------------------------------------------------
// Requirement 4.6 — nothing invented
// ---------------------------------------------------------------------------

describe('StatsSection — no fabricated metrics', () => {
  it('shows no rating, review count, success rate or satisfaction score', async () => {
    const stats = { approvedTutors: 100, subjects: 40, universities: 12, countries: 5 }
    stubStats(() => ok(stats))
    const { container } = renderSection()

    await waitForAllCards(stats)

    const text = (container.textContent ?? '').toLowerCase()
    for (const word of [
      'rating',
      'star',
      'review',
      'testimonial',
      'success rate',
      'satisfaction',
      'happy learners',
      'students taught',
      'lessons',
    ]) {
      expect(text, `"${word}" must not appear in the stats section`).not.toContain(word)
    }
  })
})
