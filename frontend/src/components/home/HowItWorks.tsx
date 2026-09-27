import { Container } from '@/components/layout/PageShell'

const STEPS = [
  {
    title: 'Tell Us What You Need',
    description: 'Submit your tutoring requirements.',
  },
  {
    title: 'Our Team Reviews Your Request',
    description: 'Tedor manually reviews the request.',
  },
  {
    title: 'We Contact You',
    description:
      'Our team contacts the client and helps them find a suitable tutor.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-slate-50">
      <Container className="py-14 sm:py-16">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          How it works
        </h2>

        <ol className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-xl border border-slate-200 bg-white p-6">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{step.description}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  )
}
