import { Link } from 'react-router-dom'
import { Container } from '@/components/layout/PageShell'
import { Reveal } from '@/components/ui/Reveal'

import '../brand/surfaces.css'

/**
 * Final call to action, after every section has had its say.
 *
 * Two doors, deliberately: most visitors arrived to find a tutor, and a smaller
 * number arrived to teach one. Neither is styled as the secondary option that
 * does not matter.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */
export function CTASection() {
  return (
    <section className="bg-white pb-16 sm:pb-20 lg:pb-24">
      <Container>
        <Reveal className="tt-hero relative isolate overflow-hidden rounded-3xl px-6 py-14 sm:px-12 sm:py-16 lg:px-16">
          <div aria-hidden="true" className="tt-grid" />

          <div className="relative max-w-2xl">
            <h2 className="text-3xl font-bold tracking-[-0.02em] text-white sm:text-4xl">
              Ready to find your tutor?
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-brand-100">
              Tell us what you want to learn and what kind of support you need. Our team will
              review your request and get back to you.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link to="/tutors" className="group inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-brand-800 transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-brand-50">
                Find a Tutor
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-hover:translate-x-1">
                  <path d="M2 8h11" /><path d="M9 4l4 4-4 4" />
                </svg>
              </Link>
              <Link to="/become-a-tutor" className="inline-flex items-center justify-center rounded-xl border border-brand-500/60 px-6 py-3.5 text-base font-semibold text-white transition-[background-color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-white hover:bg-white/10">
                Become a Tutor
              </Link>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
