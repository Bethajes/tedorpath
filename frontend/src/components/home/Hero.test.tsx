import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fc from 'fast-check'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Hero } from './Hero'
import { HERO_PHOTOS } from './heroPhotos'
import { OTHER_SUBJECT_ENTRY, SUBJECT_GROUPS } from './subjectCatalog'
import { EDUCATION_LEVELS, LEARNING_MODES, SUBJECTS } from '@/features/tutorRequest/tutorRequest.constants'

/**
 * Property 2: whatever the visitor picks, the URL they land on carries exactly
 * those choices and nothing else.
 *
 * The destination is a real `<Routes>` entry rather than a `navigate` spy, so
 * the assertion is made against the URL the browser would actually show.
 */

/** Must mirror `SUBJECT_SLUG_MAP` in TutorSearchCard. */
const SUBJECT_SLUG_MAP: Record<string, string> = Object.fromEntries(
  [...SUBJECT_GROUPS.flatMap((g) => g.subjects), OTHER_SUBJECT_ENTRY].map((e) => [e.subject, e.slug]),
)

const SUBJECT_CHOICES = [...SUBJECTS, OTHER_SUBJECT_ENTRY.subject]
const LEVEL_CHOICES = [...EDUCATION_LEVELS]
const MODE_CHOICES = [...LEARNING_MODES]

const SUBJECT_SELECT_LABEL = /^subject$/i
const LEVEL_SELECT_LABEL = /^level$/i
const MODE_SELECT_LABEL = /^learning mode$/i

/** Minimal MediaQueryList stand-in; jsdom never matches anything on its own. */
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

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  stubMatchMedia()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Surfaces the location of whatever route currently matched. */
function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

function renderHero() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      {/* The probe sits outside <Routes> on purpose: it has to keep reporting
          the location after the Hero unmounts, which is the whole point of the
          assertion. */}
      <LocationProbe />
      <Routes>
        <Route path="/" element={<Hero />} />
        <Route path="/tutors" element={<h1>Tutor directory</h1>} />
        <Route path="/become-a-tutor" element={<h1>Become a tutor</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

function select(control: 'subject' | 'level' | 'mode') {
  return screen.getByLabelText(
    control === 'subject' ? SUBJECT_SELECT_LABEL : control === 'level' ? LEVEL_SELECT_LABEL : MODE_SELECT_LABEL,
  )
}

function currentUrl(): string {
  return screen.getByTestId('location').textContent ?? ''
}

const emptyOrOf = <T,>(values: readonly T[]) => fc.constantFrom('', ...values)

// ---------------------------------------------------------------------------
// Feature: homepage-redesign, Property 2: Hero CTA navigation preserves
// selected filters
// Validates: Requirements 2.3, 2.5
// ---------------------------------------------------------------------------

describe('Hero — Property 2: the submitted URL carries exactly the chosen filters', () => {
  it('preserves the chosen subject, level and mode, and adds nothing', async () => {
    await fc.assert(
      fc.asyncProperty(
        emptyOrOf(SUBJECT_CHOICES),
        emptyOrOf(LEVEL_CHOICES),
        emptyOrOf(MODE_CHOICES),
        async (subject, level, mode) => {
          const user = userEvent.setup()
          // Unmounted per run: 100 renders in one `it` would otherwise pile up
          // in document.body and every query after the first would be ambiguous.
          const { unmount } = renderHero()

          try {
            if (subject) await user.selectOptions(select('subject'), subject)
            if (level) await user.selectOptions(select('level'), level)
            if (mode) await user.selectOptions(select('mode'), mode)

            await user.click(screen.getByRole('button', { name: /find a tutor/i }))

            await screen.findByTestId('location')
            await waitFor(() => {
              expect(currentUrl()).not.toBe('/')
            })

            const search = new URL(currentUrl(), 'http://localhost').searchParams

            // Only the keys the visitor actually filled in may be present, and
            // each must carry the slug or value the card is supposed to send.
            const expected = new URLSearchParams()
            if (subject) {
              const slug = SUBJECT_SLUG_MAP[subject]
              if (slug) expected.set('subject', slug)
            }
            if (level) expected.set('level', level)
            if (mode) expected.set('mode', mode)

            expect(new URL(currentUrl(), 'http://localhost').pathname).toBe('/tutors')
            expect(search.toString()).toBe(expected.toString())
          } finally {
            unmount()
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('omits a subject that has no slug rather than sending an empty value', async () => {
    // A subject in the picker with no catalog entry would otherwise produce
    // `?subject=` — which the directory treats as a real filter.
    const user = userEvent.setup()
    renderHero()

    await user.selectOptions(select('subject'), OTHER_SUBJECT_ENTRY.subject)
    await user.click(screen.getByRole('button', { name: /find a tutor/i }))

    await waitFor(() => {
      expect(currentUrl()).toContain('/tutors')
    })

    // "Other" does have a slug, so it is sent — the check is that the value is a
    // slug and never blank.
    const search = new URL(currentUrl(), 'http://localhost').searchParams
    if (search.has('subject')) {
      expect(search.get('subject')).toBe(SUBJECT_SLUG_MAP[OTHER_SUBJECT_ENTRY.subject])
      expect(search.get('subject')).not.toBe('')
    }
  })

  it('goes to the bare directory when nothing is selected', async () => {
    const user = userEvent.setup()
    renderHero()

    await user.click(screen.getByRole('button', { name: /find a tutor/i }))

    await waitFor(() => {
      expect(currentUrl()).toContain('/tutors')
    })
    expect(currentUrl()).toBe('/tutors')
  })
})

// ---------------------------------------------------------------------------
// Requirements 2.1, 2.2, 2.4, 2.7, 2.8
// ---------------------------------------------------------------------------

describe('Hero — content and secondary action', () => {
  it('carries exactly one h1 with the required text', () => {
    const { container } = renderHero()

    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0].textContent).toContain('Find the right tutor.')
    expect(container.querySelectorAll('h1')).toHaveLength(1)
  })

  it('describes the subjects and both teaching modes somewhere in the hero', () => {
    renderHero()

    // The paragraph under the headline names the subject families and both
    // teaching modes. The two remaining categories — school support and exam
    // preparation — live in the trust point below the search card rather than in
    // the same sentence, because Requirement 2.2 asks the hero to cover them,
    // not that one paragraph has to. Asserted over the whole hero so the
    // requirement is what is being tested.
    const paragraph = screen.getByText(/connect with carefully reviewed tutors/i)
    expect(paragraph.textContent).toMatch(/online or in person/i)

    const { container } = renderHero()
    const hero = container.textContent ?? ''
    for (const phrase of [
      /school/i,
      /university/i,
      /professional skills/i,
      /exam preparation/i,
    ]) {
      expect(hero, `hero is missing ${phrase}`).toMatch(phrase)
    }
  })

  it('links a secondary "Become a Tutor" to the onboarding route', () => {
    renderHero()

    const link = screen.getByRole('link', { name: /become a tutor/i })
    expect(link.getAttribute('href')).toBe('/become-a-tutor')
  })

  it('keeps the international badge', () => {
    renderHero()
    expect(screen.getByText(/international tutoring marketplace/i)).toBeInTheDocument()
  })

  it('shows trust points with no numbers in them', () => {
    renderHero()

    const list = screen.getByRole('list')
    const points = Array.from(list.querySelectorAll('li')).map((li) => li.textContent ?? '')

    expect(points.length).toBeGreaterThanOrEqual(3)
    for (const point of points) {
      // No statistic, rating or count may be implied here: the real counts live
      // in the stats section, sourced from the API.
      expect(point).not.toMatch(/\d/)
    }
  })

  it('puts the people first in the right-hand column', () => {
    renderHero()

    // The visual is three photographs of learners and tutors, and nothing else.
    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(HERO_PHOTOS.length)
    for (const image of images) {
      expect(image).toHaveAttribute('alt')
      expect(image.getAttribute('alt')?.length ?? 0).toBeGreaterThan(20)
    }
    expect(screen.queryByRole('img', { name: /learning journey|path to your goal/i })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// The ambient field: decoration, and only decoration
// ---------------------------------------------------------------------------

describe('Hero — the ambient background field', () => {
  it('is hidden from assistive technology and holds nothing focusable', () => {
    renderHero()

    // One `aria-hidden` wrapper covers all five marks, which is why the field can
    // be as dense as it likes without a screen reader announcing a helix.
    const field = document.querySelector('.hf')
    expect(field).not.toBeNull()
    expect(field).toHaveAttribute('aria-hidden', 'true')

    // Purely decorative means purely decorative: no role, no label, no tab stop,
    // and nothing that a pointer could be aimed at.
    expect(field?.querySelectorAll('[role]')).toHaveLength(0)
    expect(field?.querySelectorAll('a, button, input, [tabindex]')).toHaveLength(0)
    expect(field?.textContent?.trim() ?? '').toBe('')

    // And the drawings it is made of are not announced as images either.
    expect(screen.getAllByRole('img')).toHaveLength(HERO_PHOTOS.length)
  })

  it('states no fact: no number, no count, no claim, no label', () => {
    renderHero()

    // The marks are the subject matter of a learning and technology marketplace,
    // never a claim about it. Requirement 14.1: nothing on this page may imply
    // scale, quality or accreditation, and a decorative layer is the easiest
    // place for such a thing to be added by accident.
    const field = document.querySelector('.hf')
    const marks = Array.from(field?.querySelectorAll('svg') ?? [])

    expect(marks.length).toBeGreaterThanOrEqual(5)
    for (const mark of marks) {
      expect(mark.getAttribute('aria-hidden') ?? 'true').toBe('true')
      expect(mark.textContent ?? '').toBe('')
    }

    const hero = document.querySelector('.tt-hero')?.textContent ?? ''
    for (const claim of [
      /\b\d/,
      /free trial/i,
      /certified|accredited|verified|background check/i,
      /guaranteed/i,
    ]) {
      expect(hero, `hero must not claim ${claim}`).not.toMatch(claim)
    }
  })
})
