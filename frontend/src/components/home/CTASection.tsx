import { Link } from 'react-router-dom'

import { Container } from '@/components/layout/PageShell'

export function CTASection() {
  return (
    <section className="bg-brand-700">
      <Container className="py-14 sm:py-16">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Ready to start learning?
          </h2>
          <p className="mt-3 text-brand-50">
            Send us your tutoring request and our team will get back to you.
          </p>
          <Link
            to="/request-tutor"
            className="mt-7 inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-base font-medium text-brand-700 transition-colors hover:bg-brand-50"
          >
            Find a Tutor
          </Link>
        </div>
      </Container>
    </section>
  )
}
