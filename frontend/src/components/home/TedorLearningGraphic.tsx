import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

import { Logo } from '@/components/brand/Logo'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'

import './TedorLearningGraphic.css'

/**
 * Tedor learning journey — the homepage hero graphic.
 *
 * One idea, built from the logo's own: a blue line that leaves a foundation and
 * rises into the orange growth arrow. Learning is the start, the arrow is where
 * it is going, and the moving point between them is the learner making progress.
 *
 * The composition is deliberately abstract — no axes, no figures, no fake
 * people or statistics — so the mark stays the only claim the graphic makes.
 *
 * Motion is split so that most of it costs nothing per frame:
 *   - CSS keyframes draw the path, drift the grid, breathe the rings, float
 *     the arrow and the learning icons.
 *   - A single requestAnimationFrame loop moves the progress point, the
 *     particles and the parallax, writing SVG attributes and CSS variables
 *     straight to the DOM.
 *
 * Hovering the card, or the Find a Tutor button, raises one `data-energy`
 * state which the stylesheet and the animation loop both read, so the visual
 * response and the slightly faster progress point can never disagree.
 */

/** How the graphic is being engaged. Read by the stylesheet and the rAF loop. */
type Energy = 'idle' | 'card' | 'cta'

/** Attribute marking the hero CTA, so the graphic can react to it. */
const CTA_ATTRIBUTE = '[data-tedor-cta]'

/** Peak parallax offset, in pixels. Deliberately just noticeable. */
const PARALLAX_RANGE = 8

/** How long the progress point takes to travel the whole path once. */
const JOURNEY_MS = 12000

/** The path draws itself first; the point only sets off once it is there. */
const JOURNEY_DELAY_MS = 2100

/**
 * The learning path, from the foundation in the lower left to the arrow in the
 * upper right. Two cubics so the slope steepens as it climbs, and so the final
 * tangent matches the angle of the mark's orange arrow.
 */
const PATH_D = 'M88 232C158 232 184 200 214 166C238 140 246 128 252 116'

/**
 * Milestone markers at 26%, 54% and 82% of the path's arc length — evenly
 * spaced markers need arc length, not the bezier parameter. The label
 * coordinates are placed by hand so each one sits on the empty side of the
 * path, clear of the path itself and of the floating icons.
 */
const MILESTONES = [
  { x: 142, y: 223.6, stage: 'Learn', detail: 'Build your foundation', anchor: 'start', lx: 150, ly: 246 },
  { x: 190.9, y: 191.2, stage: 'Practice', detail: 'Sharpen what you know', anchor: 'end', lx: 180, ly: 160 },
  { x: 230.6, y: 147.3, stage: 'Grow', detail: 'See your progress', anchor: 'start', lx: 242, ly: 158 },
] as const

/** 24×24 line icons — no icon dependency, and no emoji. */
const ICONS = {
  spark: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z',
  code: ['M9 7l-5 5 5 5', 'M15 7l5 5-5 5'],
  bulb: [
    'M12 3a6 6 0 0 0-3.6 10.8c.6.4 1 1.1 1.1 1.9h5c.1-.8.5-1.5 1.1-1.9A6 6 0 0 0 12 3Z',
    'M9.5 19h5M10.5 21.5h3',
  ],
  book: [
    'M4 4.5h5.5a3 3 0 0 1 3 3v12a2.5 2.5 0 0 0-2.5-2.5H4Z',
    'M20 4.5h-5.5a3 3 0 0 0-3 3v12a2.5 2.5 0 0 1 2.5-2.5H20Z',
  ],
} as const

/** Scene size, trimmed to the content so nothing floats in dead space. */
const SCENE_WIDTH = 358
const SCENE_HEIGHT = 292

/** Long description of the graphic for assistive technology. */
const SCENE_LABEL =
  'A learning journey: a blue path leaves a starting point and rises through three milestones — ' +
  'Learn, Practice, Grow — ending in the orange upward arrow from the Tedor logo. A moving point ' +
  'travels the path from the start to the arrow.'

interface SampledPath {
  xs: Float32Array
  ys: Float32Array
  count: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/**
 * Samples the path once so the animation loop never has to measure it again.
 * Returns null where SVG geometry is unavailable (jsdom, older engines).
 */
function samplePath(path: SVGPathElement, count = 200): SampledPath | null {
  if (typeof path.getTotalLength !== 'function' || typeof path.getPointAtLength !== 'function') {
    return null
  }
  const total = path.getTotalLength()
  if (!total) return null

  const xs = new Float32Array(count)
  const ys = new Float32Array(count)
  for (let index = 0; index < count; index += 1) {
    const point = path.getPointAtLength((index / (count - 1)) * total)
    xs[index] = point.x
    ys[index] = point.y
  }
  return { xs, ys, count }
}

function pointAt(path: SampledPath, t: number) {
  const position = clamp(t, 0, 1) * (path.count - 1)
  const index = Math.min(Math.floor(position), path.count - 2)
  const fraction = position - index
  return {
    x: path.xs[index] + (path.xs[index + 1] - path.xs[index]) * fraction,
    y: path.ys[index] + (path.ys[index + 1] - path.ys[index]) * fraction,
  }
}

/** Brand header: the real mark, at its natural proportions. */
function BrandHeader() {
  return (
    <div className="flex items-center gap-3 px-6 pt-6 sm:px-7 sm:pt-7">
      <Logo size="sm" />
    </div>
  )
}

/** Atmosphere only: a very slow drift keeps the grid from reading as a static asset. */
function GraphicGrid() {
  return (
    <g className="tj-grid" aria-hidden="true">
      <rect x={-25} y={-25} width={450} height={350} fill="url(#tj-grid-pattern)" />
    </g>
  )
}

/**
 * The learning path: a soft track, the blue line on top, and a highlight that
 * drifts along it. `pathLength` normalises the dash maths, so the draw-in takes
 * the same 2.6 seconds whatever size the card renders at.
 */
function LearningPath({ pathRef }: { pathRef: RefObject<SVGPathElement | null> }) {
  return (
    <g aria-hidden="true">
      <path className="tj-path-base" d={PATH_D} pathLength={100} />
      <path ref={pathRef} className="tj-path" d={PATH_D} pathLength={100} />
      <path className="tj-path-shimmer" d={PATH_D} pathLength={100} />
    </g>
  )
}

/** The foundation the journey leaves: concentric rings that breathe outward. */
function Foundation() {
  return (
    <g aria-hidden="true">
      <circle cx={88} cy={232} r={44} fill="none" stroke="#dcf0fd" strokeWidth={2} />
      <g className="tj-ring tj-ring--pulse" fill="none" stroke="#bce1fb" strokeWidth={2}>
        <circle cx={88} cy={232} r={44} />
      </g>
      <g className="tj-ring tj-ring--pulse tj-ring--pulse-2" fill="none" stroke="#bce1fb" strokeWidth={2}>
        <circle cx={88} cy={232} r={44} />
      </g>
    </g>
  )
}

/** The start of the path, drawn on top of it so the line reads as leaving it. */
function StartPoint() {
  return (
    <g className="tj-start" aria-hidden="true">
      <circle cx={88} cy={232} r={10} fill="#dcf0fd" />
      <circle cx={88} cy={232} r={6} fill="#1e96e8" stroke="#fff" strokeWidth={2.5} />
    </g>
  )
}

/** The learner, moving along the path. The rest position is the reduced-motion frame. */
function ProgressPoint({ dotRef, particlesRef }: { dotRef: RefObject<SVGGElement | null>; particlesRef: RefObject<SVGGElement | null> }) {
  return (
    <g aria-hidden="true">
      <g ref={particlesRef}>
        {[0, 1, 2].map((index) => (
          <circle key={index} className="tj-particle" cx={0} cy={0} r={2} />
        ))}
      </g>
      <g ref={dotRef} transform="translate(211 169.5)">
        <circle className="tj-dot-halo" r={9} />
        <circle className="tj-dot" r={5.5} stroke="#fff" strokeWidth={2.5} />
        <circle className="tj-dot-accent" r={5.5} stroke="#fff" strokeWidth={2.5} />
      </g>
    </g>
  )
}

/**
 * Milestone markers on the path, with their labels revealed on hover. The hit
 * area is deliberately larger than the marker so the label is easy to find.
 */
function Milestones() {
  return (
    <g aria-hidden="true">
      {MILESTONES.map((milestone, index) => (
        <g key={milestone.stage} className="tj-milestone">
          <circle className={`tj-milestone-pulse${index ? ` tj-milestone-pulse--${index + 1}` : ''}`} cx={milestone.x} cy={milestone.y} r={5} />
          <circle className="tj-milestone-dot" cx={milestone.x} cy={milestone.y} r={4.5} />
          <circle className="tj-milestone-hit" cx={milestone.x} cy={milestone.y} r={15} />
          <g className="tj-milestone-label" textAnchor={milestone.anchor}>
            <text className="tj-ms-stage" x={milestone.lx} y={milestone.ly}>
              {milestone.stage}
            </text>
            <text className="tj-ms-detail" x={milestone.lx} y={milestone.ly + 13}>
              {milestone.detail}
            </text>
          </g>
        </g>
      ))}
    </g>
  )
}

/**
 * The destination: the mark's own orange arrow, lifted onto the end of the
 * path. Placement, hover lift and idle float each live on their own element,
 * because a CSS transform on an element would otherwise replace the placement
 * transform attribute outright.
 */
function GrowthArrow() {
  return (
    <g className="tj-arrow-lift" aria-hidden="true">
      <g transform="translate(274 78) rotate(16) scale(0.5) translate(-100 -63)">
        <g className="tj-arrow-float">
          <circle className="tj-arrow-halo" cx={102} cy={63} r={44} fill="url(#tj-arrow-glow)" />
          <path d="M78 118c6-22 12-46 16-68l32-42-10 46c-6 22-10 42-14 64Z" fill="#F5801F" />
        </g>
      </g>
    </g>
  )
}

/** Four faint symbols of learning, each floating on its own rhythm. */
function LearningIcons() {
  return (
    <g aria-hidden="true">
      <g className="tj-icon tj-icon--a" transform="translate(112 48)">
        <g className="tj-float">
          <path d={ICONS.spark} />
        </g>
      </g>
      <g className="tj-icon tj-icon--b" transform="translate(186 70)">
        <g className="tj-float">
          {ICONS.code.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </g>
      <g className="tj-icon tj-icon--c tj-icon--accent" transform="translate(318 176)">
        <g className="tj-float">
          {ICONS.bulb.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </g>
      <g className="tj-icon tj-icon--d" transform="translate(298 240)">
        <g className="tj-float">
          {ICONS.book.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </g>
    </g>
  )
}

export interface TedorLearningGraphicProps {
  /**
   * Element whose pointer movement drives the parallax — pass the hero
   * section so the whole hero feels alive, not just the card.
   */
  parallaxHost?: RefObject<HTMLElement | null>
  className?: string
}

export function TedorLearningGraphic({ parallaxHost, className }: TedorLearningGraphicProps) {
  const reducedMotion = usePrefersReducedMotion()
  const cardRef = useRef<HTMLDivElement>(null)
  const parallaxRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const dotRef = useRef<SVGGElement>(null)
  const particlesRef = useRef<SVGGElement>(null)
  const sampledRef = useRef<SampledPath | null>(null)
  const energyRef = useRef<Energy>('idle')

  const [cardHover, setCardHover] = useState(false)
  const [ctaActive, setCtaActive] = useState(false)
  const [onScreen, setOnScreen] = useState(true)

  const energy: Energy = ctaActive ? 'cta' : cardHover ? 'card' : 'idle'

  useEffect(() => {
    energyRef.current = energy
  }, [energy])

  useLayoutEffect(() => {
    const path = pathRef.current
    sampledRef.current = path ? samplePath(path) : null
  }, [])

  // Stop animating once the graphic scrolls out of view.
  useEffect(() => {
    const card = cardRef.current
    if (!card || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin: '120px' },
    )
    observer.observe(card)
    return () => observer.disconnect()
  }, [])

  // Engagement: the card itself, plus the hero CTA it is meant to lead into.
  useEffect(() => {
    const card = cardRef.current
    const host = parallaxHost?.current
    if (!card) return

    const onCardEnter = () => setCardHover(true)
    const onCardLeave = () => setCardHover(false)
    const onCtaEnter = () => setCtaActive(true)
    const onCtaLeave = () => setCtaActive(false)

    const ctas = Array.from(host?.querySelectorAll<HTMLElement>(CTA_ATTRIBUTE) ?? [])

    card.addEventListener('pointerenter', onCardEnter)
    card.addEventListener('pointerleave', onCardLeave)
    ctas.forEach((cta) => {
      cta.addEventListener('pointerenter', onCtaEnter)
      cta.addEventListener('pointerleave', onCtaLeave)
      cta.addEventListener('focusin', onCtaEnter)
      cta.addEventListener('focusout', onCtaLeave)
    })

    return () => {
      card.removeEventListener('pointerenter', onCardEnter)
      card.removeEventListener('pointerleave', onCardLeave)
      ctas.forEach((cta) => {
        cta.removeEventListener('pointerenter', onCtaEnter)
        cta.removeEventListener('pointerleave', onCtaLeave)
        cta.removeEventListener('focusin', onCtaEnter)
        cta.removeEventListener('focusout', onCtaLeave)
      })
    }
  }, [parallaxHost])

  // One loop for the progress point, the particles and the parallax. Nothing
  // here goes through React state, so a frame costs three attribute writes.
  useEffect(() => {
    const card = cardRef.current
    const dot = dotRef.current
    const particles = particlesRef.current?.querySelectorAll<SVGCircleElement>('.tj-particle')
    const layer = parallaxRef.current
    const host = parallaxHost?.current
    if (!card || !dot || reducedMotion) return

    const path = sampledRef.current
    const nodes = particles ? Array.from(particles) : []
    const particlePhase = nodes.map((_, index) => index * 0.34)

    let frame = 0
    let last = performance.now()
    let elapsed = 0
    let journey = 0
    let speed = 1
    let targetX = 0
    let targetY = 0
    let offsetX = 0
    let offsetY = 0

    const tick = (now: number) => {
      const delta = Math.min(now - last, 64)
      last = now
      elapsed += delta

      const wanted = energyRef.current === 'cta' ? 1.2 : energyRef.current === 'card' ? 1.1 : 1
      speed += (wanted - speed) * 0.05

      if (path && elapsed > JOURNEY_DELAY_MS) {
        journey = (journey + (delta / JOURNEY_MS) * speed) % 1
        const point = pointAt(path, journey)
        dot.setAttribute('transform', `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`)
        card.style.setProperty('--tj-arrival', smoothstep(0.72, 0.98, journey).toFixed(3))
      }

      if (nodes.length) {
        const lift = energyRef.current === 'idle' ? 0 : 0.14
        nodes.forEach((node, index) => {
          particlePhase[index] = (particlePhase[index] + delta / (JOURNEY_MS * 0.7)) % 1
          if (!path) return
          const position = pointAt(path, particlePhase[index])
          node.setAttribute('cx', position.x.toFixed(2))
          node.setAttribute('cy', position.y.toFixed(2))
          const envelope = smoothstep(0, 0.12, particlePhase[index]) * (1 - smoothstep(0.82, 1, particlePhase[index]))
          node.style.opacity = (envelope * (0.5 + lift)).toFixed(3)
        })
      }

      if (layer) {
        offsetX += (targetX - offsetX) * 0.08
        offsetY += (targetY - offsetY) * 0.08
        layer.style.setProperty('--tj-x', offsetX.toFixed(3))
        layer.style.setProperty('--tj-y', offsetY.toFixed(3))
      }

      frame = requestAnimationFrame(tick)
    }

    const start = () => {
      frame = requestAnimationFrame(tick)
      last = performance.now()
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!host || event.pointerType === 'touch') return
      const bounds = host.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      targetX = clamp((event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2), -1, 1) * PARALLAX_RANGE
      targetY = clamp((event.clientY - bounds.top - bounds.height / 2) / (bounds.height / 2), -1, 1) * PARALLAX_RANGE
    }

    const onPointerLeave = () => {
      targetX = 0
      targetY = 0
    }

    host?.addEventListener('pointermove', onPointerMove, { passive: true })
    host?.addEventListener('pointerleave', onPointerLeave)

    if (onScreen) start()

    return () => {
      cancelAnimationFrame(frame)
      host?.removeEventListener('pointermove', onPointerMove)
      host?.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [reducedMotion, onScreen, parallaxHost])

  return (
    <div
      ref={cardRef}
      data-energy={energy}
      data-static={reducedMotion ? 'true' : undefined}
      className={`tj-card ${className ?? ''}`}
    >
      <div ref={parallaxRef} className="tj-parallax">
        <BrandHeader />

        <div className="px-2 pt-2 sm:px-3 sm:pt-4">
          <svg
            className="tj-scene"
            viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
            role="img"
            aria-label={SCENE_LABEL}
          >
            <defs>
              <pattern id="tj-grid-pattern" width={25} height={25} patternUnits="userSpaceOnUse">
                <path d="M25 0H0v25" fill="none" stroke="#e4f2fd" strokeWidth={1} />
              </pattern>
              <linearGradient id="tj-scene-fade" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#eff8fe" stopOpacity="0" />
                <stop offset="100%" stopColor="#eff8fe" stopOpacity="0.9" />
              </linearGradient>
              <radialGradient id="tj-arrow-glow">
                <stop offset="0%" stopColor="#f5801f" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#f5801f" stopOpacity="0" />
              </radialGradient>
            </defs>

            <GraphicGrid />
            <rect className="tj-grid-fade" width={SCENE_WIDTH} height={SCENE_HEIGHT} />

            <Foundation />
            <LearningPath pathRef={pathRef} />
            <StartPoint />
            <ProgressPoint dotRef={dotRef} particlesRef={particlesRef} />
            <Milestones />
            <GrowthArrow />
            <LearningIcons />
          </svg>
        </div>

        <div className="px-6 pb-6 pt-1 sm:px-7 sm:pb-7">
          <p className="text-[0.95rem] font-medium text-ink-700">Learning that moves forward</p>
          <p className="tj-meta mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-brand-700">
            <span>Learn</span>
            <span aria-hidden="true" className="h-px w-4 bg-brand-200" />
            <span>Practice</span>
            <span aria-hidden="true" className="h-px w-4 bg-brand-200" />
            <span>Grow</span>
          </p>
        </div>
      </div>
    </div>
  )
}
