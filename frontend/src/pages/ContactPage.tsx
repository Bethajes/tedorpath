import { Link } from 'react-router-dom'

import { Container, PageShell } from '@/components/layout/PageShell'

export function ContactPage() {
  return (
    <PageShell>
      <Container className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-[-0.02em] text-ink-900 sm:text-4xl">Contact</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-600">
          The quickest way to reach us is to send a tutor request. Our team reviews every request
          and will contact you.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            to="/request-tutor"
            className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 py-3 text-[0.95rem] font-medium text-white shadow-sm transition-colors hover:bg-brand-700 sm:w-fit"
          >
            Request a Tutor
          </Link>
        </div>

        <div className="mt-10 rounded-2xl border border-ink-200 bg-ink-50 p-6 text-ink-600">
          <p className="font-medium text-ink-900">Looking for information first?</p>
          <p className="mt-1.5 leading-relaxed">
            Our <Link to="/about" className="text-brand-700 underline underline-offset-2">About</Link>{' '}
            page explains how Tedor Tutors works, and{' '}
            <Link
              to="/#how-it-works"
              className="text-brand-700 underline underline-offset-2"
            >
              How It Works
            </Link>{' '}
            walks through the three steps.
          </p>
        </div>
      </Container>
    </PageShell>
  )
}
