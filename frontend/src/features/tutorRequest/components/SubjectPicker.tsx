import { useId, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * A multi-select set of subjects, grouped by category.
 *
 * Checkboxes rather than toggle buttons for the same reason the single-select
 * uses radios: the count and the grouping are only meaningful to assistive
 * technology if the controls are real checkboxes inside real fieldsets.
 *
 * `suggested` items are rendered first under their own heading. They are a
 * starting point, not a limit — the rest of the catalogue follows — and the
 * heading says so, because a client who cannot find their subject would
 * otherwise assume it is not available.
 */
export interface SubjectGroupSection {
  category: string
  subjects: ReadonlyArray<{ id: string; name: string; description: string | null }>
}

export interface SubjectPickerProps {
  legend: string
  hint?: string
  error?: string
  /** Shown first, under its own heading, when a level was chosen in step 2. */
  suggested: ReadonlyArray<{ id: string; name: string; description: string | null }>
  suggestedHeading?: string
  groups: readonly SubjectGroupSection[]
  selected: readonly string[]
  onToggle: (id: string) => void
  /** Revealed once `Other` is ticked; the catalogue's escape hatch. */
  children?: ReactNode
}

export function SubjectPicker({
  legend,
  hint,
  error,
  suggested,
  suggestedHeading,
  groups,
  selected,
  onToggle,
  children,
}: SubjectPickerProps) {
  const groupId = useId()
  const hintId = `${groupId}-hint`
  const errorId = `${groupId}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  const toggle = (subjectId: string) => onToggle(subjectId)

  return (
    <fieldset aria-describedby={describedBy || undefined} className="min-w-0">
      <legend className="text-sm font-medium text-ink-800">
        {legend}
        <span className="ml-1 text-red-600" aria-hidden="true">
          *
        </span>
      </legend>

      {hint ? (
        <p id={hintId} className="mt-1 text-xs text-ink-500">
          {hint}
        </p>
      ) : null}

      <div className="mt-4 space-y-6">
        {suggested.length > 0 ? (
          <section aria-label={suggestedHeading ?? 'Suggested subjects'}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
              {suggestedHeading ?? 'Suggested for you'}
            </p>
            <SubjectChips
              groupId={groupId}
              subjects={suggested}
              selected={selected}
              onToggle={toggle}
            />
          </section>
        ) : null}

        {groups.map((group) => (
          <section key={group.category} aria-label={group.category}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
              {group.category}
            </p>
            <SubjectChips
              groupId={groupId}
              subjects={group.subjects}
              selected={selected}
              onToggle={toggle}
            />
          </section>
        ))}
      </div>

      {children ? <div className="mt-5">{children}</div> : null}

      {error ? (
        <p id={errorId} role="alert" className="mt-3 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}

      <p aria-live="polite" className="mt-4 text-sm text-ink-500">
        {selected.length === 0
          ? 'No subjects selected yet.'
          : `${selected.length} subject${selected.length === 1 ? '' : 's'} selected.`}
      </p>
    </fieldset>
  )
}

interface SubjectChipsProps {
  groupId: string
  subjects: ReadonlyArray<{ id: string; name: string; description: string | null }>
  selected: readonly string[]
  onToggle: (id: string) => void
}

function SubjectChips({ groupId, subjects, selected, onToggle }: SubjectChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {subjects.map((subject) => {
        const isSelected = selected.includes(subject.id)
        return (
          <label
            key={subject.id}
            htmlFor={`${groupId}-${subject.id}`}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors',
              isSelected
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-ink-200 bg-white text-ink-800 hover:border-brand-400 hover:bg-brand-50',
            )}
          >
            <input
              id={`${groupId}-${subject.id}`}
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggle(subject.id)}
              className="h-4 w-4 shrink-0 accent-[var(--color-brand-600)]"
            />
            <span>{subject.name}</span>
          </label>
        )
      })}
    </div>
  )
}