import { Link } from 'react-router-dom'

import { Container } from '@/components/layout/PageShell'
import { SectionHeading } from '@/components/sections/SectionHeading'
import { Reveal } from '@/components/ui/Reveal'

import { ArrowRightIcon, ChevronIcon } from './HowItWorksIcons'
import { FAQS } from './howItWorksContent'

/**
 * The questions people actually ask, in the order they ask them.
 *
 * Native `<details>`/`<summary>` rather than a scripted accordion: it is
 * keyboard-operable and findable by the browser's own in-page search for free,
 * it works without JavaScript, and each answer is in the document for search
 * engines either way. The chevron rotation is the only decoration, driven by
 * `group-open`.
 *
 * Every answer here is checked against what the platform does. There is no
 * mention of background checks, of certified tutors or of guaranteed results,
 * and no response-time promise the team has not measured (Requirements 5.4,
 * 14.1).
 */
export function HowItWorksFaq() {
  return (
    <section aria-labelledby="faq-heading" className="section-y bg-white">
      <Container className="max-w-3xl">
        <SectionHeading
          id="faq-heading"
          eyebrow="Questions"
          align="center"
          lede="The five things learners ask us most before they send a request."
        >
          Frequently asked questions
        </SectionHeading>

        <div className="mt-12 grid gap-3 sm:gap-4">
          {FAQS.map((faq, index) => (
            <Reveal as="div" key={faq.question} delay={index * 60}>
              <details className="tt-faq group rounded-2xl border border-ink-200 bg-white px-5 py-5 marker:hidden open:pb-6 sm:px-7">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-5 text-left text-[1.05rem] font-semibold leading-snug text-ink-900 transition-colors duration-200 hover:text-brand-700 [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-500 ring-1 ring-ink-200 transition-[background-color,color,transform] duration-300 group-hover:bg-brand-50 group-hover:text-brand-700 group-open:rotate-180 group-open:bg-brand-600 group-open:text-white group-open:ring-brand-600"
                  >
                    <ChevronIcon className="h-4 w-4" />
                  </span>
                </summary>
                <p className="mt-4 max-w-2xl leading-relaxed text-ink-600">{faq.answer}</p>
              </details>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120} className="mt-10 text-center">
          <p className="text-ink-600">
            Still not sure?{' '}
            <Link
              to="/contact"
              className="group inline-flex items-center gap-1.5 font-semibold text-brand-700 transition-colors hover:text-brand-800"
            >
              Ask us directly
              <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </p>
        </Reveal>
      </Container>
    </section>
  )
}
