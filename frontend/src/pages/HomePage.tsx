import { BecomeATutorSection } from '@/components/home/BecomeATutorSection'
import { CTASection } from '@/components/home/CTASection'
import { GlobalLearningSection } from '@/components/home/GlobalLearningSection'
import { Hero } from '@/components/home/Hero'
import { LearnerTutorConnection } from '@/components/home/LearnerTutorConnection'
import { LearningJourney } from '@/components/home/LearningJourney'
import { StatsSection } from '@/components/home/StatsSection'
import { TrustSection } from '@/components/home/TrustSection'
import { UniversityTrustStrip } from '@/components/home/UniversityTrustStrip'
import { VerificationSteps } from '@/components/home/VerificationSteps'
import { TestimonialsSection } from '@/components/testimonials/TestimonialsSection'
import { PageShell } from '@/components/layout/PageShell'

/**
 * The homepage, in the order a visitor needs it.
 *
 * The argument the page makes, in order:
 *
 *  1. Hero — the promise and the search box, so there is something to act on
 *     within seconds of landing. Carries the page's only <h1> (Requirements 2.1,
 *     13.3) and the subject / level / mode discovery form that navigates to
 *     `/tutors` (Requirements 2.3, 2.5).
 *  2. UniversityTrustStrip — the first evidence that tutors are real people with
 *     real academic backgrounds.
 *  3. StatsSection — the scale of the live marketplace, from the API. No other
 *     section is allowed to print a number, so that this one can be trusted.
 *  4. VerificationSteps — why the tutors are trustworthy, and what the review
 *     actually involves.
 *  5. TestimonialsSection — learner experiences as a two-row stream. Bundled
 *     content is clearly-labelled demo data until real reviews arrive; see
 *     components/testimonials/testimonialData.ts.
 *  6. LearningJourney — the four steps of the path, as a section rather than a
 *     metaphor. Carries the `how-it-works` anchor the navbar and footer link to.
 *  7. LearnerTutorConnection — learners on one side, tutors on the other, and
 *     Tedor as the thing that does the matching between them.
 *  8. GlobalLearningSection — for the visitor who is not in Ethiopia.
 *  9. TrustSection — the four claims the platform can actually defend.
 * 10. BecomeATutorSection — the other kind of visitor, deliberately late
 *     (Requirement 9.4).
 * 11. CTASection — one last pair of doors.
 *
 * The tutor directory is not previewed here, and neither are the subjects. The
 * hero's search card and the navbar are the way in, and the directory page does
 * both jobs properly — a sample of profiles and a subject index on the homepage
 * repeated those routes rather than shortening them. That is why the page
 * carries no `#subjects` anchor, and why the navbar's "Subjects" entry now goes
 * to the directory rather than to a section that is no longer here.
 *
 * Requirements: 2.1, 12.1, 12.4, 13.3, 15.1
 */
export function HomePage() {
  return (
    <PageShell bare>
      {/* The only <h1> on the page. Requirement 2.1, 13.3. */}
      <Hero />

      <UniversityTrustStrip />
      <StatsSection />
      <VerificationSteps />
      <TestimonialsSection />
      <LearningJourney />
      <LearnerTutorConnection />
      <GlobalLearningSection />
      <TrustSection />
      <BecomeATutorSection />
      <CTASection />
    </PageShell>
  )
}
