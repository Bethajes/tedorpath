import { useState } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/cn'
import { resolveImageUrl } from '@/lib/api'

import { TEACHING_MODE_LABELS } from '../tutors.types'
import type { TutorCardDTO } from '../tutors.types'

/**
 * One tutor in the public directory.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 *
 * The card shows only fields the API actually sends. There are no ratings, no
 * lesson counts and no testimonials here (Requirement 9.4): none of those are
 * backed by a data model, and inventing them would put a number in front of a
 * visitor that nobody can substantiate.
 */

const MAX_VISIBLE_SUBJECTS = 2

export interface TutorCardProps {
  tutor: TutorCardDTO
  className?: string
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
}: {
  displayName: string
  photoUrl: string | null
  onBrokenImage: () => void
}) {
  const label = `${displayName} profile photo`

  // Uploaded photos are stored as a path relative to the API origin, so it has
  // to be resolved before it can be used as an `img src`.
  const resolvedPhotoUrl = resolveImageUrl(photoUrl)

  if (resolvedPhotoUrl) {
    return (
      <img
        src={resolvedPhotoUrl}
        alt={label}
        onError={onBrokenImage}
        className="h-14 w-14 shrink-0 rounded-full border border-ink-200 bg-ink-100 object-cover"
      />
    )
  }

  const initials = initialsOf(displayName)

  return (
    <div
      role="img"
      aria-label={`${label} placeholder`}
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-lg font-semibold text-brand-700"
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
          className="h-7 w-7"
        >
          <circle cx="12" cy="8.5" r="3.4" />
          <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
        </svg>
      )}
    </div>
  )
}

export function TutorCard({ tutor, className }: TutorCardProps) {
  // A stored photo URL can stop resolving after the fact, so the fallback is
  // triggered by the load failing, not only by the field being null.
  const [photoBroken, setPhotoBroken] = useState(false)
  const photoUrl = photoBroken ? null : tutor.profilePhotoUrl

  const visibleSubjects = tutor.subjects.slice(0, MAX_VISIBLE_SUBJECTS)
  const hiddenSubjectCount = tutor.subjects.length - visibleSubjects.length

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
        <Avatar
          displayName={tutor.displayName}
          photoUrl={photoUrl}
          onBrokenImage={() => setPhotoBroken(true)}
        />

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-ink-900">{tutor.displayName}</h3>
          <p className="mt-0.5 line-clamp-2 text-sm text-ink-600">{tutor.headline}</p>
        </div>
      </div>

      {visibleSubjects.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Subjects">
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
      )}

      <dl className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-600">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Teaching mode</dt>
          <dd className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent-700">
            {TEACHING_MODE_LABELS[tutor.teachingMode]}
          </dd>
        </div>

        {tutor.location && (
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Location</dt>
            <dd className="flex items-center gap-1.5">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 text-ink-400"
              >
                <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              {tutor.location}
            </dd>
          </div>
        )}

        {tutor.hourlyRate !== null && (
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Hourly rate</dt>
            <dd>
              {/*
                No currency symbol: the API sends a bare number and no currency
                field, so printing "$" or "ETB" here would be inventing data.
              */}
              {tutor.hourlyRate} per hour
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-5 pt-1">
        <Link
          to={`/tutors/${encodeURIComponent(tutor.id)}`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-[0.95rem] font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          View Profile
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
            className="transition-transform duration-150"
          >
            <path d="M2 8h11" />
            <path d="M9 4l4 4-4 4" />
          </svg>
        </Link>
      </div>
    </article>
  )
}
