import { useMemo, useState, type FormEvent } from 'react'

import { AdminPageHeader, AdminShell } from '@/components/layout/AdminShell'
import { Alert, Button, Input } from '@/components/ui'
import { fetchSiteStats, updateSiteStats } from '@/features/adminSettings/adminSettings.api'
import {
  MAX_SITE_STAT_OVERRIDE,
  SITE_STAT_HINTS,
  SITE_STAT_KEYS,
  SITE_STAT_LABELS,
  parseOverrideField,
  type SiteStatKey,
  type SiteStatsSettings,
  type SiteStatsUpdate,
} from '@/features/adminSettings/adminSettings.types'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatWhen } from '@/lib/formatDate'
import { useAsyncData } from '@/lib/useAsyncData'

/**
 * Homepage statistics — `/admin/site-stats`
 *
 * The four figures in the homepage trust band are live database counts by
 * default. This screen lets an admin replace any of them, which is what makes
 * the screen worth having: the count answers "what exists right now" and an
 * override answers "what we have committed to", and a launch needs both to be
 * publishable.
 *
 * The design constraint that shapes everything here is that an override must
 * never be invisible. Each row shows the live count, the override, and the
 * figure a visitor is actually seeing, so "the database says 6, the homepage
 * says 24" is a state an admin can see and a later admin can still understand.
 *
 * A blank field means "no override" rather than "override by zero", because the
 * homepage deliberately renders wording instead of a zero — a zero override
 * would produce a card that disagreed with its own number.
 */

/** The draft form: one text field per figure, empty string meaning no override. */
type Draft = Record<SiteStatKey, string>

function draftFrom(settings: SiteStatsSettings | null): Draft {
  return Object.fromEntries(
    SITE_STAT_KEYS.map((key) => {
      const override = settings?.overrides[key]
      return [key, override === null || override === undefined ? '' : String(override)]
    }),
  ) as Draft
}

/** Validates one field, returning the message to show or `null` when it is fine. */
function validateField(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null

  const value = Number(trimmed)
  if (!Number.isFinite(value)) return 'Enter a whole number, or leave blank to use the live count.'
  if (!Number.isInteger(value)) return 'Enter a whole number, or leave blank to use the live count.'
  if (value < 1) return 'Must be at least 1 — the homepage shows wording instead of a zero.'
  if (value > MAX_SITE_STAT_OVERRIDE) {
    return `Must be at most ${MAX_SITE_STAT_OVERRIDE.toLocaleString('en-GB')}.`
  }
  return null
}

function describeLoadError(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Your admin session is no longer valid. Please sign in again.'
  }
  return 'Unable to load the homepage statistics. Please try again.'
}

function describeSaveError(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Your admin session is no longer valid. Please sign in again.'
  }
  return 'Unable to save the homepage statistics. Please try again.'
}

export function AdminSiteStatsPage() {
  const { data: settings, loading, error: loadError, reload } = useAsyncData<SiteStatsSettings>(
    fetchSiteStats,
    [],
    describeLoadError,
  )

  /**
   * What the form is bound to, kept separately from `settings` so a keystroke
   * does not have to round-trip through the server.
   *
   * `seeded` is the last server answer the draft was built from — the initial
   * GET, and every refetch after a save. It is what "has this changed?"
   * compares against, so a save the server normalises cannot leave the form
   * claiming to still be edited.
   */
  const [seeded, setSeeded] = useState<SiteStatsSettings | null>(null)
  const [draft, setDraft] = useState<Draft>(() => draftFrom(null))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SiteStatKey, string>>>({})

  /*
   * Adopt the loaded settings into the draft while rendering rather than in an
   * effect: this is React's "adjust state when an input changes" pattern. It
   * means the form shows the server's values on the first paint where the data
   * was already available, with no flash of empty inputs and no setState inside
   * an effect. The identity check means it runs once per server answer rather
   * than on every render.
   */
  if (settings && settings !== seeded) {
    setSeeded(settings)
    setDraft(draftFrom(settings))
  }

  /** Any edit invalidates the "saved" banner: the form is dirty again. */
  function editField(key: SiteStatKey, value: string) {
    setDraft((current) => ({ ...current, [key]: value }))
    setSavedAt(null)
    setSaveError(null)
    setFieldErrors((current) => {
      if (!(key in current)) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const validation = useMemo(
    () =>
      Object.fromEntries(
        SITE_STAT_KEYS.map((key) => [key, validateField(draft[key])]),
      ) as Record<SiteStatKey, string | null>,
    [draft],
  )

  /**
   * Only the fields that differ from what is stored are sent.
   *
   * Sending the whole form would clear overrides the admin did not touch, which
   * is the one way a save on this screen could quietly undo somebody else's
   * work.
   */
  const update = useMemo<SiteStatsUpdate>(() => {
    const body: SiteStatsUpdate = {}
    for (const key of SITE_STAT_KEYS) {
      const stored = settings?.overrides[key] ?? null
      const next = parseOverrideField(draft[key])
      if (next !== stored) body[key] = next
    }
    return body
  }, [draft, settings])

  const changedKeys = Object.keys(update) as SiteStatKey[]
  const dirty = changedKeys.length > 0
  // Both sources block the save: the browser-side checks, and anything the API
  // rejected that the operator has not corrected yet.
  const invalid =
    Object.values(validation).some(Boolean) || Object.keys(fieldErrors).length > 0

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!dirty || invalid) return

    setSaving(true)
    setSaveError(null)
    setFieldErrors({})

    try {
      await updateSiteStats(update)
      // Refetch rather than trusting the local draft: the re-read answer is what
      // re-seeds the form above, so the boxes always show what was stored. The
      // PATCH response has the same shape, but only the GET is the source of
      // truth for this form.
      reload()
      setSavedAt(new Date().toISOString())
    } catch (error) {
      setSaveError(describeSaveError(error))
      if (error instanceof ApiError && error.fields?.length) {
        setFieldErrors(
          Object.fromEntries(
            error.fields
              .filter((field) => SITE_STAT_KEYS.includes(field.field as SiteStatKey))
              .map((field) => [field.field, field.message ?? 'Invalid value.']),
          ),
        )
      }
    } finally {
      setSaving(false)
    }
  }

  /**
   * Clears every override in one action.
   *
   * Sends all four keys as `null` rather than the current draft, because the
   * question this button answers is "take my hands off the numbers", not "save
   * whatever happens to be in the boxes".
   */
  async function handleClearAll() {
    setSaving(true)
    setSaveError(null)
    setFieldErrors({})

    try {
      const cleared = Object.fromEntries(
        SITE_STAT_KEYS.map((key) => [key, null]),
      ) as SiteStatsUpdate
      await updateSiteStats(cleared)
      reload()
      setSavedAt(new Date().toISOString())
    } catch (error) {
      setSaveError(describeSaveError(error))
    } finally {
      setSaving(false)
    }
  }

  const anyOverride = SITE_STAT_KEYS.some((key) => (settings?.overrides[key] ?? null) !== null)

  return (
    <AdminShell>
      <AdminPageHeader
        title="Homepage statistics"
        description="The four figures shown in the homepage trust band. Each one counts live records by default; override a figure only when the published number needs to say more than the current count."
      />

      {loadError ? (
        <Alert tone="error" className="mb-5">
          <p>{loadError}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={reload} disabled={loading}>
            Try again
          </Button>
        </Alert>
      ) : null}

      {saveError ? (
        <Alert tone="error" className="mb-5">
          <p>{saveError}</p>
        </Alert>
      ) : null}

      {savedAt && !saveError ? (
        <Alert tone="success" className="mb-5">
          <p>Saved. The homepage is showing the new figures on its next load.</p>
        </Alert>
      ) : null}

      {/*
        Only while there is nothing to show. After a save the page refetches, and
        replacing the form with a loading panel would throw away the operator's
        scroll position for a request that has already succeeded.
      */}
      {loading && !settings ? (
        <p
          role="status"
          className="rounded-xl border border-ink-200 bg-white p-6 text-sm text-ink-600 shadow-sm"
        >
          Loading homepage statistics…
        </p>
      ) : null}

      {settings ? (
        <form onSubmit={handleSubmit} noValidate>
          <div className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-sm">
            <div className="hidden gap-4 border-b border-ink-200 bg-ink-50 px-5 py-3 text-xs font-semibold tracking-wide text-ink-500 uppercase lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto]">
              <span>Statistic</span>
              <span>Live count</span>
              <span>Show instead</span>
              <span className="text-right">Visitors see</span>
            </div>

            <ul className="divide-y divide-ink-100">
              {SITE_STAT_KEYS.map((key) => {
                // `?? null` rather than a raw read: the whole row branches on
                // "is this overridden?", and a key the server omitted would
                // otherwise compare unequal to null and claim to be overridden.
                const override = settings.overrides[key] ?? null
                const live = settings.live[key]
                // The published figure, from the server — deliberately not the
                // draft, so the badge always answers "what do visitors see now?"
                // rather than "what would they see if you saved?".
                const showing = settings.showing[key] ?? override ?? live
                const message = validation[key] ?? fieldErrors[key] ?? null

                return (
                  <li
                    key={key}
                    className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-start lg:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-900">{SITE_STAT_LABELS[key]}</p>
                      <p className="mt-0.5 text-sm text-ink-600">{SITE_STAT_HINTS[key]}</p>
                    </div>

                    <div className="flex items-baseline gap-2 lg:block">
                      <span className="text-xs font-medium tracking-wide text-ink-500 uppercase lg:hidden">
                        Live count
                      </span>
                      <p className="text-lg font-semibold text-ink-700 tabular-nums">{live}</p>
                    </div>

                    <div>
                      {/*
                        The visible label describes the field, not the metric.
                        Labelling the input with the metric's name would make a
                        screen reader announce "Approved tutors, 24" for what is
                        actually the override box, and would misdescribe the
                        value when it is blank.
                      */}
                      <label
                        htmlFor={`stat-${key}`}
                        className="block text-xs font-medium tracking-wide text-ink-500 uppercase lg:sr-only"
                      >
                        Show instead
                      </label>
                      <Input
                        id={`stat-${key}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={MAX_SITE_STAT_OVERRIDE}
                        step={1}
                        invalid={Boolean(message)}
                        value={draft[key]}
                        placeholder="Live count"
                        aria-describedby={message ? `stat-${key}-error` : `stat-${key}-hint`}
                        onChange={(event) => editField(key, event.target.value)}
                        className="tabular-nums"
                      />
                      <p id={`stat-${key}-hint`} className="mt-1 text-xs text-ink-500">
                        Leave blank to use the live count.
                      </p>
                      {message ? (
                        <p
                          id={`stat-${key}-error`}
                          role="alert"
                          className="mt-1 text-xs font-medium text-red-600"
                        >
                          {message}
                        </p>
                      ) : null}
                    </div>

                    <div className="lg:pt-1 lg:text-right">
                      <span className="text-xs font-medium tracking-wide text-ink-500 uppercase lg:hidden">
                        Visitors see{' '}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums',
                          override === null
                            ? 'bg-ink-100 text-ink-600'
                            : 'bg-amber-100 text-amber-900',
                        )}
                      >
                        {showing}
                      </span>
                      {override !== null ? (
                        <span className="ml-2 text-xs font-medium text-amber-800">overridden</span>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!dirty || invalid || saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClearAll}
              disabled={!anyOverride || saving}
            >
              Reset all to live counts
            </Button>
            {dirty ? (
              <p className="text-sm text-ink-600">
                {changedKeys.length} figure{changedKeys.length === 1 ? '' : 's'} changed — nothing is
                saved yet.
              </p>
            ) : null}
          </div>
        </form>
      ) : null}

      {/*
        The honesty note is on the screen rather than in a comment. An admin
        overriding a count is making a claim the database does not support, and
        the person doing it should be able to see that sentence while doing it.
      */}
      <section className="mt-8 rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-ink-900">Before you override a number</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink-600">
          <li>
            The homepage shows wording instead of a number when the count is zero, so an override
            cannot be zero or blank-by-accident.
          </li>
          <li>
            The live count is never stored — it is recalculated on every page load, so an override
            does not freeze a figure that should be tracking the marketplace.
          </li>
          <li>
            An overridden figure is visibly different from the live count here, and the change is
            timestamped so it can be explained later.
          </li>
        </ul>
        {settings?.updatedAt ? (
          <p className="mt-3 text-xs text-ink-500">
            Overrides last changed{' '}
            <time dateTime={settings.updatedAt}>{formatWhen(settings.updatedAt).label}</time>.
          </p>
        ) : null}
      </section>
    </AdminShell>
  )
}
