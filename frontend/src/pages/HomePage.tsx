import { BecomeATutorSection } from '@/components/home/BecomeATutorSection'
import { CTASection } from '@/components/home/CTASection'
import { FeaturedTutors } from '@/components/home/FeaturedTutors'
import { GlobalLearningSection } from '@/components/home/GlobalLearningSection'
import { Hero } from '@/components/home/Hero'
import { LearnerTutorConnection } from '@/components/home/LearnerTutorConnection'
import { LearningJourney } from '@/components/home/LearningJourney'
import { StatsSection } from '@/components/home/StatsSection'
import { SubjectGrid } from '@/components/home/SubjectGrid'
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
 *  5. FeaturedTutors — proof rather than promise: the actual approved profiles.
 *  6. TestimonialsSection — learner experiences as a two-row stream. Bundled
 *     content is clearly-labelled demo data until real reviews arrive; see
 *     components/testimonials/testimonialData.ts.
 *  7. LearningJourney — the four steps of the path, as a section rather than a
 *     metaphor. Carries the `how-it-works` anchor the navbar and footer link to.
 *  8. LearnerTutorConnection — learners on one side, tutors on the other, and
 *     Tedor as the thing that does the matching between them.
 *  9. GlobalLearningSection — for the visitor who is not in Ethiopia.
 * 10. TrustSection — the four claims the platform can actually defend.
 * 11. SubjectGrid — browse by topic, reusing the existing component unchanged.
 * 12. BecomeATutorSection — the other kind of visitor, deliberately late
 *     (Requirement 9.4).
 * 13. CTASection — one last pair of doors.
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
      <FeaturedTutors />
      <TestimonialsSection />
      <LearningJourney />
      <LearnerTutorConnection />
      <GlobalLearningSection />
      <TrustSection />
      <SubjectGrid />
      <BecomeATutorSection />
      <CTASection />
    </PageShell>
  )
}
