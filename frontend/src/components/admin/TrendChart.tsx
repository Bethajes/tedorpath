import { useId } from 'react'

import { cn } from '@/lib/cn'

import type { TrendPoint } from '@/features/adminAnalytics/adminAnalytics.types'

/**
 * A small, honest bar chart.
 *
 * No chart library. The admin bundle does not need one, and a dependency for two
 * stacked bar charts would cost more than the SVG below — which is about forty
 * lines and has one job: show how many records fell on each day.
 *
 * WHAT THIS CHART WILL NOT DO
 *
 * - It does not smooth, interpolate or pad. A bar is a count.
 * - It does not draw an axis line implying a zero baseline when the scale starts
 *   above zero: `yTicks` always starts at 0 and the bars are drawn from the
 *   baseline, so the visual length of a bar is always proportional to its value.
 * - It does not invent a value for a day with no rows. The series arrives
 *   zero-filled from the server, and a zero here means a real zero.
 * - With no data at all it renders an explicit empty state rather than an empty
 *   box, because an empty chart is indistinguishable from a broken one.
 *
 * The scale is "nice"-rounded so the axis reads in round numbers, which is a
 * presentation choice and does not alter any bar's relationship to the others.
 */

export interface TrendChartProps {
  title: string
  /** The series, already zero-filled and in date order. */
  points: TrendPoint[]
  /** Colour token prefix, e.g. `brand` → `fill-brand-500` / `text-brand-700`. */
  tone?: 'brand' | 'accent'
  emptyMessage?: string
  className?: string
}

const CHART_HEIGHT = 132
const BAR_AREA = 96
const MAX_BARS = 45

/**
 * Rounds the axis maximum up to something readable.
 *
 * A maximum of 7 would label every gridline 1.75 apart. Rounding up to a multiple
 * of the step keeps the labels whole, and never lowers the maximum below the
 * largest value, so no bar is ever clipped.
 */
function niceMax(value: number): number {
  if (value <= 4) return 4

  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalised = value / magnitude
  const step = normalised <= 5 ? 5 : normalised <= 10 ? 10 : 20

  return step * magnitude
}

function dayLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function TrendChart({
  title,
  points,
  tone = 'brand',
  emptyMessage = 'No records in this window yet.',
  className,
}: TrendChartProps) {
  const gradientId = useId()
  const total = points.reduce((sum, point) => sum + point.count, 0)
  const peak = points.reduce((max, point) => Math.max(max, point.count), 0)
  const axisMax = niceMax(peak)

  const fill = tone === 'accent' ? 'fill-accent-500' : 'fill-brand-500'
  const fillSoft = tone === 'accent' ? 'fill-accent-200' : 'fill-brand-200'
  const stroke = tone === 'accent' ? 'stroke-accent-600' : 'stroke-brand-600'

  const shown = points.slice(-MAX_BARS)
  const hiddenDays = points.length - shown.length
  const summary = `${points.length === 1 ? 'record' : 'records'} in ${
    points.length
  } ${points.length === 1 ? 'day' : 'days'}`
  const slotWidth = 100 / Math.max(shown.length, 1)
  // A bar wider than about 60% of its slot reads as a column; narrower leaves a
  // visible gap between days, which is what makes the chart legible at 30 bars.
  const barWidth = Math.min(slotWidth * 0.6, 4)

  const gridLines = [0, 0.5, 1]

  return (
    <figure className={cn('rounded-xl border border-ink-200 bg-white p-5 shadow-sm', className)}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink-900">{title}</span>
        {/*
          One text node, deliberately. Splitting the count from the noun beside
          it reads correctly but announces as three fragments, and it makes the
          sentence impossible to assert on as a unit.
        */}
        <span className="text-sm text-ink-600">
          <span className="font-semibold text-ink-900 tabular-nums">{total}</span>{' '}
          {summary}
        </span>
      </figcaption>

      {points.length === 0 || total === 0 ? (
        <p className="mt-4 rounded-lg bg-ink-50 px-3 py-6 text-center text-sm text-ink-500">
          {emptyMessage}
        </p>
      ) : (
        <>
          {/*
            A table of the same numbers, for screen readers and for anyone who
            wants the figures rather than the picture. `sr-only` rather than
            hidden entirely: the shape of the chart is the point, but the values
            are the data.
          */}
          <table className="sr-only">
            <caption>{title}</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Records</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.date}>
                  <th scope="row">{point.date}</th>
                  <td>{point.count}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex gap-3">
            <div
              className="flex w-8 flex-col justify-between py-0.5 text-right text-[0.65rem] text-ink-400 tabular-nums"
              aria-hidden="true"
            >
              {gridLines
                .slice()
                .reverse()
                .map((ratio) => (
                  <span key={ratio}>{Math.round(axisMax * ratio)}</span>
                ))}
            </div>

            <div className="min-w-0 flex-1">
              <div
                className="relative"
                style={{ height: CHART_HEIGHT }}
                role="presentation"
              >
                {/* Gridlines first so bars sit on top of them. */}
                {gridLines.map((ratio) => (
                  <span
                    key={ratio}
                    aria-hidden="true"
                    className="absolute inset-x-0 border-t border-dashed border-ink-200"
                    style={{ bottom: `${ratio * BAR_AREA}%` }}
                  />
                ))}

                <svg
                  className="absolute inset-0 h-full w-full overflow-visible"
                  viewBox={`0 0 100 ${CHART_HEIGHT}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" className={fill} stopOpacity="0.95" />
                      <stop offset="100%" className={fillSoft} stopOpacity="0.55" />
                    </linearGradient>
                  </defs>

                  <line
                    x1="0"
                    y1={BAR_AREA}
                    x2="100"
                    y2={BAR_AREA}
                    className={stroke}
                    strokeWidth="0.4"
                    vectorEffect="non-scaling-stroke"
                  />

                  {shown.map((point, index) => {
                    // A zero gets no bar at all. A 0-height rect would still be a
                    // mark on the baseline, and the axis already says zero.
                    if (point.count === 0) return null

                    const height = (point.count / axisMax) * BAR_AREA
                    const x = index * slotWidth + (slotWidth - barWidth) / 2

                    return (
                      <rect
                        key={point.date}
                        x={x}
                        y={BAR_AREA - height}
                        width={barWidth}
                        height={height}
                        rx={Math.min(barWidth / 2, 0.6)}
                        fill={`url(#${gradientId})`}
                        className={stroke}
                        strokeWidth="0.35"
                        vectorEffect="non-scaling-stroke"
                      >
                        <title>{`${dayLabel(point.date)}: ${point.count}`}</title>
                      </rect>
                    )
                  })}
                </svg>
              </div>

              <div
                className="mt-1 flex justify-between text-[0.65rem] text-ink-400"
                aria-hidden="true"
              >
                <span>{dayLabel(points[0].date)}</span>
                <span>{dayLabel(points[points.length - 1].date)}</span>
              </div>
            </div>
          </div>

          {/*
            Only stated when it is true. A 365-day window in a 560px-wide card
            cannot show 365 bars, so the chart would silently be showing only the
            tail — which reads as "nothing before this" and is not true.
          */}
          {hiddenDays > 0 ? (
            <p className="mt-2 text-xs text-ink-500">
              Showing the most recent {shown.length} days of {points.length}. The total above counts
              all {points.length} days.
            </p>
          ) : null}
        </>
      )}
    </figure>
  )
}
