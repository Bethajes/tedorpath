import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setAdminToken } from '@/features/adminRequests/adminSession'
import { AdminDashboardPage } from '@/pages/AdminDashboardPage'
import { AdminRequestDetailPage } from '@/pages/AdminRequestDetailPage'
import { AdminRequestsPage } from '@/pages/AdminRequestsPage'

/**
 * Admin UI tests.
 *
 * The API layer is stubbed at the `fetch` boundary so these focus on the
 * screens: loading / empty / error / success states, filtering, pagination and
 * the status + notes controls. The end-to-end behaviour against the real
 * database is covered by backend/tests/admin.api.test.mjs.
 */

const TOKEN = 'test-admin-token'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const listItem = (overrides: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  fullName: 'Abel Tesfaye',
  subject: 'Mathematics',
  educationLevel: 'University',
  learningMode: 'Online',
  status: 'NEW',
  createdAt: '2026-09-27T10:00:00.000Z',
  ...overrides,
})

const detailRecord = (overrides: Record<string, unknown> = {}) => ({
  ...listItem(),
  phone: '0912345678',
  telegramUsername: '@abel',
  email: 'abel@example.com',
  description: 'I need help with calculus for my exam.',
  location: 'Downtown',
  preferredDays: 'Monday',
  preferredTime: 'Evening',
  budget: '$20 per hour',
  additionalInfo: null,
  adminNotes: null,
  updatedAt: '2026-09-27T10:05:00.000Z',
  ...overrides,
})

let fetchMock: ReturnType<typeof vi.fn>

/** Routes a URL to a handler, so each test only declares what it cares about. */
function stubApi(routes: {
  stats?: () => Promise<Response> | Response
  list?: (url: URL) => Promise<Response> | Response
  detail?: () => Promise<Response> | Response
  patch?: (body: Record<string, unknown>) => Promise<Response> | Response
  remove?: () => Promise<Response> | Response
}) {
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost:5173')
    const method = init?.method ?? 'GET'

    if (url.pathname === '/api/admin/stats') {
      return routes.stats
        ? routes.stats()
        : jsonResponse({
            success: true,
            data: { total: 3, NEW: 1, CONTACTED: 1, IN_PROGRESS: 1, COMPLETED: 0, CANCELLED: 0 },
          })
    }

    if (url.pathname === '/api/admin/tutor-requests' && method === 'GET') {
      return routes.list
        ? routes.list(url)
        : jsonResponse({
            success: true,
            data: {
              items: [listItem()],
              pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
            },
          })
    }

    if (url.pathname.startsWith('/api/admin/tutor-requests/')) {
      if (method === 'PATCH') {
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
        return routes.patch
          ? routes.patch(body)
          : jsonResponse({ success: true, data: detailRecord(body) })
      }
      if (method === 'DELETE') {
        return routes.remove ? routes.remove() : jsonResponse({ success: true, data: { deleted: true } })
      }
      return routes.detail ? routes.detail() : jsonResponse({ success: true, data: detailRecord() })
    }

    throw new Error(`unexpected request: ${method} ${url.pathname}`)
  })
}

function renderAt(ui: React.ReactElement, path: string) {
  return render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>)
}

beforeEach(() => {
  setAdminToken(TOKEN)
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AdminDashboardPage', () => {
  it('shows a loading state, then the real statistics', async () => {
    stubApi({})
    renderAt(<AdminDashboardPage />, '/admin')

    expect(screen.getByText('Loading dashboard…')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('Total Requests')).toBeInTheDocument())
    expect(screen.getByText('Contacted')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()

    // Values must come from the API, not be hardcoded.
    const totalCard = screen.getByText('Total Requests').closest('li')!
    expect(within(totalCard).getByText('3')).toBeInTheDocument()
  })

  it('shows an empty state when there are no requests', async () => {
    stubApi({
      stats: () => jsonResponse({ success: true, data: { total: 0, NEW: 0, CONTACTED: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 } }),
      list: () =>
        jsonResponse({
          success: true,
          data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
        }),
    })
    renderAt(<AdminDashboardPage />, '/admin')

    await waitFor(() => expect(screen.getByText('No tutor requests yet.')).toBeInTheDocument())
  })

  it('shows an error state with a retry when loading fails', async () => {
    stubApi({
      stats: () => jsonResponse({ success: false, error: { code: 'X', message: 'boom' } }, 500),
      list: () => jsonResponse({ success: false, error: { code: 'X', message: 'boom' } }, 500),
    })
    renderAt(<AdminDashboardPage />, '/admin')

    await waitFor(() =>
      expect(
        screen.getByText('Unable to load the dashboard. Please try again.'),
      ).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('lists recent requests with a status badge', async () => {
    stubApi({})
    renderAt(<AdminDashboardPage />, '/admin')

    await waitFor(() => expect(screen.getByText('Recent requests')).toBeInTheDocument())
    expect(screen.getByText('Abel Tesfaye')).toBeInTheDocument()
    expect(screen.getAllByText('NEW').length).toBeGreaterThan(0)
  })
})

describe('AdminRequestsPage', () => {
  it('shows a loading state then renders the table', async () => {
    stubApi({})
    renderAt(<AdminRequestsPage />, '/admin/requests')

    expect(screen.getByText('Loading tutor requests…')).toBeInTheDocument()
    // Rendered twice on purpose: once in the desktop table, once in the mobile
    // card list, with CSS deciding which is visible.
    await waitFor(() => expect(screen.getAllByText('Abel Tesfaye').length).toBeGreaterThan(0))

    // Column headers for the desktop table.
    for (const header of [
      'Client',
      'Subject',
      'Education Level',
      'Learning Mode',
      'Status',
      'Created',
      'Actions',
    ]) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument()
    }
  })

  it('sends the admin token with requests', async () => {
    stubApi({})
    renderAt(<AdminRequestsPage />, '/admin/requests')
    await waitFor(() => expect(screen.getAllByText('Abel Tesfaye').length).toBeGreaterThan(0))

    const call = fetchMock.mock.calls.find(([input]) =>
      String(input).includes('/api/admin/tutor-requests'),
    )
    const headers = (call?.[1] as RequestInit | undefined)?.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('sends a debounced search term', async () => {
    const user = userEvent.setup()
    const seen: string[] = []
    stubApi({
      list: (url) => {
        seen.push(url.searchParams.get('q') ?? '')
        return jsonResponse({
          success: true,
          data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
        })
      },
    })
    renderAt(<AdminRequestsPage />, '/admin/requests')
    await waitFor(() => expect(seen.length).toBeGreaterThan(0))

    await user.type(screen.getByLabelText('Search'), 'abel')
    await waitFor(() => expect(seen).toContain('abel'), { timeout: 2000 })
  })

  it('filters by status', async () => {
    const user = userEvent.setup()
    const seen: string[] = []
    stubApi({
      list: (url) => {
        seen.push(url.searchParams.get('status') ?? '')
        return jsonResponse({
          success: true,
          data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
        })
      },
    })
    renderAt(<AdminRequestsPage />, '/admin/requests')
    await waitFor(() => expect(seen).toContain('all'))

    await user.selectOptions(screen.getByLabelText('Status'), 'COMPLETED')
    await waitFor(() => expect(seen).toContain('COMPLETED'))
  })

  it('offers every status filter option', async () => {
    stubApi({
      list: () =>
        jsonResponse({
          success: true,
          data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
        }),
    })
    renderAt(<AdminRequestsPage />, '/admin/requests')
    await waitFor(() => expect(screen.getByLabelText('Status')).toBeInTheDocument())

    const options = within(screen.getByLabelText('Status')).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual([
      'All',
      'New',
      'Contacted',
      'In Progress',
      'Completed',
      'Cancelled',
    ])
  })

  it('shows pagination and moves between pages', async () => {
    const user = userEvent.setup()
    const pages: number[] = []
    stubApi({
      list: (url) => {
        const page = Number(url.searchParams.get('page'))
        pages.push(page)
        return jsonResponse({
          success: true,
          data: {
            items: [listItem({ id: `id-${page}`, fullName: `Page ${page} person` })],
            pagination: { page, limit: 20, total: 45, totalPages: 3 },
          },
        })
      },
    })
    renderAt(<AdminRequestsPage />, '/admin/requests')
    await waitFor(() => expect(screen.getByText('Page 1 of 3')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(screen.getByText('Page 2 of 3')).toBeInTheDocument())
    expect(pages).toContain(2)
  })

  it('renders cards as well as the table for small screens', async () => {
    stubApi({})
    const { container } = renderAt(<AdminRequestsPage />, '/admin/requests')
    await waitFor(() => expect(screen.getAllByText('Abel Tesfaye').length).toBeGreaterThan(0))

    // Both presentations exist in the DOM; CSS decides which is visible.
    expect(container.querySelector('table')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'View request' }).length).toBeGreaterThan(0)
  })

  it('shows the plain empty message when there are no requests at all', async () => {
    stubApi({
      list: () =>
        jsonResponse({
          success: true,
          data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
        }),
    })
    renderAt(<AdminRequestsPage />, '/admin/requests')
    await waitFor(() => expect(screen.getByText('No tutor requests yet.')).toBeInTheDocument())
  })

  it('shows a helpful empty message when a search matches nothing', async () => {
    const user = userEvent.setup()
    stubApi({
      list: () =>
        jsonResponse({
          success: true,
          data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
        }),
    })
    renderAt(<AdminRequestsPage />, '/admin/requests')
    await waitFor(() => expect(screen.getByText('No tutor requests yet.')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Search'), 'zzzz-no-match')
    await waitFor(
      () =>
        expect(
          screen.getByText('No tutor requests match your search or filter.'),
        ).toBeInTheDocument(),
      { timeout: 2000 },
    )
  })

  it('shows the error state and can retry', async () => {
    const user = userEvent.setup()
    let fail = true
    stubApi({
      list: () => {
        if (fail) return jsonResponse({ success: false, error: { code: 'X', message: 'no' } }, 500)
        return jsonResponse({
          success: true,
          data: { items: [listItem()], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } },
        })
      },
    })
    renderAt(<AdminRequestsPage />, '/admin/requests')

    await waitFor(() =>
      expect(
        screen.getByText('Unable to load tutor requests. Please try again.'),
      ).toBeInTheDocument(),
    )

    fail = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getAllByText('Abel Tesfaye').length).toBeGreaterThan(0))
  })
})

describe('AdminRequestDetailPage', () => {
  const id = '11111111-1111-4111-8111-111111111111'

  it('displays all client and requirement information', async () => {
    stubApi({ detail: () => jsonResponse({ success: true, data: detailRecord() }) })
    renderAt(<AdminRequestDetailPage />, `/admin/requests/${id}`)

    await waitFor(() => expect(screen.getByText('Client Information')).toBeInTheDocument())

    expect(screen.getByText('Full name')).toBeInTheDocument()
    expect(screen.getByText('0912345678')).toBeInTheDocument()
    expect(screen.getByText('@abel')).toBeInTheDocument()
    expect(screen.getByText('abel@example.com')).toBeInTheDocument()

    expect(screen.getByText('Learning Requirements')).toBeInTheDocument()
    expect(screen.getByText('I need help with calculus for my exam.')).toBeInTheDocument()
    expect(screen.getByText('Online')).toBeInTheDocument()
    expect(screen.getByText('Downtown')).toBeInTheDocument()
    expect(screen.getByText('$20 per hour')).toBeInTheDocument()

    expect(screen.getByText('Request Information')).toBeInTheDocument()
    expect(screen.getByText('Created')).toBeInTheDocument()
    expect(screen.getByText('Last updated')).toBeInTheDocument()
  })

  it('marks missing optional values as not provided', async () => {
    stubApi({
      detail: () =>
        jsonResponse({
          success: true,
          data: detailRecord({ telegramUsername: null, email: null, location: null, budget: null }),
        }),
    })
    renderAt(<AdminRequestDetailPage />, `/admin/requests/${id}`)

    await waitFor(() => expect(screen.getByText('Client Information')).toBeInTheDocument())
    expect(screen.getAllByText('Not provided').length).toBeGreaterThanOrEqual(4)
  })

  it('shows a 404 message for a missing request', async () => {
    stubApi({
      detail: () => jsonResponse({ success: false, error: { code: 'NOT_FOUND', message: 'nope' } }, 404),
    })
    renderAt(<AdminRequestDetailPage />, `/admin/requests/${id}`)

    await waitFor(() =>
      expect(
        screen.getByText('This tutor request does not exist. It may have been deleted.'),
      ).toBeInTheDocument(),
    )
  })

  it('labels the notes field as internal', async () => {
    stubApi({ detail: () => jsonResponse({ success: true, data: detailRecord() }) })
    renderAt(<AdminRequestDetailPage />, `/admin/requests/${id}`)

    await waitFor(() => expect(screen.getByText('Internal Admin Notes')).toBeInTheDocument())
    expect(screen.getByText(/Never shown on the public website/)).toBeInTheDocument()
  })

  it('saves a status change through the API', async () => {
    const user = userEvent.setup()
    const patches: unknown[] = []
    stubApi({
      detail: () => jsonResponse({ success: true, data: detailRecord() }),
      patch: (body) => {
        patches.push(body)
        return jsonResponse({ success: true, data: detailRecord(body) })
      },
    })
    renderAt(<AdminRequestDetailPage />, `/admin/requests/${id}`)

    await waitFor(() => expect(screen.getByLabelText('Status')).toBeInTheDocument())
    await user.selectOptions(screen.getByLabelText('Status'), 'CONTACTED')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(patches).toHaveLength(1))
    expect(patches[0]).toMatchObject({ status: 'CONTACTED' })
  })

  it('walks NEW -> CONTACTED -> IN_PROGRESS -> COMPLETED', async () => {
    const user = userEvent.setup()
    let current: Record<string, unknown> = { status: 'NEW' }
    const patches: unknown[] = []
    stubApi({
      detail: () => jsonResponse({ success: true, data: detailRecord(current) }),
      patch: (body) => {
        patches.push(body)
        current = { ...current, ...body }
        return jsonResponse({ success: true, data: detailRecord(current) })
      },
    })
    renderAt(<AdminRequestDetailPage />, `/admin/requests/${id}`)

    await waitFor(() => expect(screen.getByLabelText('Status')).toBeInTheDocument())

    for (const next of ['CONTACTED', 'IN_PROGRESS', 'COMPLETED']) {
      await user.selectOptions(screen.getByLabelText('Status'), next)
      await user.click(screen.getByRole('button', { name: 'Save changes' }))
      await waitFor(() => expect(patches[patches.length - 1]).toMatchObject({ status: next }))
    }

    expect(patches.map((p) => (p as { status: string }).status)).toEqual([
      'CONTACTED',
      'IN_PROGRESS',
      'COMPLETED',
    ])
  })

  it('saves internal notes, including clearing them', async () => {
    const user = userEvent.setup()
    const patches: unknown[] = []
    stubApi({
      detail: () => jsonResponse({ success: true, data: detailRecord({ adminNotes: 'First note' }) }),
      patch: (body) => {
        patches.push(body)
        return jsonResponse({
          success: true,
          data: detailRecord({ adminNotes: (body as { adminNotes?: string }).adminNotes ?? null }),
        })
      },
    })
    renderAt(<AdminRequestDetailPage />, `/admin/requests/${id}`)

    const textarea = await screen.findByLabelText('Internal admin notes')
    expect(textarea).toHaveValue('First note')

    await user.clear(textarea)
    await user.type(textarea, 'Called the client')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(patches[0]).toMatchObject({ adminNotes: 'Called the client' }),
    )

    await user.clear(textarea)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(patches[1]).toMatchObject({ adminNotes: null }))
  })

  it('requires an explicit confirmation before deleting', async () => {
    const user = userEvent.setup()
    let deleted = false
    stubApi({
      detail: () => jsonResponse({ success: true, data: detailRecord() }),
      remove: () => {
        deleted = true
        return jsonResponse({ success: true, data: { deleted: true } })
      },
    })
    renderAt(<AdminRequestDetailPage />, `/admin/requests/${id}`)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete request' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Delete request' }))

    // Nothing is deleted until confirmed.
    expect(deleted).toBe(false)
    expect(
      screen.getByText('Delete this request permanently? This cannot be undone.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Yes, delete it' }))
    await waitFor(() => expect(deleted).toBe(true))
  })

  it('cancels a delete without removing the request', async () => {
    const user = userEvent.setup()
    let deleted = false
    stubApi({
      detail: () => jsonResponse({ success: true, data: detailRecord() }),
      remove: () => {
        deleted = true
        return jsonResponse({ success: true, data: { deleted: true } })
      },
    })
    renderAt(<AdminRequestDetailPage />, `/admin/requests/${id}`)

    await user.click(await screen.findByRole('button', { name: 'Delete request' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(deleted).toBe(false)
    expect(screen.getByRole('button', { name: 'Delete request' })).toBeInTheDocument()
  })

  it('never sends client-submitted fields when saving', async () => {
    const user = userEvent.setup()
    const patches: Record<string, unknown>[] = []
    stubApi({
      detail: () => jsonResponse({ success: true, data: detailRecord() }),
      patch: (body) => {
        patches.push(body as Record<string, unknown>)
        return jsonResponse({ success: true, data: detailRecord(body) })
      },
    })
    renderAt(<AdminRequestDetailPage />, `/admin/requests/${id}`)

    await waitFor(() => expect(screen.getByLabelText('Status')).toBeInTheDocument())
    await user.selectOptions(screen.getByLabelText('Status'), 'IN_PROGRESS')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(patches).toHaveLength(1))
    expect(Object.keys(patches[0]).sort()).toEqual(['adminNotes', 'status'])
  })
})
