import { PageShell } from '@/components/layout/PageShell'

import { HowItWorksCta } from '@/components/howItWorks/HowItWorksCta'
import { HowItWorksFaq } from '@/components/howItWorks/HowItWorksFaq'
import { HowItWorksHero } from '@/components/howItWorks/HowItWorksHero'
import { HowItWorksPromise } from '@/components/howItWorks/HowItWorksPromise'
import { HowItWorksStats } from '@/components/howItWorks/HowItWorksStats'
import { HowItWorksSteps } from '@/components/howItWorks/HowItWorksSteps'

/**
 * /how-it-works — the page that answers "what actually happens if I press the
 * button?", and the only page whose job is to be understood rather than used.
 *
 * The argument, in the order it is made:
 *
 *  1. Hero — the promise and both ways in, over the people it is about.
 *  2. HowItWorksSteps — the three steps, as cards a reader can point at.
 *  3. HowItWorksStats — what the marketplace actually looks like, counted live.
 *  4. HowItWorksPromise — the re-match commitment, next to a real lesson.
 *  5. HowItWorksFaq — the questions that come after the hero's promise.
 *  6. HowItWorksCta — two doors, and no invented numbers next to them.
 *
 * The colour rhythm is deliberate: navy, white, navy, grey, white, then a navy
 * panel that meets the footer's own dark chrome. Alternating the two extremes
 * is what keeps a long, mostly-textual page from turning into a wall.
 *
 * Section components live in `components/howItWorks/`; the copy they render
 * lives in `howItWorksContent.ts`, so the argument can be edited without
 * touching a layout. Heading order is h1 (hero) → h2 (one per section) → h3
 * (steps only), with no level skipped (Requirements 12.4, 13.4).
 */
export function HowItWorksPage() {
  return (
    <PageShell bare>
      <HowItWorksHero />
      <HowItWorksSteps />
      <HowItWorksStats />
      <HowItWorksPromise />
      <HowItWorksFaq />
      <HowItWorksCta />
    </PageShell>
  )
}
