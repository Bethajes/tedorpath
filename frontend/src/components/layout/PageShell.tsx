import type { ReactNode } from 'react'

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
      <Navbar />
      <main id="main-content" className={cn('flex-1', !bare && 'py-10 sm:py-14', className)}>
        {children}
      </main>
      <Footer />
    </div>
  )
}

/** Consistent max width + horizontal padding for page content. */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-6xl px-4 sm:px-6', className)}>{children}</div>
}
