import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Footer } from '@/components/layout/Footer'
import { emailLink } from '@/lib/contactConfig'

/**
 * The footer email address.
 *
 * Two things are being protected. The first is correctness of the `mailto:`
 * target — an address that looks right on screen but opens the wrong mailbox is
 * worse than no address at all. The second is that an unconfigured address is
 * not rendered, which follows the same rule as every other contact channel here.
 */

function renderFooter() {
  return render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// emailLink
// ---------------------------------------------------------------------------

describe('emailLink', () => {
  it('builds a mailto from a plain address', () => {
    expect(emailLink('tedorpath1@gmail.com')).toBe('mailto:tedorpath1@gmail.com')
  })

  it('keeps a + in a Gmail address working', () => {
    // `+` is a real character in the local part, not a space — encoding the whole
    // address would break the one address form that uses it.
    expect(emailLink('tedorpath+adverts@gmail.com')).toBe(
      'mailto:tedorpath%2Badverts@gmail.com',
    )
  })

  it('refuses an empty address rather than producing mailto:', () => {
    expect(emailLink('')).toBeNull()
    expect(emailLink('   ')).toBeNull()
  })

  it('refuses an address carrying query parameters', () => {
    // `mailto:` takes a query string, so a configured value with a `?` could
    // inject a pre-filled body an operator never wrote.
    expect(emailLink('someone@example.com?body=hello')).toBeNull()
    expect(emailLink('someone@example.com#fragment')).toBeNull()
  })

  it('refuses something with whitespace in it', () => {
    expect(emailLink('some one@example.com')).toBeNull()
  })

  it('refuses a value with no @ or no domain', () => {
    expect(emailLink('not-an-address')).toBeNull()
    expect(emailLink('someone@')).toBeNull()
    expect(emailLink('someone@localhost')).toBeNull()
  })

  it('refuses a second @', () => {
    expect(emailLink('a@b@example.com')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

describe('Footer — the email in the Support column', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_CONTACT_EMAIL', 'tedorpath1@gmail.com')
  })

  it('shows the address under Contact, spelled out rather than hidden', () => {
    renderFooter()

    const support = screen.getByRole('navigation', { name: 'Support' })
    const link = within(support).getByRole('link', { name: 'tedorpath1@gmail.com' })

    expect(link).toHaveAttribute('href', 'mailto:tedorpath1@gmail.com')
    // It sits after the Contact route, which is where an admin expects to find it.
    expect(support).toHaveTextContent('Contact')
  })

  it('opens the visitor’s mail client rather than the site', () => {
    renderFooter()
    const support = screen.getByRole('navigation', { name: 'Support' })

    // No target=_blank: a mailto should hand off to the mail client, not open a
    // tab pointing at nothing.
    const link = within(support).getByRole('link', { name: 'tedorpath1@gmail.com' })
    expect(link).not.toHaveAttribute('target')
  })

  it('hides the line entirely when no address is configured', () => {
    vi.stubEnv('VITE_CONTACT_EMAIL', '')
    renderFooter()

    const support = screen.getByRole('navigation', { name: 'Support' })
    expect(within(support).queryByRole('link', { name: /@/ })).not.toBeInTheDocument()
    expect(support.querySelector('a[href^="mailto:"]')).toBeNull()
  })

  it('hides the line when the configured value is not a usable address', () => {
    // Refused rather than rendered as a broken link — the same rule as the social
    // placeholders, which are inert instead of pointing somewhere wrong.
    vi.stubEnv('VITE_CONTACT_EMAIL', 'not-an-address')
    renderFooter()

    expect(document.querySelector('a[href^="mailto:"]')).toBeNull()
  })
})