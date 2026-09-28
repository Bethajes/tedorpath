import { Container } from '@/components/layout/PageShell'

/**
 * The three steps of the current, entirely manual workflow. The copy
 * deliberately describes what the product actually does today: a person reads
 * the request and follows up. No matching engine is implied.
 */
const STEPS = [
  {
    title: 'Tell Us What You Need',
    description:
      'Tell us the subject, the level, how you prefer to learn, and what you need help with. It takes about two minutes.',
  },
  {
    title: 'We Review Your Request',
    description:
      'Our team reads your requirements and looks for a tutor whose subject knowledge and experience fit what you need.',
  },
  {
    title: 'Start Learning',
    description:
      'We contact you and help you arrange the tutoring experience — online or in person, at a pace that works for you.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="section-y bg-ink-50">
      <Container>
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-700">
            How Tedor works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
            Three steps, no guesswork
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-600">
            You describe what you need. A person on our team reads it and helps you get to the
            right tutor.
          </p>
        </div>

        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="relative flex h-full flex-col rounded-2xl border border-ink-200 bg-white p-6"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-base font-semibold text-white"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                {index < STEPS.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="hidden h-px flex-1 bg-gradient-to-r from-brand-200 to-transparent md:block"
                  />
                ) : null}
              </div>

              <h3 className="mt-5 text-lg font-semibold text-ink-900">{step.title}</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-600">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  )
}
