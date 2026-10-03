import type { ReactNode } from 'react'

/**
 * Admin icons.
 *
 * Inline SVG rather than an icon package, for the same reason the sidebar was:
 * the admin bundle is not shipped to the public site, and a handful of paths
 * costs less than a dependency.
 *
 * All on one 24×24 grid and drawn with `fill`, so they sit optically consistent
 * next to each other in the sidebar and the KPI cards. `currentColor` is never
 * used here because the caller decides the colour through `fill-*` on the `<svg>`,
 * which is how the nav icons have always worked.
 */
export type AdminIconName =
  | 'dashboard'
  | 'requests'
  | 'tutors'
  | 'matching'
  | 'messages'
  | 'analytics'
  | 'content'
  | 'settings'
  | 'search'
  | 'bell'
  | 'plus'
  | 'check'
  | 'clock'
  | 'document'
  | 'alert'
  | 'arrowRight'
  | 'sparkle'
  | 'menu'
  | 'close'
  | 'chevronDown'

const PATHS: Record<AdminIconName, ReactNode> = {
  dashboard: (
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h3A1.5 1.5 0 0 1 10 5.5v3A1.5 1.5 0 0 1 8.5 10h-3A1.5 1.5 0 0 1 4 8.5v-3Zm6 8a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 16 13.5v3A1.5 1.5 0 0 1 14.5 18h-3A1.5 1.5 0 0 1 10 16.5v-3Zm-6 0A1.5 1.5 0 0 1 5.5 12h3a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 8.5 18h-3A1.5 1.5 0 0 1 4 15.5v-3Zm10.5-9.5h3A1.5 1.5 0 0 1 19 5.5v3A1.5 1.5 0 0 1 17.5 10h-3A1.5 1.5 0 0 1 13 8.5v-3A1.5 1.5 0 0 1 14.5 4Z" />
  ),
  requests: (
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.4A.75.75 0 0 1 4.5 18.8V16h-.2A.75.75 0 0 1 4 15.2V6.5Z" />
  ),
  tutors: (
    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 1.5c-3.6 0-6.5 1.9-6.5 4.25V19a.75.75 0 0 0 .75.75h11.5A.75.75 0 0 0 18.5 19v-1.25C18.5 15.4 15.6 13.5 12 13.5Z" />
  ),
  matching: (
    <path d="M7.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm9 1.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM3 19.5c0-2.76 2.01-5 4.5-5s4.5 2.24 4.5 5a.75.75 0 0 1-.75.75H3.75A.75.75 0 0 1 3 19.5Zm11.4-.35c.36-.93.6-1.9.6-2.9 0-1.2-.32-2.33-.88-3.34.9-.43 1.91-.66 2.98-.66 2.49 0 4.5 2.24 4.5 5a.75.75 0 0 1-.75.75h-5.7a.75.75 0 0 1-.75-1.85Z" />
  ),
  messages: (
    <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v8a2.5 2.5 0 0 1-2.5 2.5H9.6l-4.4 3.3A.75.75 0 0 1 4 19.7V17h-.5A.5.5 0 0 1 3 16.5v-10Z" />
  ),
  analytics: (
    <path d="M5 19V9.5h3.25V19H5Zm5.4 0V4.5h3.25V19h-3.25Zm5.35 0v-6.25H19V19h-3.25Z" />
  ),
  content: (
    <path d="M6 3.75h8.5L19 8.25v12a.75.75 0 0 1-.75.75h-12a.75.75 0 0 1-.75-.75v-15a.75.75 0 0 1 .5-.75Zm7.75 1.5v3.5h3.5l-3.5-3.5ZM8.25 11.5v1.5h7.5v-1.5h-7.5Zm0 3.75V17h7.5v-1.75h-7.5Z" />
  ),
  settings: (
    <path d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Zm8.44 4.94a7.6 7.6 0 0 0 0-2.38l1.9-1.44a.5.5 0 0 0 .12-.62l-1.8-3.12a.5.5 0 0 0-.59-.22l-2.24.9a7.3 7.3 0 0 0-2.06-1.2L15.43 2.9a.5.5 0 0 0-.5-.42h-3.6a.5.5 0 0 0-.5.42l-.34 2.22c-.73.29-1.43.69-2.06 1.2l-2.24-.9a.5.5 0 0 0-.59.22l-1.8 3.12a.5.5 0 0 0 .12.62l1.9 1.44a7.6 7.6 0 0 0 0 2.38l-1.9 1.44a.5.5 0 0 0-.12.62l1.8 3.12c.13.22.38.32.59.22l2.24-.9c.63.51 1.33.91 2.06 1.2l.34 2.22c.04.24.25.42.5.42h3.6c.25 0 .46-.18.5-.42l.34-2.22c.73-.29 1.43-.69 2.06-1.2l2.24.9c.21.1.46 0 .59-.22l1.8-3.12a.5.5 0 0 0-.12-.62l-1.9-1.44Z" />
  ),
  search: (
    <path d="M10.5 3a7.5 7.5 0 1 1-4.7 13.34l-3.22 3.22a.75.75 0 1 1-1.06-1.06l3.22-3.22A7.5 7.5 0 0 1 10.5 3Zm0 1.5a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z" />
  ),
  bell: (
    <path d="M12 2.5a6 6 0 0 1 6 6v3.43l1.2 2.4A1.5 1.5 0 0 1 17.87 17H6.13A1.5 1.5 0 0 1 4.8 14.33L6 11.93V8.5a6 6 0 0 1 6-6Zm0 15.5a3 3 0 0 0 2.83-2H9.17a3 3 0 0 0 2.83 2Z" />
  ),
  plus: <path d="M11.25 4.5h1.5v6.75h6.75v1.5h-6.75V19.5h-1.5v-6.75H4.5v-1.5h6.75V4.5Z" />,
  check: (
    <path d="M20.03 6.97a.75.75 0 0 1 .01 1.06l-9 9a.75.75 0 0 1-1.06.01l-4.5-4.5a.75.75 0 1 1 1.06-1.06L10.5 15.44l8.47-8.47a.75.75 0 0 1 1.06 0Z" />
  ),
  clock: (
    <path d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 1.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm.75 3.25v4.03l2.6 1.55a.75.75 0 0 1-.75 1.3l-3-1.79a.75.75 0 0 1-.35-.65V7.75a.75.75 0 0 1 1.5 0Z" />
  ),
  document: (
    <path d="M6 3.75h8.5L19 8.25v12a.75.75 0 0 1-.75.75h-12a.75.75 0 0 1-.75-.75v-15a.75.75 0 0 1 .5-.75Zm7.75 1.5v3.5h3.5l-3.5-3.5Z" />
  ),
  alert: (
    <path d="M12 3.6a1.5 1.5 0 0 1 1.3.76l8 14A1.5 1.5 0 0 1 20 20.6H4a1.5 1.5 0 0 1-1.3-2.24l8-14A1.5 1.5 0 0 1 12 3.6Zm0 4.9a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 0 1.5 0v-4.5A.75.75 0 0 0 12 8.5Zm0 8a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
  ),
  arrowRight: (
    <path d="M13.5 4.72a.75.75 0 0 1 1.06 1.06L10.81 9.5H19a.75.75 0 0 1 0 1.5h-8.19l3.75 3.72a.75.75 0 1 1-1.06 1.06l-5-4.96a.75.75 0 0 1 0-1.07l5-4.97Z" />
  ),
  sparkle: (
    <path d="M12 2.75c.3 0 .57.19.66.47l.98 3.06a3 3 0 0 0 2.03 2.03l3.06.98a.7.7 0 0 1 0 1.32l-3.06.98a3 3 0 0 0-2.03 2.03l-.98 3.06a.7.7 0 0 1-1.32 0l-.98-3.06a3 3 0 0 0-2.03-2.03l-3.06-.98a.7.7 0 0 1 0-1.32l3.06-.98a3 3 0 0 0 2.03-2.03l.98-3.06a.7.7 0 0 1 .66-.47Zm6.75 12.5c.18 0 .34.11.4.27l.5 1.53a1.6 1.6 0 0 0 1.07 1.07l1.53.5a.35.35 0 0 1 0 .66l-1.53.5a1.6 1.6 0 0 0-1.07 1.07l-.5 1.53a.35.35 0 0 1-.66 0l-.5-1.53a1.6 1.6 0 0 0-1.07-1.07l-1.53-.5a.35.35 0 0 1 0-.66l1.53-.5a1.6 1.6 0 0 0 1.07-1.07l.5-1.53a.4.4 0 0 1 .4-.27Z" />
  ),
  menu: (
    <path d="M3.75 6.5a.75.75 0 0 1 .75-.75h15a.75.75 0 0 1 0 1.5h-15a.75.75 0 0 1-.75-.75Zm0 5.5a.75.75 0 0 1 .75-.75h15a.75.75 0 0 1 0 1.5h-15a.75.75 0 0 1-.75-.75Zm.75 4.75a.75.75 0 0 0 0 1.5h15a.75.75 0 0 0 0-1.5h-15Z" />
  ),
  close: (
    <path d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 0 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" />
  ),
  chevronDown: (
    <path d="M5.97 8.47a.75.75 0 0 1 1.06 0L12 13.44l4.97-4.97a.75.75 0 0 1 1.06 1.06l-5.5 5.5a.75.75 0 0 1-1.06 0l-5.5-5.5a.75.75 0 0 1 0-1.06Z" />
  ),
}

export interface AdminIconProps {
  name: AdminIconName
  className?: string
}

/**
 * One icon. `aria-hidden` unconditionally: every icon in the admin area sits
 * beside a text label or inside a control that already has an accessible name,
 * so an announced icon would be noise.
 */
export function AdminIcon({ name, className }: AdminIconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      {PATHS[name]}
    </svg>
  )
}
