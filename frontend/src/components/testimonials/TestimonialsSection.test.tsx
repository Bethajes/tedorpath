import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { TestimonialCard } from './TestimonialCard'
import { TestimonialRow } from './TestimonialRow'
import { TestimonialsSection } from './TestimonialsSection'
import { DEMO_TESTIMONIALS, splitIntoRows, TESTIMONIALS, toTestimonial } from './testimonialData'
import type { Testimonial } from './testimonialData'

/**
 * Tests for the testimonial stream.
 *
 * Most of this file is about what the section must NOT claim. The visual
 * behaviour that cannot be asserted in jsdom — that the rows actually travel,
 * that the loop is seamless, that nothing overflows the body — lives in
 * testimonials.css and is reviewed there; these tests cover the DOM contract
 * those styles depend on, plus the trust rules that no stylesheet can enforce.
 */

function renderSection(testimonials?: readonly Testimonial[]) {
  return render(
    <MemoryRouter>
      <TestimonialsSection testimonials={testimonials} />
    </MemoryRouter>,
  )
}

const REAL: Testimonial = {
  id: 'r-1',
  name: 'A Real Learner',
  quote: 'A quote somebody actually wrote, with their permission to publish it.',
  subject: 'Mathematics',
  location: 'Addis Ababa',
  rating: 4,
  isVerified: true,
  isDemo: false,
}

// ---------------------------------------------------------------------------
// Section structure
// ---------------------------------------------------------------------------

describe('TestimonialsSection — structure', () => {
  it('has a single h2 with the required heading', () => {
    renderSection()

    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings).toHaveLength(1)
    expect(headings[0].textContent).toBe('Real learning. Real progress.')
  })

  it('drops the subheading to h3, so no heading level is skipped', () => {
    const { container } = renderSection()

    const levels = Array.from(container.querySelectorAll('h2, h3')).map((heading) =>
      Number(heading.tagName.slice(1)),
    )

    expect(levels).toContain(2)
    expect(levels).toContain(3)
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1)
    }
  })

  it('renders two rows travelling in opposite directions', () => {
    const { container } = renderSection()

    const rows = Array.from(container.querySelectorAll<HTMLElement>('.tw-row'))
    expect(rows).toHaveLength(2)

    // `data-reverse` selects the opposite keyframe in the stylesheet, so it is
    // the hook the CSS depends on: the two rows must differ.
    expect(rows[0].dataset.reverse).toBe('false')
    expect(rows[1].dataset.reverse).toBe('true')
  })

  it('renders every testimonial across the two rows', () => {
    const { container } = renderSection()

    // Once per row-copy: two copies per row, two rows, one entry in each.
    const readable = container.querySelectorAll('li > figure')
    expect(readable).toHaveLength(DEMO_TESTIMONIALS.length * 2)

    for (const testimonial of DEMO_TESTIMONIALS) {
      expect(container.textContent).toContain(testimonial.quote)
    }
  })

  it('marks the quote up as a blockquote inside a figure', () => {
    const { container } = renderSection()

    const figures = Array.from(container.querySelectorAll('li > figure'))
    expect(figures.length).toBeGreaterThan(0)

    for (const figure of figures) {
      expect(figure.querySelector('blockquote')).not.toBeNull()
      expect(figure.querySelector('figcaption')).not.toBeNull()
    }
  })

  it('gives every image an empty alt — the name is already the adjacent text', () => {
    const { container } = render(
      <MemoryRouter>
        <TestimonialCard
          testimonial={{ ...REAL, avatar: '/testimonials/someone.svg' }}
        />
      </MemoryRouter>,
    )

    for (const image of Array.from(container.querySelectorAll('img'))) {
      expect(image.getAttribute('alt')).toBe('')
    }
  })

  it('renders nothing at all when there is no content, rather than a stranded heading', () => {
    const { container } = renderSection([])

    expect(container.querySelector('section')).toBeNull()
    expect(container.textContent).toBe('')
  })
})

// ---------------------------------------------------------------------------
// The two-row split. Both rows have to stay populated and stay varied.
// ---------------------------------------------------------------------------

describe('splitIntoRows', () => {
  it('alternates rather than slicing, so neither row is left empty', () => {
    const [first, second] = splitIntoRows(DEMO_TESTIMONIALS)

    expect(first).toHaveLength(Math.ceil(DEMO_TESTIMONIALS.length / 2))
    expect(second).toHaveLength(Math.floor(DEMO_TESTIMONIALS.length / 2))

    // Nothing dropped, nothing duplicated between the rows.
    expect([...first, ...second].map((t) => t.id).sort()).toEqual(
      DEMO_TESTIMONIALS.map((t) => t.id).sort(),
    )
  })

  it('keeps every entry, whatever the length', () => {
    for (const length of [1, 2, 3, 5, 7]) {
      const entries = DEMO_TESTIMONIALS.slice(0, length)
      const [first, second] = splitIntoRows(entries)

      expect(first.length + second.length).toBe(length)
      expect(first.length).toBe(Math.ceil(length / 2))
      expect(second.length).toBe(Math.floor(length / 2))
    }
  })

  it('leaves no row to render without content, which TestimonialRow drops', () => {
    // A single testimonial cannot fill two rows. The honest answer is one row,
    // not a second band with nothing in it — and an odd-length list gives rows
    // of 3 and 2 rather than one full row and one empty one.
    const [first, second] = splitIntoRows(DEMO_TESTIMONIALS.slice(0, 1))
    expect(first).toHaveLength(1)
    expect(second).toHaveLength(0)
  })

  it('gives both rows more than one card, so neither reads as a single quote', () => {
    const [first, second] = splitIntoRows(TESTIMONIALS)

    expect(first.length).toBeGreaterThan(1)
    expect(second.length).toBeGreaterThan(1)
  })
})

// ---------------------------------------------------------------------------
// The loop. This is the DOM contract the -50% translation depends on.
// ---------------------------------------------------------------------------

describe('TestimonialRow — seamless loop', () => {
  it('renders the list twice, so translating by half the track wraps cleanly', () => {
    const { container } = render(
      <MemoryRouter>
        <TestimonialRow testimonials={TESTIMONIALS} />
      </MemoryRouter>,
    )

    const sets = Array.from(container.querySelectorAll('.tw-set'))
    expect(sets).toHaveLength(2)

    for (const set of sets) {
      expect(set.querySelectorAll('li')).toHaveLength(TESTIMONIALS.length)
    }
  })

  it('hides the duplicate copy from assistive technology', () => {
    const { container } = render(
      <MemoryRouter>
        <TestimonialRow testimonials={TESTIMONIALS} />
      </MemoryRouter>,
    )

    const sets = Array.from(container.querySelectorAll('.tw-set'))
    expect(sets[0].getAttribute('aria-hidden')).toBeNull()
    // The reduced-motion stylesheet keys off this attribute to drop the copy.
    expect(sets[1].getAttribute('aria-hidden')).toBe('true')
  })

  it('gives every card in both copies a distinct React key', () => {
    const { container } = render(
      <MemoryRouter>
        <TestimonialRow testimonials={TESTIMONIALS} />
      </MemoryRouter>,
    )

    const figures = Array.from(container.querySelectorAll('li > figure'))
    // Two copies of the same testimonial are two elements, so a key collision
    // between them is a real defect rather than a duplicate in the data.
    expect(figures).toHaveLength(TESTIMONIALS.length * 2)
  })

  it('renders nothing for an empty row instead of an empty animated band', () => {
    const { container } = render(
      <MemoryRouter>
        <TestimonialRow testimonials={[]} />
      </MemoryRouter>,
    )

    expect(container.querySelector('.tw-row')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// TRUST. Requirement 14.2 — no social proof may be manufactured.
// ---------------------------------------------------------------------------

describe('TestimonialsSection — demo content is never presentable as real', () => {
  it('marks every bundled entry as demo, whatever its name looks like', () => {
    // The first three entries use ordinary given names, which is the whole
    // difficulty: a name is not a label. The flag is what the card trusts, and
    // the flag is what has to be set on every single one.
    for (const entry of TESTIMONIALS) {
      expect(entry.isDemo, `"${entry.id}" must be flagged as demo content`).toBe(true)
      expect(entry.isVerified, `"${entry.id}" must not claim verification`).toBe(false)
    }
  })

  it('chips every card as a sample, including the ones with real-seeming names', () => {
    const { container } = renderSection()

    const chips = Array.from(container.querySelectorAll('.tw-badge')).filter((chip) =>
      chip.textContent?.includes('Sample'),
    )
    expect(chips).toHaveLength(DEMO_TESTIMONIALS.length * 2)
  })

  it('never badges demo content as verified, even if isVerified is set by mistake', () => {
    const { container } = render(
      <MemoryRouter>
        <TestimonialCard
          testimonial={{
            id: 'demo-x',
            name: 'Hana',
            quote: 'Placeholder words.',
            subject: 'Mathematics',
            isVerified: true,
            isDemo: true,
          }}
        />
      </MemoryRouter>,
    )

    expect(container.textContent).not.toContain('Verified learner')
    expect(container.textContent).toContain('Sample')
  })

  it('does badge a real, verified review as verified', () => {
    render(
      <MemoryRouter>
        <TestimonialCard testimonial={REAL} />
      </MemoryRouter>,
    )

    expect(screen.getByText('Verified learner')).toBeInTheDocument()
  })

  it('does not badge an unverified real review', () => {
    render(
      <MemoryRouter>
        <TestimonialCard testimonial={{ ...REAL, isVerified: false }} />
      </MemoryRouter>,
    )

    expect(screen.queryByText('Verified learner')).not.toBeInTheDocument()
    expect(screen.queryByText('Sample')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// TRUST. No invented ratings, and no numbers at all.
// ---------------------------------------------------------------------------

describe('TestimonialsSection — ratings are never invented', () => {
  it('renders no stars when the data carries no rating', () => {
    const { container } = render(
      <MemoryRouter>
        <TestimonialCard testimonial={{ ...REAL, rating: undefined }} />
      </MemoryRouter>,
    )

    // No default row of stars and no implied floor of one star.
    expect(container.textContent).not.toContain('out of 5')
    expect(container.querySelector('svg[viewBox="0 0 20 20"]')).toBeNull()
  })

  it('shows the rating the data actually contains', () => {
    const { container } = render(
      <MemoryRouter>
        <TestimonialCard testimonial={{ ...REAL, rating: 3 }} />
      </MemoryRouter>,
    )

    expect(container.textContent).toContain('3 out of 5')
  })

  it('prints no aggregate score, review count or total anywhere in the section', () => {
    const { container } = renderSection()

    const text = (container.textContent ?? '').toLowerCase()
    for (const word of ['average', 'out of 5 reviews', 'total reviews', 'students worldwide']) {
      expect(text, `"${word}" must not appear`).not.toContain(word)
    }

    // A running total is the easiest way to invent scale, so the digit count of
    // the section is asserted not to contain any count-shaped claim at all: the
    // only digits present are the rating numerals and the section's own copy.
    expect(text).not.toMatch(/\b\d[\d,.]*\+?\s*(learners|reviews|ratings|students|tutors)\b/)
  })

  it('shows no unverifiable screening or accreditation claims', () => {
    const { container } = renderSection()

    const text = (container.textContent ?? '').toLowerCase()
    for (const word of ['background check', 'certified', 'accredited', 'university verified']) {
      expect(text, `"${word}" must not appear`).not.toContain(word)
    }
  })

  it('states the one trust claim the platform can actually make', () => {
    renderSection()

    expect(
      screen.getByText(/Every tutor profile is reviewed before it appears publicly/i),
    ).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// The call to action. Requirement 15.1 — links must point at real routes.
// ---------------------------------------------------------------------------

describe('TestimonialsSection — call to action', () => {
  it('closes with the two doors, using existing routes', () => {
    renderSection()

    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(
      'Ready to start learning?',
    )
    expect(screen.getByRole('link', { name: /Find a Tutor/i })).toHaveAttribute(
      'href',
      '/tutors',
    )
    expect(screen.getByRole('link', { name: /Become a Tutor/i })).toHaveAttribute(
      'href',
      '/become-a-tutor',
    )
  })
})

// ---------------------------------------------------------------------------
// The seam for GET /api/testimonials.
// ---------------------------------------------------------------------------

describe('toTestimonial — the future API payload', () => {
  it('accepts the documented response shape', () => {
    const result = toTestimonial({
      id: 'abc',
      name: 'A Real Learner',
      quote: 'Words they actually wrote.',
      subject: 'Mathematics',
      location: 'Addis Ababa',
      avatar: '/api/uploads/abc.png',
      rating: 5,
      isVerified: true,
    })

    expect(result).toEqual({
      id: 'abc',
      name: 'A Real Learner',
      quote: 'Words they actually wrote.',
      subject: 'Mathematics',
      location: 'Addis Ababa',
      avatar: '/api/uploads/abc.png',
      rating: 5,
      isVerified: true,
      isDemo: false,
    })
  })

  it('drops a record that could not render a card rather than rendering a blank one', () => {
    for (const raw of [null, undefined, 'nope', {}, { id: 'a', name: 'B' }]) {
      expect(toTestimonial(raw)).toBeNull()
    }
  })

  it('refuses an out-of-range rating instead of clamping it into a score', () => {
    // Clamping 9.4 would print four stars nobody gave.
    for (const rating of [0, 6, 9.4, -1, '5', null, Number.NaN]) {
      expect(toTestimonial({ id: 'a', name: 'B', quote: 'c', subject: 'd', rating })?.rating)
        .toBeUndefined()
    }
  })

  it('never lets a server response smuggle demo content in', () => {
    const result = toTestimonial({
      id: 'a',
      name: 'B',
      quote: 'c',
      subject: 'd',
      isDemo: true,
    })

    expect(result?.isDemo).toBe(false)
  })

  it('lets API data render through the section with no other change', () => {
    renderSection([toTestimonial({ ...REAL, isVerified: true, rating: 5 }) as Testimonial])

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      'Real learning. Real progress.',
    )
    expect(screen.getAllByText('Verified learner').length).toBeGreaterThan(0)
  })
})
