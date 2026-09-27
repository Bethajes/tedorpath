import { Container } from '@/components/layout/PageShell'

const REASONS = [
  {
    title: 'Personalized support',
    description:
      'Every request is read by our team, so the tutor we suggest fits your goals and pace.',
  },
  {
    title: 'Online or in person',
    description:
      'Choose the learning mode that suits you — online lessons, in-person sessions, or either.',
  },
  {
    title: 'A simple process',
    description:
      'No complicated sign-up. Share what you need and we will take it from there.',
  },
]

export function WhyTedor() {
  return (
    <section className="bg-white">
      <Container className="py-14 sm:py-16">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Why choose Tedor Tutors
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {REASONS.map((reason) => (
            <div key={reason.title} className="rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900">{reason.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{reason.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
