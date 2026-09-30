import { useState } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/cn'
import { resolveImageUrl } from '@/lib/api'

import { TEACHING_MODE_LABELS } from '../tutors.types'
import type { TutorCardDTO } from '../tutors.types'

/**
 * One tutor in the public directory.
 *
 * Two layouts, because the card is used at two different widths:
 *
 * - `row` (default) is a wide horizontal card: portrait on the left, the tutor's
 *   words in the middle, and the facts plus the call to action in a rail on the
 *   right. The directory is a single column, so there is width to spend.
 * - `grid` is a compact vertical card for three-across layouts — the homepage
 *   featured section, which Requirement 6.7 fixes at three columns. It carries
 *   the summary only: the bio excerpt and the join date need a wide card, and
 *   both are on the profile page regardless.
 *
 * Both variants lead with the same facts — who, what they teach, where, and
 * what it costs — so a tutor is never harder to judge in one place than another.
 * Neither adds anything the API does not send.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 *
 * The card shows only fields the API actually sends. There are no ratings, no
 * lesson counts, no "hours tutoring", no response time and no testimonials here
 * (Requirement 9.4): none of those are backed by a data model, and inventing them
 * would put a number in front of a visitor that nobody can substantiate.
 */

const MAX_VISIBLE_SUBJECTS = 2
const MAX_VISIBLE_LANGUAGES = 2

export interface TutorCardProps {
  tutor: TutorCardDTO
  className?: string
  /** `row` for the full-width directory, `grid` for three-across layouts. */
  variant?: 'row' | 'grid'
}

/**
 * Up to two initials for the placeholder avatar.
 *
 * Returns '' for a name with no letters at all, in which case the caller falls
 * back to a generic person glyph rather than rendering an empty circle.
 */
function initialsOf(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''

  const first = words[0][0] ?? ''
  const last = words.length > 1 ? (words[words.length - 1][0] ?? '') : ''
  return (first + last).toUpperCase()
}

/**
 * The avatar area.
 *
 * Renders a real `<img>` when a photo exists, and an initials tile otherwise.
 * Both branches expose the same accessible name, so assistive technology reads
 * the card identically whether or not the tutor uploaded a photo
 * (Requirements 9.1, 9.2).
 *
 * `onBrokenImage` covers the case Requirement 9.2 does not mention: a stored
 * URL that now 404s. Without it the browser shows its own broken-image glyph.
 */
function Avatar({
  displayName,
  photoUrl,
  onBrokenImage,
  size,
}: {
  displayName: string
  photoUrl: string | null
  onBrokenImage: () => void
  size: 'sm' | 'lg'
}) {
  const label = `${displayName} profile photo`
  const frame = size === 'lg' ? 'h-20 w-20 text-2xl' : 'h-14 w-14 text-lg'

  // Uploaded photos are stored as a path relative to the API origin, so it has
  // to be resolved before it can be used as an `img src`.
  const resolvedPhotoUrl = resolveImageUrl(photoUrl)

  if (resolvedPhotoUrl) {
    return (
      <img
        src={resolvedPhotoUrl}
        alt={label}
        onError={onBrokenImage}
        className={cn(
          frame,
          'shrink-0 rounded-full border border-ink-200 bg-ink-100 object-cover',
        )}
      />
    )
  }

  const initials = initialsOf(displayName)

  return (
    <div
      role="img"
      aria-label={`${label} placeholder`}
      className={cn(
        frame,
        'flex shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 font-semibold text-brand-700',
      )}
    >
      {initials ? (
        <span aria-hidden="true">{initials}</span>
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          className="h-9 w-9"
        >
          <circle cx="12" cy="8.5" r="3.4" />
          <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
        </svg>
      )}
    </div>
  )
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2 8h11" />
      <path d="M9 4l4 4-4 4" />
    </svg>
  )
}

/** The month and year a tutor's profile first appeared. */
function joinedLabel(createdAt: string): string | null {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

export function TutorCard({ tutor, className, variant = 'row' }: TutorCardProps) {
  // A stored photo URL can stop resolving after the fact, so the fallback is
  // triggered by the load failing, not only by the field being null.
  const [photoBroken, setPhotoBroken] = useState(false)
  const photoUrl = photoBroken ? null : tutor.profilePhotoUrl

  const visibleSubjects = tutor.subjects.slice(0, MAX_VISIBLE_SUBJECTS)
  const hiddenSubjectCount = tutor.subjects.length - visibleSubjects.length

  const visibleLanguages = tutor.languages.slice(0, MAX_VISIBLE_LANGUAGES)
  const hiddenLanguageCount = tutor.languages.length - visibleLanguages.length

  const joined = joinedLabel(tutor.createdAt)
  const isRow = variant === 'row'

  const avatar = (
    <Avatar
      displayName={tutor.displayName}
      photoUrl={photoUrl}
      onBrokenImage={() => setPhotoBroken(true)}
      size={isRow ? 'lg' : 'sm'}
    />
  )

  const heading = (
    <h3
      className={cn(
        'truncate font-semibold text-ink-900',
        isRow ? 'text-lg' : 'text-base',
      )}
    >
      {tutor.displayName}
    </h3>
  )

  // The headline is the tutor's own one-line summary of what they teach. It is
  // the closest thing this card has to a specialism, so it gets the brand
  // colour and two lines rather than being greyed out.
  const headline = (
    <p
      className={cn(
        'mt-1 font-medium text-brand-700',
        isRow ? 'line-clamp-2 text-[0.98rem]' : 'line-clamp-2 text-sm',
      )}
    >
      {tutor.headline}
    </p>
  )

  const subjectChips = visibleSubjects.length > 0 && (
    <ul className="flex flex-wrap gap-1.5" aria-label="Subjects">
      {visibleSubjects.map((subject) => (
        <li
          key={subject.id}
          className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-700"
        >
          {subject.name}
        </li>
      ))}
      {hiddenSubjectCount > 0 && (
        <li className="rounded-full bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-500">
          +{hiddenSubjectCount} more
        </li>
      )}
    </ul>
  )

  const languageChips = visibleLanguages.length > 0 && (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="sr-only">Teaching languages</span>
      {visibleLanguages.map((language) => (
        <span
          key={language}
          className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800"
        >
          {language}
        </span>
      ))}
      {hiddenLanguageCount > 0 ? (
        <span className="text-xs text-ink-500">+{hiddenLanguageCount} more</span>
      ) : null}
    </div>
  )

  const modeBadge = (
    <div className="flex items-center gap-1.5">
      <dt className="sr-only">Teaching mode</dt>
      <dd className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent-700">
        {TEACHING_MODE_LABELS[tutor.teachingMode]}
      </dd>
    </div>
  )

  const locationRow = tutor.location && (
    <div className="flex items-center gap-1.5">
      <dt className="sr-only">Location</dt>
      <dd className="flex items-center gap-1.5">
        <PinIcon className="h-4 w-4 text-ink-400" />
        {tutor.location}
      </dd>
    </div>
  )

  /*
    One <dd>, not one per fragment: the rate is a single value, and splitting
    "25" from "per hour" would leave the text content as "25per hour" for
    anything reading the card as text. The `{' '}` is explicit so the space
    survives JSX's line-trimming.
  */
  const rateRow = tutor.hourlyRate !== null && (
    <div className="flex items-baseline">
      <dt className="sr-only">Hourly rate</dt>
      <dd className="text-xl font-bold tracking-[-0.01em] text-ink-900">
        {/*
          No currency symbol: the API sends a bare number and no currency
          field, so printing "$" or "ETB" here would be inventing data.
        */}
        <span>{tutor.hourlyRate}</span>{' '}
        <span className="text-sm font-normal text-ink-500">per hour</span>
      </dd>
    </div>
  )

  const cta = (
    <Link
      to={`/tutors/${encodeURIComponent(tutor.id)}`}
      className={cn(
        'inline-flex w-full items-center justify-center gap-2 rounded-lg font-medium text-white shadow-sm transition-colors',
        isRow ? 'px-4 py-3 text-[0.95rem]' : 'px-4 py-2.5 text-[0.95rem]',
        tutor.hourlyRate !== null
          ? 'bg-accent-500 hover:bg-accent-600'
          : 'bg-brand-600 hover:bg-brand-700',
      )}
    >
      View Profile
      <ArrowIcon className="transition-transform duration-150 group-hover/cta:translate-x-0.5" />
    </Link>
  )

  if (isRow) {
    return (
      <article
        className={cn(
          'group/cta rounded-2xl border border-ink-200 bg-white p-5 sm:p-6',
          'shadow-[0_1px_3px_rgba(18,26,36,0.05)]',
          'transition-[box-shadow,border-color] hover:border-ink-300',
          'hover:shadow-[0_10px_30px_-16px_rgba(18,26,36,0.35)]',
          className,
        )}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
          {avatar}

          <div className="min-w-0 flex-1">
            {heading}
            {headline}

            {/*
              A short excerpt of the tutor's own bio. The server already caps
              `bio` at 200 characters for the card, so this is a teaser and
              `line-clamp-2` keeps it to a couple of lines at any width.
            */}
            {tutor.bio ? (
              <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-ink-600">
                {tutor.bio}
              </p>
            ) : null}

            {subjectChips ? <div className="mt-3.5">{subjectChips}</div> : null}
            {languageChips ? <div className="mt-2">{languageChips}</div> : null}
          </div>

          {/*
            The facts rail. A left rule on desktop so the eye can find the price
            without scanning the prose; a top rule on mobile, where the rail is
            underneath rather than beside.
          */}
          <div className="flex shrink-0 flex-col gap-3 border-t border-ink-100 pt-5 sm:w-52 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            {rateRow}
            <dl className="flex flex-col gap-2 text-sm text-ink-600">
              {modeBadge}
              {locationRow}
            </dl>

            {joined ? (
              <p className="text-xs text-ink-500">On Tedor since {joined}</p>
            ) : null}

            <div className="mt-auto pt-1">{cta}</div>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article
      className={cn(
        'flex h-full flex-col rounded-2xl border border-ink-200 bg-white p-5',
        'shadow-[0_1px_3px_rgba(18,26,36,0.05)]',
        'transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(18,26,36,0.25)]',
        className,
      )}
    >
      <div className="flex items-start gap-4">
        {avatar}
        <div className="min-w-0 flex-1">
          {heading}
          {headline}
        </div>
      </div>

      {subjectChips ? <div className="mt-4">{subjectChips}</div> : null}
      {languageChips ? <div className="mt-2">{languageChips}</div> : null}

      <dl className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-600">
        {modeBadge}
        {locationRow}
        {rateRow}
      </dl>

      <div className="mt-5 pt-1">{cta}</div>
    </article>
  )
}
