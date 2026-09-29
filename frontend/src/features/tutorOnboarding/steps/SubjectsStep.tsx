/**
 * Step 2 — Teaching Subjects
 * Multi-select from active subjects fetched from the API.
 *
 * Requirements: 11.2, 1.4, 1.5
 */

import { useCallback } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useAsyncData } from '@/lib/useAsyncData'
import { getJson, ApiError } from '@/lib/api'
import type { OnboardingFormData, SubjectOption } from '../tutorOnboarding.types'

interface SubjectsStepProps {
  form: UseFormReturn<OnboardingFormData>
}

function loadSubjects(): Promise<SubjectOption[]> {
  return getJson<SubjectOption[]>('/api/subjects')
}

function mapLoadError(err: unknown): string {
  if (err instanceof ApiError) return err.message
  return 'Could not load subjects. Please try again.'
}

export function SubjectsStep({ form }: SubjectsStepProps) {
  const { watch, setValue, formState: { errors } } = form
  const selectedIds = watch('subjectIds')

  const load = useCallback(() => loadSubjects(), [])
  const { data: subjects, loading, error } = useAsyncData<SubjectOption[]>(load, [], mapLoadError)

  function toggleSubject(id: string) {
    if (selectedIds.includes(id)) {
      setValue('subjectIds', selectedIds.filter((s) => s !== id), { shouldValidate: true })
    } else {
      setValue('subjectIds', [...selectedIds, id], { shouldValidate: true })
    }
  }

  // Group subjects by category for a cleaner presentation
  const groupedSubjects: Record<string, SubjectOption[]> = {}
  if (subjects) {
    for (const subject of subjects) {
      if (!groupedSubjects[subject.category]) {
        groupedSubjects[subject.category] = []
      }
      groupedSubjects[subject.category].push(subject)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-ink-200 bg-white shadow-sm">
        <div className="border-b border-ink-100 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-ink-900">Teaching Subjects</h2>
          <p className="mt-1 text-sm text-ink-600">
            Select all the subjects you are qualified to teach. At least one is required.
          </p>
        </div>

        <div className="px-5 py-6 sm:px-6">
          {loading && (
            <p role="status" className="text-sm text-ink-500">
              Loading subjects…
            </p>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          {!loading && !error && subjects && (
            <div
              role="group"
              aria-label="Teaching subjects"
              className="space-y-6"
            >
              {Object.entries(groupedSubjects).map(([category, categorySubjects]) => (
                <div key={category}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
                    {category}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {categorySubjects.map((subject) => {
                      const selected = selectedIds.includes(subject.id)
                      return (
                        <button
                          key={subject.id}
                          type="button"
                          onClick={() => toggleSubject(subject.id)}
                          aria-pressed={selected}
                          className={[
                            'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                            selected
                              ? 'border-brand-600 bg-brand-600 text-white'
                              : 'border-ink-200 bg-white text-ink-700 hover:border-brand-400 hover:bg-brand-50',
                          ].join(' ')}
                        >
                          {subject.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {errors.subjectIds && (
            <p role="alert" className="mt-3 text-xs font-medium text-red-600">
              {errors.subjectIds.message}
            </p>
          )}

          {selectedIds.length > 0 && (
            <p className="mt-4 text-sm text-ink-500">
              {selectedIds.length} subject{selectedIds.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
