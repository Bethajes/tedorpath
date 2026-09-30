import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { UniversityTrustStrip } from './UniversityTrustStrip'
import { UNIVERSITIES } from '@/data/universities'

/**
 * The data file is deliberately NOT mocked here.
 *
 * Property 5 is a claim about the real `UNIVERSITIES` array, and a mocked
 * array would make the property true by construction. The one test that needs
 * an empty data file re-imports the component against a mocked module instead
 * (see the last describe block), so the rest of the file sees the real entries.
 */

const LIST_TEST_ID = 'university-trust-logos'
const HEADING_NAME = /tutors with backgrounds from/i

function renderStrip() {
  return render(
    <MemoryRouter>
      <UniversityTrustStrip />
    </MemoryRouter>,
  )
}

function logoImages(container: HTMLElement): HTMLImageElement[] {
  return Array.from(container.querySelectorAll<HTMLImageElement>('img'))
}

function logoAlts(container: HTMLElement): string[] {
  return logoImages(container).map((image) => image.getAttribute('alt') ?? '')
}

// ---------------------------------------------------------------------------
// Feature: homepage-redesign, Property 5: University trust strip uses only
// data-file entries
// Validates: Requirements 3.5, 3.7
// ---------------------------------------------------------------------------

describe('UniversityTrustStrip — only data-file universities are shown', () => {
  it('renders exactly one logo image per entry in the data file', () => {
    const { container } = renderStrip()

    expect(UNIVERSITIES.length).toBeGreaterThan(0)
    expect(logoImages(container)).toHaveLength(UNIVERSITIES.length)
  })

  it('gives every logo the name and path from its data-file entry', () => {
    const { container } = renderStrip()

    for (const entry of UNIVERSITIES) {
      const image = container.querySelector<HTMLImageElement>(`img[src="${entry.logo}"]`)
      expect(image, `${entry.logo} should be rendered`).not.toBeNull()
      expect(image?.getAttribute('alt')).toBe(entry.name)
    }
  })

  it('names no university that is not in the data file', () => {
    const { container } = renderStrip()

    // The complete set of university names anywhere in the output has to be the
    // data file's names — no more. A hardcoded logo or a stray caption would
    // make this set larger than `UNIVERSITIES`.
    const expected = UNIVERSITIES.map((entry) => entry.name).sort()
    expect([...logoAlts(container)].sort()).toEqual(expected)

    // The heading is the only other text in the section, so it cannot smuggle in
    // a university name either.
    const heading = screen.getByRole('heading', { name: HEADING_NAME })
    expect(UNIVERSITIES.map((e) => e.name).some((name) => heading.textContent?.includes(name))).toBe(false)
  })

  it('renders each logo inside the trust-strip list', () => {
    renderStrip()

    const list = screen.getByTestId(LIST_TEST_ID)
    expect(within(list).getAllByRole('img')).toHaveLength(UNIVERSITIES.length)
  })
})

// ---------------------------------------------------------------------------
// Heading wording — Requirement 3.2
// ---------------------------------------------------------------------------

describe('UniversityTrustStrip — heading makes no partnership claim', () => {
  it('does not imply an institutional partnership', () => {
    renderStrip()

    const heading = screen.getByRole('heading', { name: HEADING_NAME })
    expect(heading).toBeInTheDocument()
    expect(heading.textContent?.toLowerCase()).not.toMatch(/partner/)
  })

  it('renders no "partner" wording anywhere in the section', () => {
    const { container } = renderStrip()

    const everything = `${container.textContent ?? ''} ${logoAlts(container).join(' ')}`.toLowerCase()
    expect(everything).not.toMatch(/partner/)
  })
})

// ---------------------------------------------------------------------------
// Requirement 3.8 — a missing logo is hidden, not shown broken
// ---------------------------------------------------------------------------

describe('UniversityTrustStrip — broken logos are hidden', () => {
  it('hides a logo whose image fails to load', async () => {
    // A real 404 is simulated with a data file that names a file which does not
    // ship, so this exercises the same onError path a visitor would hit.
    vi.resetModules()
    vi.doMock('@/data/universities', () => ({
      UNIVERSITIES: [
        { name: 'Addis Ababa University', logo: '/universities/aau.svg' },
        { name: 'Missing University', logo: '/universities/does-not-exist.svg' },
      ],
    }))

    const { UniversityTrustStrip: StripWithMissingLogo } = await import('./UniversityTrustStrip')
    const { container } = render(
      <MemoryRouter>
        <StripWithMissingLogo />
      </MemoryRouter>,
    )

    const broken = container.querySelector<HTMLImageElement>('img[src="/universities/does-not-exist.svg"]')
    expect(broken).not.toBeNull()
    expect(logoImages(container)).toHaveLength(2)

    fireEvent.error(broken as HTMLImageElement)

    expect(container.querySelector('img[src="/universities/does-not-exist.svg"]')).toBeNull()
    expect(logoImages(container)).toHaveLength(1)

    // The logo that did load is untouched.
    expect(container.querySelector('img[src="/universities/aau.svg"]')).not.toBeNull()
  })

  it('never leaves a broken image after every logo has failed', () => {
    const { container } = renderStrip()
    const before = logoImages(container)
    expect(before.length).toBeGreaterThan(1)

    for (const image of before) {
      fireEvent.error(image)
    }

    expect(logoImages(container)).toHaveLength(0)
    expect(screen.queryByTestId(LIST_TEST_ID)).toBeNull()
    // The heading survives: the strip has nothing to show, not nothing to say.
    expect(screen.getByRole('heading', { name: HEADING_NAME })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Requirement 3.3 — between 4 and 8 logos on desktop
// ---------------------------------------------------------------------------

describe('UNIVERSITIES data file — desktop logo count', () => {
  it('lists between 4 and 8 universities — Requirement 3.3', () => {
    // The full range is now achievable: there are real logo files for more than
    // three universities. Both bounds are enforced, so dropping an entry or
    // adding a ninth one fails here.
    expect(UNIVERSITIES.length).toBeGreaterThanOrEqual(4)
    expect(UNIVERSITIES.length).toBeLessThanOrEqual(8)
  })

  it('has a unique name and logo for every entry', () => {
    expect(new Set(UNIVERSITIES.map((u) => u.name)).size).toBe(UNIVERSITIES.length)
    expect(new Set(UNIVERSITIES.map((u) => u.logo)).size).toBe(UNIVERSITIES.length)
  })

  it('points every entry at a file under /universities/ with a real image extension', () => {
    for (const entry of UNIVERSITIES) {
      expect(entry.logo.startsWith('/universities/')).toBe(true)
      expect(/\.(svg|png)$/.test(entry.logo)).toBe(true)
    }
  })

  it('names a university on every entry, so a logo is never unlabelled', () => {
    for (const entry of UNIVERSITIES) {
      expect(entry.name.trim()).not.toBe('')
    }
  })
})

// ---------------------------------------------------------------------------
// The logos are shown in colour — a greyscale wall of crests reads as
// decoration, and the marks are the content of this strip.
// ---------------------------------------------------------------------------

describe('UniversityTrustStrip — logos are colourful and visible', () => {
  it('does not grey out or fade any logo', () => {
    const { container } = renderStrip()

    for (const image of logoImages(container)) {
      const className = image.getAttribute('class') ?? ''
      expect(className).not.toMatch(/grayscale/)
      // 70% opacity is "visible" in the letter of the class list but not in
      // practice; full opacity keeps the brand colour honest.
      expect(className).not.toMatch(/\bopacity-\d/)
    }
  })

  it('keeps each logo undistorted inside a fixed-height box', () => {
    const { container } = renderStrip()

    for (const image of logoImages(container)) {
      const className = image.getAttribute('class') ?? ''
      // A fixed height plus object-contain is what stops Cairo's tall portrait
      // crest and the near-square IIT mark from being stretched to the same box.
      expect(className).toMatch(/\bh-\d/)
      expect(className).toMatch(/object-contain/)
    }
  })
})

// ---------------------------------------------------------------------------
// An empty data file must not break the page
// ---------------------------------------------------------------------------

describe('UniversityTrustStrip — empty data file', () => {
  afterEach(() => {
    vi.doUnmock('@/data/universities')
    vi.resetModules()
  })

  it('renders without error when UNIVERSITIES is empty', async () => {
    vi.resetModules()
    vi.doMock('@/data/universities', () => ({ UNIVERSITIES: [] }))

    const { UniversityTrustStrip: EmptyStrip } = await import('./UniversityTrustStrip')
    const { container } = render(
      <MemoryRouter>
        <EmptyStrip />
      </MemoryRouter>,
    )

    expect(container).toBeTruthy()
    expect(logoImages(container)).toHaveLength(0)
    expect(screen.queryByTestId(LIST_TEST_ID)).toBeNull()
    expect(screen.getByRole('heading', { name: HEADING_NAME })).toBeInTheDocument()
  })
})
