import { Link } from 'react-router-dom'

import { Container } from '@/components/layout/PageShell'
import { buildTutorRequestHref } from '@/lib/tutorRequestQuery'

export function CTASection() {
  return (
    <section className="bg-white pb-16 sm:pb-20 lg:pb-24">
      <Container>
        <div className="relative overflow-hidden rounded-3xl bg-brand-800 px-6 py-14 sm:px-12 sm:py-16 lg:px-16">
          {/* Restrained brand texture: a soft radial wash and the growth arc. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_85%_0%,#0d4f80_0%,#0b5f9f_45%,#104269_100%)]"
          />
          <svg
            aria-hidden="true"
            viewBox="0 0 420 260"
            preserveAspectRatio="xMaxYMax meet"
            className="pointer-events-none absolute bottom-0 right-4 h-auto w-[52%] opacity-45 sm:right-8 sm:w-[42%]"
          >
            <path
              d="M40 250C120 226 180 176 250 108"
              fill="none"
              stroke="#8acdf7"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path d="M282 76 218 122l28 8 20 28Z" fill="#f5801f" />
            <circle cx="40" cy="250" r="8" fill="#8acdf7" />
          </svg>

          <div className="relative max-w-2xl">
            <h2 className="text-3xl font-bold tracking-[-0.02em] text-white sm:text-4xl">
              Ready to find the right tutor?
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-brand-100">
              Tell us what you want to learn and what kind of support you need. Our team will
              review your request and get back to you.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to={buildTutorRequestHref()}
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3.5 text-base font-medium text-brand-800 shadow-sm transition-colors hover:bg-brand-50"
              >
                Find a Tutor
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
              <Link
                to="/about"
                className="inline-flex items-center justify-center rounded-lg border border-brand-500/60 px-6 py-3.5 text-base font-medium text-white transition-colors hover:border-white hover:bg-white/10"
              >
                Learn About Tedor
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
