import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fc from 'fast-check'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthContext } from '@/features/auth/authContext'
import type { AuthContextValue } from '@/features/auth/authContext'
import type { AuthStatus, AuthUser } from '@/features/auth/auth.types'
import type { TutorDetailDTO } from '@/features/tutors/tutors.types'

import { TutorProfilePage, TutorProfileView } from './TutorProfilePage'

/**
 * **Feature: tutor-marketplace, Property 10: Tutor profile page renders all public profile fields**
 * **Validates: Requirements 10.1, 10.3**
 *
 * The properties render `TutorProfileView` — the markup the page puts on screen
 * once the profile has loaded — so a hundred runs cost a hundred small renders
 * instead of a hundred fetches. Everything that *is* about the fetch (loading,
 * 404, retry) is covered by the integration tests against `TutorProfilePage`
 * further down.
 */

const TUTOR_ID = '11111111-1111-4111-8111-111111111111'

const SIGNED_IN_USER: AuthUser = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Grace Hopper',
  email: 'grace@example.com',
  role: 'CLIENT',
  image: null,
  createdAt: '2026-09-01T00:00:00.000Z',
}

/** A complete profile, for the tests that need one specific shape. */
const TUTOR: TutorDetailDTO = {
  id: TUTOR_ID,
  displayName: 'Ada Lovelace',
  headline: 'Mathematics tutor for university students',
  bio: 'I have taught calculus for twelve years.',
  profilePhotoUrl: 'https://example.com/ada.jpg',
  teachingMode: 'BOTH',
  location: 'Addis Ababa',
  hourlyRate: 30,
  studentLevels: ['High School', 'University'],
  languages: ['English', 'Amharic'],
  availability: 'Weekday evenings',
  experience: 'Twelve years in secondary and university maths.',
  education: 'MSc Mathematics',
  createdAt: '2024-01-01T00:00:00.000Z',
  subjects: [
    { id: 's1', name: 'Mathematics', slug: 'mathematics', category: 'Mathematics' },
    { id: 's2', name: 'Physics', slug: 'physics', category: 'Science' },
  ],
}

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ok = (data: unknown) => jsonResponse({ success: true, data })
const fail = (code: string, message: string, status: number) =>
  jsonResponse({ success: false, error: { code, message } }, status)

/** What `GET /api/tutors/:id` should answer with on the next call. */
type Reply =
  | { kind: 'ok'; tutor: TutorDetailDTO }
  | { kind: 'error'; code: string; message: string; status: number }
  | { kind: 'pending' }

/** One test's worth of stub state, closed over so a late call cannot leak. */
interface Stub {
  replies: Reply[]
  calls: string[]
  mock: ReturnType<typeof vi.fn>
}

let stub: Stub

/** Queues the answers for the next profile fetches, the last one repeating. */
function replyWith(...next: Reply[]) {
  stub.replies = next
}

function tutorReply(tutor: TutorDetailDTO | null): Reply {
  return tutor
    ? { kind: 'ok', tutor }
    : { kind: 'error', code: 'NOT_FOUND', message: 'Tutor not found.', status: 404 }
}

beforeEach(() => {
  const state: Stub = { replies: [], calls: [], mock: vi.fn() }

  state.mock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost')
    state.calls.push(url.pathname)

    // Only the profile endpoint is stubbed. Anything else is a test bug, and
    // naming it beats a silent default that would hide a wrong request.
    if (!url.pathname.startsWith('/api/tutors/')) {
      throw new Error(`unexpected request: ${url.pathname}`)
    }

    const reply = state.replies.length > 1 ? state.replies.shift()! : state.replies[0]
    if (!reply || reply.kind === 'pending') return new Promise<Response>(() => {})

    return reply.kind === 'ok' ? ok(reply.tutor) : fail(reply.code, reply.message, reply.status)
  })

  stub = state
  vi.stubGlobal('fetch', state.mock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** A fixed session, so a test is not paying for `/api/auth/me` on every render. */
function authValue(status: AuthStatus): AuthContextValue {
  return {
    status,
    user: status === 'authenticated' ? SIGNED_IN_USER : null,
    providers: [],
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }
}

/** Stands in for `/login`, surfacing the redirect target the page handed over. */
function LoginProbe() {
  const from = (useLocation().state as { from?: string } | null)?.from ?? '(none)'
  return <p>login-from:{from}</p>
}

/** Stands in for `/request-tutor`, surfacing the query it was opened with. */
function RequestProbe() {
  return <p>request-search:{useLocation().search}</p>
}

/** Wraps `ui` in the session and the routes it links to. */
function withProviders(ui: React.ReactElement, status: AuthStatus, id = TUTOR_ID) {
  return (
    <AuthContext.Provider value={authValue(status)}>
      <MemoryRouter initialEntries={[`/tutors/${id}`]}>
        <Routes>
          <Route path="/tutors/:id" element={ui} />
          <Route path="/login" element={<LoginProbe />} />
          <Route path="/request-tutor" element={<RequestProbe />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

/** Renders the profile markup and returns queries scoped to it. */
function renderView(
  tutor: TutorDetailDTO,
  { status = 'authenticated' }: { status?: AuthStatus } = {},
) {
  const { container } = render(withProviders(<TutorProfileView tutor={tutor} />, status))
  return { container, text: container.textContent ?? '', ...within(container) }
}

type ViewQueries = ReturnType<typeof renderView>

/**
 * DOM-level lookups, deliberately not `getByRole`.
 *
 * The generators below draw headlines, subject names and student levels from
 * one pool of words, so any two of them can come out identical. A bare
 * `getByText(headline)` would then find the subject chip as well and fail on a
 * page that had rendered everything correctly — checking each value inside the
 * section that owns it is both stricter and immune to that.
 *
 * They also avoid the accessibility tree, which a role query rebuilds on every
 * call. That is the difference between a property that runs in seconds and one
 * that takes half a minute. The role-based reading of this markup — named
 * lists, one h1, no skipped heading levels — is checked in the accessibility
 * tests below, once, rather than a hundred times.
 */
function sectionText(view: ViewQueries, heading: string): string {
  for (const title of view.container.querySelectorAll('h2')) {
    // Card > CardHeader > CardTitle
    if (title.textContent === heading) return title.parentElement?.parentElement?.textContent ?? ''
  }
  throw new Error(`no section titled "${heading}"`)
}

/** The text of the list the page labels `label`, failing if there is no such list. */
function listText(view: ViewQueries, label: string): string {
  const list = view.container.querySelector(`ul[aria-label="${label}"]`)
  if (!list) throw new Error(`no list labelled "${label}"`)
  return list.textContent ?? ''
}

/** The page's only level-one heading: the tutor's name. */
function nameHeading(view: ViewQueries): HTMLElement {
  const heading = view.container.querySelector('h1')
  if (!heading) throw new Error('the page has no h1')
  return heading
}

/** The line under the name, which is the headline. */
function headlineOf(view: ViewQueries): string {
  return nameHeading(view).nextElementSibling?.textContent ?? ''
}

/** How this tutor teaches, as the Details list words it. */
function teachingModeOf(view: ViewQueries): string | null {
  for (const term of view.container.querySelectorAll('dt')) {
    if (term.textContent === 'Teaching mode') return term.nextElementSibling?.textContent ?? null
  }
  throw new Error('the Details list has no teaching mode')
}

/** Renders the page at `/tutors/:id`, so the fetch and its states are real. */
function renderPage({ status = 'authenticated', id = TUTOR_ID }: { status?: AuthStatus; id?: string } = {}) {
  return render(withProviders(<TutorProfilePage />, status, id))
}

/** The page's own content, once the profile has loaded, without the site chrome. */
async function renderLoadedPage() {
  renderPage()
  await screen.findByRole('heading', { level: 1 })
  return within(screen.getByRole('main'))
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Words a real profile is made of.
 *
 * The property asserts on rendered text, so a generator full of digits and
 * punctuation would make the "no fabricated metrics" property fail for reasons
 * that have nothing to do with the page: a headline reading "5 stars" would
 * trip a stars pattern whether or not the page had invented anything.
 */
const WORDS = [
  'mathematics',
  'algebra',
  'physics',
  'chemistry',
  'biology',
  'english',
  'programming',
  'mentoring',
  'exam',
  'revision',
  'patience',
  'practice',
  'confidence',
  'curriculum',
  'homework',
  'university',
  'school',
  'online',
  'Addis',
  'Ababa',
  'Amharic',
] as const

/** One to `maxLength` words, e.g. a name, a headline or a sentence. */
const words = (minLength: number, maxLength: number) =>
  fc.array(fc.constantFrom(...WORDS), { minLength, maxLength }).map((parts) => parts.join(' '))

/** A list of distinct labels, so no two rendered chips share a value. */
const uniqueWords = (minLength: number, maxLength: number) =>
  fc.uniqueArray(words(1, 3), { minLength, maxLength, selector: (value) => value })

/**
 * An approved tutor profile, in the shape the detail endpoint really sends.
 *
 * `bio`, `subjects` and `studentLevels` are non-empty because the property
 * claims the page shows the full bio, every subject and every level, which is
 * only a statement about profiles that have them. The empty cases have their
 * own tests below.
 */
const tutorProfileArbitrary: fc.Arbitrary<TutorDetailDTO> = fc.record({
  id: fc.uuid(),
  displayName: words(1, 3),
  headline: words(2, 5),
  bio: words(3, 12),
  profilePhotoUrl: fc.option(fc.webUrl(), { nil: null }),
  teachingMode: fc.constantFrom('ONLINE', 'IN_PERSON', 'BOTH'),
  location: fc.option(words(1, 2), { nil: null }),
  hourlyRate: fc.option(fc.integer({ min: 0, max: 500 }).map((value) => value / 100), { nil: null }),
  studentLevels: uniqueWords(1, 3),
  languages: uniqueWords(1, 3),
  availability: fc.option(words(2, 5), { nil: null }),
  experience: fc.option(words(2, 6), { nil: null }),
  education: fc.option(words(2, 6), { nil: null }),
  createdAt: fc.constant(new Date('2024-01-01T00:00:00.000Z').toISOString()),
  subjects: fc.uniqueArray(
    fc.record({
      id: fc.uuid(),
      name: words(1, 2),
      slug: fc.stringMatching(/^[a-z0-9-]{1,30}$/),
      category: fc.constantFrom('Science', 'Mathematics', 'Languages', 'Technology'),
    }),
    { minLength: 1, maxLength: 4, selector: (subject) => subject.name },
  ),
})

/** How a teaching mode is worded on screen, mirroring the page's own labels. */
const MODE_LABELS = {
  ONLINE: 'Online',
  IN_PERSON: 'In person',
  BOTH: 'Online & in person',
} as const

/**
 * The page href for a tutor, built the way the page builds it.
 *
 * A UUID is unchanged by `encodeURIComponent`, so this reads as the plain
 * `/request-tutor?tutorId=<id>` of Requirement 10.3 without repeating the
 * page's own encoding decision in a second, driftable place.
 */
const requestHref = (id: string) => `/request-tutor?tutorId=${encodeURIComponent(id)}`

/**
 * Strings Requirement 10.4 forbids on a profile: reviews, star ratings,
 * tutoring-hours counts, satisfaction scores. The API has no model behind any of
 * them, so showing one would be inventing a number.
 */
const FABRICATED_METRIC_PATTERNS: readonly RegExp[] = [
  /\d(\.\d)?\s*★/u,
  /★\s*\d/u,
  /\bstars?\b/iu,
  /\brated?\s*(by|out of)\b/iu,
  /\b\d[\d,]*\+?\s*hours?\b/iu,
  /\b\d+\s*%\s*(satisfaction|happy|rated|positive)/iu,
  /\b\d[\d,]*\+?\s*(lessons?|sessions?|classes?|students?|learners?)\s*(taught|completed|helped)?/iu,
  /\b\d[\d,]*\+?\s*reviews?\b/iu,
  /\b\d+\s*(\/\s*5)\b/u,
]

// ---------------------------------------------------------------------------
// Property 10
// ---------------------------------------------------------------------------

describe('Property 10: TutorProfilePage renders all public profile fields', () => {
  it('shows the name, headline, full bio, every subject, every level and the mode', () => {
    fc.assert(
      fc.property(tutorProfileArbitrary, (tutor) => {
        // A hundred renders inside one test, so `screen` would still be holding
        // the previous iteration. The queries here are scoped to the container
        // this render just made.
        cleanup()

        const view = renderView(tutor)

        expect(nameHeading(view)).toHaveTextContent(tutor.displayName)
        expect(headlineOf(view)).toContain(tutor.headline)
        expect(sectionText(view, 'About')).toContain(tutor.bio)

        const subjects = listText(view, 'Subjects')
        for (const subject of tutor.subjects) {
          expect(subjects).toContain(subject.name)
        }

        const levels = listText(view, 'Student levels')
        for (const level of tutor.studentLevels) {
          expect(levels).toContain(level)
        }

        expect(teachingModeOf(view)).toBe(MODE_LABELS[tutor.teachingMode])
      }),
      { numRuns: 100 },
    )
  })

  it('links "Request This Tutor" to this tutor\'s request form', () => {
    fc.assert(
      fc.property(tutorProfileArbitrary, (tutor) => {
        cleanup()
        const view = renderView(tutor)

        expect(view.getByRole('link', { name: /request this tutor/i })).toHaveAttribute(
          'href',
          requestHref(tutor.id),
        )
      }),
      { numRuns: 100 },
    )
  })

  it('never renders a fabricated review, rating or hours count', () => {
    fc.assert(
      fc.property(tutorProfileArbitrary, (tutor) => {
        cleanup()
        const view = renderView(tutor)

        for (const pattern of FABRICATED_METRIC_PATTERNS) {
          expect(view.text).not.toMatch(pattern)
        }
      }),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// Requirement 10.1 — the fields
// ---------------------------------------------------------------------------

describe('profile content (Requirement 10.1)', () => {
  it('shows location, rate, languages and availability when the tutor set them', () => {
    const view = renderView(TUTOR)

    expect(view.getByText('Addis Ababa')).toBeInTheDocument()
    expect(view.getByText('30 per hour')).toBeInTheDocument()
    expect(view.getByRole('list', { name: 'Languages' })).toHaveTextContent('Amharic')
    expect(view.getByText('Weekday evenings')).toBeInTheDocument()
    expect(view.getByText('MSc Mathematics')).toBeInTheDocument()
    expect(view.getByText('Twelve years in secondary and university maths.')).toBeInTheDocument()
  })

  it('omits location and rate entirely when they are null', () => {
    const view = renderView({ ...TUTOR, location: null, hourlyRate: null })

    expect(view.queryByText('per hour')).toBeNull()
    expect(view.queryByText('Location')).toBeNull()
  })

  it('shows a zero rate rather than treating it as absent', () => {
    // 0 is a real price. A truthiness check would hide the one tutor who is
    // free, which is exactly the person a visitor is looking for.
    expect(renderView({ ...TUTOR, hourlyRate: 0 }).getByText('0 per hour')).toBeInTheDocument()
  })

  it('says so plainly when the tutor left a section empty, instead of hiding it', () => {
    const view = renderView({
      ...TUTOR,
      bio: null,
      experience: null,
      education: null,
      availability: null,
      languages: [],
      subjects: [],
      studentLevels: [],
    })

    expect(view.getByText('This tutor has not added a bio yet.')).toBeInTheDocument()
    expect(view.getByText('This tutor has not listed their education yet.')).toBeInTheDocument()
    expect(view.getByText('No student levels listed yet.')).toBeInTheDocument()
    // An empty section keeps its heading: dropping it would leave a visitor
    // wondering whether the page had failed to load that part.
    expect(view.getByRole('heading', { name: 'About' })).toBeInTheDocument()
  })

  it('asks the API for exactly this tutor', async () => {
    replyWith(tutorReply(TUTOR))
    await renderLoadedPage()

    expect(stub.calls).toEqual([`/api/tutors/${TUTOR_ID}`])
  })
})

// ---------------------------------------------------------------------------
// Requirement 10.2 — 404
// ---------------------------------------------------------------------------

describe('missing or unapproved tutor (Requirement 10.2)', () => {
  it('renders the 404 page when the tutor does not exist', async () => {
    replyWith(tutorReply(null))
    renderPage()

    expect(
      await screen.findByRole('heading', { level: 1, name: /page not found/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('404')).toBeInTheDocument()
  })

  it('renders the 404 page for a profile that exists but is not approved', async () => {
    // The API answers both cases with the same NOT_FOUND, on purpose: telling a
    // stranger that an id exists but is pending would leak that a tutor has
    // applied without being approved.
    replyWith({ kind: 'error', code: 'NOT_FOUND', message: 'Tutor not found.', status: 404 })
    renderPage()

    expect(
      await screen.findByRole('heading', { level: 1, name: /page not found/i }),
    ).toBeInTheDocument()
  })

  it('does not render the profile or its call to action', async () => {
    replyWith(tutorReply(null))
    renderPage()

    await screen.findByRole('heading', { level: 1, name: /page not found/i })
    expect(screen.queryByRole('link', { name: /request this tutor/i })).toBeNull()
  })

  it('shows an error with a retry when the profile fails for another reason', async () => {
    replyWith({ kind: 'error', code: 'SERVER_ERROR', message: 'Something went wrong.', status: 500 })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.')
    // A 404 page for a server hiccup would tell the visitor the tutor does not
    // exist, which is a different and much more alarming claim.
    expect(screen.queryByRole('heading', { name: /page not found/i })).toBeNull()
  })

  it('retries the request when the visitor asks it to', async () => {
    replyWith({ kind: 'error', code: 'SERVER_ERROR', message: 'Broken.', status: 500 }, tutorReply(TUTOR))
    renderPage()

    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Ada Lovelace')
    expect(stub.calls).toHaveLength(2)
  })

  it('shows a loading state while the request is in flight', () => {
    replyWith({ kind: 'pending' })
    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent(/loading tutor profile/i)
  })
})

// ---------------------------------------------------------------------------
// Requirement 10.5 — accessibility
// ---------------------------------------------------------------------------

describe('accessibility (Requirement 10.5)', () => {
  it('has exactly one h1 and never skips a heading level', () => {
    const view = renderView(TUTOR)

    const levels = view.getAllByRole('heading').map((heading) => Number(heading.tagName.slice(1)))

    expect(levels.filter((level) => level === 1)).toHaveLength(1)
    expect(levels[0]).toBe(1)
    // A jump from h2 straight to h4 leaves a screen-reader user with no idea
    // they have left a section.
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1)
    }
  })

  it('exposes the subjects, levels and languages as named lists', () => {
    // The properties above find these lists by their `aria-label`; this is
    // where that label is checked the way assistive technology reads it.
    const view = renderView(TUTOR)

    expect(view.getByRole('list', { name: 'Subjects' })).toHaveTextContent('Mathematics')
    expect(view.getByRole('list', { name: 'Student levels' })).toHaveTextContent('University')
    expect(view.getByRole('list', { name: 'Languages' })).toHaveTextContent('Amharic')
  })

  it('names the profile photo after the tutor it belongs to', () => {
    expect(
      renderView(TUTOR).getByRole('img', { name: 'Ada Lovelace profile photo' }),
    ).toBeInTheDocument()
  })

  it('shows a placeholder, not a broken image, when there is no photo', () => {
    const view = renderView({ ...TUTOR, profilePhotoUrl: null })

    // The real failure mode: an <img> with a missing src renders the browser's
    // own broken-image glyph.
    expect(view.queryByRole('img', { name: 'Ada Lovelace profile photo' })).toBeNull()
    expect(
      view.getByRole('img', { name: 'Ada Lovelace profile photo placeholder' }),
    ).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Requirements 12.1–12.3 — public page, gated call to action
// ---------------------------------------------------------------------------

describe('requesting a tutor (Requirements 12.1, 12.2, 12.3)', () => {
  const target = requestHref(TUTOR_ID)

  it('reads the whole profile without an account', async () => {
    replyWith(tutorReply(TUTOR))
    renderPage({ status: 'anonymous' })

    // Requirement 12.1: browsing is not gated. A visitor has to be able to
    // decide whether they want this tutor before deciding to sign up.
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Ada Lovelace')
    expect(screen.getByText('I have taught calculus for twelve years.')).toBeInTheDocument()
  })

  it('sends a signed-out visitor to login carrying the tutor they were reading', async () => {
    replyWith(tutorReply(TUTOR))
    renderPage({ status: 'anonymous' })

    const cta = await screen.findByRole('link', { name: /request this tutor/i })
    expect(cta).toHaveAttribute('href', '/login')

    await userEvent.click(cta)

    // The destination travels in the router state, which is what RequireAuth
    // and LoginPage already read — so there is no second convention to keep in
    // sync, and signing in lands on the request form (Requirement 12.3).
    await waitFor(() => {
      expect(screen.getByText(`login-from:${target}`)).toBeInTheDocument()
    })
  })

  it('sends a signed-in visitor straight to the request form', async () => {
    replyWith(tutorReply(TUTOR))
    renderPage({ status: 'authenticated' })

    const cta = await screen.findByRole('link', { name: /request this tutor/i })
    expect(cta).toHaveAttribute('href', target)

    await userEvent.click(cta)

    // The tutor arrives preselected, so the visitor does not have to find and
    // re-pick the tutor they were just reading.
    expect(await screen.findByText(`request-search:?tutorId=${TUTOR_ID}`)).toBeInTheDocument()
  })

  it('still sends a visitor whose session is still being checked to login', async () => {
    // Redirecting before `/api/auth/me` answers would bounce signed-in visitors
    // out on every reload. LoginPage forwards an already-signed-in visitor
    // straight on, so the detour costs nothing.
    replyWith(tutorReply(TUTOR))
    renderPage({ status: 'unknown' })

    await userEvent.click(await screen.findByRole('link', { name: /request this tutor/i }))

    await waitFor(() => {
      expect(screen.getByText(`login-from:${target}`)).toBeInTheDocument()
    })
  })
})
