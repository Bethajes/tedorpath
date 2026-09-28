import { useSearchParams } from 'react-router-dom'

import { Container, PageShell } from '@/components/layout/PageShell'
import { TutorRequestForm } from '@/features/tutorRequest/TutorRequestForm'
import { parseTutorRequestPrefill } from '@/lib/tutorRequestQuery'

export function RequestTutorPage() {
  const [searchParams] = useSearchParams()
  const { subject, educationLevel, learningMode } = parseTutorRequestPrefill(
    searchParams.toString(),
  )

  const carriedOver: { label: string; value: string }[] = []
  if (subject) carriedOver.push({ label: 'Subject', value: subject })
  if (educationLevel) carriedOver.push({ label: 'Level', value: educationLevel })
  if (learningMode) carriedOver.push({ label: 'Learning mode', value: learningMode })

  return (
    <PageShell>
      <Container className="max-w-3xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-ink-900 sm:text-4xl">
            Request a Tutor
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-ink-600">
            Tell us what you need and our team will review your request and get back to you. It
            takes about two minutes, and only the fields marked with{' '}
            <span className="text-red-600">*</span> are required.
          </p>

          {carriedOver.length > 0 ? (
            <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50/60 p-5">
              <p className="text-sm font-semibold text-ink-900">
                We carried over your choices
              </p>
              <p className="mt-1 text-sm text-ink-600">
                Change anything below before you send the request.
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {carriedOver.map((item) => (
                  <li
                    key={item.label}
                    className="rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-sm"
                  >
                    <span className="text-ink-500">{item.label}:</span>{' '}
                    <span className="font-medium text-ink-900">{item.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </header>

        <TutorRequestForm />
      </Container>
    </PageShell>
  )
}
