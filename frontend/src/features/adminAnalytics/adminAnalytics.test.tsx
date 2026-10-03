import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { ActivityFeed } from '@/components/admin/ActivityFeed'
import { AttentionItemCard } from '@/components/admin/AttentionPanels'
import { SubjectBreakdown, VerificationSummary } from '@/components/admin/Breakdowns'
import { KpiCard, KpiRow } from '@/components/admin/KpiCards'
import { TrendChart } from '@/components/admin/TrendChart'

import type { ActivityEntry, TrendPoint } from '@/features/adminAnalytics/adminAnalytics.types'

/**
 * The dashboard's building blocks.
 *
 * These tests exist mostly to pin down what the components refuse to do. The
 * platform records counts and timestamps and nothing else, so the failure mode
 * this whole redesign has to avoid is a component that helpfully invents a
 * percentage, a trend arrow or a "last updated" claim. Each block below asserts
 * one such boundary.
 */

/** ActivityFeed renders links, so it needs a router to render at all. */
function renderFeed(entries: ActivityEntry[]) {
  return render(
    <MemoryRouter>
      <ActivityFeed entries={entries} />
    </MemoryRouter>,
  )
}

function series(values: number[]): TrendPoint[] {
  return values.map((count, index) => ({
    date: `2026-09-${String(index + 1).padStart(2, '0')}`,
    count,
  }))
}

// ---------------------------------------------------------------------------
// TrendChart — a bar is a count, and a gap is a zero
// ---------------------------------------------------------------------------

describe('TrendChart — reports the series it was given', () => {
  it('totals exactly the values it was handed', () => {
    // Asserted against the container's text rather than a single element: the
    // caption deliberately styles the count separately, which splits the phrase
    // across text nodes even though it reads as one sentence.
    const { container } = render(<TrendChart title="Requests" points={series([0, 2, 0, 5, 1])} />)

    expect(container.textContent).toContain('8 records in 5 days')
  })

  it('renders one table row per day, so the figures are readable without the picture', () => {
    render(<TrendChart title="Requests" points={series([0, 2, 0, 5, 1])} />)

    const table = screen.getByRole('table', { hidden: true })
    // A header row plus one row per day.
    expect(within(table).getAllByRole('row')).toHaveLength(6)
  })

  it('draws no bar for a zero day, and does not renumber the others', () => {
    const { container } = render(<TrendChart title="Requests" points={series([0, 0, 3])} />)

    // Only the day with a count gets a rectangle; the two zeroes get nothing,
    // because a zero-height rect would still be a mark on the baseline.
    const bars = container.querySelectorAll('svg rect')
    expect(bars).toHaveLength(1)
    expect(container.textContent).toContain('3 records in 3 days')
  })

  it('says so when there is nothing at all, rather than showing an empty box', () => {
    render(<TrendChart title="Requests" points={series([0, 0, 0])} />)

    expect(screen.getByText(/no records in this window yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('table', { hidden: true })).not.toBeInTheDocument()
  })

  it('handles an empty series without dividing by zero', () => {
    render(<TrendChart title="Requests" points={[]} />)

    expect(screen.getByText(/no records in this window yet/i)).toBeInTheDocument()
  })

  it('admits when it is showing only the tail of a long window', () => {
    // 90 days in a card this size cannot show 90 bars. Silently drawing the last
    // 45 would read as "nothing before this", which is not what the data says.
    const { container } = render(
      <TrendChart
        title="Requests"
        points={series(Array.from({ length: 90 }, (_, i) => (i % 5 === 0 ? 1 : 0)))}
      />,
    )

    expect(container.textContent).toContain('Showing the most recent 45 days of 90')
    // The headline total still covers every day, not just the drawn ones.
    expect(container.textContent).toContain('18 records in 90 days')
  })

  it('never implies a change against a previous period', () => {
    // There is no snapshot of past totals, so any "vs last month" would be
    // fabricated. Nothing in the chart may claim one.
    const { container } = render(<TrendChart title="Requests" points={series([1, 2, 3])} />)

    const text = (container.textContent ?? '').toLowerCase()
    for (const word of ['%', 'vs', 'growth', 'increase', 'decrease', 'compared']) {
      expect(text).not.toContain(word)
    }
  })
})

// ---------------------------------------------------------------------------
// KpiCard — states what is counted
// ---------------------------------------------------------------------------

describe('KpiCard', () => {
  const card = {
    key: 'pending',
    label: 'Pending reviews',
    value: 4,
    icon: 'clock' as const,
    to: '/admin/tutors?status=PENDING_REVIEW',
    hint: 'applications awaiting a decision',
    tone: 'amber' as const,
    actionable: true,
  }

  it('shows the value, the label and what the value counts', () => {
    render(
      <MemoryRouter>
        <KpiCard card={card} />
      </MemoryRouter>,
    )

    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('Pending reviews')).toBeInTheDocument()
    expect(screen.getByText('applications awaiting a decision')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/admin/tutors?status=PENDING_REVIEW')
  })

  it('links every card somewhere, because an un-actionable count is decoration', () => {
    render(
      <MemoryRouter>
        <KpiRow
          cards={[
            card,
            { ...card, key: 'b', label: 'Other', to: '/admin/requests', hint: 'h', tone: 'brand' },
          ]}
        />
      </MemoryRouter>,
    )

    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('href')
    }
  })

  it('labels the KPI group so it is not an anonymous grab-bag of numbers', () => {
    render(
      <MemoryRouter>
        <KpiRow cards={[card]} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('list', { name: 'Key figures' })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Attention panels — each states its own empty case
// ---------------------------------------------------------------------------

describe('AttentionItemCard', () => {
  const item = {
    key: 'new-requests',
    label: 'New requests',
    count: 3,
    detail: 'waiting for a first reply',
    to: '/admin/requests?status=NEW',
    cta: 'See new requests',
    icon: 'requests' as const,
    tone: 'blue' as const,
    clearLabel: 'Every learner request has had a reply',
  }

  it('shows the count beside the state, not merged into it', () => {
    render(
      <MemoryRouter>
        <AttentionItemCard item={item} />
      </MemoryRouter>,
    )

    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('waiting for a first reply')).toBeInTheDocument()
    expect(screen.queryByText(item.clearLabel)).not.toBeInTheDocument()
  })

  it('states the queue is clear instead of leaving a bare zero', () => {
    render(
      <MemoryRouter>
        <AttentionItemCard item={{ ...item, count: 0 }} />
      </MemoryRouter>,
    )

    expect(screen.getByText(item.clearLabel)).toBeInTheDocument()
    expect(screen.queryByText(item.detail)).not.toBeInTheDocument()
  })

  it('keeps the route working when the queue is empty', () => {
    render(
      <MemoryRouter>
        <AttentionItemCard item={{ ...item, count: 0 }} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: new RegExp(item.cta, 'i') })).toHaveAttribute(
      'href',
      '/admin/requests?status=NEW',
    )
  })
})

// ---------------------------------------------------------------------------
// Activity feed — claims only what the timestamps prove
// ---------------------------------------------------------------------------

describe('ActivityFeed', () => {
  const entry = (overrides: Partial<ActivityEntry> = {}): ActivityEntry => ({
    id: 'request:1',
    kind: 'request',
    entityId: 'abc',
    occurredAt: new Date().toISOString(),
    actor: 'Abel Tesfaye',
    headline: 'Mathematics',
    status: 'NEW',
    isNew: true,
    signedIn: true,
    ...overrides,
  })

  it('says a record arrived when it has never been written again', () => {
    const { container } = renderFeed([entry()])

    expect(container.textContent).toContain('Abel Tesfaye sent a new tutor request')
  })

  it('says a record was updated when it has been written again', () => {
    const { container } = renderFeed([entry({ isNew: false })])

    expect(container.textContent).toContain('Abel Tesfaye updated a tutor request')
  })

  it('never claims an approval, because nothing records who approved what', () => {
    // There is no audit log: the schema keeps the current status and when the
    // row was last written. A feed that said "approved" would be inventing an
    // event that the database cannot prove happened.
    const { container } = renderFeed([
      entry(),
      entry({
        id: 'profile:2',
        kind: 'application',
        entityId: 'def',
        actor: 'Zebedee',
        headline: 'Chemistry',
        status: 'APPROVED',
        isNew: false,
      }),
    ])

    const text = (container.textContent ?? '').toLowerCase()
    for (const word of ['approved by', 'rejected by', 'reviewed by', 'sent an email', 'notified']) {
      expect(text).not.toContain(word)
    }
  })

  it('links each entry to the record it describes', () => {
    renderFeed([entry()])

    expect(screen.getByRole('link')).toHaveAttribute('href', '/admin/requests/abc')
  })

  it('routes an application entry to the tutor workspace', () => {
    const { container } = renderFeed([
      entry({
        id: 'profile:9',
        kind: 'application',
        entityId: 'tutor-1',
        isNew: true,
        status: 'PENDING_REVIEW',
      }),
    ])

    expect(screen.getByRole('link')).toHaveAttribute('href', '/admin/tutors/tutor-1')
    expect(container.textContent).toContain('submitted a tutor application')
  })

  it('explains the empty state rather than showing nothing', () => {
    renderFeed([])

    expect(screen.getByText(/nothing has been created yet/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Breakdowns — free text stays free text
// ---------------------------------------------------------------------------

describe('SubjectBreakdown', () => {
  it('ranks the subjects it was given', () => {
    render(
      <MemoryRouter>
        <SubjectBreakdown
          rows={[
            { subject: 'Mathematics', count: 5 },
            { subject: 'Physics', count: 2 },
          ]}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('Mathematics')).toBeInTheDocument()
    expect(screen.getByText('Physics')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('says there is nothing to rank when there are no requests', () => {
    render(
      <MemoryRouter>
        <SubjectBreakdown rows={[]} />
      </MemoryRouter>,
    )

    expect(screen.getByText(/nothing to rank/i)).toBeInTheDocument()
  })
})

describe('VerificationSummary', () => {
  it('shows one row per document-check state, counted from the response', () => {
    render(
      <MemoryRouter>
        <VerificationSummary
          counts={{
            VERIFIED: 2,
            DOCUMENTS_REQUESTED: 1,
            DOCUMENTS_RECEIVED: 3,
            NEEDS_MORE_INFORMATION: 0,
            UNVERIFIED: 4,
          }}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(screen.getByText('across 10 profiles')).toBeInTheDocument()
  })

  it('adds no approval rate or turnaround figure', () => {
    const { container } = render(
      <MemoryRouter>
        <VerificationSummary
          counts={{
            VERIFIED: 2,
            DOCUMENTS_REQUESTED: 1,
            DOCUMENTS_RECEIVED: 3,
            NEEDS_MORE_INFORMATION: 0,
            UNVERIFIED: 4,
          }}
        />
      </MemoryRouter>,
    )

    const text = (container.textContent ?? '').toLowerCase()
    for (const word of ['rate', 'turnaround', 'average', 'days', '%']) {
      expect(text).not.toContain(word)
    }
  })
})
