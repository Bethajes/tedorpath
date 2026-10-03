import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { TutorApplicationStatusPage } from '@/features/tutorOnboarding/TutorApplicationStatusPage'

/**
 * The applicant-facing application status page.
 *
 * The API is stubbed at the `fetch` boundary. The contact details are the part
 * worth guarding here: they come from build-time configuration, so a page can
 * pass its own tests and still ship with no way for a tutor to reach anyone —
 * which is exactly the case where a tutor is stuck and there is no button.
 *
 * The contact values are read at call time by `contactConfig`, so stubbing the
 * environment before rendering is enough to exercise both the configured and the
 * unconfigured case. (They used to be read once at module load, which made this
 * impossible to test without reloading the module graph — and therefore
 * untestable in practice.)
 *
 * Requirements: 21.1, 21.3, 21.4, 21.6, 21.8, 32.3, 32.4
 */

const USER = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Bethel Berihun',
  email: 'bethel@example.com',
  role: 'CLIENT' as const,
  emailVerified: true,
}

/** The shape `GET /api/tutor-profile/me` answers with. */
function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    userId: USER.id,
    displayName: 'Bethel Berihun',
    headline: 'Chemistry and physics',
    bio: 'Ten years teaching.',
    location: 'Addis Ababa',
    profilePhotoUrl: null,
    teachingMode: 'BOTH',
    studentLevels: ['High School'],
    languages: ['English'],
    availability: null,
    hourlyRate: 77,
    experience: null,
    education: null,
    profileStatus: 'PENDING_REVIEW',
    verificationStatus: 'UNVERIFIED',
    applicationReference: 'TT-2026-000007',
    rejectionReason: null,
    adminMessage: null,
    subjects: [{ id: 's1', name: 'Chemistry', slug: 'chemistry' }],
    createdAt: '2026-09-29T10:00:00.000Z',
    updatedAt: '2026-09-29T11:00:00.000Z',
    ...overrides,
  }
}

let fetchMock: ReturnType<typeof vi.fn>

function stubApi(tutorProfile: unknown) {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost:5173')

    if (url.pathname === '/api/auth/me') {
      return new Response(JSON.stringify({ success: true, data: { user: USER } }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (url.pathname === '/api/tutor-profile/me') {
      return new Response(JSON.stringify({ success: true, data: tutorProfile }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, data: [] }), {
      headers: { 'Content-Type': 'application/json' },
    })
  })
}

/**
 * Renders the page with a specific contact configuration.
 *
 * The env is stubbed and the module graph reset first, so `contactConfig` is
 * re-evaluated against these values rather than against whatever is in the
 * developer's `.env.local`.
 */
function renderPageWith(env: Record<string, string>) {
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value)
  }

  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/tutor/application-status']}>
        <TutorApplicationStatusPage />
      </MemoryRouter>
    </AuthProvider>,
  )
}

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Contact details (Requirements 32.3, 32.4)
// ---------------------------------------------------------------------------

describe('contact details for sending documents', () => {
  it('offers a Telegram link to the configured handle while under review', async () => {
    stubApi(profile())
    renderPageWith({ VITE_CONTACT_TELEGRAM: '@Tedor_Team', VITE_CONTACT_WHATSAPP: '' })

    const link = await screen.findByRole('link', { name: /message on telegram/i })
    expect(link).toHaveAttribute('href', 'https://t.me/Tedor_Team')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('accepts the handle with or without a leading @', async () => {
    stubApi(profile())
    renderPageWith({ VITE_CONTACT_TELEGRAM: 'Tedor_Team', VITE_CONTACT_WHATSAPP: '' })

    expect(await screen.findByRole('link', { name: /message on telegram/i })).toHaveAttribute(
      'href',
      'https://t.me/Tedor_Team',
    )
  })

  it('offers WhatsApp only when a number is configured', async () => {
    stubApi(profile())
    renderPageWith({ VITE_CONTACT_TELEGRAM: '@Tedor_Team', VITE_CONTACT_WHATSAPP: '+44 7700 900123' })

    const whatsapp = await screen.findByRole('link', { name: /message on whatsapp/i })
    expect(whatsapp).toHaveAttribute('href', 'https://wa.me/447700900123')
  })

  it('renders no contact buttons at all when neither channel is set', async () => {
    // A half-configured deployment must show one channel, not a pair of links
    // that go nowhere.
    stubApi(profile())
    renderPageWith({ VITE_CONTACT_TELEGRAM: '', VITE_CONTACT_WHATSAPP: '' })

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('link', { name: /message on telegram/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /message on whatsapp/i })).toBeNull()
  })

  it('still asks for the documents when there is no way to send them', async () => {
    // The checklist must not depend on the buttons existing, or a deployment
    // with no contact configured would tell a tutor to send documents and then
    // give them nowhere to send them.
    stubApi(profile())
    renderPageWith({ VITE_CONTACT_TELEGRAM: '', VITE_CONTACT_WHATSAPP: '' })

    expect(await screen.findByText(/Government-issued identification/i)).toBeInTheDocument()
  })

  it('prints the handle, because that is the address the tutor has to reach', async () => {
    // Regression guard. The handle used to sit in a screen-reader-only span, so a
    // sighted tutor saw "Message on Telegram" and still had no idea which account
    // they were about to open — while sending an identity document, which is the
    // worst possible moment to go hunting through an app for a username.
    stubApi(profile())
    renderPageWith({ VITE_CONTACT_TELEGRAM: '@Tedor_Team', VITE_CONTACT_WHATSAPP: '' })

    const link = await screen.findByRole('link', { name: /message on telegram/i })
    expect(link).toHaveTextContent('@Tedor_Team')
    expect(link.querySelector('.sr-only')).toBeNull()
  })

  it('names the handle in the documents panel itself, not only on the button', async () => {
    // The instruction paragraph is what a tutor reads top to bottom; the address
    // belongs in the sentence, so it cannot be missed by someone who skims past
    // the buttons below the list.
    stubApi(profile())
    renderPageWith({ VITE_CONTACT_TELEGRAM: '@Tedor_Team', VITE_CONTACT_WHATSAPP: '' })

    // Twice on purpose: once in the instruction sentence, once on the button.
    await waitFor(() => {
      expect(screen.getAllByText('@Tedor_Team').length).toBeGreaterThanOrEqual(2)
    })

    const heading = screen.getByRole('heading', { name: /send us your documents/i })
    const intro = heading.parentElement ?? document.body
    expect(intro.textContent).toContain('@Tedor_Team')
  })

  it('omits the handle from the sentence when Telegram is not configured', async () => {
    // Nothing may claim a channel that does not exist.
    stubApi(profile())
    renderPageWith({ VITE_CONTACT_TELEGRAM: '', VITE_CONTACT_WHATSAPP: '+44 7700 900123' })

    await screen.findByRole('heading', { name: /send us your documents/i })
    const panel = screen.getByRole('heading', { name: /send us your documents/i })
      .closest('section') ?? document.body

    expect(panel.textContent).not.toContain('@Tedor_Team')
    expect(panel.textContent).not.toContain('Telegram')
  })
})

// ---------------------------------------------------------------------------
// The under-review state (Requirements 21.3, 21.4, 21.8)
// ---------------------------------------------------------------------------

describe('under review', () => {
  it('shows the application reference and every required document', async () => {
    stubApi(profile())
    renderPageWith({ VITE_CONTACT_TELEGRAM: '@Tedor_Team', VITE_CONTACT_WHATSAPP: '' })

    expect(await screen.findByText('TT-2026-000007')).toBeInTheDocument()

    for (const document of [
      /Government-issued identification/i,
      /Education or academic qualification document/i,
      /Teaching or professional certificate/i,
      /Additional qualifications/i,
    ]) {
      expect(screen.getByText(document)).toBeInTheDocument()
    }
  })

  it('copies the reference to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })

    stubApi(profile())
    renderPageWith({ VITE_CONTACT_TELEGRAM: '@Tedor_Team', VITE_CONTACT_WHATSAPP: '' })

    const copy = await screen.findByRole('button', { name: /^copy$/i })
    await userEvent.click(copy)

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('TT-2026-000007'))
  })

  it('reports a refused clipboard write instead of pretending it worked', async () => {
    // A denied clipboard permission must not look like a successful copy: the
    // tutor would go looking for something they had not actually copied.
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })

    stubApi(profile())
    renderPageWith({ VITE_CONTACT_TELEGRAM: '@Tedor_Team', VITE_CONTACT_WHATSAPP: '' })

    await userEvent.click(await screen.findByRole('button', { name: /^copy$/i }))

    expect(await screen.findByRole('button', { name: /copy failed/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// The other states (Requirements 21.2, 21.6, 21.7)
// ---------------------------------------------------------------------------

describe('other application states', () => {
  it('sends a DRAFT back to the wizard', async () => {
    stubApi(profile({ profileStatus: 'DRAFT', applicationReference: null }))
    renderPageWith({ VITE_CONTACT_TELEGRAM: '@Tedor_Team', VITE_CONTACT_WHATSAPP: '' })

    expect(
      await screen.findByRole('link', { name: /continue your application/i }),
    ).toHaveAttribute('href', '/become-a-tutor')
  })

  it('shows the rejection reason in plain words, with the admin message', async () => {
    stubApi(
      profile({
        profileStatus: 'REJECTED',
        rejectionReason: 'MISSING_DOCUMENT',
        adminMessage: 'Your national ID photo was unreadable.',
      }),
    )
    renderPageWith({ VITE_CONTACT_TELEGRAM: '@Tedor_Team', VITE_CONTACT_WHATSAPP: '' })

    // The category is a code on the wire; the applicant has to read a sentence.
    expect(
      await screen.findByText('A required document was missing'),
    ).toBeInTheDocument()
    expect(screen.getByText('Your national ID photo was unreadable.')).toBeInTheDocument()
    expect(screen.queryByText('MISSING_DOCUMENT')).toBeNull()
    expect(screen.getByRole('link', { name: /update application/i })).toHaveAttribute(
      'href',
      '/become-a-tutor',
    )
  })

  it('shows what is needed when the admin asked for more information', async () => {
    stubApi(
      profile({
        profileStatus: 'NEEDS_INFORMATION',
        adminMessage: 'Please send your teaching certificate.',
      }),
    )
    renderPageWith({ VITE_CONTACT_TELEGRAM: '@Tedor_Team', VITE_CONTACT_WHATSAPP: '' })

    expect(await screen.findByText('Additional information is required')).toBeInTheDocument()
    expect(screen.getByText('Please send your teaching certificate.')).toBeInTheDocument()
  })

  it('links an approved tutor to their live profile', async () => {
    stubApi(profile({ profileStatus: 'APPROVED' }))
    renderPageWith({ VITE_CONTACT_TELEGRAM: '@Tedor_Team', VITE_CONTACT_WHATSAPP: '' })

    const link = await screen.findByRole('link', { name: /view your public profile/i })
    expect(link).toHaveAttribute('href', '/tutors/33333333-3333-4333-8333-333333333333')
  })

  it('says a suspended profile is unavailable and offers contact', async () => {
    stubApi(profile({ profileStatus: 'SUSPENDED' }))
    renderPageWith({ VITE_CONTACT_TELEGRAM: '@Tedor_Team', VITE_CONTACT_WHATSAPP: '' })

    expect(
      await screen.findByText(/not currently available/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /message on telegram/i })).toBeInTheDocument()
  })
})
