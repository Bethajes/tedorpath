import { Link } from 'react-router-dom'

import { Container } from '@/components/layout/PageShell'

export function Hero() {
  return (
    <section className="bg-slate-50">
      <Container className="py-14 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
            Personalized tutoring
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            Learn Better. Find the Right Tutor.
          </h1>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Tedor Tutors connects students with tutors for personalized learning, online or in
            person.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/request-tutor"
              className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              Find a Tutor
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-800 transition-colors hover:bg-slate-50"
            >
              Learn More
            </a>
          </div>
        </div>
      </Container>
    </section>
  )
}
