import { CTASection } from '@/components/home/CTASection'
import { GlobalLearningSection } from '@/components/home/GlobalLearningSection'
import { Hero } from '@/components/home/Hero'
import { StatsSection } from '@/components/home/StatsSection'
import { UniversityTrustStrip } from '@/components/home/UniversityTrustStrip'
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
 *  4. TestimonialsSection — learner experiences as a two-row stream. Bundled
 *     content is clearly-labelled demo data until real reviews arrive; see
 *     components/testimonials/testimonialData.ts.
 *  5. GlobalLearningSection — for the visitor who is not in Ethiopia.
 *  6. CTASection — one last pair of doors.
 *
 * The tutor invitation no longer has a section of its own here. The argument it
 * made is the one CTASection closes with, and /become-a-tutor is still a navbar
 * and footer link away, so nothing became unreachable by dropping it.
 *
 * The four-step learning journey is no longer on the homepage. The same four
 * steps are covered by /how-it-works, which is where the navbar's "How It
 * Works" entry and the footer both point. The homepage therefore carries no
 * `how-it-works` anchor, and those links address the page instead.
 *
 * How a tutor profile gets reviewed and published is no longer on the homepage.
 * It is covered by /how-it-works.
 *
 * Neither is the "why learners trust Tedor" section. The four claims the
 * platform can defend are a case for trust, and a homepage visitor is not
 * reading to be persuaded — they are scanning for a tutor and for the button
 * that starts the request. TrustSection therefore lives on /about, which is
 * the page a visitor reads before deciding, and /about is a navbar and footer
 * link away.
 *
 * The tutor directory is not previewed here, and neither are the subjects. The
 * hero's search card and the navbar are the way in, and the directory page does
 * both jobs properly — a sample of profiles and a subject index on the homepage
 * repeated those routes rather than shortening them. That is why the page
 * carries no `#subjects` anchor, and why the navbar's "Subjects" entry now goes
 * to the directory rather than to a section that is no longer here.
 *
 * The learner/tutor connection section is gone from the homepage too. What it
 * claimed — that a learner brings a goal and a tutor brings subjects, and Tedor
 * sits between them — is said more carefully by /how-it-works, which is a navbar
 * and footer link away. A middle column of sample profiles on the marketing page
 * repeated the directory without adding to it, so the page now shows no tutor
 * cards at all.
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
      <TestimonialsSection />
      <GlobalLearningSection />
      <CTASection />
    </PageShell>
  )
}
