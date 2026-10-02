import { Link } from 'react-router-dom'

import { heroPhoto, heroPhotoSrc } from '@/components/home/heroPhotos'
import { Container } from '@/components/layout/PageShell'
import { Reveal } from '@/components/ui/Reveal'

import { ArrowRightIcon, CheckIcon, ShieldCheckIcon } from './HowItWorksIcons'
import { PROMISE_POINTS } from './howItWorksContent'

import './HowItWorks.css'

/**
 * The promise, and the photograph that makes it believable.
 *
 * If the first tutor is not right, we re-match at no extra charge. That is a
 * commitment, and a commitment shown next to a stock illustration of a smiling
 * family is worth nothing — so the image here is a real lesson in progress,
 * and the three lines under it are the three things that actually have to
 * happen for the promise to be kept.
 *
 * The wording is deliberately plain. There is no "guaranteed results" and no
 * "100% satisfaction": what we offer is a second look, quickly and for free,
 * which is a promise the team can keep by hand.
 */
export function HowItWorksPromise() {
  const session = heroPhoto('study')

  return (
    <section
      aria-labelledby="promise-heading"
      className="section-y relative isolate bg-ink-50"
    >
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <Reveal>
            <span
              aria-hidden="true"
              className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-brand-700 ring-1 ring-brand-100"
            >
              <ShieldCheckIcon className="h-7 w-7" />
            </span>
          </Reveal>

          <Reveal delay={70}>
            <p className="mt-7 text-sm font-semibold uppercase tracking-[0.14em] text-accent-700">
              Our promise
            </p>
            <h2
              id="promise-heading"
              className="mt-3 text-3xl font-bold tracking-[-0.025em] sm:text-4xl"
            >
              The right fit — or we fix it
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-ink-600">
              We are confident in our matching, but we would rather redo it than have you settle.
              If your first tutor is not right, tell us and we will find you another one at{' '}
              <strong className="font-semibold text-ink-900">no extra charge</strong>.
            </p>
          </Reveal>

          <Reveal delay={140}>
            <ul className="mt-9 grid gap-6">
              {PROMISE_POINTS.map((point) => (
                <li key={point.title} className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-500/12 text-accent-600"
                  >
                    <CheckIcon className="h-3.5 w-3.5" />
                  </span>
                  <span>
                    <span className="block font-semibold text-ink-900">{point.title}</span>
                    <span className="mt-1 block text-[0.95rem] leading-relaxed text-ink-600">
                      {point.description}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={200}>
            <Link
              to="/request-tutor"
              className="group mt-9 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-base font-semibold text-white transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-[0_14px_30px_-16px_rgba(15,120,196,0.9)]"
            >
              Request a tutor
              <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>

        <Reveal delay={120} className="relative">
          <div aria-hidden="true" className="tt-dots" />

          <div className="tt-photo relative aspect-[4/3] rotate-0 rounded-3xl shadow-[0_34px_70px_-40px_rgba(18,26,36,0.6)]">
            <img
              src={heroPhotoSrc(session)}
              alt={session.alt}
              width={400}
              height={500}
              loading="lazy"
              decoding="async"
              style={{ objectPosition: session.objectPosition }}
            />
          </div>

          {/*
            A label, not a control. Set across the frame's lower edge so the
            picture and the sentence about it read as one object.
          */}
          <p className="tt-chip absolute -bottom-4 left-5 mt-0 sm:left-8">
            <span aria-hidden="true" className="tt-chip-dot tt-chip-dot--accent" />
            Lessons run on your schedule
          </p>
        </Reveal>
      </Container>
    </section>
  )
}
