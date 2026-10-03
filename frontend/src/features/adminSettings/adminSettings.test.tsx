import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setAdminToken } from '@/features/adminRequests/adminSession'
import { AdminSiteStatsPage } from '@/pages/AdminSiteStatsPage'

import type { SiteStatsSettings } from './adminSettings.types'

/**
 * Homepage statistics settings screen.
 *
 * The API layer is stubbed at the `fetch` boundary, so these exercise the real
 * request path — URL, method, body shape and envelope unwrapping included. A
 * mocked API module would let a wrong endpoint or a body the backend rejects
 * pass. The server side of this feature is covered by
 * backend/tests/siteStats.api.test.mjs.
 *
 * The behaviours these pin down are the ones that would quietly mislead: a
 * figure that says it is overridden when it is not, a save that clears the three
 * overrides the admin did not touch, and a number accepted here that the
 * homepage cannot render.
 */

const PATH = '/api/admin/site-stats'

const KEYS = ['approvedTutors', 'subjects', 'universities', 'countries'] as const

function settings(overrides: Partial<SiteStatsSettings> = {}): SiteStatsSettings {
  const live = { approvedTutors: 6, subjects: 9, universities: 3, countries: 2 }
  const zeroed = { approvedTutors: null, subjects: null, universities: null, countries: null }

  return {
    live,
    overrides: { ...zeroed },
    showing: { ...live },
    updatedAt: null,
    ...overrides,
  }
}

/** A settings payload with `key` overridden, and `showing` consistent with it. */
function withOverride(key: (typeof KEYS)[number], value: number): SiteStatsSettings {
  const base = settings()
  return {
    ...base,
    overrides: { ...base.overrides, [key]: value },
    showing: { ...base.showing, [key]: value },
    updatedAt: '2026-10-01T09:00:00.000Z',
  }
}

function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

let fetchMock: ReturnType<typeof vi.fn>

/** The bodies of every PATCH this page sent, in order. */
function patchBodies(): Array<Record<string, unknown>> {
  return fetchMock.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH')
    .map(([, init]) => JSON.parse(String((init as RequestInit).body ?? '{}')))
}

interface Routes {
  get?: () => Response
  patch?: (body: Record<string, unknown>) => Response
}

function stubApi(routes: Routes = {}) {
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost:5173')
    if (url.pathname !== PATH) throw new Error(`unexpected request: ${url.pathname}`)

    if ((init?.method ?? 'GET') === 'PATCH') {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      // Default behaviour: accept the save and answer with the merged state, the
      // way the real endpoint does.
      if (routes.patch) return routes.patch(body)

      const current = settings()
      const next = { ...current.overrides }
      for (const [key, value] of Object.entries(body)) {
        next[key as (typeof KEYS)[number]] = value as number | null
      }
      return ok({
        ...current,
        overrides: next,
        showing: { ...current.showing },
        updatedAt: '2026-10-01T09:00:00.000Z',
      })
    }

    return routes.get ? routes.get() : ok(settings())
  })
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/site-stats']}>
      <AdminSiteStatsPage />
    </MemoryRouter>,
  )
}

/** The override input for one figure. */
function field(key: (typeof KEYS)[number]) {
  return document.getElementById(`stat-${key}`) as HTMLInputElement
}

/** The whole row for one figure, so assertions can be scoped to it. */
function row(label: string) {
  return screen.getByText(label).closest('li') as HTMLElement
}

/** Waits for the first load to settle. */
async function waitForLoad() {
  await waitFor(() => {
    expect(field('approvedTutors')).toBeInTheDocument()
  })
}

beforeEach(() => {
  setAdminToken('test-admin-token')
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  stubApi()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Reading the screen
// ---------------------------------------------------------------------------

describe('AdminSiteStatsPage — what the screen shows', () => {
  it('requests the admin endpoint, with no authentication of its own', async () => {
    renderPage()
    await waitForLoad()

    const [input, init] = fetchMock.mock.calls[0]
    expect(new URL(String(input), 'http://localhost').pathname).toBe(PATH)
    // The token travels as a bearer header supplied by the shared API layer; the
    // page must never put it in the URL.
    expect((init as RequestInit).credentials).toBe('include')
  })

  it('names all four homepage figures', async () => {
    renderPage()
    await waitForLoad()

    for (const label of [
      'Approved tutors',
      'Subjects taught',
      'University backgrounds',
      'Countries represented',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('shows the live count for every figure and no override boxes', async () => {
    stubApi({ get: () => ok(settings()) })
    renderPage()
    await waitForLoad()

    expect(row('Approved tutors')).toHaveTextContent('6')
    for (const key of KEYS) {
      expect(field(key)).toHaveValue(null)
    }
  })

  it('shows the override in the box and the figure visitors are seeing', async () => {
    stubApi({ get: () => ok(withOverride('approvedTutors', 500)) })
    renderPage()
    await waitForLoad()

    const tutors = row('Approved tutors')

    expect(field('approvedTutors')).toHaveValue(500)
    expect(tutors).toHaveTextContent('500')
    // The live count is still shown, so the override is never invisible.
    expect(tutors).toHaveTextContent('6')
    expect(tutors).toHaveTextContent('overridden')
  })

  it('reports a failed load instead of pretending the counts are zero', async () => {
    stubApi({
      get: () =>
        new Response(
          JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Nope' } }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
    })
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/unable to load/i)
    })
    expect(field('approvedTutors')).toBeNull()
  })

  it('says so when the admin session has expired', async () => {
    stubApi({
      get: () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'A valid admin access token is required.' },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
    })
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/session is no longer valid/i)
    })
  })
})

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

describe('AdminSiteStatsPage — saving an override', () => {
  it('sends only the figure that changed', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitForLoad()

    await user.type(field('subjects'), '40')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(patchBodies()).toHaveLength(1)
    })
    expect(patchBodies()[0]).toEqual({ subjects: 40 })
  })

  it('cannot submit an unchanged form', async () => {
    renderPage()
    await waitForLoad()

    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled()
  })

  it('sends null to clear an override, and says nothing was changed otherwise', async () => {
    const user = userEvent.setup()
    stubApi({ get: () => ok(withOverride('subjects', 40)) })
    renderPage()
    await waitForLoad()

    await user.clear(field('subjects'))
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(patchBodies()).toEqual([{ subjects: null }])
    })
  })

  it('resets all four overrides in one action', async () => {
    const user = userEvent.setup()
    stubApi({
      get: () =>
        ok({
          ...settings(),
          overrides: { approvedTutors: 1, subjects: 2, universities: 3, countries: 4 },
          showing: { approvedTutors: 1, subjects: 2, universities: 3, countries: 4 },
          updatedAt: '2026-10-01T09:00:00.000Z',
        }),
    })
    renderPage()
    await waitForLoad()

    await user.click(screen.getByRole('button', { name: /reset all to live counts/i }))

    await waitFor(() => {
      expect(patchBodies()).toHaveLength(1)
    })
    expect(patchBodies()[0]).toEqual({
      approvedTutors: null,
      subjects: null,
      universities: null,
      countries: null,
    })
  })

  it('confirms a save', async () => {
    const user = userEvent.setup()
    stubApi({
      get: () => ok(settings()),
      patch: () => ok(withOverride('countries', 12)),
    })
    renderPage()
    await waitForLoad()

    await user.type(field('countries'), '12')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/saved/i)
    })
  })

  it('re-seeds the form from the server after a save', async () => {
    const user = userEvent.setup()
    let stored: Record<string, unknown> = {}
    stubApi({
      get: () => ok({ ...settings(), overrides: stored, showing: { ...settings().live } }),
      patch: () => {
        stored = { countries: 12 }
        return ok(withOverride('countries', 12))
      },
    })
    renderPage()
    await waitForLoad()

    await user.type(field('countries'), '12')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    // The refetch after the save is what empties the box: the stored override is
    // now the baseline, so the form is no longer dirty.
    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === 'PATCH')).toHaveLength(1)
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled()
    })
  })

  it('surfaces the API message and leaves the edit in place', async () => {
    const user = userEvent.setup()
    stubApi({
      patch: () =>
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request.',
              fields: [{ field: 'subjects', message: 'must be at least 1' }],
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
    })
    renderPage()
    await waitForLoad()

    await user.type(field('subjects'), '40')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(screen.getByText('must be at least 1')).toBeInTheDocument()
    })
    expect(field('subjects')).toHaveValue(40)
  })
})

// ---------------------------------------------------------------------------
// Values the homepage cannot render
// ---------------------------------------------------------------------------

describe('AdminSiteStatsPage — refuses figures the homepage cannot show', () => {
  /*
   * The homepage prints wording instead of a zero, so a 0 stored here would put
   * a card on screen that contradicts its own number. The screen has to refuse it
   * before the request, not discover it from a 400.
   */
  it('will not submit a zero', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitForLoad()

    await user.type(field('approvedTutors'), '0')

    expect(await screen.findByText(/at least 1/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled()
    expect(patchBodies()).toHaveLength(0)
  })

  it('will not submit a fraction', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitForLoad()

    await user.type(field('universities'), '2.5')

    expect(await screen.findByText(/whole number/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled()
  })

  it('will not submit a figure beyond the ceiling', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitForLoad()

    await user.type(field('subjects'), '1000001')

    expect(await screen.findByText(/at most 1,000,000/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled()
  })

  it('treats a blank field as "use the live count", not as zero', async () => {
    const user = userEvent.setup()
    stubApi({ get: () => ok(withOverride('subjects', 40)) })
    renderPage()
    await waitForLoad()

    await user.clear(field('subjects'))
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(patchBodies()).toEqual([{ subjects: null }])
    })
  })
})

// ---------------------------------------------------------------------------
// The screen's own honesty
// ---------------------------------------------------------------------------

describe('AdminSiteStatsPage — the override is never hidden', () => {
  it('shows the last-changed timestamp only once something has been overridden', async () => {
    const { unmount } = renderPage()
    await waitForLoad()
    expect(screen.queryByText(/overrides last changed/i)).not.toBeInTheDocument()
    unmount()

    stubApi({ get: () => ok(withOverride('subjects', 40)) })
    renderPage()
    await waitForLoad()
    expect(screen.getByText(/overrides last changed/i)).toBeInTheDocument()
  })

  it('spells out what an override does before anyone sets one', async () => {
    renderPage()
    await waitForLoad()

    const text = screen.getByRole('main').textContent ?? ''
    expect(text).toMatch(/recalculated on every page load/i)
    expect(text).toMatch(/overridden figure is visibly different from the live count/i)
  })
})
