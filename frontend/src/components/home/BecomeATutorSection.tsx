import { Link } from 'react-router-dom'

import { Container } from '@/components/layout/PageShell'

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
        <div className="grid items-center gap-10 rounded-3xl border border-ink-200 bg-ink-50 p-8 sm:p-12 lg:grid-cols-[1.25fr_0.75fr] lg:gap-16 lg:p-14">
          <div>
            <h2
              id="become-a-tutor-heading"
              className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl"
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
                applicants are asked for more detail or supporting documents first, and it can take
                a little time. We will be in touch either way.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start gap-4 lg:items-end">
            <Link
              to="/become-a-tutor"
              className="group inline-flex items-center justify-center gap-2 rounded-lg bg-accent-500 px-6 py-3.5 text-base font-medium text-white shadow-sm transition-colors hover:bg-accent-600"
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
                className="transition-transform duration-150 group-hover:translate-x-0.5"
              >
                <path d="M2 8h11" />
                <path d="M9 4l4 4-4 4" />
              </svg>
            </Link>
            <p className="text-sm leading-relaxed text-ink-500 lg:text-right">
              Applications are reviewed before profiles are published.
            </p>
          </div>
        </div>
      </Container>
    </section>
  )
}
