import type { Subject } from '@/types/tutorRequest'

/**
 * Line icons for the subject cards. One 24×24 grid, 1.7 stroke, `currentColor`
 * so the tile can colour them. Kept as plain paths so the site adds no icon
 * dependency.
 */
const PATHS: Record<Subject, React.ReactNode> = {
  Mathematics: (
    <>
      <path d="M4 20V5" />
      <path d="M4 20h16" />
      <path d="M7 15c2.5 0 3-9 5.5-9S16 15 18.5 15" />
    </>
  ),
  Physics: (
    <>
      <circle cx="12" cy="12" r="2.4" />
      <ellipse cx="12" cy="12" rx="10" ry="4.4" />
      <ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(120 12 12)" />
    </>
  ),
  Chemistry: (
    <>
      <path d="M9.5 3h5" />
      <path d="M10.5 3v6.2L5.4 18a2 2 0 0 0 1.7 3h9.8a2 2 0 0 0 1.7-3l-5.1-8.8V3" />
      <path d="M7.2 15h9.6" />
    </>
  ),
  Biology: (
    <>
      <path d="M4.5 19.5C4.5 11 10 5.5 19.5 4.5c1 9.5-4.5 15-13 15Z" />
      <path d="M9 15c1.8-2.6 4-4.6 6.5-6" />
    </>
  ),
  English: (
    <>
      <path d="M3.5 5.5h7a2.5 2.5 0 0 1 2 1 2.5 2.5 0 0 1 2-1h6v12h-6a2.5 2.5 0 0 0-2 1 2.5 2.5 0 0 0-2-1h-7Z" />
      <path d="M12.5 7v12" />
    </>
  ),
  Programming: (
    <>
      <path d="M8.5 8 4 12l4.5 4" />
      <path d="M15.5 8 20 12l-4.5 4" />
      <path d="M13.5 5.5 10.5 18.5" />
    </>
  ),
  'AI & Technology': (
    <>
      <rect x="7.5" y="7.5" width="9" height="9" rx="1.5" />
      <path d="M10.5 3.5v4M13.5 3.5v4M10.5 16.5v4M13.5 16.5v4M3.5 10.5h4M3.5 13.5h4M16.5 10.5h4M16.5 13.5h4" />
    </>
  ),
  'University Course': (
    <>
      <path d="M2.5 8.5 12 4l9.5 4.5L12 13Z" />
      <path d="M6.5 10.8V16c0 1.6 2.5 3 5.5 3s5.5-1.4 5.5-3v-5.2" />
      <path d="M21.5 8.5V14" />
    </>
  ),
  'Exam Preparation': (
    <>
      <path d="M8 4.5h9.5A1.5 1.5 0 0 1 19 6v14a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V6A1.5 1.5 0 0 1 8 4.5Z" />
      <path d="M10 2.5v4M16 2.5v4" />
      <path d="m9.5 13 2 2 4-4" />
    </>
  ),
  Other: (
    <>
      <circle cx="6" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18" cy="12" r="1.4" />
    </>
  ),
}

export interface SubjectIconProps {
  subject: Subject
  className?: string
}

export function SubjectIcon({ subject, className }: SubjectIconProps) {
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
      {PATHS[subject]}
    </svg>
  )
}
