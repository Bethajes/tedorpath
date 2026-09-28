import type { ReactNode } from 'react'

import { ScrollToHash } from '@/app/ScrollToHash'
import { cn } from '@/lib/cn'

import { Footer } from './Footer'
import { Navbar } from './Navbar'

export interface PageShellProps {
  children: ReactNode
  /** Removes the vertical padding for pages that manage their own spacing. */
  bare?: boolean
  className?: string
}

/** Shared page chrome: header, main landmark and footer. */
export function PageShell({ children, bare = false, className }: PageShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <ScrollToHash />
      <Navbar />
      <main id="main-content" className={cn('flex-1', !bare && 'py-10 sm:py-14', className)}>
        {children}
      </main>
      <Footer />
    </div>
  )
}

/**
 * Consistent max width + horizontal padding for page content.
 *
 * 1280px at the widest breakpoint, centred, with gutters that grow on larger
 * screens. Narrower reading pages (about, contact, the request form) pass a
 * `max-w-*` class to opt out of the full width.
 */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10', className)}>
      {children}
    </div>
  )
}
