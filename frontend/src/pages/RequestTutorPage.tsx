import { Container, PageShell } from '@/components/layout/PageShell'
import { TutorRequestForm } from '@/features/tutorRequest/TutorRequestForm'

export function RequestTutorPage() {
  return (
    <PageShell>
      <Container className="max-w-3xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Request a Tutor
          </h1>
          <p className="mt-3 text-slate-600">
            Tell us what you need and our team will review your request and get back to you. It
            takes about two minutes, and only the fields marked with{' '}
            <span className="text-red-600">*</span> are required.
          </p>
        </header>

        <TutorRequestForm />
      </Container>
    </PageShell>
  )
}
