import { useEffect, useState } from 'react'

import { Container } from '@/components/layout/PageShell'
import { SectionHeading } from '@/components/sections/SectionHeading'
import { Reveal } from '@/components/ui/Reveal'
import { getPublicStats } from '@/features/tutors/tutors.api'
import type { PublicStats } from '@/features/tutors/tutors.types'
import { statDisplayValue } from '@/lib/publicStats'

import { STAT_DEFINITIONS } from './howItWorksContent'

import './HowItWorks.css'

/**
 * The trust band: what the platform actually looks like right now.
 *
 * Every figure is read live from `GET /api/public/stats`, which counts real
 * database records, and every one that is zero — or unknown, or slow to arrive
 * — is replaced by wording instead of a number. This replaced a hand-written
 * "500+ tutors / 4.9 ★ / 300+ subjects" band: the platform collects no
 * ratings, and a count nobody measured is a claim rather than a statistic
 * (Requirements 4.2, 4.3, 14.1, 14.5).
 *
 * The request is not allowed to block anything. The heading, the labels and the
 * wording fallbacks all render on the first paint; only the digits arrive
 * later, and a failure is silent because there is nothing a visitor could do
 * about it.
 */
export function HowItWorksStats() {
  // `undefined` means "not known yet", which is deliberately distinct from 0
  // ("known to be none") so the two can render the same honest wording without
  // conflating a pending request with an empty database.
  const [stats, setStats] = useState<PublicStats | undefined>(undefined)

  useEffect(() => {
    // Ignore the result if the component unmounts first: this page is a lazy
    // route chunk, so navigating away mid-request is entirely ordinary.
    let active = true

    getPublicStats()
      .then((result) => {
        if (active) setStats(result)
      })
      .catch(() => {
        // Silent by design — no error message, no retry, no banner. Each card
        // falls back to its own wording.
        if (active) setStats(undefined)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <section
      aria-labelledby="hiw-stats-heading"
      className="tt-hero relative isolate overflow-hidden border-y border-brand-900/50 py-16 sm:py-20 lg:py-24"
    >
      <div aria-hidden="true" className="tt-grid tt-grid--band" />

      <Container className="relative">
        <SectionHeading
          id="hiw-stats-heading"
          eyebrow="Where things stand"
          tone="onDark"
          lede="Counted from the live marketplace, not from a marketing deck — these numbers cover only the tutor profiles that are public right now."
        >
          The platform today
        </SectionHeading>

        <dl className="mt-12 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {STAT_DEFINITIONS.map((definition, index) => {
            const value = statDisplayValue(stats?.[definition.key], definition.fallback)

            return (
              <Reveal
                key={definition.key}
                delay={index * 80}
                className="tt-stat flex flex-col rounded-2xl border border-ink-800 bg-ink-900/50 p-5 sm:p-6"
              >
                {/*
                  `dt` first, then the figures, and the visual order set with
                  `order`: the biggest number wants to be the first thing read,
                  but a description list is only well-formed with its term
                  ahead of its descriptions.
                */}
                <dt className="order-2 mt-2 text-sm font-semibold text-brand-200">
                  {definition.label}
                </dt>
                <dd
                  data-testid={`tt-stat-${definition.key}`}
                  className="order-1 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl"
                >
                  {value}
                </dd>
                <dd className="order-3 mt-1 text-xs leading-relaxed text-ink-400">
                  {definition.sub}
                </dd>
              </Reveal>
            )
          })}
        </dl>
      </Container>
    </section>
  )
}
