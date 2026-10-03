import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { Footer } from '@/components/layout/Footer'

/**
 * Footer social profiles on a deployment with nothing configured.
 *
 * Split into its own file because it has to replace the config module wholesale,
 * and `vi.mock` is hoisted for a whole test file. The shipped configuration is
 * asserted in `socialConfig.test.tsx`; this file is about the other half of the
 * contract — that a deployment which has filled in nothing shows six inert slots
 * rather than six broken links.
 */

const ALL_IDS = ['tiktok', 'facebook', 'instagram', 'telegram', 'linkedin', 'x'] as const

const LABELS: Record<(typeof ALL_IDS)[number], string> = {
  tiktok: 'TikTok',
  facebook: 'Facebook',
  instagram: 'Instagram',
  telegram: 'Telegram',
  linkedin: 'LinkedIn',
  x: 'X',
}

vi.mock('@/lib/socialConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/socialConfig')>()

  return {
    ...actual,
    // Every platform unconfigured.
    socialPlatforms: () => ALL_IDS.map((id) => ({ id, label: LABELS[id], url: null })),
    hasSocialLinks: () => false,
  }
})

function renderFooter() {
  return render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  )
}

describe('Footer — social row with nothing configured', () => {
  it('shows all six slots, so the operator can see what is still to fill in', () => {
    renderFooter()
    const nav = screen.getByRole('navigation', { name: 'Social profiles' })

    expect(nav.querySelectorAll('li')).toHaveLength(6)
    for (const id of ALL_IDS) {
      expect(nav.querySelector(`[data-platform="${id}"]`)).toBeInTheDocument()
    }
  })

  it('renders not one of them as a link', () => {
    // The whole reason an empty slot is a <span> rather than an <a href="#">:
    // a deployment with no profiles must have no social links to 404 on.
    renderFooter()
    const nav = screen.getByRole('navigation', { name: 'Social profiles' })

    expect(within(nav).queryAllByRole('link')).toHaveLength(0)
    expect(nav.querySelectorAll('a')).toHaveLength(0)
  })

  it('explains every empty slot on hover instead of looking broken', () => {
    renderFooter()
    const nav = screen.getByRole('navigation', { name: 'Social profiles' })

    const slots = nav.querySelectorAll('[title]')
    expect(slots).toHaveLength(6)
    for (const slot of slots) {
      expect(slot.getAttribute('title')).toMatch(/no profile URL configured yet/)
    }
  })

  it('does not announce an empty slot to a screen reader', () => {
    // An unconfigured platform is not a destination, so offering it as one would
    // be a dead end for anyone navigating by link.
    renderFooter()
    const nav = screen.getByRole('navigation', { name: 'Social profiles' })

    expect(within(nav).queryAllByRole('link')).toHaveLength(0)
  })

  it('still renders the rest of the footer', () => {
    renderFooter()

    expect(screen.getByRole('navigation', { name: 'Support' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /How It Works/i })).toBeInTheDocument()
    expect(screen.getByText(/All rights reserved/)).toBeInTheDocument()
  })

  it('invents no contact details anywhere in the footer', () => {
    // Requirement 11.6: the footer may only carry what is configured. The
    // contact channels are stubbed blank so this asserts the absence of
    // invention rather than tripping over a real address that happens to be set
    // in the developer's .env.local. The configured case is covered by
    // `contactEmail.test.tsx`.
    vi.stubEnv('VITE_CONTACT_EMAIL', '')
    vi.stubEnv('VITE_CONTACT_TELEGRAM', '')
    vi.stubEnv('VITE_CONTACT_WHATSAPP', '')

    const { container, unmount } = renderFooter()
    const text = container.textContent ?? ''

    // No phone number, and no email of any shape.
    expect(text).not.toMatch(/\+?\d{3}[\s-]?\d{3}[\s-]?\d{4}/)
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/)
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull()

    unmount()
  })
})