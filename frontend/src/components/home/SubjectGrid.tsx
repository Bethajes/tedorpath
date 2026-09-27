import { Link } from 'react-router-dom'

import { Container } from '@/components/layout/PageShell'
import { SUBJECTS } from '@/features/tutorRequest/tutorRequest.constants'

export function SubjectGrid() {
  return (
    <section id="subjects" className="bg-white">
      <Container className="py-14 sm:py-16">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Subjects we cover
        </h2>
        <p className="mt-3 max-w-2xl text-slate-600">
          Tell us what you are working on and we will help you find a tutor who can help.
        </p>

        <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SUBJECTS.map((subject) => (
            <li key={subject}>
              <Link
                to="/request-tutor"
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3.5 text-slate-800 transition-colors hover:border-brand-300 hover:bg-brand-50"
              >
                <span className="font-medium">{subject}</span>
                <span aria-hidden="true" className="text-slate-400">
                  &rarr;
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
