import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TedorLearningGraphic } from './TedorLearningGraphic'

/** Minimal MediaQueryList stand-in; jsdom never matches anything on its own. */
function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (media: string) =>
      ({
        media,
        matches: matches && media.includes('reduce'),
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderGraphic() {
  return render(<TedorLearningGraphic />)
}

describe('TedorLearningGraphic', () => {
  it('describes the learning journey to assistive technology', () => {
    renderGraphic()

    const scene = screen.getByRole('img', { name: /learning journey/i })
    expect(scene).toBeInTheDocument()
    expect(scene.getAttribute('aria-label')).toMatch(/orange upward arrow/i)
  })

  it('brands the card with the logo, the wordmark and a plain-language caption', () => {
    const { container } = renderGraphic()

    expect(container.querySelector('img[src="/brand/tedor-mark.svg"]')).toBeInTheDocument()
    expect(screen.getByText('Tedor')).toBeInTheDocument()
    expect(screen.getByText('Learning that moves forward')).toBeInTheDocument()
  })

  it('labels the three milestones on the path', () => {
    const { container } = renderGraphic()

    expect(container.querySelectorAll('.tj-milestone')).toHaveLength(3)
    expect(container.querySelectorAll('.tj-path')).toHaveLength(1)
  })

  it('responds to the card being hovered', async () => {
    const { container } = renderGraphic()
    const card = container.querySelector<HTMLElement>('.tj-card')
    expect(card?.dataset.energy).toBe('idle')

    await userEvent.hover(card!)
    expect(card?.dataset.energy).toBe('card')

    await userEvent.unhover(card!)
    expect(card?.dataset.energy).toBe('idle')
  })

  it('parks the scene for users who prefer reduced motion', () => {
    stubReducedMotion(true)
    const { container } = renderGraphic()

    expect(container.querySelector<HTMLElement>('.tj-card')?.dataset.static).toBe('true')
    // The finished frame is still complete: path, milestones and arrow all present.
    expect(container.querySelectorAll('.tj-milestone')).toHaveLength(3)
    expect(container.querySelector('.tj-arrow-float')).toBeInTheDocument()
  })
})
