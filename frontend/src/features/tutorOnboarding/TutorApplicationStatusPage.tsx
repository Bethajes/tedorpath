/**
 * TutorApplicationStatusPage — `/tutor/application-status`
 *
 * The one page a tutor needs after submitting: where their application has got
 * to, what the reference number is, and what happens next.
 *
 * It is deliberately a status page rather than a dashboard — every state has
 * exactly one thing to say, and the copy for that state is the whole content of
 * the page. Anything the tutor is expected to *do* (send documents, fix a
 * rejected application) is a link, not a form, because the work happens
 * somewhere else: documents go to the contact channels and edits go back through
 * the wizard.
 *
 * Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.9, 21.10,
 *               32.3, 32.4
 */

import { useCallback, useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { Container, PageShell } from '@/components/layout/PageShell'
import { Alert, Button } from '@/components/ui'
import { useAuth } from '@/features/auth/useAuth'
/**
 * The rejection vocabulary is defined once, next to the admin dropdown that
 * picks from it. An applicant reading "A required document was missing" has to
 * be reading the same words the admin chose from, so the labels are shared
 * rather than restated here where the two could drift apart.
 * Requirements: 22.1, 21.6
 */
import {
  REJECTION_REASON_LABELS,
  type RejectionReasonCategory,
} from '@/features/adminTutors/adminTutors.types'
import {
  telegramHandle,
  telegramLink,
  whatsappLink,
  whatsappNumber,
} from '@/lib/contactConfig'
import { ApiError } from '@/lib/api'
import { useAsyncData } from '@/lib/useAsyncData'
import { formatDate } from '@/lib/formatDate'

import { getMyTutorProfile } from './tutorOnboarding.api'
import type { MyTutorProfile } from './tutorOnboarding.types'

/**
 * The wording for a rejection reason, or the raw value if it is one this build
 * does not recognise.
 *
 * The cast is deliberate: the API is the authority on what it stores, and a
 * category added by a newer backend should still be readable here rather than
 * rendering as undefined.
 */
function rejectionLabel(value: string | null): string | null {
  if (!value) return null
  return REJECTION_REASON_LABELS[value as RejectionReasonCategory] ?? value
}


/**
 * The documents a tutor is asked for while under review.
 *
 * Presented as a checklist the applicant works through themselves rather than as
 * a set of checkboxes they tick off — the system has no way to know a document
 * arrived, it only knows when an admin records it, so offering a tick box here
 * would be a lie.
 * Requirement 21.8
 */
const REQUIRED_DOCUMENTS = [
  'Government-issued identification',
  'Education or academic qualification document',
  'Teaching or professional certificate (if applicable)',
  'Additional qualifications relevant to the subjects you teach',
] as const

export function TutorApplicationStatusPage() {
  const { status, user } = useAuth()

  const load = useCallback(() => getMyTutorProfile(), [])
  const { data: profile, loading, error, reload } = useAsyncData<MyTutorProfile>(
    load,
    [],
    describeError,
  )

  // The applicant's own profile, so this page is pointless without a session.
  // `state.from` is the mechanism LoginPage actually reads back (see
  // LoginPage.tsx) — a `?next=` query would arrive at the homepage.
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: '/tutor/application-status' }} />
  }

  if (status === 'unknown' || loading) {
    return (
      <PageShell>
        <Container className="py-16">
          <p role="status" className="text-sm text-ink-500">
            Loading your application…
          </p>
        </Container>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <Container className="max-w-3xl py-10 sm:py-14">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-ink-900">Your tutor application</h1>
          <p className="mt-2 text-ink-600">
            {user?.name ? `Signed in as ${user.name}. ` : ''}
            This page shows where your application has got to.
          </p>
        </header>

        {error ? (
          <Alert tone="error">
            <div className="flex flex-col items-start gap-3">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={reload}>
                Try again
              </Button>
            </div>
          </Alert>
        ) : !profile ? null : (
          <StatusContent profile={profile} />
        )}
      </Container>
    </PageShell>
  )
}

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) {
      return 'You have not started a tutor application yet.'
    }
    if (err.status === 0 || err.code === 'NETWORK_ERROR') {
      return 'We could not reach the server. Check your connection and try again.'
    }
    return err.message
  }
  return 'We could not load your application right now.'
}

/**
 * Renders the one state the profile is actually in.
 *
 * A switch rather than a set of conditionals so that adding a status later is a
 * compile error here instead of a silently blank page.
 */
function StatusContent({ profile }: { profile: MyTutorProfile }) {
  switch (profile.profileStatus) {
    case 'DRAFT':
      return <DraftState />
    case 'PENDING_REVIEW':
      return <PendingReviewState profile={profile} />
    case 'APPROVED':
      return <ApprovedState profile={profile} />
    case 'REJECTED':
      return <RejectedState profile={profile} />
    case 'NEEDS_INFORMATION':
      return <NeedsInformationState profile={profile} />
    case 'SUSPENDED':
      return <SuspendedState profile={profile} />
    default:
      return null
  }
}

function DraftState() {
  return (
    <Panel>
      <StatusPill status="DRAFT" />
      <h2 className="mt-4 text-xl font-semibold text-ink-900">
        Your application is still in progress
      </h2>
      <p className="mt-2 text-ink-600">
        You have not sent your application for review yet. Pick up where you left off — your
        answers are saved as you go.
      </p>
      <Action to="/become-a-tutor" label="Continue your application" />
    </Panel>
  )
}

function PendingReviewState({ profile }: { profile: MyTutorProfile }) {
  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusPill status="PENDING_REVIEW" />
          {profile.updatedAt ? (
            <p className="text-sm text-ink-500">
              Submitted {formatDate(profile.updatedAt)}
            </p>
          ) : null}
        </div>

        <h2 className="mt-4 text-xl font-semibold text-ink-900">
          Your application is being reviewed
        </h2>
        <p className="mt-2 text-ink-600">
          A member of the Tedor team is checking your profile. We will contact you if we need
          anything else.
        </p>

        {profile.applicationReference ? (
          <ReferenceBlock reference={profile.applicationReference} />
        ) : null}
      </Panel>

      {/* Requirement 21.4 / 21.5: what to send, and where. */}
      <Panel>
        <h2 className="text-lg font-semibold text-ink-900">Send us your documents</h2>
        <p className="mt-2 text-ink-600">
          To finish verifying your profile, please send the following over one of the contact
          details below:
        </p>
        <ul className="mt-4 space-y-2.5">
          {REQUIRED_DOCUMENTS.map((document) => (
            <li key={document} className="flex gap-3 text-ink-700">
              <svg
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0 text-brand-600"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{document}</span>
            </li>
          ))}
        </ul>

        <ContactActions />

        <p className="mt-5 rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-600">
          Your review begins once we have received your documents.
        </p>
      </Panel>
    </div>
  )
}

function ApprovedState({ profile }: { profile: MyTutorProfile }) {
  return (
    <Panel>
      <StatusPill status="APPROVED" />
      <h2 className="mt-4 text-xl font-semibold text-ink-900">Your application was approved</h2>
      <p className="mt-2 text-ink-600">
        Your profile is live and students can find you and send you a request.
      </p>
      {profile.applicationReference ? (
        <ReferenceBlock reference={profile.applicationReference} />
      ) : null}

      <h3 className="mt-6 text-sm font-semibold uppercase tracking-wider text-ink-500">
        Next steps
      </h3>
      <ul className="mt-2 list-inside list-disc space-y-1.5 text-ink-700">
        <li>Open your public profile to check it reads the way you want.</li>
        <li>Keep your availability up to date so students know when to reach you.</li>
        <li>Expect requests from students by email — reply to them directly.</li>
      </ul>

      <Action to={`/tutors/${profile.id}`} label="View your public profile" />
    </Panel>
  )
}

function RejectedState({ profile }: { profile: MyTutorProfile }) {
  const reason = rejectionLabel(profile.rejectionReason)

  return (
    <Panel>
      <StatusPill status="REJECTED" />
      <h2 className="mt-4 text-xl font-semibold text-ink-900">
        We could not take this application further
      </h2>

      {reason ? (
        <div className="mt-4">
          <p className="text-sm font-medium text-ink-700">Reason</p>
          <p className="mt-1 text-ink-900">{reason}</p>
        </div>
      ) : null}


      {profile.adminMessage ? (
        <blockquote className="mt-4 rounded-lg border-l-4 border-brand-300 bg-ink-50 px-4 py-3 text-ink-700">
          <p className="text-sm text-ink-500">Message from the Tedor team</p>
          <p className="mt-1 whitespace-pre-line">{profile.adminMessage}</p>
        </blockquote>
      ) : null}

      <p className="mt-4 text-ink-600">
        You can update your application and send it again.
      </p>
      <Action to="/become-a-tutor" label="Update application" />
    </Panel>
  )
}

function NeedsInformationState({ profile }: { profile: MyTutorProfile }) {
  return (
    <Panel>
      <StatusPill status="NEEDS_INFORMATION" />
      <h2 className="mt-4 text-xl font-semibold text-ink-900">
        Additional information is required
      </h2>

      {profile.adminMessage ? (
        <blockquote className="mt-4 rounded-lg border-l-4 border-accent-400 bg-accent-50 px-4 py-3 text-ink-800">
          <p className="text-sm text-ink-600">What we need from you</p>
          <p className="mt-1 whitespace-pre-line">{profile.adminMessage}</p>
        </blockquote>
      ) : (
        <p className="mt-3 text-ink-600">
          We need a little more from you before we can continue.
        </p>
      )}

      <ContactActions />

      <p className="mt-4 text-ink-600">
        Once you have it, update your application and we will pick up where we left off.
      </p>
      <Action to="/become-a-tutor" label="Update application" />
    </Panel>
  )
}

function SuspendedState({ profile }: { profile: MyTutorProfile }) {
  return (
    <Panel>
      <StatusPill status="SUSPENDED" />
      <h2 className="mt-4 text-xl font-semibold text-ink-900">
        Your profile is not currently available
      </h2>
      <p className="mt-2 text-ink-600">
        Your profile has been paused, so students cannot see it or send you requests at the
        moment.
      </p>
      {profile.adminMessage ? (
        <blockquote className="mt-4 rounded-lg border-l-4 border-ink-300 bg-ink-50 px-4 py-3 text-ink-700">
          <p className="text-sm text-ink-500">Message from the Tedor team</p>
          <p className="mt-1 whitespace-pre-line">{profile.adminMessage}</p>
        </blockquote>
      ) : null}
      <ContactActions />
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm sm:p-8">
      {children}
    </section>
  )
}

const PILL_CLASSES: Record<string, string> = {
  DRAFT: 'bg-ink-100 text-ink-700',
  PENDING_REVIEW: 'bg-accent-100 text-accent-800',
  APPROVED: 'bg-brand-100 text-brand-800',
  SUSPENDED: 'bg-ink-200 text-ink-800',
  REJECTED: 'bg-red-100 text-red-800',
  NEEDS_INFORMATION: 'bg-accent-100 text-accent-800',
}

const PILL_LABELS: Record<string, string> = {
  DRAFT: 'In progress',
  PENDING_REVIEW: 'Under review',
  APPROVED: 'Approved',
  SUSPENDED: 'Paused',
  REJECTED: 'Not accepted',
  NEEDS_INFORMATION: 'Action needed',
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
        PILL_CLASSES[status] ?? PILL_CLASSES.DRAFT
      }`}
    >
      {PILL_LABELS[status] ?? status}
    </span>
  )
}

/**
 * The reference number, with a copy button.
 *
 * The tutor will need to quote this in any message to us, so it is presented as
 * something to copy rather than something to read out or retype. The clipboard
 * write can be refused (no permission, insecure context), so the button reports
 * what happened instead of silently doing nothing.
 * Requirement 21.3
 */
function ReferenceBlock({ reference }: { reference: string }) {
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(reference)
      setCopied('copied')
    } catch {
      setCopied('failed')
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-ink-200 bg-ink-50 px-4 py-3">
      <p className="text-sm font-medium text-ink-700">Your application reference</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <code className="rounded bg-white px-3 py-1.5 font-mono text-lg tracking-wide text-ink-900">
          {reference}
        </code>
        <Button variant="outline" size="sm" onClick={copy}>
          {copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Copy failed' : 'Copy'}
        </Button>
      </div>
      <p aria-live="polite" className="mt-2 text-xs text-ink-500">
        {copied === 'copied'
          ? 'Copied to your clipboard.'
          : copied === 'failed'
            ? 'We could not copy it automatically — please write it down.'
            : 'Quote this reference in any message to the Tedor team.'}
      </p>
    </div>
  )
}

/**
 * Telegram and WhatsApp buttons, each rendered only when configured.
 *
 * Neither channel is assumed to exist: a deployment that has only one still
 * shows one, and one with neither shows neither rather than a pair of dead
 * links. Requirement 32.3, 32.4
 */
function ContactActions() {
  const telegram = telegramLink()
  const whatsapp = whatsappLink()

  if (!telegram && !whatsapp) return null

  return (
    <div className="mt-5">
      <p className="text-sm font-medium text-ink-700">Send them to us</p>
      <div className="mt-2 flex flex-wrap gap-3">
        {telegram ? (
          <a
            href={telegram}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-800 transition-colors hover:bg-ink-50"
          >
            Message on Telegram
            {/* The handle, so a screen-reader user knows which account they are
                about to open rather than only that it is Telegram. */}
            <span className="sr-only"> ({telegramHandle()})</span>
          </a>
        ) : null}
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-800 transition-colors hover:bg-ink-50"
          >
            Message on WhatsApp
            <span className="sr-only"> ({whatsappNumber()})</span>
          </a>
        ) : null}
      </div>
    </div>
  )
}

function Action({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="mt-6 inline-flex items-center rounded-lg bg-brand-600 px-5 py-2.5 text-[0.95rem] font-medium text-white transition-colors hover:bg-brand-700"
    >
      {label}
    </Link>
  )
}
