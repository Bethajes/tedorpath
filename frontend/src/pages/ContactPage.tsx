import { Link } from 'react-router-dom'

import { Container, PageShell } from '@/components/layout/PageShell'

export function ContactPage() {
  return (
    <PageShell>
      <Container className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Contact</h1>
        <p className="mt-3 text-slate-600">
          The quickest way to reach us is to send a tutor request. Our team reviews every request
          and will contact you.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            to="/request-tutor"
            className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-700 sm:w-fit"
          >
            Request a Tutor
          </Link>
        </div>

        <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
          <p className="font-medium text-slate-800">Looking for information first?</p>
          <p className="mt-1">
            Our <Link to="/about" className="text-brand-700 underline">About</Link> page explains
            how Tedor Tutors works.
          </p>
        </div>
      </Container>
    </PageShell>
  )
}
