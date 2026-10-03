import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Navbar } from '@/components/layout/Navbar'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { resetAuthState } from '@/features/auth/authStore'

/**
 * The header's primary action.
 *
 * "Find a Tutor" used to appear twice in the bar: once in the nav list and again
 * as an accent-coloured button beside it, both pointing at /tutors. Two identical
 * destinations in one bar read as a mistake.
 *
 * What replaced it is the thing that actually mattered — the orange. Removing
 * the button would have quietly demoted the primary action from the site's main
 * orange to a grey link indistinguishable from "About", so the accent now belongs
 * to the nav item itself. These tests hold both halves of that decision in place:
 * exactly one link, and it is still orange.
 */

/**
 * The bar renders a sign-in link only once the session is known to be anonymous,
 * so the auth provider has to be present — and `/me` stubbed, or the header
 * flickers between states while the request is in flight.
 */
function renderAt(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Navbar />
      </MemoryRouter>
    </AuthProvider>,
  )
}

beforeEach(() => {
  resetAuthState()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: { user: null } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** The desktop nav. The mobile panel is only rendered when it is open. */
function mainNav() {
  return screen.getByRole('navigation', { name: 'Main' })
}

describe('Navbar — Find a Tutor', () => {
  it('appears exactly once in the bar, not as a link and a duplicate button', () => {
    renderAt('/')

    // `getAllByRole` rather than `getByRole`: the point is the count, and a
    // duplicate is precisely what `getByRole` would throw on.
    expect(within(mainNav()).getAllByRole('link', { name: 'Find a Tutor' })).toHaveLength(1)
  })

  it('still points at the tutor directory', () => {
    renderAt('/')

    expect(within(mainNav()).getByRole('link', { name: 'Find a Tutor' })).toHaveAttribute(
      'href',
      '/tutors',
    )
  })

  it('keeps the orange accent rather than being demoted to a grey link', () => {
    const { container } = renderAt('/')

    const link = within(mainNav()).getByRole('link', { name: 'Find a Tutor' })
    expect(link.className).toMatch(/accent-500/)

    // The other items stay neutral, so the accent still means "primary".
    const about = within(mainNav()).getByRole('link', { name: 'About' })
    expect(about.className).not.toMatch(/accent-/)
    expect(container.textContent).toContain('Find a Tutor')
  })

  it('stays orange on the directory page, and says it is the current page', () => {
    renderAt('/tutors')

    const link = within(mainNav()).getByRole('link', { name: 'Find a Tutor' })

    // Not switched to the neutral grey the other items use: an accent link that
    // lost its accent the moment you followed it reads as a different control.
    expect(link.className).toMatch(/accent-600/)
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('gives every other item the neutral treatment when active', () => {
    renderAt('/about')

    const about = within(mainNav()).getByRole('link', { name: 'About' })
    expect(about).toHaveAttribute('aria-current', 'page')
    expect(about.className).toMatch(/ink-800/)
    expect(about.className).not.toMatch(/accent-/)
  })

  it('keeps the full nav list intact', () => {
    renderAt('/')

    for (const label of ['Find a Tutor', 'How It Works', 'Become a Tutor', 'About']) {
      expect(within(mainNav()).getByRole('link', { name: label })).toBeInTheDocument()
    }
  })
})