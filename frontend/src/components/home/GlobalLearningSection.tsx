import { Link } from 'react-router-dom'

import { Container } from '@/components/layout/PageShell'
import { Reveal } from '@/components/ui/Reveal'

import '../brand/surfaces.css'
import './GlobalLearningSection.css'

/**
 * Learning without borders.
 *
 * The globe is drawn as a wireframe, not as a map. That is a deliberate
 * constraint rather than a shortcut: a filled map of the world would be a
 * prettier picture and a dishonest one. It would imply reach — that we have
 * learners on every continent, that the platform "connects the world" — and the
 * honest statement is narrower and better. Most of our tutoring happens online,
 * it happens in English, and the times are arranged around the learner rather
 * than around Ethiopia. The wireframe says "somewhere out there" and nothing
 * more.
 *
 * Ethiopia is the one marked point, in the accent orange, because it is where
 * the platform is from. Every other node is Tedor blue: reachable, not claimed.
 *
 * Requirements: 7.1–7.5
 */

/** Globe centre and radius in the viewBox below. */
const CX = 230
const CY = 200
const R = 130

/**
 * One hub — Ethiopia — and the places sessions can be run from.
 *
 * Coordinates are hand-placed on the wireframe. They are illustrative positions
 * on an abstract globe, not surveyed locations, and nothing in this file claims
 * a tutor exists in any of them.
 */
const HUB = { x: 272, y: 166 }
const NODES = [
  { x: 150, y: 138, r: 4 },
  { x: 330, y: 122, r: 3.5 },
  { x: 112, y: 248, r: 3.5 },
  { x: 302, y: 292, r: 4 },
  { x: 198, y: 96, r: 3 },
] as const

/** Latitude rings. rx narrows toward the poles by the sphere's own geometry. */
const LATITUDES = [
  { dy: -78, rx: 104 },
  { dy: -40, rx: 123.6 },
  { dy: 0, rx: 130 },
  { dy: 40, rx: 123.6 },
  { dy: 78, rx: 104 },
]

/** Meridians, seen edge-on. rx is rx = R·cos(angle) for each tilt. */
const MERIDIANS = [
  { rx: 84 },
  { rx: 112 },
  { rx: 130 },
]

export function GlobalLearningSection() {
  return (
    <section className="section-y bg-white" aria-labelledby="international-heading">
      <Container>
        <div className="tt-hero relative isolate overflow-hidden rounded-3xl px-6 py-14 sm:px-12 sm:py-16 lg:px-16">
          <div aria-hidden="true" className="tt-grid" />
          <svg
            aria-hidden="true"
            viewBox="0 0 460 400"
            preserveAspectRatio="xMaxYMid slice"
            className="globe pointer-events-none absolute -right-10 -top-6 h-[118%] w-auto opacity-60 sm:-right-4"
          >
            <defs>
              <radialGradient id="globe-glow" cx="50%" cy="46%" r="52%">
                <stop offset="0%" stopColor="#1e96e8" stopOpacity="0.20" />
                <stop offset="70%" stopColor="#1e96e8" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#1e96e8" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Atmosphere, then the wireframe. */}
            <circle cx={CX} cy={CY} r={R} fill="url(#globe-glow)" />
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#2b6f9e" strokeWidth="1.25" />

            <g stroke="#2b6f9e" strokeWidth="0.85" fill="none" opacity="0.65">
              {LATITUDES.map((line) => (
                <ellipse key={`lat-${line.dy}`} cx={CX} cy={CY + line.dy} rx={line.rx} ry={13} />
              ))}
              {MERIDIANS.map((line) => (
                <ellipse key={`mer-${line.rx}`} cx={CX} cy={CY} rx={line.rx} ry={R} />
              ))}
            </g>

            {/* Thin connection lines from the hub out to the other nodes. */}
            <g stroke="#1e96e8" strokeWidth="1" fill="none" opacity="0.5">
              {NODES.map((node) => (
                <path key={`link-${node.x}-${node.y}`} d={`M${HUB.x} ${HUB.y}L${node.x} ${node.y}`} />
              ))}
            </g>

            {/* One line carries a travelling highlight, so the connections read
                as live rather than drawn. */}
            <path
              className="globe-trace"
              d={`M${HUB.x} ${HUB.y}L${NODES[0].x} ${NODES[0].y}`}
              fill="none"
              stroke="#8acdf7"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeDasharray="8 96"
            />

            {NODES.map((node) => (
              <circle key={`node-${node.x}-${node.y}`} cx={node.x} cy={node.y} r={node.r} fill="#1e96e8" />
            ))}

            {/* Ethiopia: the platform's home, in the accent colour. */}
            <circle
              className="globe-pulse"
              cx={HUB.x}
              cy={HUB.y}
              r="9"
              fill="none"
              stroke="#f5801f"
              strokeWidth="1.5"
            />
            <circle cx={HUB.x} cy={HUB.y} r="5.5" fill="#f5801f" />
          </svg>

          {/*
            Scrim. The globe is anchored right and the copy is capped at
            `max-w-2xl`, so the two overlap by roughly 120px at the widest
            breakpoint — and a wireframe crossing a line of body text is the one
            thing that made this panel feel busy. Fading the graphic out toward
            the left keeps the sphere whole on the right and hands the left half
            of the panel back to the words. Decorative, and behind the content.
          */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/85 to-ink-950/30"
          />

          <div className="relative max-w-2xl">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-300">
                International
              </p>
              <h2
                id="international-heading"
                className="mt-3 text-3xl font-bold tracking-[-0.025em] text-white sm:text-4xl"
              >
                Learning without borders.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-brand-100">
                Whether you&apos;re learning from Addis Ababa or connecting from somewhere around
                the world, Tedor Tutors makes quality tutoring accessible wherever you are.
              </p>
            </Reveal>

            <ul className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {[
                {
                  title: 'Online tutoring',
                  description: 'Sessions over video, so the tutor does not have to be in your city.',
                },
                {
                  title: 'Flexible scheduling',
                  description:
                    'Agree lesson times directly with your tutor rather than fitting a fixed timetable.',
                },
                {
                  title: 'School and university subjects',
                  description: 'From primary maths to degree-level coursework and assignments.',
                },
                {
                  title: 'Exam preparation',
                  description: 'Structured help for national, university and entrance examinations.',
                },
              ].map((feature) => (
                <li key={feature.title} className="flex items-start gap-3.5">
                  <span
                    aria-hidden="true"
                    className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-500/15"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#f5801f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 8.5l3.2 3.2L13 5" />
                    </svg>
                  </span>
                  <span>
                    <span className="block font-medium text-white">{feature.title}</span>
                    <span className="mt-1 block text-[0.95rem] leading-relaxed text-brand-200/90">
                      {feature.description}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-10">
              <Link
                to="/tutors"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3.5 text-base font-medium text-ink-950 transition-colors hover:bg-brand-50"
              >
                Find a Tutor
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-transform duration-150 group-hover:translate-x-0.5"
                >
                  <path d="M2 8h11" />
                  <path d="M9 4l4 4-4 4" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
