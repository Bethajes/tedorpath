import { Logo } from '@/components/brand/Logo'
import { Container } from '@/components/layout/PageShell'

/**
 * Brand statement built on the logo's upward arrow: progress, growth,
 * direction. The mark is shown larger here because the section is about the
 * idea behind it, not the product.
 */
export function BrandStory() {
  return (
    <section className="section-y bg-ink-50">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div className="flex justify-center lg:justify-end">
            <div className="flex h-52 w-52 items-center justify-center rounded-3xl border border-ink-200 bg-white p-10 shadow-[0_18px_50px_-30px_rgba(18,26,36,0.45)] sm:h-60 sm:w-60">
              <Logo size="xl" withWordmark={false} />
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
              Learning should move you forward.
            </h2>
            <div className="mt-5 flex flex-col gap-4 text-lg leading-relaxed text-ink-600">
              <p>
                The arrow in our mark points up and to the right. It is the idea we keep coming
                back to: every lesson should leave you further forward than it found you.
              </p>
              <p>
                At Tedor Tutors, we believe the right guidance can change the way you learn. We
                connect learners with tutoring support that fits their goals, their level, and the
                way they study best.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
