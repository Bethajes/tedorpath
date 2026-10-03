import { Alert, Button, Field, Input } from '@/components/ui'
import { formatTimeRange, isCompleteTimeRange } from '../tutorRequest.schema'
import { createTimeRange, type TimeRange } from '../tutorRequest.steps'

/**
 * Availability: which days, and which windows in the client's own timezone.
 *
 * The timezone is an editable field with the country's value prefilled, not a
 * hidden one. Someone studying in Ethiopia may be travelling, and someone whose
 * country we guessed wrong is exactly the person this form must not mislead: the
 * stored timezone is what a tutor reads when deciding whether "18:00" is
 * workable, so it has to be the answer the client recognises rather than the one
 * the form inferred.
 */
export interface AvailabilityFieldsProps {
  timezones: readonly string[]
  timezone: string
  onTimezoneChange: (value: string) => void
  timezoneError?: string
  /** The timezone chosen in step 1, offered as a one-click correction. */
  countryTimezone?: string
  /** The browser's own timezone, when it differs from everything above. */
  deviceTimezone?: string
  days: readonly string[]
  onDayToggle: (day: string) => void
  dayError?: string
  ranges: readonly TimeRange[]
  onRangesChange: (ranges: TimeRange[]) => void
  rangeError?: string
}

export function AvailabilityFields({
  timezones,
  timezone,
  onTimezoneChange,
  timezoneError,
  countryTimezone,
  deviceTimezone,
  days,
  onDayToggle,
  dayError,
  ranges,
  onRangesChange,
  rangeError,
}: AvailabilityFieldsProps) {
  const listId = 'timezone-suggestions'

  const update = (id: string, key: 'start' | 'end', value: string) =>
    onRangesChange(ranges.map((range) => (range.id === id ? { ...range, [key]: value } : range)))

  const remove = (id: string) => onRangesChange(ranges.filter((range) => range.id !== id))

  const add = () => onRangesChange([...ranges, createTimeRange()])

  /** Suggestions for the datalist: what we know, plus what they are using. */
  const suggestions = [...new Set([timezone, ...timezones].filter(Boolean))]

  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="text-sm font-medium text-ink-800">
          Which days usually work?
          <span className="ml-2 text-xs font-normal text-ink-500">
            {days.length === 0 ? 'None selected' : 'Optional'}
          </span>
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {DAY_BUTTONS.map((day) => {
            const selected = days.includes(day)
            return (
              <button
                key={day}
                type="button"
                onClick={() => onDayToggle(day)}
                aria-pressed={selected}
                className={[
                  'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  selected
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-ink-200 bg-white text-ink-700 hover:border-brand-400 hover:bg-brand-50',
                ].join(' ')}
              >
                {day}
              </button>
            )
          })}
        </div>
        {dayError ? (
          <p role="alert" className="mt-2 text-xs font-medium text-red-600">
            {dayError}
          </p>
        ) : null}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-ink-800">
          What times suit you?
          <span className="ml-2 text-xs font-normal text-ink-500">Optional</span>
        </legend>
        <p className="mt-1 text-xs text-ink-500">
          Add a start and an end time for each window that works.
        </p>

        <div className="mt-3 space-y-3">
          {ranges.map((range, index) => (
            // `range.id` rather than the index: removing a middle row must not
            // make React reuse the inputs of the rows after it, which would move
            // what someone has typed onto a different window.
            <div
              key={range.id}
              className="flex flex-wrap items-end gap-3 rounded-xl border border-ink-200 bg-ink-50/60 p-3"
            >
              <p className="w-full text-xs font-medium text-ink-500 sm:hidden">
                Window {index + 1}
              </p>

              <div className="w-28">
                <Field id={`${range.id}-start`} label="From" hideOptionalMarker>
                  {(field) => (
                    <Input
                      {...field}
                      type="time"
                      value={range.start}
                      onChange={(event) => update(range.id, 'start', event.target.value)}
                      invalid={Boolean(rangeError)}
                    />
                  )}
                </Field>
              </div>

              <div className="w-28">
                <Field id={`${range.id}-end`} label="Until" hideOptionalMarker>
                  {(field) => (
                    <Input
                      {...field}
                      type="time"
                      value={range.end}
                      onChange={(event) => update(range.id, 'end', event.target.value)}
                      invalid={Boolean(rangeError)}
                    />
                  )}
                </Field>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(range.id)}
                // The number is in the accessible name rather than in a hidden
                // span: separate nodes are concatenated without a separator, so
                // a screen reader would otherwise hear "Removewindow two" and
                // have no way to tell the windows apart.
                aria-label={`Remove window ${index + 1}`}
                className="ml-auto text-red-700 hover:bg-red-50"
              >
                Remove
              </Button>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={add}>
            Add a time range
          </Button>
        </div>

        {rangeError ? (
          <p role="alert" className="mt-2 text-xs font-medium text-red-600">
            {rangeError}
          </p>
        ) : null}

        {ranges.filter(isCompleteTimeRange).length > 0 ? (
          <p className="mt-3 text-xs text-ink-500">
            Your windows: {ranges.filter(isCompleteTimeRange).map(formatTimeRange).join(' · ')}
          </p>
        ) : null}
      </fieldset>

      <div>
        <Field
          id="timezone"
          label="Timezone for scheduling"
          required
          error={timezoneError}
          hint="Lessons are scheduled in this timezone. Suggestions come from the countries we serve; type any IANA name if yours is not listed."
        >
          {(field) => (
            <Input
              {...field}
              // A text input backed by a datalist rather than a closed <select>:
              // the platform serves a fixed list of countries, but a visitor can
              // be anywhere. Refusing to let them name their own timezone would
              // store the wrong one silently — and a stored timezone is what a
              // tutor reads to decide whether a proposed time is workable.
              list={listId}
              value={timezone}
              onChange={(event) => onTimezoneChange(event.target.value)}
              placeholder="Africa/Addis_Ababa"
              autoComplete="off"
              spellCheck={false}
              invalid={Boolean(timezoneError)}
            />
          )}
        </Field>

        <datalist id={listId}>
          {suggestions.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>

        {/* The correction affordances. Both only appear when they would change
            something, so a correctly-chosen timezone shows no clutter. */}
        {countryTimezone && timezone && countryTimezone !== timezone ? (
          <p className="mt-2 text-xs text-ink-600">
            You chose {timezone}, but the country you selected uses {countryTimezone}.{' '}
            <button
              type="button"
              onClick={() => onTimezoneChange(countryTimezone)}
              className="font-medium text-brand-700 underline hover:no-underline"
            >
              Use {countryTimezone}
            </button>
          </p>
        ) : null}

        {deviceTimezone && deviceTimezone !== timezone ? (
          <p className="mt-2 text-xs text-ink-600">
            Your device is set to {deviceTimezone}.{' '}
            <button
              type="button"
              onClick={() => onTimezoneChange(deviceTimezone)}
              className="font-medium text-brand-700 underline hover:no-underline"
            >
              Use {deviceTimezone}
            </button>
          </p>
        ) : null}
      </div>
    </div>
  )
}

/** Weekday names, kept next to the control that uses them. */
const DAY_BUTTONS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

/**
 * A warning that a quoted budget no longer matches the country chosen.
 *
 * This is the component that makes "never convert, never assume" visible rather
 * than merely intended. The form does not rewrite the amount and does not
 * reselect the currency; it says what changed and offers both currencies, and
 * the client decides. Anything less would be a quiet exchange rate nobody agreed
 * to, applied to someone's money.
 */
export interface CurrencyMismatchNoticeProps {
  amount: string
  currencyCode: string
  countryName: string
  countryCurrencyCode: string
  onUseCountryCurrency: () => void
}

export function CurrencyMismatchNotice({
  amount,
  currencyCode,
  countryName,
  countryCurrencyCode,
  onUseCountryCurrency,
}: CurrencyMismatchNoticeProps) {
  return (
    <Alert tone="info" className="mt-3">
      <p className="font-medium text-brand-900">Check the currency on this budget</p>
      <p className="mt-1">
        You entered <strong>{amount} {currencyCode}</strong>. {countryName} uses{' '}
        <strong>{countryCurrencyCode}</strong>. We have not converted your amount, and we will
        not — it is still {amount} {currencyCode}. Change it if that is not what you meant.
      </p>
      <button
        type="button"
        onClick={onUseCountryCurrency}
        className="mt-2 font-medium text-brand-800 underline hover:no-underline"
      >
        The budget is in {countryCurrencyCode}
      </button>
    </Alert>
  )
}