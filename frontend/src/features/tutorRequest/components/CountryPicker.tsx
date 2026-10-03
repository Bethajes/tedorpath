import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { cn } from '@/lib/cn'
import { Input } from '@/components/ui'

import type { ConfigCountry } from '../tutorRequest.config'

/**
 * A searchable country picker.
 *
 * WHY NOT A `<select>`
 *
 * The wizard asks "Which country are you located in?" and this is the first
 * question it asks, which makes it the answer most likely to be wrong — somebody
 * outside Ethiopia opening the site for the first time. The country list runs to
 * several hundred entries, and on a phone a native select takes over the whole
 * screen with an alphabetical wheel, so the consequence of the answer — the
 * currency, the curriculum, which of a tutor's prices they will be shown — is not
 * visible while they choose it.
 *
 * So it is a text box that filters. The consequences are shown on the step as they
 * choose, which is the point of asking at the beginning: the wizard can adapt
 * everything after it while the person can still see what they are agreeing to.
 *
 * ACCESSIBILITY
 *
 * This is the ARIA combobox pattern, deliberately hand-built rather than taken from
 * a library, because there is one of them and a dependency for one control is a
 * dependency forever:
 *
 *   - The text box owns the list. `aria-expanded`, `aria-controls` and
 *     `aria-activedescendant` are on the input, so a screen reader announces the
 *     highlighted option as the user types rather than leaving them to navigate a
 *     separate list.
 *   - The options are not focused. Focus never leaves the text box, so a keyboard
 *     user is not dropped into a `role="listbox"` they have to arrow their way out
 *     of.
 *   - `aria-autocomplete="list"` says the box filters, which is what distinguishes
 *     this from a free-text field.
 *   - The list is a live region, so the number of matches is announced without
 *     stealing focus mid-word.
 *   - Escape closes and returns to the box; Enter picks the highlighted option.
 */
export interface CountryPickerProps {
  countries: ConfigCountry[]
  value: string
  onChange: (code: string) => void
  /** Rendered under the box. */
  hint?: string
  error?: string
  invalid?: boolean
  /** The code preselected when the wizard opens. */
  defaultCode?: string
  /**
   * The id of the `<label>` pointing at this control.
   *
   * Supplied by the surrounding `Field`, which owns the label. Without it the label
   * points at nothing and the box is announced as an unnamed combo box, which is
   * the whole reason a label exists.
   */
  id?: string
  /** Ids of the hint and error paragraphs, for `aria-describedby`. */
  describedBy?: string
}

/** How many matches to show at once. */
const MAX_RESULTS = 60

/**
 * What a query matches.
 *
 * Accent-insensitive, because a parent typing "Cote" and a parent typing "Côte"
 * are the same person and one of them should not get no results.
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

export function CountryPicker({
  countries,
  value,
  onChange,
  hint,
  error,
  invalid,
  defaultCode,
  id,
  describedBy,
}: CountryPickerProps) {
  const listId = useId()
  const hintId = hint ? `${listId}-hint` : undefined
  const errorId = error ? `${listId}-error` : undefined

  /*
   * Both sources of description, kept together.
   *
   * The surrounding `Field` renders the hint and the error for this step; the local
   * `hint`/`error` props are for a caller that renders its own. Either can be
   * present without the other, so they are unioned rather than one being preferred.
   */
  const describedByValue =
    [describedBy, hintId, errorId].filter(Boolean).join(' ') || undefined

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)

  /*
   * The box starts holding the current answer, not an empty string.
   *
   * Two bugs live here if it does not. The field looks unanswered when it is in fact
   * pre-filled with Ethiopia, so a parent who reads the box and presses Continue
   * without noticing has no idea which country they just agreed to. And the
   * preselected-country line below is written in terms of an empty box, so it would
   * not appear at all.
   *
   * Seeded from `value` once on mount and thereafter owned by typing — this is a
   * controlled input whose value is deliberately *not* `selected?.name`, because
   * that would overwrite every keystroke with the last chosen country.
   */
  const [query, setQuery] = useState(() => {
    const initial = countries.find((country) => country.code === value)
    return initial?.name ?? ''
  })
  const [activeIndex, setActiveIndex] = useState(0)

  const selected = countries.find((country) => country.code === value)

  /*
   * An empty box shows the full list rather than "no matches", because a visitor
   * arriving at this step for the first time has not typed anything yet and an
   * empty result list would look like the country list had failed to load.
   */
  const matches = useMemo(() => {
    const needle = normalise(query)

    if (!needle) return countries

    const found = countries.filter((country) => normalise(country.name).includes(needle))

    // An exact match floats to the top even when it is not the first alphabetical
    // hit, so typing "Ethiopia" puts Ethiopia first rather than after "Ethiopia,
    // Region:".
    return found.sort((a, b) => {
      const aExact = normalise(a.name) === needle ? 0 : 1
      const bExact = normalise(b.name) === needle ? 0 : 1
      return aExact - bExact
    })
  }, [countries, query])

  const visible = matches.slice(0, MAX_RESULTS)

  /* Keep the highlight inside the results, whatever the query changed. */
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  /* Clicking away closes the list. On `pointerdown` so it happens before a click
     lands on whatever was underneath. */
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const choose = (code: string) => {
    onChange(code)
    setOpen(false)
    // The text goes back to the country's name, so the box describes the answer
    // rather than the search that led to it.
    const country = countries.find((entry) => entry.code === code)
    setQuery(country?.name ?? '')
    inputRef.current?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()

      // Typing again after the list was closed re-opens it rather than doing
      // nothing, which is what a keyboard user expects from a combobox.
      if (!open) {
        setOpen(true)
        return
      }

      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => {
        const next = current + step
        if (next < 0) return visible.length - 1
        if (next >= visible.length) return 0
        return next
      })
      return
    }

    if (event.key === 'Enter') {
      // Only intercept Enter when there is something to pick. Otherwise it must
      // submit the form, or a parent who has typed a full country name and pressed
      // Enter would have to press it twice.
      const choice = visible[activeIndex]
      if (open && choice) {
        event.preventDefault()
        choose(choice.code)
      }
      return
    }

    if (event.key === 'Escape') {
      if (!open) return
      event.preventDefault()
      setOpen(false)
      // Put the box back to describing the answer, not the abandoned search.
      setQuery(selected?.name ?? '')
      return
    }

    if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/*
        The visible control is a text box rather than a button showing the current
        choice. The parent needs to *change* the country as often as they confirm
        it, and on a phone a button labelled "Ethiopia" that opens a list is one
        more tap than a box they can tap straight into and retype.
      */}
      <Input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && visible[activeIndex] ? `${listId}-${visible[activeIndex].code}` : undefined}
        aria-describedby={describedByValue}
        autoComplete="off"
        // The list is a list of countries, and a phone keyboard that guessed would
        // put the visitor's own address in here instead.
        name="country"
        value={query}
        placeholder="Start typing to search…"
        onChange={(event) => {
          const next = event.target.value
          setQuery(next)
          setOpen(true)

          /*
           * An emptied box withdraws the answer.
           *
           * Without this, deleting the text looks like clearing the field and is
           * not: the form still holds Ethiopia, so Continue accepts the request and
           * it is stored with a country nobody chose. The box and the stored value
           * are the same answer, so they have to move together — including down to
           * nothing, which is then a genuine "no answer" and the wizard says so.
           *
           * Only on an entirely empty box. A partial one is a search in progress,
           * and must not discard the answer behind it: somebody typing "Ken" has not
           * decided they are not in Ethiopia.
           */
          if (next.trim() === '' && value !== '') onChange('')
        }}
        onFocus={() => {
          // Re-opening on focus puts the whole list back, so going back to fix the
          // country does not start from a search for something else.
          setQuery(selected?.name ?? '')
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
        invalid={invalid}
        className={cn('pr-10')}
      />

      {/*
        A decorative chevron, not a button. The text box above it is the control —
        making the chevron separately clickable would add a second, unlabelled
        target for the same action.
      */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-400"
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="m5 7.5 5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      {/*
        Kept mounted, and visually hidden, whenever the list is closed. A screen
        reader user needs to hear that "12 matches" the moment it changes, and a
        list that only exists while open announces nothing on every keystroke.
      */}
      <p className="sr-only" role="status" aria-live="polite">
        {open
          ? matches.length === 0
            ? 'No countries match that search.'
            : `${matches.length} ${matches.length === 1 ? 'country' : 'countries'} available.`
          : ''}
      </p>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Countries"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-ink-200 bg-white py-1 shadow-lg"
        >
          {matches.length === 0 ? (
            <li role="none" className="px-3 py-3 text-sm text-ink-500">
              No country matches “{query}”. Try a different spelling.
            </li>
          ) : (
            <>
              {/*
                One "showing N of M" line when the list is clipped. Without it the
                list looks like the full set, and somebody looking for a country
                near the end of the alphabet is told it does not exist.
              */}
              {matches.length > MAX_RESULTS ? (
                <li
                  role="none"
                  className="border-b border-ink-100 px-3 py-2 text-xs text-ink-500"
                >
                  Showing {MAX_RESULTS} of {matches.length} matches — keep typing to narrow it down
                </li>
              ) : null}

              {visible.map((country, index) => {
                const isActive = index === activeIndex

                return (
                  <li key={country.code} role="none">
                    <div
                      id={`${listId}-${country.code}`}
                      role="option"
                      aria-selected={country.code === value}
                      // Highlight follows the keyboard, not the pointer. A hover
                      // highlight that does not move with the arrows would leave a
                      // keyboard user pressing Enter on an option they were never
                      // told about.
                      className={cn(
                        'cursor-pointer px-3 py-2 text-sm',
                        isActive ? 'bg-brand-50 text-ink-900' : 'text-ink-700',
                      )}
                      // `onMouseDown` rather than `onClick`: the input's blur would
                      // otherwise close the list before the click landed.
                      onMouseDown={(event) => {
                        event.preventDefault()
                        choose(country.code)
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      {country.name}
                    </div>
                  </li>
                )
              })}
            </>
          )}
        </ul>
      ) : null}

      {/*
        The preselected country, announced on first render without stealing focus.
        A default that is only visible as text in a box is not a default anybody
        can be sure was applied.
      */}
      {/*
        Named on every render, not only while the box is empty.
 *
        The point of a preselected answer is that the person knows it was preselected
        rather than chosen. Showing that line only until they touch the box means the
        one person who reads it is the one who already got it right.
      */}
      {defaultCode && selected && selected.code === defaultCode ? (
        <p className="mt-1.5 text-xs text-ink-500">
          Preselected: {selected.name}. Change it if that is not where you are.
        </p>
      ) : null}
    </div>
  )
}

export default CountryPicker