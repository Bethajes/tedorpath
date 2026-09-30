import { useEffect, useState } from 'react'

import { Container } from '@/components/layout/PageShell'
import { getPublicStats } from '@/features/tutors/tutors.api'
import type { PublicStats } from '@/features/tutors/tutors.types'

/**
 * Homepage trust statistics.
 *
 * Every number is read live from `GET /api/public/stats`, which counts real
 * database records. Nothing here is a fallback figure, a seed, or a rounded-up
 * marketing number — the honest worst case is a big zero on a new deployment,
 * and the section handles that by saying so in words instead of printing "0".
 *
 * The fetch deliberately does not go through `useAsyncData` and does not gate
 * the page render. Stats are an enhancement, not the reason the homepage
 * exists, so a slow or failing endpoint must not delay or break anything else
 * on the page.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.5, 4.6
 */

/** One stat card's worth of configuration, kept beside the label it describes. */
interface StatDefinition {
  key: keyof PublicStats
  label: string
  /**
   * Shown instead of the number when the count is zero or unknown.
   *
   * These are deliberately vague. "Growing community" is defensible on an empty
   * platform; "0 tutors" reads as a dead one, and a specific figure would be a
   * number we have not earned.
   */
  fallback: string
}

const STAT_DEFINITIONS: StatDefinition[] = [
  { key: 'approvedTutors', label: 'Approved tutors', fallback: 'Growing' },
  { key: 'subjects', label: 'Subjects taught', fallback: 'Many' },
  { key: 'universities', label: 'University backgrounds', fallback: 'Several' },
  { key: 'countries', label: 'Countries represented', fallback: 'Multiple' },
]

/**
 * The number to print, or null when there is nothing true to print.
 *
 * Anything that is not a positive integer is treated as unknown rather than as
 * zero: `undefined` (the request has not landed), `null` (it failed) and a
 * malformed value from the server all mean "we do not know", and printing a
 * count for any of them would be a guess.
 */
function displayValue(count: number | undefined, fallback: string): string {
  if (typeof count === 'number' && Number.isInteger(count) && count > 0) {
    // Rendered as written rather than through `toLocaleString`: a thousands
    // separator would put "1,234" in the DOM where the API said "1234", and
    // the displayed figure should be the count itself, not a reformatting of it.
    return String(count)
  }
  return fallback
}

export function StatsSection() {
  // `undefined` means "not known yet", which is deliberately distinct from 0
  // ("known to be none") so the two render the same honest wording without
  // conflating a pending request with an empty database.
  const [stats, setStats] = useState<PublicStats | undefined>(undefined)

  useEffect(() => {
    // Ignore the result if the component unmounts first: a homepage section can
    // easily be replaced by a route change mid-request, and calling setState on
    // an unmounted component is both a leak and a React warning.
    let active = true

    getPublicStats()
      .then((result) => {
        if (active) setStats(result)
      })
      .catch(() => {
        // Silent by design. There is no error message here because there is
        // nothing the visitor can do about it, and an error banner next to the
        // tutor directory would suggest the directory is broken. Each card
        // falls back to its honest wording on its own.
        if (active) setStats(undefined)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <section className="section-y bg-white" aria-labelledby="stats-heading">
      <Container>
        <div className="max-w-2xl">
          <h2 id="stats-heading" className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
            The platform today
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-600">
            These figures come straight from the platform, counting only the tutor profiles that
            are live right now. When a count is still zero we say so rather than round it up.
          </p>
        </div>

        <dl className="mt-12 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          {STAT_DEFINITIONS.map(({ key, label, fallback }) => {
            const value = displayValue(stats?.[key], fallback)

            return (
              <div
                key={key}
                className="flex h-full flex-col items-start rounded-2xl border border-ink-200 bg-white p-5 shadow-[0_1px_3px_rgba(18,26,36,0.05)] sm:p-6"
              >
                <dd
                  className="text-3xl font-bold tracking-[-0.02em] text-brand-700 sm:text-4xl"
                  data-testid={`stat-value-${key}`}
                >
                  {value}
                </dd>
                <dt className="mt-2 text-sm leading-relaxed text-ink-600">{label}</dt>
              </div>
            )
          })}
        </dl>

        {/*
          No ratings, testimonials, success rates or satisfaction scores appear
          anywhere in this section, and none should be added: the platform does
          not collect any of them, so any such figure would be invented.
          Requirement 4.6.
        */}
      </Container>
    </section>
  )
}
