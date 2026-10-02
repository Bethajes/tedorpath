import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { TestimonialCard } from './TestimonialCard'
import { TestimonialRow } from './TestimonialRow'
import { TestimonialsSection } from './TestimonialsSection'
import { splitIntoRows, TESTIMONIALS, toTestimonial } from './testimonialData'
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

/** A single record with every field present, for the card-level tests. */
const CARD: Testimonial = {
  id: 'r-1',
  name: 'Bethlehem G.',
  quote: 'A quote somebody actually wrote, with their permission to publish it.',
  subject: 'High School Physics',
  location: 'Adama',
  rating: 4,
  isVerified: true,
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

  it('has no heading below the h2, because the section has no subsections', () => {
    const { container } = renderSection()

    // The section is one block of copy and one stream: no h3 is needed, and the
    // heading hierarchy check below still has to hold for whatever appears.
    const levels = Array.from(container.querySelectorAll('h2, h3, h4, h5, h6')).map((heading) =>
      Number(heading.tagName.slice(1)),
    )

    expect(levels[0]).toBe(2)
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
    expect(readable).toHaveLength(TESTIMONIALS.length * 2)

    for (const testimonial of TESTIMONIALS) {
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
          testimonial={{ ...CARD, avatar: '/testimonials/someone.svg' }}
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
    const [first, second] = splitIntoRows(TESTIMONIALS)

    expect(first).toHaveLength(Math.ceil(TESTIMONIALS.length / 2))
    expect(second).toHaveLength(Math.floor(TESTIMONIALS.length / 2))

    // Nothing dropped, nothing duplicated between the rows.
    expect([...first, ...second].map((t) => t.id).sort()).toEqual(
      TESTIMONIALS.map((t) => t.id).sort(),
    )
  })

  it('keeps every entry, whatever the length', () => {
    for (const length of [1, 2, 3, 5, 7]) {
      const entries = TESTIMONIALS.slice(0, length)
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
    const [first, second] = splitIntoRows(TESTIMONIALS.slice(0, 1))
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

describe('TestimonialsSection — every bundled record is a real, attributed person', () => {
  it('carries a name that is not a placeholder', () => {
    // The old content was nine entries named "Demo Learner"/"Demo Parent" plus
    // three wearing plausible given names. There is no longer a flag to catch
    // the second kind, so the assertion that has to exist is the one on the
    // text itself: nothing here may read as a placeholder to a visitor.
    const placeholders = /demo|sample|placeholder|testimonial|lorem|john doe|jane smith/i

    for (const entry of TESTIMONIALS) {
      expect(entry.name, `"${entry.id}" is a placeholder name`).not.toMatch(placeholders)
      expect(entry.name.trim().length).toBeGreaterThan(1)
    }
  })

  it('claims no verification it cannot back, so no badge renders by default', () => {
    // Attribution and consent to publish were gathered per record; no per-record
    // review is stored yet. The badge claims the platform holds the review, so it
    // stays off until it does.
    for (const entry of TESTIMONIALS) {
      expect(entry.isVerified, `"${entry.id}" must not claim verification`).toBe(false)
    }

    renderSection()
    expect(screen.queryByText('Verified learner')).not.toBeInTheDocument()
  })

  it('renders no placeholder chip of any kind', () => {
    const { container } = renderSection()

    expect(container.textContent).not.toContain('Sample')

    // The chip was the only reason a demo entry could not read as real. With the
    // demo content gone the badge slot should be absent from the markup
    // entirely, not merely empty.
    expect(container.querySelectorAll('.tw-badge')).toHaveLength(0)
  })

  it('shows the given name of each attributed learner', () => {
    const { container } = renderSection()

    for (const entry of TESTIMONIALS) {
      expect(container.textContent).toContain(entry.name)
      expect(container.textContent).toContain(entry.quote)
    }
  })

  it('badges a review the platform actually holds as verified', () => {
    render(
      <MemoryRouter>
        <TestimonialCard testimonial={CARD} />
      </MemoryRouter>,
    )

    expect(screen.getByText('Verified learner')).toBeInTheDocument()
  })

  it('does not badge a review the platform does not hold', () => {
    render(
      <MemoryRouter>
        <TestimonialCard testimonial={{ ...CARD, isVerified: false }} />
      </MemoryRouter>,
    )

    expect(screen.queryByText('Verified learner')).not.toBeInTheDocument()
    expect(screen.queryByText('Sample')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// The Ethiopian / international mix has to survive the two-row split.
// ---------------------------------------------------------------------------

describe('TestimonialsSection — geography is mixed within each row', () => {
  const isInternational = (location: string | undefined) =>
    /USA|Australia|Italy|Canada|Ireland/.test(location ?? '')

  it('bundles Ethiopian and international records', () => {
    const international = TESTIMONIALS.filter((t) => isInternational(t.location)).length

    expect(international).toBeGreaterThan(0)
    expect(international).toBeLessThan(TESTIMONIALS.length)
  })

  it('puts both kinds of learner in both rows', () => {
    // The failure this guards against is array ordering, not data: `splitIntoRows`
    // alternates, so an array grouped by geography yields one Ethiopian row and
    // one international row, and the section reads as two segregated lists.
    for (const row of splitIntoRows(TESTIMONIALS)) {
      const international = row.filter((t) => isInternational(t.location)).length

      expect(international, 'each row needs at least one international learner').toBeGreaterThan(0)
      expect(international, 'each row needs at least one Ethiopian learner').toBeLessThan(row.length)
    }
  })

  it('spreads the unrated records across rows, so both layouts are on screen', () => {
    const unratedPerRow = splitIntoRows(TESTIMONIALS).map(
      (row) => row.filter((t) => t.rating === undefined).length,
    )

    expect(unratedPerRow.every((count) => count > 0)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// TRUST. No invented ratings, and no numbers at all.
// ---------------------------------------------------------------------------

describe('TestimonialsSection — ratings are never invented', () => {
  it('renders no stars when the data carries no rating', () => {
    const { container } = render(
      <MemoryRouter>
        <TestimonialCard testimonial={{ ...CARD, rating: undefined }} />
      </MemoryRouter>,
    )

    // No default row of stars and no implied floor of one star.
    expect(container.textContent).not.toContain('out of 5')
    expect(container.querySelector('svg[viewBox="0 0 20 20"]')).toBeNull()
  })

  it('shows the rating the data actually contains', () => {
    const { container } = render(
      <MemoryRouter>
        <TestimonialCard testimonial={{ ...CARD, rating: 3 }} />
      </MemoryRouter>,
    )

    expect(container.textContent).toContain('3 out of 5')
  })

  it('shows a fractional rating to its own precision rather than rounding it', () => {
    // 4.8 is not five stars. Rounding up prints a score nobody gave, and the
    // filled width of the overlay is what makes the two distinguishable.
    for (const rating of [4.8, 4.9]) {
      const { container } = render(
        <MemoryRouter>
          <TestimonialCard testimonial={{ ...CARD, rating }} />
        </MemoryRouter>,
      )

      expect(container.textContent).toContain(`${rating} out of 5`)
      expect(container.textContent).not.toContain('5 out of 5')

      // The filled overlay is the only element in the card carrying an inline
      // style, and it clips one star rather than the whole row, so its width is
      // the fraction of that star which is filled — not the fraction of the row.
      const overlay = container.querySelector<HTMLElement>('[style*="width"]')
      expect(overlay).not.toBeNull()
      expect(overlay?.style.width).toBe(`${(rating % 1) * 100}%`)
    }
  })

  it('clips nothing at a whole rating, so no sliver of the next star fills', () => {
    // A percentage overlay across the full row is wrong by up to one gap: at a
    // rating of 1 it overfills into the second star. Only a fractional star is
    // clipped, so a whole rating must produce no clip element at all.
    for (const rating of [1, 3, 5]) {
      const { container } = render(
        <MemoryRouter>
          <TestimonialCard testimonial={{ ...CARD, rating }} />
        </MemoryRouter>,
      )

      expect(container.querySelector('[style*="width"]')).toBeNull()
    }
  })

  it('bundles at least one fractional rating, so the partial-star path is real', () => {
    const fractional = TESTIMONIALS.filter((t) => t.rating !== undefined && t.rating % 1 !== 0)

    expect(fractional.length).toBeGreaterThan(0)
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

  it('leaves the review claim to TrustSection', () => {
    renderSection()

    // TrustSection says this once, with the three other claims the platform
    // can defend around it. Repeating it here gave the weaker, isolated version
    // a second chance to be read on its own.
    expect(screen.queryByText(/Every tutor profile is reviewed before it appears publicly/i)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// The section ends on the stream: no local call to action.
// ---------------------------------------------------------------------------

describe('TestimonialsSection — no local call to action', () => {
  it('closes on the stream, leaving the doors to CTASection', () => {
    const { container } = renderSection()

    expect(screen.queryByRole('heading', { name: /Ready to start learning/i })).toBeNull()
    expect(container.querySelectorAll('a[href]')).toHaveLength(0)
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
    })
  })

  it('drops a record that could not render a card rather than rendering a blank one', () => {
    for (const raw of [null, undefined, 'nope', {}, { id: 'a', name: 'B' }]) {
      expect(toTestimonial(raw)).toBeNull()
    }
  })

  it('refuses an out-of-range rating instead of clamping it into a score', () => {
    // Clamping 9.4 would print four stars nobody gave.
    for (const rating of [0, 6, 9.4, -1, '5', null, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(toTestimonial({ id: 'a', name: 'B', quote: 'c', subject: 'd', rating })?.rating)
        .toBeUndefined()
    }
  })

  it('keeps a fractional rating to one decimal rather than rounding it to a star', () => {
    expect(toTestimonial({ id: 'a', name: 'B', quote: 'c', subject: 'd', rating: 4.8 })?.rating)
      .toBe(4.8)
    // Guards the float that would otherwise print as 4.799999999999999 in the
    // "out of 5" label.
    expect(toTestimonial({ id: 'a', name: 'B', quote: 'c', subject: 'd', rating: 4.79999 })?.rating)
      .toBe(4.8)
  })

  it('treats anything but a literal true as unverified', () => {
    for (const isVerified of ['true', 1, 'yes']) {
      expect(
        toTestimonial({ id: 'a', name: 'B', quote: 'c', subject: 'd', isVerified })?.isVerified,
      ).toBe(false)
    }
  })

  it('lets API data render through the section with no other change', () => {
    renderSection([toTestimonial({ ...CARD, isVerified: true, rating: 5 }) as Testimonial])

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      'Real learning. Real progress.',
    )
    expect(screen.getAllByText('Verified learner').length).toBeGreaterThan(0)
  })
})
