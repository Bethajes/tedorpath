import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { TutorRequestSuccess } from './TutorRequestSuccess'

/** The confirmation links back into the site, so it needs a router. */
function renderSuccess() {
  render(
    <MemoryRouter>
      <TutorRequestSuccess />
    </MemoryRouter>,
  )
}

/**
 * The confirmation a client sees after sending a request.
 *
 * The Telegram link is the point of these tests. A client who has just answered
 * eleven steps is told we will contact them, and the confirmation is the only
 * place we hand them a way to reach us — so a broken or missing link there is a
 * client with nothing to do but wait.
 */
describe('TutorRequestSuccess', () => {
  it('confirms the request was received', () => {
    renderSuccess()

    expect(screen.getByRole('status')).toHaveTextContent(/request received/i)
    expect(screen.getByText(/contact you shortly/i)).toBeInTheDocument()
  })

  it('offers the team\'s Telegram handle', () => {
    renderSuccess()

    const link = screen.getByRole('link', { name: /message .* on telegram/i })
    expect(link).toHaveAttribute('href', 'https://t.me/Tedor_Team')
  })

  it('opens Telegram in a new tab, safely', () => {
    renderSuccess()

    const link = screen.getByRole('link', { name: /message .* on telegram/i })
    expect(link).toHaveAttribute('target', '_blank')
    // `noopener` is what stops the new tab reaching back into this one.
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('says when the new tab will open, because a screen reader will not', () => {
    renderSuccess()

    const link = screen.getByRole('link', { name: /opens in a new tab/i })
    expect(link).toBeInTheDocument()
  })

  it('explains what to send, so the message is not empty', () => {
    renderSuccess()

    expect(screen.getByText(/message us on Telegram/i)).toBeInTheDocument()
  })
})