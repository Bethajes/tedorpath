import { useEffect, useRef, type ChangeEvent } from 'react'

import { Field, Input, Select } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { EDUCATION_LEVELS } from '@/types/tutorRequest'

import type { TeachingMode, TutorFilters } from '../tutors.types'
import { TEACHING_MODES } from '../tutors.types'

/**
 * The set of subjects seeded in the database, ordered as in the backend
 * SUBJECTS constant. A real implementation could fetch
 * `GET /api/subjects?active=true` and render whatever the server returns, but
 * that would require a loader and a loading state here. Because the list is
 * stable (it mirrors the backend seed data), it is defined as a constant so
 * the filter panel renders immediately without waiting for an extra fetch.
 *
 * Each entry carries the slug sent to the API and the label shown to the user.
 */
const SUBJECT_OPTIONS: { slug: string; label: string }[] = [
  { slug: 'mathematics', label: 'Mathematics' },
  { slug: 'physics', label: 'Physics' },
  { slug: 'chemistry', label: 'Chemistry' },
  { slug: 'biology', label: 'Biology' },
  { slug: 'english', label: 'English' },
  { slug: 'programming', label: 'Programming' },
  { slug: 'ai-technology', label: 'AI & Technology' },
  { slug: 'university-course', label: 'University Course' },
  { slug: 'exam-preparation', label: 'Exam Preparation' },
  { slug: 'other', label: 'Other' },
]

const TEACHING_MODE_LABELS: Record<TeachingMode, string> = {
  ONLINE: 'Online',
  IN_PERSON: 'In person',
  BOTH: 'Online & in person',
}

export interface FilterPanelProps {
  /** Current filter values, controlled from the parent page. */
  filters: TutorFilters
  /**
   * Called whenever the user changes any filter control.
   * The parent is responsible for fetching new results; this component never
   * fetches directly (Requirements 8.7, 8.8).
   */
  onChange: (filters: TutorFilters) => void
  /**
   * Mobile-only: whether the drawer is currently open.
   * On desktop (md+) this prop has no effect — the panel is always visible.
   */
  isOpen?: boolean
  /**
   * Mobile-only: called when the user closes the drawer (Escape key or the
   * close button).
   */
  onClose?: () => void
}

/**
 * Sidebar / drawer filter panel for the tutor directory.
 *
 * Desktop (md+): renders as a sticky sidebar in the page layout.
 * Mobile (< md): renders as a slide-in bottom sheet triggered by the parent's
 * "Filters" button, controlled via `isOpen` / `onClose`.
 *
 * Every control calls `onChange` with the full updated `TutorFilters` object;
 * the panel never directly fetches. The parent page wires the callback to its
 * own state and kicks off the API call (Requirements 8.7, 8.8).
 *
 * Requirements: 8.7, 8.8, 10.1–10.5
 */
export function FilterPanel({ filters, onChange, isOpen = false, onClose }: FilterPanelProps) {
  /** Merge one changed key into the existing filter object. */
  function update<K extends keyof TutorFilters>(key: K, value: TutorFilters[K]) {
    onChange({ ...filters, [key]: value })
  }

  function handleSubjectChange(e: ChangeEvent<HTMLSelectElement>) {
    update('subject', e.target.value || undefined)
  }

  function handleLevelChange(e: ChangeEvent<HTMLSelectElement>) {
    update('studentLevel', (e.target.value as TutorFilters['studentLevel']) || undefined)
  }

  function handleModeChange(e: ChangeEvent<HTMLSelectElement>) {
    update('mode', (e.target.value as TeachingMode) || undefined)
  }

  function handleLocationChange(e: ChangeEvent<HTMLInputElement>) {
    update('location', e.target.value || undefined)
  }

  function handleMinRateChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    update('minRate', raw === '' ? undefined : Number(raw))
  }

  function handleMaxRateChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    update('maxRate', raw === '' ? undefined : Number(raw))
  }

  function clearAll() {
    onChange({})
  }

  const hasActiveFilters =
    Boolean(filters.subject) ||
    Boolean(filters.studentLevel) ||
    Boolean(filters.mode) ||
    Boolean(filters.location) ||
    filters.minRate !== undefined ||
    filters.maxRate !== undefined

  // ---------------------------------------------------------------------------
  // Keyboard: close drawer on Escape
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Focus trap: move focus into the panel when the drawer opens on mobile
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (isOpen && panelRef.current) {
      // Slight delay so the CSS transition has started before we steal focus
      const id = setTimeout(() => {
        const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        firstFocusable?.focus()
      }, 50)
      return () => clearTimeout(id)
    }
  }, [isOpen])

  // ---------------------------------------------------------------------------
  // Controls — shared between the sidebar and the drawer
  // ---------------------------------------------------------------------------
  const controls = (
    <div className="flex flex-col gap-5">
      {/* Subject */}
      <Field id="filter-subject" label="Subject">
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={filters.subject ?? ''}
            onChange={handleSubjectChange}
            aria-label="Filter by subject"
          >
            <option value="">All subjects</option>
            {SUBJECT_OPTIONS.map(({ slug, label }) => (
              <option key={slug} value={slug}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {/* Student level */}
      <Field id="filter-level" label="Student Level">
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={filters.studentLevel ?? ''}
            onChange={handleLevelChange}
            aria-label="Filter by student level"
          >
            <option value="">All levels</option>
            {EDUCATION_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {/* Teaching mode */}
      <Field id="filter-mode" label="Teaching Mode">
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={filters.mode ?? ''}
            onChange={handleModeChange}
            aria-label="Filter by teaching mode"
          >
            <option value="">Any mode</option>
            {TEACHING_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {TEACHING_MODE_LABELS[mode]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {/* Location */}
      <Field id="filter-location" label="Location">
        {(fieldProps) => (
          <Input
            {...fieldProps}
            type="text"
            value={filters.location ?? ''}
            onChange={handleLocationChange}
            placeholder="City or area"
            aria-label="Filter by location"
          />
        )}
      </Field>

      {/* Hourly rate range */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium text-ink-800">Hourly Rate</legend>
        <div className="flex items-center gap-2">
          <label htmlFor="filter-min-rate" className="sr-only">
            Minimum hourly rate
          </label>
          <Input
            id="filter-min-rate"
            type="number"
            min={0}
            step={1}
            value={filters.minRate ?? ''}
            onChange={handleMinRateChange}
            placeholder="Min"
            aria-label="Minimum hourly rate"
          />
          <span className="shrink-0 text-sm text-ink-500" aria-hidden="true">
            –
          </span>
          <label htmlFor="filter-max-rate" className="sr-only">
            Maximum hourly rate
          </label>
          <Input
            id="filter-max-rate"
            type="number"
            min={0}
            step={1}
            value={filters.maxRate ?? ''}
            onChange={handleMaxRateChange}
            placeholder="Max"
            aria-label="Maximum hourly rate"
          />
        </div>
      </fieldset>

      {/* Clear all */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          aria-label="Clear all filters"
          className="self-start"
        >
          Clear all filters
        </Button>
      )}
    </div>
  )

  // ---------------------------------------------------------------------------
  // Desktop sidebar — always visible at md+
  // ---------------------------------------------------------------------------
  const sidebar = (
    <aside
      aria-label="Filter tutors"
      className="hidden md:block w-64 shrink-0"
    >
      <div className="sticky top-24 rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-ink-900">Filters</h2>
        {controls}
      </div>
    </aside>
  )

  // ---------------------------------------------------------------------------
  // Mobile drawer — slide in from bottom when isOpen is true
  // ---------------------------------------------------------------------------
  const drawer = (
    <div
      aria-hidden={!isOpen}
      className={[
        'fixed inset-0 z-50 md:hidden',
        isOpen ? 'pointer-events-auto' : 'pointer-events-none',
      ].join(' ')}
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={[
          'absolute inset-0 bg-ink-900/40 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      />

      {/* Sheet */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Filter tutors"
        className={[
          'absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-5',
          'shadow-[0_-4px_32px_rgba(18,26,36,0.15)]',
          'transition-transform duration-300',
          isOpen ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink-900">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 4l12 12M16 4L4 16" />
            </svg>
          </button>
        </div>

        {controls}

        {/* Done button at the bottom */}
        <div className="mt-6">
          <Button
            variant="primary"
            fullWidth
            onClick={onClose}
            aria-label="Apply filters and close"
          >
            Show results
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {sidebar}
      {drawer}
    </>
  )
}
