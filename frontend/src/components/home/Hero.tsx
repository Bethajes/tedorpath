import { useRef } from 'react'

import { Container } from '@/components/layout/PageShell'

import { TedorLearningGraphic } from './TedorLearningGraphic'
import { TutorSearchCard } from './TutorSearchCard'

/** Factual, checkable reasons to start here — deliberately no numbers. */
const TRUST_POINTS = [
  'Reviewed by our team, not an algorithm',
  'Online or in person',
  'School, university and technology subjects',
]

export function Hero() {
  // The whole section drives the graphic's parallax, so the movement reads as
  // the hero responding rather than one floating card.
  const sectionRef = useRef<HTMLElement>(null)

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-gradient-to-b from-brand-50/70 via-white to-white"
    >
      <Container className="grid items-center gap-12 py-14 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-brand-700 ring-1 ring-brand-200">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-500" />
            Find the right tutor
          </p>

          <h1 className="mt-5 text-[2.5rem] font-bold leading-[1.08] tracking-[-0.03em] text-ink-900 sm:text-[3.25rem] lg:text-[3.5rem]">
            Learn Better. <br />
            Find the Right Tutor.
          </h1>

          <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-600">
            Tell us what you want to learn and we'll help you find a tutor who fits — the
            subject, the level, and the way you prefer to study.
          </p>

          <div className="mt-8 max-w-xl">
            <TutorSearchCard />
          </div>

          <ul className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
            {TRUST_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2 text-sm text-ink-600">
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  className="mt-0.5 shrink-0"
                >
                  <circle cx="9" cy="9" r="9" fill="#eff8fe" />
                  <path
                    d="M5 9.2l2.6 2.6L13 6.5"
                    stroke="#0f78c4"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:pl-2">
          <TedorLearningGraphic parallaxHost={sectionRef} />
        </div>
      </Container>
    </section>
  )
}
