import { Container } from '@/components/layout/PageShell'
import { SectionDivider, SectionHeading } from '@/components/sections/SectionHeading'
import { Reveal } from '@/components/ui/Reveal'

import { CheckIcon, ClockIcon, StepIcon } from './HowItWorksIcons'
import { STEPS } from './howItWorksContent'

import './HowItWorks.css'

/**
 * The three steps, as three cards on one row.
 *
 * The connector is drawn per gap rather than as a single line stretched behind
 * the whole row. An absolutely positioned path was tried first and is the
 * obvious approach, but three opaque white panels across a 1280px row left only
 * a few pixels of line visible between them — attaching it to the gap it
 * actually spans means a card can never cover it, at any width, without
 * measuring anything.
 *
 * The badge carries the position visually and is `aria-hidden`; the order is
 * announced by the parent `<ol>` instead, so a screen reader hears "list, 3
 * items" rather than a stray "01".
 */
export function HowItWorksSteps() {
  return (
    <section aria-labelledby="steps-heading" className="section-y bg-white">
      <Container>
        {/* The seam between the navy hero and this white section. */}
        <SectionDivider />

        <SectionHeading
          id="steps-heading"
          eyebrow="The three steps"
          lede="We do the searching, the checking and the scheduling. You tell us what you need and turn up to the lesson."
        >
          From request to first lesson
        </SectionHeading>

        <ol className="mt-12 grid gap-7 sm:grid-cols-2 sm:gap-6 lg:mt-14 lg:grid-cols-3 lg:gap-6">
          {STEPS.map((step, index) => (
            <Reveal
              as="li"
              key={step.number}
              delay={index * 90}
              className="flex flex-col"
            >
              <div className="mb-5 flex items-center">
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink-900 text-[0.95rem] font-bold tracking-tight text-white"
                >
                  {step.number}
                </span>
                {index < STEPS.length - 1 ? (
                  <span aria-hidden="true" className="tt-connector mx-4 hidden sm:block" />
                ) : null}
              </div>

              <div className="tt-card flex h-full flex-col rounded-2xl border border-ink-200 bg-white p-7 shadow-[0_1px_3px_rgba(18,26,36,0.05)]">
                <span className="tt-card-icon flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                  <StepIcon id={step.icon} className="h-7 w-7" />
                </span>

                <h3 className="mt-6 text-xl font-bold tracking-[-0.02em] text-ink-900">
                  {step.title}
                </h3>

                <p className="mt-2.5 inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                  <ClockIcon className="h-4 w-4 shrink-0" />
                  {step.meta}
                </p>

                <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-600">
                  {step.description}
                </p>

                <ul className="mt-auto flex flex-wrap gap-2 border-t border-ink-100 pt-6">
                  {step.points.map((point) => (
                    <li
                      key={point}
                      className="inline-flex items-center gap-1.5 rounded-full bg-ink-50 px-3 py-1.5 text-xs font-medium text-ink-600 ring-1 ring-ink-200/80"
                    >
                      <CheckIcon className="h-3 w-3 text-brand-600" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  )
}
