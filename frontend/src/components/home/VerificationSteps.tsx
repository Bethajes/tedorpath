import { Link } from 'react-router-dom'

import { Container } from '@/components/layout/PageShell'

/**
 * How a tutor profile gets published.
 *
 * The wording is constrained by what the platform actually does. Review is done
 * by a person, over a period of time, and it can end in a request for more
 * information — so this section must not say "automatically verified",
 * "instant verification", "background checked" or "certified", none of which
 * would be true. Each step below describes a step that exists in the workflow.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

interface VerificationStep {
  title: string
  description: string
}

const STEPS: VerificationStep[] = [
  {
    title: 'Tutors apply',
    description:
      'A tutor submits their profile: the subjects they teach, their experience, their education background, and how they prefer to work.',
  },
  {
    title: 'We review',
    description:
      'Our team reads the application for completeness, relevant teaching experience, and education background.',
  },
  {
    title: 'Credentials are reviewed',
    description:
      'Where we need supporting documents, we ask for them through the contact channels given during the application, and a person on the team reviews what arrives.',
  },
  {
    title: 'Approved profiles go live',
    description:
      'Only applications that pass review are published. If something is missing we ask for it first — nothing is listed while it is outstanding.',
  },
]

export function VerificationSteps() {
  return (
    <section id="how-it-works" className="section-y bg-ink-50" aria-labelledby="verification-steps-heading">
      <Container>
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-700">
            Tutor approval
          </p>
          <h2 id="verification-steps-heading" className="mt-3 text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
            How we build a trusted tutor community
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-600">
            Anyone can apply to teach. Not everyone gets listed. This is the whole process, start
            to finish, and it is done by our team rather than by a scoring system.
          </p>
        </div>

        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex h-full flex-col rounded-2xl border border-ink-200 bg-white p-6 shadow-[0_1px_3px_rgba(18,26,36,0.05)]"
            >
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-base font-semibold text-white"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              {/* The visual number is aria-hidden, so the position is announced
                  through the list semantics of the parent <ol> instead. */}
              <h3 className="mt-5 text-lg font-semibold text-ink-900">{step.title}</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-600">{step.description}</p>
            </li>
          ))}
        </ol>

        <p className="mt-8">
          <Link
            to="/become-a-tutor"
            className="group inline-flex items-center gap-2 text-base font-medium text-brand-700 transition-colors hover:text-brand-800"
          >
            Learn how tutor approval works
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
        </p>
      </Container>
    </section>
  )
}
