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

const LIST_ITEM_ID = '11111111-1111-4111-8111-111111111111'
const TUTOR_ID = 'a52b1a0f-03d2-48dc-8eca-8aa22f00a47c'

/** The tutor a request was aimed at, as the admin API now returns it. */
const requestedTutor = (overrides: Record<string, unknown> = {}) => ({
  id: TUTOR_ID,
  displayName: 'Zebedee Nightingale',
  headline: 'Chemistry and physics',
  profileStatus: 'APPROVED',
  ...overrides,
})

const listItem = (overrides: Record<string, unknown> = {}) => ({
  id: LIST_ITEM_ID,
  fullName: 'Abel Tesfaye',
  subject: 'Mathematics',
  educationLevel: 'University',
  learningMode: 'Online',
  status: 'NEW',
  // Recent enough that the relative time renders as "N days ago" rather than
  // falling back to the absolute date.
  createdAt: '2026-09-29T10:00:00.000Z',
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

/**
 * The stats envelope the dashboard expects.
 *
 * Includes `tutorApplications` because a response without it would silently drop
 * the whole applications panel — and the panel existing is the point.
 */
function defaultStats(overrides: Record<string, unknown> = {}) {
  return {
    total: 3,
    NEW: 1,
    CONTACTED: 1,
    IN_PROGRESS: 1,
    COMPLETED: 0,
    CANCELLED: 0,
    tutorApplications: { total: 2, PENDING_REVIEW: 1, NEEDS_INFORMATION: 0, APPROVED: 1 },
    ...overrides,
  }
}

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
        : jsonResponse({ success: true, data: defaultStats() })
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
      stats: () =>
        jsonResponse({
          success: true,
          data: defaultStats({
            total: 0,
            NEW: 0,
            CONTACTED: 0,
            IN_PROGRESS: 0,
            COMPLETED: 0,
            CANCELLED: 0,
            tutorApplications: { total: 0, PENDING_REVIEW: 0, NEEDS_INFORMATION: 0, APPROVED: 0 },
          }),
        }),
      list: () =>
        jsonResponse({
          success: true,
          data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
        }),
    })
    renderAt(<AdminDashboardPage />, '/admin')

    await waitFor(() => expect(screen.getByText('No learner requests yet')).toBeInTheDocument())
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

  it('lists the latest requests with a status badge', async () => {
    stubApi({})
    renderAt(<AdminDashboardPage />, '/admin')

    await waitFor(() => expect(screen.getByText('Latest requests')).toBeInTheDocument())
    expect(screen.getByText('Abel Tesfaye')).toBeInTheDocument()
    expect(screen.getAllByText('NEW').length).toBeGreaterThan(0)
  })

  it('shows how long ago each request arrived, not just the date', async () => {
    // Two requests dated the same day can be minutes apart, and "is this new?"
    // is the question the queue exists to answer. An absolute date cannot answer it.
    stubApi({})
    renderAt(<AdminDashboardPage />, '/admin')

    const row = (await screen.findByText('Abel Tesfaye')).closest('li')!
    // "yesterday" and "today" are included because `Intl.RelativeTimeFormat`
    // uses `numeric: 'auto'`, which renders ±1 day in words rather than
    // "1 day ago". The fixture above is a fixed date, so this test used to pass
    // only while it was less than 24 hours old and then failed on its own once
    // the clock crossed midnight UTC — the product output was correct the whole
    // time.
    expect(within(row).getByText(/ago|just now|yesterday|today|2026/)).toBeInTheDocument()
  })

  it('tells the admin how many learner requests are waiting for a first reply', async () => {
    // The whole point of the change: "someone sent a request" has to be
    // answerable without reading the whole feed.
    stubApi({})
    renderAt(<AdminDashboardPage />, '/admin')

    const section = (await screen.findByRole('heading', { name: 'Learner requests' })).closest(
      'section',
    )!
    expect(within(section).getByText('1 waiting for a first reply')).toBeInTheDocument()
    expect(
      within(section).getByRole('link', { name: /see all new requests/i }),
    ).toHaveAttribute('href', '/admin/requests?status=NEW')
  })

  it('lists each request once, linking straight to its detail page', async () => {
    // A request appearing in both the attention panel and the feed would put the
    // same row on screen twice; the panel carries counts, the feed carries rows.
    stubApi({})
    renderAt(<AdminDashboardPage />, '/admin')

    const names = await screen.findAllByText('Abel Tesfaye')
    expect(names).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Abel Tesfaye' })).toHaveAttribute(
      'href',
      `/admin/requests/${LIST_ITEM_ID}`,
    )
  })

  it('marks a request nobody has replied to yet', async () => {
    stubApi({})
    renderAt(<AdminDashboardPage />, '/admin')

    const row = (await screen.findByRole('link', { name: 'Abel Tesfaye' })).closest('li')!
    expect(within(row).getByText('NEW')).toBeInTheDocument()
  })

  it('shows both queues, so a waiting tutor application is not invisible', async () => {
    // Regression: the applications panel existed on its own and was easy to miss;
    // it now sits beside the learner requests.
    stubApi({})
    renderAt(<AdminDashboardPage />, '/admin')

    expect(await screen.findByRole('heading', { name: 'Learner requests' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tutor applications' })).toBeInTheDocument()
    expect(screen.getByText('1 waiting for review')).toBeInTheDocument()
  })

  it('links the tutor queue straight to the pending-review slice', async () => {
    stubApi({})
    renderAt(<AdminDashboardPage />, '/admin')

    const link = await screen.findByRole('link', { name: /start reviewing/i })
    expect(link).toHaveAttribute('href', '/admin/tutors?status=PENDING_REVIEW')
  })

  it('says nothing is waiting when both queues are clear', async () => {
    stubApi({
      stats: () =>
        jsonResponse({
          success: true,
          data: defaultStats({
            NEW: 0,
            tutorApplications: { total: 1, PENDING_REVIEW: 0, NEEDS_INFORMATION: 0, APPROVED: 1 },
          }),
        }),
      list: () =>
        jsonResponse({
          success: true,
          data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
        }),
    })
    renderAt(<AdminDashboardPage />, '/admin')

    expect(await screen.findByText('Nothing is waiting for you right now.')).toBeInTheDocument()
  })

  it('flags tutors who are waiting on documents the admin asked for', async () => {
    // NEEDS_INFORMATION means the admin is the blocker, so it belongs on a
    // dashboard that is asking what is waiting.
    stubApi({
      stats: () =>
        jsonResponse({
          success: true,
          data: defaultStats({
            tutorApplications: { total: 3, PENDING_REVIEW: 0, NEEDS_INFORMATION: 2, APPROVED: 1 },
          }),
        }),
    })
    renderAt(<AdminDashboardPage />, '/admin')

    expect(await screen.findByText(/2 tutors are waiting on documents/)).toBeInTheDocument()
  })

  it('links each status count into the matching queue filter', async () => {
    // A number an admin cannot act on is decoration; every card is a shortcut
    // to the rows behind it.
    stubApi({})
    renderAt(<AdminDashboardPage />, '/admin')

    const newCard = (await screen.findByText('New')).closest('a')!
    expect(newCard).toHaveAttribute('href', '/admin/requests?status=NEW')

    const completedCard = screen.getByText('Completed').closest('a')!
    expect(completedCard).toHaveAttribute('href', '/admin/requests?status=COMPLETED')
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

// ---------------------------------------------------------------------------
// The tutor a client chose (Requirement 13.1)
// ---------------------------------------------------------------------------

describe('the tutor a client chose (Requirement 13.1)', () => {
  /** A list page with one routed request and one cold request. */
  function stubMixedList() {
    return {
      list: () =>
        jsonResponse({
          success: true,
          data: {
            items: [
              listItem({ tutorProfileId: TUTOR_ID, tutor: requestedTutor() }),
              listItem({
                id: '22222222-2222-4222-8222-222222222222',
                fullName: 'Cold Request',
                subject: 'Art',
                tutorProfileId: null,
                tutor: null,
              }),
            ],
            pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
          },
        }),
    }
  }

  /**
   * Scoped to the table, because the queue renders a desktop table and a mobile
   * card list and only CSS separates them. Both carry the same links, which is
   * what keeps nothing hidden on a small screen.
   */
  async function desktopTable() {
    const view = renderAt(<AdminRequestsPage />, '/admin/requests')

    // Both presentations render the same rows, so wait for the data to land
    // before reaching for the table — the query is synchronous and the list is
    // still loading on the first pass.
    await screen.findAllByText('Cold Request')

    const table = view.container.querySelector('table')
    if (!table) throw new Error('the queue rendered no table')
    return table
  }

  it('names the chosen tutor in the request list, linked to their profile', async () => {
    stubApi(stubMixedList())

    const table = await desktopTable()
    const link = within(table).getByRole('link', { name: 'Zebedee Nightingale' })
    // An admin needs to go from "who asked for this" to "who is this" in one click.
    expect(link).toHaveAttribute('href', `/admin/tutors/${TUTOR_ID}`)
  })

  it('shows a dash rather than a blank for a request with no tutor', async () => {
    // A column of nothing is indistinguishable from a column that failed to
    // load; a dash is visibly "not chosen".
    stubApi(stubMixedList())

    const table = await desktopTable()
    const coldRow = within(table).getByText('Cold Request').closest('tr')!
    expect(within(coldRow).getByText('—')).toBeInTheDocument()
    expect(within(coldRow).queryByRole('link', { name: /Nightingale/ })).toBeNull()
  })

  it('leads the detail page with the chosen tutor', async () => {
    stubApi({
      detail: () =>
        jsonResponse({ success: true, data: detailRecord({ tutorProfileId: TUTOR_ID, tutor: requestedTutor() }) }),
    })
    renderAt(<AdminRequestDetailPage />, `/admin/requests/${LIST_ITEM_ID}`)

    expect(
      await screen.findByText('Requested tutor: Zebedee Nightingale'),
    ).toBeInTheDocument()
    expect(screen.getByText('Chemistry and physics')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open their profile/i })).toHaveAttribute(
      'href',
      `/admin/tutors/${TUTOR_ID}`,
    )
  })

  it('says a request with no tutor needs matching instead of naming one', async () => {
    // The two cases have to be visibly different: a routed request is already
    // decided, a cold one is work.
    stubApi({
      detail: () =>
        jsonResponse({ success: true, data: detailRecord({ tutorProfileId: null, tutor: null }) }),
    })
    renderAt(<AdminRequestDetailPage />, `/admin/requests/${LIST_ITEM_ID}`)

    expect(await screen.findByText('No tutor chosen')).toBeInTheDocument()
    expect(screen.getByText(/needs matching against the tutor directory/i)).toBeInTheDocument()
    expect(screen.queryByText(/requested tutor:/i)).toBeNull()
  })

  it('shows the tutor on the dashboard row, without opening the request', async () => {
    stubApi({ list: stubMixedList().list })
    renderAt(<AdminDashboardPage />, '/admin')

    // The dashboard is where an admin decides whether to open anything at all,
    // so the routing fact has to be visible there.
    const link = await screen.findByRole('link', { name: 'Zebedee Nightingale' })
    expect(link).toHaveAttribute('href', `/admin/tutors/${TUTOR_ID}`)
  })

  it('mentions the tutor in the profile status, so a stale request is explainable', async () => {
    stubApi({
      detail: () =>
        jsonResponse({
          success: true,
          data: detailRecord({
            tutorProfileId: TUTOR_ID,
            tutor: requestedTutor({ profileStatus: 'SUSPENDED' }),
          }),
        }),
    })
    renderAt(<AdminRequestDetailPage />, `/admin/requests/${LIST_ITEM_ID}`)

    expect(await screen.findByText('Status: suspended')).toBeInTheDocument()
  })
})
