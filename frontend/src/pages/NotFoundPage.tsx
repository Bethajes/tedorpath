import { Link } from 'react-router-dom'

import { Container, PageShell } from '@/components/layout/PageShell'

export function NotFoundPage() {
  return (
    <PageShell>
      <Container className="max-w-xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-700">404</p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.02em] text-ink-900 sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-600">
          The page you are looking for does not exist or has moved.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg border border-ink-200 bg-white px-5 py-2.5 text-[0.95rem] font-medium text-ink-800 transition-colors hover:bg-ink-50"
          >
            Back to home
          </Link>
          <Link
            to="/request-tutor"
            className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 py-2.5 text-[0.95rem] font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            Find a Tutor
          </Link>
        </div>
      </Container>
    </PageShell>
  )
}
