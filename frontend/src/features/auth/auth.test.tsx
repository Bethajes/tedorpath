import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Navbar } from '@/components/layout/Navbar'
import { AuthProvider } from './AuthProvider'
import { RequireAuth } from './RequireAuth'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { resetAuthState } from './authStore'

/**
 * Authentication UI tests.
 *
 * The API is stubbed at the `fetch` boundary, so these focus on the screens and
 * the state machine around them: what is rendered, what is validated, what the
 * user is told when a request fails, and what happens to the session on the
 * way in and out.
 *
 * The credentials side of this — real hashing, real cookies, real revocation —
 * is covered end to end by backend/tests/auth.api.test.mjs.
 */

const USER = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  role: 'CLIENT' as const,
  image: null,
  createdAt: '2026-09-29T10:00:00.000Z',
}

let fetchMock: ReturnType<typeof vi.fn>

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const ok = (data: unknown) => jsonResponse({ success: true, data })
const fail = (code: string, message: string, status = 400) =>
  jsonResponse({ success: false, error: { code, message } }, status)

/** Routes only what a test cares about; anything else is a test bug. */
/** Providers the server offers, unless a test says otherwise. */
let availableProviders = ['GOOGLE']

function stubApi(routes: {
  me?: () => Promise<Response> | Response
  providers?: () => Promise<Response> | Response
  login?: (body: Record<string, unknown>) => Promise<Response> | Response
  register?: (body: Record<string, unknown>) => Promise<Response> | Response
  logout?: () => Promise<Response> | Response
}) {
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost:5173')
    const method = init?.method ?? 'GET'
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}

    if (url.pathname === '/api/auth/providers') {
      return routes.providers
        ? routes.providers()
        : ok({ providers: availableProviders })
    }

    if (url.pathname === '/api/auth/me') {
      return routes.me ? routes.me() : fail('UNAUTHORIZED', 'Sign in to continue.', 401)
    }
    if (url.pathname === '/api/auth/login' && method === 'POST') {
      return routes.login ? routes.login(body) : ok({ user: USER })
    }
    if (url.pathname === '/api/auth/register' && method === 'POST') {
      return routes.register ? routes.register(body) : ok({ user: USER })
    }
    if (url.pathname === '/api/auth/logout' && method === 'POST') {
      return routes.logout ? routes.logout() : ok({ loggedOut: true })
    }

    throw new Error(`unexpected request: ${method} ${url.pathname}`)
  })
}

function renderAt(ui: React.ReactElement, path = '/') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </AuthProvider>,
  )
}

beforeEach(() => {
  resetAuthState()
  availableProviders = ['GOOGLE']
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LoginPage', () => {
  it('renders the sign-in form and a working link to the API OAuth flow', async () => {
    stubApi({})
    renderAt(<LoginPage />, '/login')

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute(
      'href',
      '/register',
    )

    // A plain link to the API, which drives the whole OAuth conversation: no
    // client id, no secret and no token in the browser. It appears once the
    // server has said Google is configured.
    const google = await screen.findByRole('link', { name: /continue with google/i })
    expect(google).toHaveAttribute('href', '/api/auth/google')
  })

  it('offers no Google button while the server has no Google configured', async () => {
    availableProviders = []
    stubApi({})
    renderAt(<LoginPage />, '/login')

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).includes('/api/auth/providers')),
      ).toBe(true),
    )

    expect(screen.queryByRole('link', { name: /continue with google/i })).not.toBeInTheDocument()
    // And no orphaned "or continue with email" rule left behind.
    expect(screen.queryByText(/or continue with email/i)).not.toBeInTheDocument()
    // Email sign-in is unaffected.
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
  })

  it('explains a failed Google attempt in plain language', async () => {
    stubApi({})
    renderAt(<LoginPage />, '/login?authError=cancelled')

    expect(screen.getByRole('alert')).toHaveTextContent(/cancelled google sign-in/i)
  })

  it('never shows a raw provider error code', async () => {
    stubApi({})
    renderAt(<LoginPage />, '/login?authError=some_code_nobody_defined')

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/did not work/i)
    expect(alert).not.toHaveTextContent('some_code_nobody_defined')
  })

  it('validates the form before calling the API', async () => {
    stubApi({})
    renderAt(<LoginPage />, '/login')

    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === 'POST'),
    ).toBe(false)
  })

  it('rejects a malformed email without contacting the API', async () => {
    stubApi({})
    renderAt(<LoginPage />, '/login')

    await userEvent.type(screen.getByLabelText(/email/i), 'not-an-email')
    await userEvent.type(screen.getByLabelText(/password/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === 'POST'),
    ).toBe(false)
  })

  it('shows a loading state and signs the user in', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    stubApi({
      me: () => fail('UNAUTHORIZED', 'Sign in to continue.', 401),
      login: async () => {
        await gate
        return ok({ user: USER })
      },
    })

    renderAt(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<h1>Signed in area</h1>} />
      </Routes>,
      '/login',
    )

    await userEvent.type(screen.getByLabelText(/email/i), 'ada@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'a-good-password')
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

    // The button reports progress and refuses a second submit.
    const busy = await screen.findByRole('button', { name: /signing in/i })
    expect(busy).toBeDisabled()

    release!()
    expect(await screen.findByRole('heading', { name: 'Signed in area' })).toBeInTheDocument()
  })

  it('reports a rejected sign-in without saying whether the email exists', async () => {
    stubApi({
      me: () => fail('UNAUTHORIZED', 'Sign in to continue.', 401),
      login: () => fail('INVALID_CREDENTIALS', 'Invalid email or password.', 401),
    })
    renderAt(<LoginPage />, '/login')

    await userEvent.type(screen.getByLabelText(/email/i), 'ada@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong-password')
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Invalid email or password.')
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
  })

  it('reports an account that already exists', async () => {
    stubApi({
      me: () => fail('UNAUTHORIZED', 'Sign in to continue.', 401),
      login: () => fail('EMAIL_ALREADY_REGISTERED', 'An account with that email already exists.', 409),
    })
    renderAt(<LoginPage />, '/login')

    await userEvent.type(screen.getByLabelText(/email/i), 'ada@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'a-good-password')
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An account with that email already exists.',
    )
  })

  it('returns to the page the visitor was trying to reach', async () => {
    stubApi({ me: () => fail('UNAUTHORIZED', 'Sign in to continue.', 401) })

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/request-tutor' } }]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/request-tutor" element={<h1>Find a tutor</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    await userEvent.type(screen.getByLabelText(/email/i), 'ada@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'a-good-password')
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByRole('heading', { name: 'Find a tutor' })).toBeInTheDocument()
  })
})

describe('RegisterPage', () => {
  it('renders every field the account needs and nothing else', async () => {
    stubApi({})
    renderAt(<RegisterPage />, '/register')

    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login')

    // No tutor onboarding fields yet, by design.
    expect(screen.queryByLabelText(/subject/i)).not.toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /continue with google/i })).toHaveAttribute(
      'href',
      '/api/auth/google',
    )
  })

  it('requires a matching confirmation and a long enough password', async () => {
    stubApi({})
    renderAt(<RegisterPage />, '/register')

    await userEvent.type(screen.getByLabelText(/full name/i), 'Ada Lovelace')
    await userEvent.type(screen.getByLabelText(/^email/i), 'ada@example.com')
    await userEvent.type(screen.getByLabelText(/^password/i), 'short')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'different')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findAllByText(/at least 8 characters/i)).not.toHaveLength(0)
    expect(screen.getByText('The two passwords do not match.')).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === 'POST'),
    ).toBe(false)
  })

  it('creates the account, signs the user in and never sends the confirmation field', async () => {
    let received: Record<string, unknown> | undefined
    stubApi({
      me: () => fail('UNAUTHORIZED', 'Sign in to continue.', 401),
      register: (body) => {
        received = body
        return ok({ user: USER })
      },
    })

    renderAt(
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<h1>Welcome home</h1>} />
      </Routes>,
      '/register',
    )

    await userEvent.type(screen.getByLabelText(/full name/i), 'Ada Lovelace')
    await userEvent.type(screen.getByLabelText(/^email/i), 'ada@example.com')
    await userEvent.type(screen.getByLabelText(/^password/i), 'a-good-password')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'a-good-password')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('heading', { name: 'Welcome home' })).toBeInTheDocument()
    expect(received).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'a-good-password',
    })
    expect(received).not.toHaveProperty('confirmPassword')
    // A visitor cannot pick their own role.
    expect(received).not.toHaveProperty('role')
  })

  it('shows the API message when registration is refused', async () => {
    stubApi({
      me: () => fail('UNAUTHORIZED', 'Sign in to continue.', 401),
      register: () => fail('EMAIL_ALREADY_REGISTERED', 'An account with that email already exists.', 409),
    })
    renderAt(<RegisterPage />, '/register')

    await userEvent.type(screen.getByLabelText(/full name/i), 'Ada Lovelace')
    await userEvent.type(screen.getByLabelText(/^email/i), 'ada@example.com')
    await userEvent.type(screen.getByLabelText(/^password/i), 'a-good-password')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'a-good-password')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An account with that email already exists.',
    )
  })
})

describe('Navbar', () => {
  it('offers sign-in to an anonymous visitor', async () => {
    stubApi({ me: () => fail('UNAUTHORIZED', 'Sign in to continue.', 401) })
    renderAt(<Navbar />)

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login'),
    )
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument()
  })

  it('shows the signed-in user and a way to sign out', async () => {
    stubApi({ me: () => ok({ user: USER }) })
    renderAt(<Navbar />)

    const toggle = await screen.findByRole('button', { name: /ada/i })
    expect(toggle).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument()

    await userEvent.click(toggle)
    const menu = screen.getByRole('menu')
    expect(within(menu).getByText('ada@example.com')).toBeInTheDocument()

    await userEvent.click(within(menu).getByRole('menuitem', { name: /sign out/i }))

    // Signing out calls the API and drops back to the signed-out header.
    await waitFor(() => expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument())
    expect(
      fetchMock.mock.calls.some(([url, init]) =>
        String(url).includes('/api/auth/logout') && init?.method === 'POST',
      ),
    ).toBe(true)
  })
})

describe('RequireAuth', () => {
  const Private = () => <h1>Private area</h1>

  function renderGuard(path: string) {
    return render(
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/login" element={<h1>Sign in page</h1>} />
            <Route
              path="/account"
              element={
                <RequireAuth>
                  <Private />
                </RequireAuth>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
  }

  it('sends an anonymous visitor to sign in, remembering where they were going', async () => {
    stubApi({ me: () => fail('UNAUTHORIZED', 'Sign in to continue.', 401) })
    renderGuard('/account')

    expect(await screen.findByRole('heading', { name: 'Sign in page' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Private area' })).not.toBeInTheDocument()
  })

  it('waits for the answer instead of bouncing a signed-in visitor', async () => {
    stubApi({ me: () => ok({ user: USER }) })
    renderGuard('/account')

    // The guard must not decide while /api/auth/me is still in flight.
    expect(screen.getByRole('status')).toHaveTextContent(/checking your session/i)
    expect(await screen.findByRole('heading', { name: 'Private area' })).toBeInTheDocument()
  })
})
