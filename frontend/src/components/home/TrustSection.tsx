import { Container } from '@/components/layout/PageShell'

/**
 * Why a learner can rely on the platform.
 *
 * Every claim here is one the product can defend. The specific things this
 * section must NOT say, because the platform does not do them, are: background
 * checks, identity verification, accredited or certified tutors, guaranteed
 * results, and anything about ratings. Requirement 14.1 and the same constraint
 * as VerificationSteps, which describes the review that actually happens.
 *
 * (Previously WhyTedor — the same component under a name that described the
 * product rather than the reader's reason to trust it.)
 */

interface TrustReason {
  title: string
  description: string
  icon: React.ReactNode
}

const REASONS: TrustReason[] = [
  {
    title: 'Reviewed tutor profiles',
    description:
      'Every tutor profile goes through our review process before becoming publicly visible. Nothing is listed while something is outstanding.',
    icon: (
      <>
        <path d="M4 12.5l5 5L20 6.5" />
        <path d="M12 3.2l7 2.6v5.4c0 4.3-2.9 8.2-7 9.6-4.1-1.4-7-5.3-7-9.6V5.8Z" />
      </>
    ),
  },
  {
    title: 'Relevant expertise',
    description:
      'Find tutors by subject, level, teaching mode, background, and learning goal — so the shortlist reflects what you actually need.',
    icon: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m16.2 16.2 4 4" />
      </>
    ),
  },
  {
    title: 'Flexible learning',
    description:
      'Learn online or in person depending on where you are and what suits you. Most tutoring happens online, in English.',
    icon: (
      <>
        <rect x="3" y="4.5" width="18" height="12" rx="2" />
        <path d="M8.5 20.5h7M12 16.5v4" />
      </>
    ),
  },
  {
    title: 'Human support',
    description:
      'A person on our team reads your request and helps you get to a suitable tutor. Nothing is matched by an algorithm alone.',
    icon: (
      <>
        <circle cx="12" cy="8.5" r="3.4" />
        <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
      </>
    ),
  },
]

export function TrustSection() {
  return (
    <section id="why-tedor" className="section-y bg-ink-50" aria-labelledby="trust-heading">
      <Container>
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-accent-700">
            Trust
          </p>
          <h2 id="trust-heading" className="mt-3 text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
            Why learners trust Tedor
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-600">
            Four things that are true about how this platform works — not four things that would
            sound better.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {REASONS.map((reason) => (
            // A <div>, not an <article>: HomePage.test.tsx counts tutor cards
            // with a bare `article` selector to prove FeaturedTutors renders one
            // card per approved profile, and these are not that.
            <div
              key={reason.title}
              className="flex h-full gap-5 rounded-2xl border border-ink-200 bg-white p-6 transition-[border-color,box-shadow] duration-150 hover:border-brand-200 hover:shadow-[0_12px_32px_-24px_rgba(18,26,36,0.4)]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-[22px] w-[22px]"
                >
                  {reason.icon}
                </svg>
              </span>
              <div>
                <h3 className="font-semibold text-ink-900">{reason.title}</h3>
                <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink-600">
                  {reason.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
