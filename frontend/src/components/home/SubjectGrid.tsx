import { Link } from 'react-router-dom'

import { Container } from '@/components/layout/PageShell'

import { SubjectIcon } from './SubjectIcon'
import { OTHER_SUBJECT_ENTRY, SUBJECT_GROUPS, type SubjectEntry } from './subjectCatalog'

function SubjectLink({ entry }: { entry: SubjectEntry }) {
  return (
    <li>
      <Link
        to={`/tutors?subject=${entry.slug}`}
        className="group/subject flex items-start gap-3 rounded-lg border border-transparent p-3 -mx-3 transition-colors hover:border-ink-200 hover:bg-white hover:shadow-[0_6px_20px_-16px_rgba(18,26,36,0.5)]"
      >
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand-700 ring-1 ring-brand-100 transition-colors group-hover/subject:bg-brand-600 group-hover/subject:text-white group-hover/subject:ring-brand-600">
          <SubjectIcon subject={entry.subject} className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 font-medium text-ink-900">
            {entry.subject}
            <svg
              aria-hidden="true"
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="-translate-x-1 text-ink-300 opacity-0 transition-all duration-150 group-hover/subject:translate-x-0 group-hover/subject:text-brand-600 group-hover/subject:opacity-100"
            >
              <path d="M2 8h11" />
              <path d="M9 4l4 4-4 4" />
            </svg>
          </span>
          <span className="mt-0.5 block text-sm leading-relaxed text-ink-500">
            {entry.description}
          </span>
        </span>
      </Link>
    </li>
  )
}

/**
 * Subject discovery.
 *
 * Subjects are grouped into categories rather than shown as one flat list, and
 * each category is a full-width row so the groups stay readable no matter how
 * many subjects they hold. Every subject links into the request form with that
 * subject already selected.
 */
export function SubjectGrid() {
  return (
    <section id="subjects" className="section-y bg-white">
      <Container>
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
            What do you want to learn?
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-600">
            Find support across school subjects, university courses, technology and exam
            preparation. Pick a subject and we will take it from there.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-ink-200 bg-ink-50/60">
          {SUBJECT_GROUPS.map((group, index) => (
            <div
              key={group.id}
              className={[
                'grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,17rem)_1fr] lg:gap-10',
                index > 0 ? 'border-t border-ink-200' : '',
              ].join(' ')}
            >
              <div>
                <h3 className="text-lg font-semibold text-ink-900">{group.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
                  {group.summary}
                </p>
                <Link
                  to="/request-tutor"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 transition-colors hover:text-brand-800"
                >
                  Request a tutor
                  <svg
                    aria-hidden="true"
                    width="15"
                    height="15"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 8h11" />
                    <path d="M9 4l4 4-4 4" />
                  </svg>
                </Link>
              </div>

              <ul className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
                {group.subjects.map((entry) => (
                  <SubjectLink key={entry.subject} entry={entry} />
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-accent-200 bg-accent-50/60 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-accent-700 ring-1 ring-accent-200">
              <SubjectIcon subject={OTHER_SUBJECT_ENTRY.subject} className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold text-ink-900">Looking for something else?</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-600">
                {OTHER_SUBJECT_ENTRY.description}
              </p>
            </div>
          </div>
          <Link
            to="/request-tutor"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-accent-300 bg-white px-4 py-2.5 text-sm font-medium text-accent-700 transition-colors hover:border-accent-400 hover:bg-accent-50"
          >
            Tell us what you need
          </Link>
        </div>
      </Container>
    </section>
  )
}
