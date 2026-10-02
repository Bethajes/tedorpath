import { Link } from 'react-router-dom'

import { TrustSection } from '@/components/about/TrustSection'
import { Container, PageShell } from '@/components/layout/PageShell'

/**
 * /about — the page that says what the platform is and why it can be relied on.
 *
 * The argument, in the order it is made: what Tedor does, the four claims it can
 * defend (TrustSection, carried here rather than on the homepage), the door for
 * tutors, and the door for learners.
 *
 * Reading measure throughout: `max-w-3xl` inside a padded `PageShell`, so the
 * section components here lay themselves out inline rather than as full-width
 * bands the way the homepage and /how-it-works do.
 */
export function AboutPage() {
  return (
    <PageShell>
      <Container className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-[-0.02em] text-ink-900 sm:text-4xl">
          About Tedor Tutors
        </h1>

        <div className="mt-6 flex flex-col gap-4 text-lg leading-relaxed text-ink-600">
          <p>
            Tedor Tutors connects students with tutors for personalized learning, online or in
            person.
          </p>
          <p>
            We keep the process simple. You share what you need help with, our team reviews your
            request, and we contact you to help you find a suitable tutor.
          </p>
          <p>
            Whether you are preparing for an exam, catching up on a subject, or building a new
            skill, tell us where you are and we will help you take the next step.
          </p>
        </div>

        <TrustSection />

        <section
          id="become-a-tutor"
          aria-labelledby="become-a-tutor-heading"
          className="mt-12 scroll-mt-28 rounded-2xl border border-ink-200 bg-ink-50 p-6 sm:p-8"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-accent-700">
            For tutors
          </p>
          <h2
            id="become-a-tutor-heading"
            className="mt-3 text-2xl font-bold tracking-[-0.02em] text-ink-900"
          >
            Become a tutor
          </h2>
          <p className="mt-3 leading-relaxed text-ink-600">
            We are still building the Tedor tutor network and tutor registration is not open
            yet. If you teach a subject covered on the site and would like to be considered when
            it opens, get in touch and tell us what you teach.
          </p>
          <Link
            to="/contact"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 py-3 text-[0.95rem] font-medium text-white transition-colors hover:bg-brand-700"
          >
            Get in touch
          </Link>
        </section>

        <div className="mt-12 rounded-2xl border border-brand-200 bg-brand-50/60 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-ink-900">Ready to get started?</h2>
          <p className="mt-1.5 leading-relaxed text-ink-600">
            Send us a request and our team will take it from there.
          </p>
          <Link
            to="/request-tutor"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 py-3 text-[0.95rem] font-medium text-white transition-colors hover:bg-brand-700"
          >
            Find a Tutor
          </Link>
        </div>
      </Container>
    </PageShell>
  )
}
