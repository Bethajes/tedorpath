import { SectionHeading } from '@/components/sections/SectionHeading'
import { Reveal } from '@/components/ui/Reveal'

import '../brand/surfaces.css'

/**
 * Why a learner can rely on the platform.
 *
 * Carried by /about, in the page's reading column rather than as a full-width
 * band: the claim is one a reader takes on trust while deciding whether the
 * platform is worth their time, and the About page is where that decision is
 * made. It used to be the seventh section of the homepage, which asked for the
 * same belief before it had given the reader a reason.
 *
 * Every claim here is one the product can defend. The specific things this
 * section must NOT say, because the platform does not do them, are: background
 * checks, identity verification, accredited or certified tutors, guaranteed
 * results, and anything about ratings. Requirement 14.1 and the same constraint
 * as the tutor approval section the homepage used to carry, which described the
 * review that actually happens (now on /how-it-works).
 *
 * (Previously WhyTedor, then the homepage's TrustSection — the same component
 * under names that described the product rather than the reader's reason to
 * trust it, on a page the reader was not yet reading it on.)
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
    <section id="why-tedor" className="mt-12 scroll-mt-28" aria-labelledby="trust-heading">
      <SectionHeading
        id="trust-heading"
        eyebrow="Trust"
        lede="Four things that are true about how this platform works — not four things that would sound better."
      >
        Why learners trust Tedor
      </SectionHeading>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {REASONS.map((reason, index) => (
          // A <div>, not an <article>: HomePage.test.tsx counts tutor cards with a
          // bare `article` selector to prove FeaturedTutors renders one card per
          // approved profile, and these are not that.
          <Reveal
            key={reason.title}
            delay={index * 70}
            className="tt-card flex h-full gap-5 rounded-2xl border border-ink-200 bg-white p-6"
          >
            <span className="tt-card-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
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
          </Reveal>
        ))}
      </div>
    </section>
  )
}
