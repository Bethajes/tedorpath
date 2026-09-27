import { Container, PageShell } from '@/components/layout/PageShell'

export function AboutPage() {
  return (
    <PageShell>
      <Container className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          About Tedor Tutors
        </h1>

        <div className="mt-6 flex flex-col gap-4 text-slate-600">
          <p>
            Tedor Tutors connects students with tutors for personalized learning, online or in
            person.
          </p>
          <p>
            We keep the process simple. You share what you need help with, our team reviews your
            request, and we contact you to help you find a suitable tutor.
          </p>
          <p>
            Whether you are preparing for an exam, catching up on a subject, or building a new
            skill, tell us where you are and we will help you take the next step.
          </p>
        </div>

        <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-lg font-semibold text-slate-900">Ready to get started?</h2>
          <p className="mt-1 text-sm text-slate-600">
            Send us a request and our team will take it from there.
          </p>
          <a
            href="/request-tutor"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            Find a Tutor
          </a>
        </div>
      </Container>
    </PageShell>
  )
}
