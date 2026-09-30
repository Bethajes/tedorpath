import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Hero } from './Hero'
import { HeroVisual } from './HeroVisual'
import { HERO_PHOTOS, heroPhotoSrc } from './heroPhotos'
import { MemoryRouter } from 'react-router-dom'

/**
 * The hero's right-hand composition.
 *
 * These are the guarantees the redesign must not be able to break by accident:
 * the learning-path graphic survives inside it, every frame is a real image
 * with real alt text and a fixed ratio, the labels are inert text rather than
 * controls, and nothing in the visual asserts a fact that cannot be checked.
 */

function stubMatchMedia() {
  vi.stubGlobal(
    'matchMedia',
    (media: string) =>
      ({
        media,
        matches: false,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  stubMatchMedia()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderVisual() {
  return render(
    <MemoryRouter>
      <HeroVisual />
    </MemoryRouter>,
  )
}

describe('HeroVisual — the composition', () => {
  it('keeps the Tedor learning-path graphic as the anchor of the composition', () => {
    renderVisual()
    // The graphic and its long description are untouched; the composition is
    // built around it rather than replacing it.
    expect(screen.getByRole('img', { name: /learning journey/i })).toBeInTheDocument()
  })

  it('renders every photo slot as a figure with a described image', () => {
    renderVisual()

    const figures = screen.getAllByRole('figure')
    expect(figures).toHaveLength(HERO_PHOTOS.length)

    for (const photo of HERO_PHOTOS) {
      const image = screen.getByAltText(photo.alt)
      expect(image.tagName).toBe('IMG')
      // Width and height are what let the frame reserve its space before the
      // image resolves, so a slow or absent photograph cannot reflow the hero.
      expect(image).toHaveAttribute('width')
      expect(image).toHaveAttribute('height')
    }
  })

  it('only loads the first frame eagerly and lazy-loads the rest', () => {
    renderVisual()

    const eager = screen.getAllByRole('img').filter((img) => img.getAttribute('loading') === 'eager')
    expect(eager).toHaveLength(1)
  })

  it('labels each frame with a plain caption rather than a control', () => {
    renderVisual()

    for (const photo of HERO_PHOTOS) {
      expect(screen.getByText(photo.label)).toBeInTheDocument()
    }

    // A label that looked like a control but did nothing would be a broken
    // promise; these must stay inert text.
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('hides the decorative geometry from assistive technology', () => {
    const { container } = renderVisual()

    const accents = container.querySelector('.hv-accents')
    expect(accents).not.toBeNull()
    expect(accents).toHaveAttribute('aria-hidden', 'true')

    // Decorative shapes carry no text of their own, so a screen reader reads
    // nothing where they sit.
    expect(accents?.textContent).toBe('')
  })

  it('adds no heading and no list to the hero', () => {
    const { container } = renderVisual()

    // The hero owns the page's only h1 and one h2 in the search card, and the
    // homepage tests resolve both of those by role. A heading or a list inside
    // the visual would break heading hierarchy and the trust-point list.
    expect(container.querySelectorAll('h1, h2, h3, ul, ol')).toHaveLength(0)
  })
})

describe('HeroVisual — no fabricated claims', () => {
  it('uses no numbers, names, ratings or credentials in its own copy', () => {
    const { container } = renderVisual()

    // Only the labels this composition adds. The learning-path graphic carries
    // numbered milestones, which are its own thing and are asserted separately.
    const own = [
      ...HERO_PHOTOS.map((photo) => photo.label),
      ...Array.from(container.querySelectorAll('.hv-badge')).map((badge) => badge.textContent ?? ''),
    ]

    expect(own.length).toBeGreaterThanOrEqual(3)
    for (const text of own) {
      // Subjects, teaching modes and the journey's own vocabulary are the only
      // words allowed here. Anything quantified would be a claim.
      expect(text).not.toMatch(/\d/)
      for (const forbidden of [/tutor of/i, /rated/i, /\bstars?\b/i, /university of/i, /graduated/i]) {
        expect(text, `hero visual is claiming ${forbidden}`).not.toMatch(forbidden)
      }
    }
  })
})

describe('hero photo slots', () => {
  it('points every slot at a photograph served from this origin', () => {
    for (const photo of HERO_PHOTOS) {
      expect(photo.src, `${photo.id} has no photograph`).toBeTruthy()
      // A local file under public/. Nothing in the hero may reach another host,
      // and a remote URL here would also be a photo nobody controls.
      expect(photo.src?.startsWith('/')).toBe(true)
      expect(heroPhotoSrc(photo)).toBe(photo.src)
    }
  })

  it('keeps the branded scene as the fallback for a slot with no photograph', () => {
    // The path a future slot takes before its photograph exists: render a
    // complete frame rather than an empty one, then swap by setting `src`.
    const withoutPhoto = { ...HERO_PHOTOS[0], src: undefined }
    const src = heroPhotoSrc(withoutPhoto)
    expect(src.startsWith('data:image/svg+xml,')).toBe(true)
  })

  it('describes each photograph instead of calling it a placeholder', () => {
    for (const photo of HERO_PHOTOS) {
      expect(photo.alt).not.toMatch(/placeholder/i)
      expect(photo.alt.length).toBeGreaterThan(20)
    }
  })

  it('crops every photograph deliberately rather than by default', () => {
    // Landscape photographs in portrait and square frames lose most of
    // themselves to `object-fit: cover`. Any slot relying on the centre of the
    // frame as its default is a slot nobody has actually looked at.
    for (const photo of HERO_PHOTOS) {
      if (photo.src) expect(photo.objectPosition).toBeTruthy()
    }
  })
})

describe('Hero — the right-hand column', () => {
  it('still renders the search card and the learning graphic side by side', () => {
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /what do you want to learn/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /find a tutor/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /become a tutor/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /learning journey/i })).toBeInTheDocument()
  })
})
