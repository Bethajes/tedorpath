import { Container } from '@/components/layout/PageShell'

/**
 * Reasons to choose Tedor. Every one of these describes something the product
 * genuinely does today — no invented counts, ratings or success rates.
 */
const REASONS = [
  {
    title: 'Personalized Support',
    description:
      'Your learning needs are not the same as anyone else’s. Tell us what you are looking for and we will help you find support that fits your goals and pace.',
    icon: (
      <>
        <circle cx="12" cy="8" r="3.4" />
        <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
      </>
    ),
  },
  {
    title: 'Online or In Person',
    description:
      'Choose the learning mode that works for you. Share your preference when you make your request and we will look for the right fit.',
    icon: (
      <>
        <rect x="3" y="4.5" width="14" height="10" rx="1.6" />
        <path d="M8 19h4" />
      </>
    ),
  },
  {
    title: 'Tutors for Different Learning Goals',
    description:
      'School subjects, university courses, technology and exam preparation — tell us where you are and what you are working towards.',
    icon: (
      <>
        <path d="M3 7.5 12 3.5l9 4-9 4Z" />
        <path d="M7 9.8V15c0 1.5 2.2 2.8 5 2.8s5-1.3 5-2.8V9.8" />
      </>
    ),
  },
  {
    title: 'A Simple Process',
    description:
      'No account to create and nothing to compare. Send your request, we review it, and we help you move forward.',
    icon: (
      <>
        <path d="M4 6.5h11" />
        <path d="M4 12h11" />
        <path d="M4 17.5h7" />
        <path d="m15 15.5 2 2 3.5-4" />
      </>
    ),
  },
]

export function WhyTedor() {
  return (
    <section id="why-tedor" className="section-y bg-white">
      <Container>
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-accent-700">
            Why Tedor
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
            Why learn with Tedor?
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-600">
            We are building a tutoring marketplace around a simple idea: the right guidance
            depends on who you are and what you are trying to do.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {REASONS.map((reason) => (
            <article
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
            </article>
          ))}
        </div>
      </Container>
    </section>
  )
}
