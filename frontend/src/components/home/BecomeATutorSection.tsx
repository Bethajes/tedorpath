import { Link } from 'react-router-dom'

import { Container } from '@/components/layout/PageShell'
import { Reveal } from '@/components/ui/Reveal'

import '../brand/surfaces.css'

/**
 * Invitation for prospective tutors.
 *
 * This sits after FeaturedTutors and InternationalSection rather than in the
 * hero, because the page's job is to help a learner first (Requirement 9.4).
 *
 * The copy is careful about approval: applying does not publish a profile. A
 * reader should finish this section knowing there is a review in between,
 * otherwise "apply now" reads as "you are live now" and that is not how the
 * workflow works.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */
export function BecomeATutorSection() {
  return (
    <section className="section-y bg-white" aria-labelledby="become-a-tutor-heading">
      <Container>
        <div className="relative isolate grid items-center gap-10 overflow-hidden rounded-3xl border border-brand-200/60 bg-white p-8 shadow-[0_30px_60px_-46px_rgba(18,26,36,0.5)] sm:p-12 lg:grid-cols-[1.25fr_0.75fr] lg:gap-16 lg:p-14">
          {/* One decorative mark, in the air the two columns leave between them. */}
          <span
            aria-hidden="true"
            className="tt-shape tt-shape--square hidden lg:block"
          />

          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent-700">
              For tutors
            </p>
            <h2
              id="become-a-tutor-heading"
              className="mt-3 text-3xl font-bold tracking-[-0.025em] sm:text-4xl"
            >
              Share what you know. Help someone grow.
            </h2>
            <div className="mt-5 flex flex-col gap-4 text-lg leading-relaxed text-ink-600">
              <p>
                If you teach a subject well and you want to do it on your own terms, we would
                like to hear from you. Tell us what you teach, who you have taught, and how you
                prefer to work.
              </p>
              <p>
                Every application is reviewed by our team before a profile goes live. Some
                applicants are asked for more detail or supporting documents first, and it can
                take a little time. We will be in touch either way.
              </p>
            </div>
          </Reveal>

          <Reveal delay={100} className="flex flex-col items-start gap-4 lg:items-end">
            <Link
              to="/become-a-tutor"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-accent-500 px-6 py-3.5 text-base font-semibold text-white shadow-[0_14px_30px_-14px_rgba(245,128,31,0.9)] transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:bg-accent-400"
            >
              Become a Tutor
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform duration-200 group-hover:translate-x-1"
              >
                <path d="M2 8h11" />
                <path d="M9 4l4 4-4 4" />
              </svg>
            </Link>
            <p className="text-sm leading-relaxed text-ink-500 lg:text-right">
              Applications are reviewed before profiles are published.
            </p>
          </Reveal>
        </div>
      </Container>
    </section>
  )
}
