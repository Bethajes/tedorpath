import { describe, expect, it } from 'vitest'

import { formatDate, formatRelative, formatWhen } from './formatDate'

/**
 * The admin queue is read by time, so these are load-bearing: a wrong relative
 * time ("0 seconds ago", "-3 hours ago") makes a real queue look broken. `now`
 * is fixed so every case is deterministic.
 */
const NOW = new Date('2026-09-30T12:00:00.000Z')

function ago(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString()
}

describe('formatDate', () => {
  it('formats an ISO timestamp as a short date', () => {
    expect(formatDate('2026-09-27T10:00:00.000Z')).toMatch(/27/)
  })

  it('renders a dash for a missing or unparseable value', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('not a date')).toBe('—')
  })
})

describe('formatRelative', () => {
  it('collapses anything under a minute to "just now"', () => {
    expect(formatRelative(ago(0), NOW)).toBe('just now')
    expect(formatRelative(ago(30_000), NOW)).toBe('just now')
  })

  it('counts minutes, hours and days', () => {
    expect(formatRelative(ago(5 * 60_000), NOW)).toBe('5 minutes ago')
    expect(formatRelative(ago(60 * 60_000), NOW)).toBe('1 hour ago')
    expect(formatRelative(ago(3 * 3_600_000), NOW)).toBe('3 hours ago')
    expect(formatRelative(ago(2 * 86_400_000), NOW)).toBe('2 days ago')
  })

  it('switches to an absolute date once "N days ago" stops helping', () => {
    // 47 days ago is harder to picture than a date, so the date wins.
    expect(formatRelative(ago(47 * 86_400_000), NOW)).toBe(formatDate(ago(47 * 86_400_000)))
  })

  it('does not describe a future timestamp as being in the past', () => {
    // Clock skew between the API host and the browser must not produce
    // "-3 hours ago" on a queue an admin is trying to trust.
    expect(formatRelative(ago(-3 * 3_600_000), NOW)).toBe('just now')
  })

  it('renders a dash for a missing or unparseable value', () => {
    expect(formatRelative(null, NOW)).toBe('—')
    expect(formatRelative('not a date', NOW)).toBe('—')
  })
})

describe('formatWhen', () => {
  it('exposes the relative label and keeps the exact date reachable', () => {
    const when = formatWhen(ago(2 * 3_600_000), NOW)

    expect(when.label).toBe('2 hours ago')
    expect(when.title).toBe(formatDate(ago(2 * 3_600_000)))
  })
})
