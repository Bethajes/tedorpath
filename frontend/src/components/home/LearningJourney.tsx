import { Container } from '@/components/layout/PageShell'

import './LearningJourney.css'

/**
 * The learner's path through the platform, told as a journey.
 *
 * This is the same idea as the hero graphic, repeated at a different scale: a
 * line that rises from left to right and finishes at an orange arrow. The hero
 * shows the metaphor abstractly because there is no product to demonstrate yet;
 * this section is where the four things that actually happen get named. Using
 * the same shape in both is the point — the reader should recognise the visual
 * as Tedor before they read the heading.
 *
 * `id="how-it-works"` stays on the section because the navbar and footer both
 * link to `/#how-it-works`. Renaming the component did not change the anchor,
 * because the anchor is a public URL, not an implementation detail.
 *
 * Every step below is something a person on the team does today. There is no
 * "instant match" and no "AI-powered matching" anywhere in this copy, because
 * there is no matching engine — the request is read by a person. (Previously
 * HowItWorks.)
 */

interface JourneyStep {
  title: string
  description: string
}

const STEPS: JourneyStep[] = [
  {
    title: 'Tell us what you want to learn',
    description:
      'Choose a subject, level, learning mode, and your goals. It takes about two minutes, and nothing is published.',
  },
  {
    title: 'Discover the right tutor',
    description:
      'Browse reviewed tutor profiles and compare their backgrounds, subjects, teaching styles, and availability.',
  },
  {
    title: 'Start learning',
    description:
      'Connect with your tutor online or in person, agree the times, and begin working toward what you came for.',
  },
  {
    title: 'Keep progressing',
    description:
      'Build knowledge, confidence, and skills one lesson at a time. Your next step is always the next session.',
  },
]

/**
 * The connector between two steps.
 *
 * Drawn as one element per gap rather than as a single stretched SVG behind the
 * whole row. An absolutely-positioned path was tried first and is the obvious
 * approach, but the cards sit on top of it: four opaque white panels at 100% of
 * a 1280px row left only 20px slivers visible between them and no orange arrow
 * at all, which is the opposite of the intent. Attaching the line to the gap it
 * actually spans makes it impossible for the cards to cover it, and it stays
 * correct at every width without measuring anything.
 *
 * `::after` carries a short dash that travels along the line. 14s over a
 * 150-unit pattern: slow enough to read as a current running up the path rather
 * than as a second marquee competing with the testimonial stream further down.
 */
function StepLink({ last }: { last: boolean }) {
  if (last) {
    // The logo's own arrow closes the sequence. On the final step rather than
    // after it, so the line never appears to run off the end of the section.
    return (
      <span
        aria-hidden="true"
        className="ml-3 hidden shrink-0 items-center sm:flex"
      >
        <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
          <path d="M1 7h12M8.5 2.2 13.4 7l-4.9 4.8" stroke="#f5801f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }

  return <span aria-hidden="true" className="lj-link mx-3 hidden h-px flex-1 sm:block" />
}

export function LearningJourney() {
  return (
    <section id="how-it-works" className="section-y bg-white" aria-labelledby="learning-journey-heading">
      <Container>
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-700">
            How Tedor works
          </p>
          <h2
            id="learning-journey-heading"
            className="mt-3 text-3xl font-bold tracking-[-0.02em] sm:text-4xl"
          >
            The Tedor Learning Journey
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-600">
            One path, four steps, and a person on our team at the start of it. Nothing here is
            automated, because matching a learner to a tutor is a judgement, not a lookup.
          </p>
        </div>

        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4 lg:gap-5">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex flex-col">
              {/*
                Badge and connector share a row so the line runs through the
                numerals rather than behind the panels. Every cell has the same
                badge row even where the connector is hidden, which is what keeps
                the four cards on one baseline at the `lg` breakpoint.
              */}
              <div className="mb-4 flex items-center">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-base font-semibold text-white"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <StepLink last={index === STEPS.length - 1} />
              </div>

              <div className="flex h-full flex-col rounded-2xl border border-ink-200 bg-white p-6 shadow-[0_1px_3px_rgba(18,26,36,0.05)]">
                <h3 className="text-lg font-semibold text-ink-900">{step.title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-600">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  )
}
