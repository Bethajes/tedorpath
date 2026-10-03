/**
 * Admin tutor review workspace — `/admin/tutors/:id`
 *
 * Five sections:
 *  1. Application Summary
 *  2. About the Tutor
 *  3. Teaching
 *  4. Public Profile Preview
 *  5. Verification (checklist + notes, saved independently of status)
 *
 * Sticky action panel with Approve / Request More Info / Reject modals.
 *
 * Requirements: 24.1–24.14, 33.3
 */

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { AdminPageHeader, AdminShell, AdminTutorsBackLink } from '@/components/layout/AdminShell'
import { Alert, Button, Modal, Select, Textarea } from '@/components/ui'
import {
  fetchAdminTutor,
  updateTutorStatus,
  updateTutorVerification,
} from '@/features/adminTutors/adminTutors.api'
import {
  EMPTY_VERIFICATION_CHECKLIST,
  PROFILE_STATUS_LABELS,
  REJECTION_REASONS,
  REJECTION_REASON_LABELS,
  VERIFICATION_CHECKLIST_FIELDS,
  VERIFICATION_STATUSES,
  VERIFICATION_STATUS_LABELS,
  type AdminTutorProfile,
  type ProfileStatus,
  type RejectionReasonCategory,
  type VerificationChecklist,
  type VerificationStatus,
} from '@/features/adminTutors/adminTutors.types'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/formatDate'

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_BADGE_CLASSES: Record<ProfileStatus, string> = {
  DRAFT: 'bg-ink-100 text-ink-700',
  PENDING_REVIEW: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  SUSPENDED: 'bg-ink-200 text-ink-800',
  REJECTED: 'bg-red-100 text-red-800',
  NEEDS_INFORMATION: 'bg-orange-100 text-orange-800',
}

function StatusBadge({ status }: { status: ProfileStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
        STATUS_BADGE_CLASSES[status],
      )}
    >
      {PROFILE_STATUS_LABELS[status]}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
  tone,
}: {
  title: string
  children: React.ReactNode
  tone?: 'internal'
}) {
  return (
    <section
      className={cn(
        'rounded-xl border p-5 shadow-sm',
        tone === 'internal'
          ? 'border-amber-200 bg-amber-50'
          : 'border-ink-200 bg-white',
      )}
    >
      <h2 className="mb-4 text-base font-semibold text-ink-900">{title}</h2>
      {children}
    </section>
  )
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-ink-100 py-2 last:border-0 sm:flex-row sm:gap-4">
      <dt className="w-full shrink-0 text-xs font-medium text-ink-500 sm:w-44">{label}</dt>
      <dd className="text-sm text-ink-800">{value || '—'}</dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Copy-to-clipboard helper
// ---------------------------------------------------------------------------

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
      className="ml-2 rounded px-1.5 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-50 hover:underline"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

// ---------------------------------------------------------------------------
// AdminTutorReviewPage
// ---------------------------------------------------------------------------

/**
 * A moderator's view of the two rates.
 *
 * Both, always. A moderator deciding whether to approve a profile needs to know
 * that an international rate exists at all, not only the one their screen happens
 * to prefer — and the two are never compared against each other, so there is
 * nothing to sum or average here.
 *
 * "Not offered" rather than an em dash, because an em dash reads as a rendering
 * gap and this is a decision the tutor made.
 */
function formatAdminRates(profile: { hourlyRateEtb: number | null; hourlyRateUsd: number | null }): string {
  const parts: string[] = []
  if (profile.hourlyRateEtb != null) parts.push(`${profile.hourlyRateEtb} ETB/hr`)
  if (profile.hourlyRateUsd != null) parts.push(`${profile.hourlyRateUsd} USD/hr`)

  return parts.length > 0 ? parts.join(' · ') : 'No rate offered'
}

export function AdminTutorReviewPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<AdminTutorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  // ── Verification section state ────────────────────────────────────────────
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('UNVERIFIED')
  const [adminNotes, setAdminNotes] = useState('')
  const [checklist, setChecklist] = useState<VerificationChecklist>({ ...EMPTY_VERIFICATION_CHECKLIST })
  const [savingVerification, setSavingVerification] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [verificationSavedAt, setVerificationSavedAt] = useState<string | null>(null)

  // ── Modals ────────────────────────────────────────────────────────────────
  const [approveOpen, setApproveOpen] = useState(false)
  const [needsInfoOpen, setNeedsInfoOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)

  // Approve modal
  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)

  // Needs information modal
  const [infoMessage, setInfoMessage] = useState('')
  const [sendingInfo, setSendingInfo] = useState(false)
  const [infoError, setInfoError] = useState<string | null>(null)

  // Reject modal
  const [rejectReason, setRejectReason] = useState<RejectionReasonCategory>('MISSING_DOCUMENT')
  const [rejectMessage, setRejectMessage] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [rejectError, setRejectError] = useState<string | null>(null)

  // Suspend modal
  const [suspendOpen, setSuspendOpen] = useState(false)
  const [suspending, setSuspending] = useState(false)
  const [suspendError, setSuspendError] = useState<string | null>(null)

  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError(null)
      setNotFound(false)
      try {
        const data = await fetchAdminTutor(id)
        if (cancelled) return
        setProfile(data)
        setVerificationStatus(data.verificationStatus)
        setAdminNotes(data.adminNotes ?? '')
        setChecklist({
          ...EMPTY_VERIFICATION_CHECKLIST,
          ...(data.verificationChecklist ?? {}),
        })
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true)
        } else {
          setLoadError(
            err instanceof ApiError && err.status === 401
              ? 'Your admin session has expired. Please sign in again.'
              : 'Unable to load this tutor profile. Please try again.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [id])

  // ── Verification save ─────────────────────────────────────────────────────
  async function handleSaveVerification() {
    setSavingVerification(true)
    setVerificationError(null)
    setVerificationSavedAt(null)
    try {
      const updated = await updateTutorVerification(id, {
        verificationStatus,
        adminNotes: adminNotes.trim() || undefined,
        verificationChecklist: checklist,
      })
      if (!active.current) return
      setProfile(updated)
      setVerificationSavedAt(new Date().toLocaleTimeString('en-GB'))
    } catch {
      if (!active.current) return
      setVerificationError('Unable to save verification notes. Please try again.')
    } finally {
      if (active.current) setSavingVerification(false)
    }
  }

  // ── Approve ───────────────────────────────────────────────────────────────
  async function handleApprove() {
    setApproving(true)
    setApproveError(null)
    try {
      const updated = await updateTutorStatus(id, { status: 'APPROVED' })
      if (!active.current) return
      setProfile(updated)
      setApproveOpen(false)
    } catch {
      if (!active.current) return
      setApproveError('Unable to approve this tutor. Please try again.')
    } finally {
      if (active.current) setApproving(false)
    }
  }

  // ── Needs information ─────────────────────────────────────────────────────
  async function handleSendInfoRequest() {
    if (!infoMessage.trim()) return
    setSendingInfo(true)
    setInfoError(null)
    try {
      const updated = await updateTutorStatus(id, {
        status: 'NEEDS_INFORMATION',
        adminMessage: infoMessage.trim(),
      })
      if (!active.current) return
      setProfile(updated)
      setNeedsInfoOpen(false)
      setInfoMessage('')
    } catch {
      if (!active.current) return
      setInfoError('Unable to send the information request. Please try again.')
    } finally {
      if (active.current) setSendingInfo(false)
    }
  }

  // ── Reject ────────────────────────────────────────────────────────────────
  async function handleReject() {
    setRejecting(true)
    setRejectError(null)
    try {
      const updated = await updateTutorStatus(id, {
        status: 'REJECTED',
        rejectionReason: rejectReason,
        adminMessage: rejectMessage.trim() || undefined,
      })
      if (!active.current) return
      setProfile(updated)
      setRejectOpen(false)
      setRejectMessage('')
    } catch {
      if (!active.current) return
      setRejectError('Unable to reject this application. Please try again.')
    } finally {
      if (active.current) setRejecting(false)
    }
  }

  // ── Suspend ───────────────────────────────────────────────────────────────
  /**
   * Takes an approved tutor out of the public directory without ending the
   * relationship.
   *
   * Distinct from rejection on purpose: a suspended tutor is somebody who was
   * approved and may be restored, and the API has no restore action — so this is
   * a one-way door in the UI, which is why it gets a confirmation that says so.
   * No reason field is required because the API does not accept one, and asking
   * for a reason the server would discard would be worse than not asking.
   */
  async function handleSuspend() {
    setSuspending(true)
    setSuspendError(null)
    try {
      const updated = await updateTutorStatus(id, { status: 'SUSPENDED' })
      if (!active.current) return
      setProfile(updated)
      setSuspendOpen(false)
    } catch {
      if (!active.current) return
      setSuspendError('Unable to suspend this tutor. Please try again.')
    } finally {
      if (active.current) setSuspending(false)
    }
  }

  // ── Checklist helper ──────────────────────────────────────────────────────
  function toggleChecklistItem(key: keyof VerificationChecklist) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AdminShell>
      <div className="mb-4">
        <AdminTutorsBackLink />
      </div>

      {loading ? (
        <p role="status" className="rounded-xl border border-ink-200 bg-white p-6 text-sm text-ink-600 shadow-sm">
          Loading tutor profile…
        </p>
      ) : null}

      {notFound ? (
        <Alert tone="error">
          <p>This tutor profile does not exist or has been deleted.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/admin/tutors')}>
            Back to all tutors
          </Button>
        </Alert>
      ) : null}

      {loadError ? (
        <Alert tone="error">
          <p>{loadError}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </Alert>
      ) : null}

      {profile ? (
        <>
          <AdminPageHeader
            title={profile.displayName}
            description={profile.headline}
          />

          {/* Admin message banner — shown for NEEDS_INFORMATION and REJECTED */}
          {(profile.profileStatus === 'NEEDS_INFORMATION' || profile.profileStatus === 'REJECTED') && profile.adminMessage ? (
            <div
              role="alert"
              className={cn(
                'mb-5 rounded-xl border px-5 py-4 text-sm',
                profile.profileStatus === 'REJECTED'
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : 'border-orange-200 bg-orange-50 text-orange-900',
              )}
            >
              <p className="font-semibold">
                {profile.profileStatus === 'REJECTED' ? 'Rejection message sent to applicant' : 'Information request sent to applicant'}
              </p>
              <p className="mt-1">{profile.adminMessage}</p>
            </div>
          ) : null}

          {/* Two-column layout: main content + sticky action panel */}
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">

            {/* ── Main content ───────────────────────────────────────────── */}
            <div className="flex min-w-0 flex-1 flex-col gap-5">

              {/* Section 1 — Application Summary */}
              <Section title="Application Summary">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                  {/* Profile photo */}
                  <div className="shrink-0">
                    {profile.profilePhotoUrl ? (
                      <img
                        src={profile.profilePhotoUrl}
                        alt={`${profile.displayName}'s profile photo`}
                        className="h-24 w-24 rounded-full object-cover ring-2 ring-ink-200"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex h-24 w-24 items-center justify-center rounded-full bg-ink-200 text-3xl font-bold text-ink-500"
                      >
                        {profile.displayName.trim().charAt(0).toUpperCase() || '?'}
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <dl>
                      <FieldRow label="Status" value={<StatusBadge status={profile.profileStatus} />} />
                      <FieldRow
                        label="Application reference"
                        value={
                          profile.applicationReference ? (
                            <span>
                              <code className="rounded bg-ink-100 px-1.5 py-0.5 text-sm font-mono">
                                {profile.applicationReference}
                              </code>
                              <CopyButton value={profile.applicationReference} />
                            </span>
                          ) : (
                            <span className="text-ink-400">Not yet submitted</span>
                          )
                        }
                      />
                      <FieldRow label="Location" value={profile.location} />
                      <FieldRow label="Submitted" value={formatDate(profile.createdAt)} />
                      <FieldRow label="Last updated" value={formatDate(profile.updatedAt)} />
                      <FieldRow label="Account email" value={profile.user.email} />
                    </dl>
                  </div>
                </div>
              </Section>

              {/* Section 2 — About the Tutor */}
              <Section title="About the Tutor">
                <dl>
                  <FieldRow label="Bio" value={<span className="whitespace-pre-wrap">{profile.bio}</span>} />
                  <FieldRow label="Experience" value={profile.experience} />
                  <FieldRow label="Education" value={profile.education} />
                  <FieldRow
                    label="Languages"
                    value={profile.languages.length > 0 ? profile.languages.join(', ') : null}
                  />
                  <FieldRow label="Availability" value={profile.availability} />
                </dl>
              </Section>

              {/* Section 3 — Teaching */}
              <Section title="Teaching">
                <dl>
                  <FieldRow
                    label="Subjects"
                    value={
                      profile.subjects.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {profile.subjects.map((s) => (
                            <span key={s.id} className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-800">
                              {s.name}
                            </span>
                          ))}
                        </div>
                      ) : null
                    }
                  />
                  <FieldRow
                    label="Student levels"
                    value={
                      profile.studentLevels.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {profile.studentLevels.map((level) => (
                            <span key={level} className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-700">
                              {level}
                            </span>
                          ))}
                        </div>
                      ) : null
                    }
                  />
                  <FieldRow
                    label="Teaching mode"
                    value={profile.teachingMode.replace(/_/g, ' ').toLowerCase()}
                  />
                  <FieldRow
                    label="Hourly rate"
                    value={formatAdminRates(profile)}
                  />
                </dl>
              </Section>

              {/* Section 4 — Public Profile Preview */}
              <Section title="Public Profile Preview">
                <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  This is a preview — the profile is not publicly visible until approved.
                </p>

                {profile.profileStatus === 'APPROVED' ? (
                  <p className="mb-3 text-sm text-ink-600">
                    This profile is approved.{' '}
                    <Link
                      to={`/tutors/${profile.id}`}
                      className="font-medium text-brand-700 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      View public profile →
                    </Link>
                  </p>
                ) : null}

                <div className="rounded-xl border border-ink-200 bg-ink-50 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    {profile.profilePhotoUrl ? (
                      <img
                        src={profile.profilePhotoUrl}
                        alt={`${profile.displayName}'s profile photo`}
                        className="h-20 w-20 rounded-full object-cover ring-2 ring-ink-200"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex h-20 w-20 items-center justify-center rounded-full bg-ink-200 text-2xl font-bold text-ink-500"
                      >
                        {profile.displayName.trim().charAt(0).toUpperCase() || '?'}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-bold text-ink-900">{profile.displayName}</p>
                      <p className="text-sm text-ink-600">{profile.headline}</p>
                      {profile.location ? (
                        <p className="mt-1 text-xs text-ink-500">{profile.location}</p>
                      ) : null}
                      <p className="mt-1 text-sm font-semibold text-ink-800">
                        {formatAdminRates(profile)}
                      </p>
                    </div>
                  </div>

                  {profile.bio ? (
                    <div className="mt-4 border-t border-ink-200 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">About</p>
                      <p className="mt-1 text-sm text-ink-700 line-clamp-4">{profile.bio}</p>
                    </div>
                  ) : null}

                  {profile.subjects.length > 0 ? (
                    <div className="mt-4 border-t border-ink-200 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Subjects</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {profile.subjects.map((s) => (
                          <span key={s.id} className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-800">
                            {s.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </Section>

              {/* Section 5 — Verification */}
              <Section title="Verification" tone="internal">
                <p className="mb-4 text-xs italic text-amber-800">
                  External document verification — Documents are submitted to the Tedor Tutors team through Telegram or WhatsApp.
                </p>

                {/* Verification status */}
                <div className="mb-4 flex flex-col gap-1.5">
                  <label htmlFor="verification-status" className="text-sm font-medium text-ink-800">
                    Verification status
                  </label>
                  <Select
                    id="verification-status"
                    value={verificationStatus}
                    onChange={(e) => setVerificationStatus(e.target.value as VerificationStatus)}
                    className="sm:w-64"
                  >
                    {VERIFICATION_STATUSES.map((v) => (
                      <option key={v} value={v}>
                        {VERIFICATION_STATUS_LABELS[v]}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Verification checklist */}
                <fieldset className="mb-4">
                  <legend className="mb-2 text-sm font-medium text-ink-800">Document checklist</legend>
                  <div className="flex flex-col gap-2">
                    {VERIFICATION_CHECKLIST_FIELDS.map(({ key, label }) => (
                      <label key={key} className="flex cursor-pointer items-center gap-3 text-sm text-ink-700">
                        <input
                          type="checkbox"
                          checked={checklist[key]}
                          onChange={() => toggleChecklistItem(key)}
                          className="h-4 w-4 rounded border-ink-300 accent-brand-600"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                {/* Admin notes */}
                <div className="mb-4 flex flex-col gap-1.5">
                  <label htmlFor="admin-notes" className="text-sm font-medium text-ink-800">
                    Verification notes
                    <span className="ml-1 text-xs font-normal text-ink-500">(internal, not shown to applicant)</span>
                  </label>
                  <Textarea
                    id="admin-notes"
                    value={adminNotes}
                    rows={4}
                    maxLength={4000}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Document summary, verification dates, outstanding items…"
                    className="bg-white"
                  />
                  <p className="text-xs text-amber-800">{adminNotes.length} / 4000 characters</p>
                </div>

                {/* Save button */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => void handleSaveVerification()}
                    disabled={savingVerification}
                  >
                    {savingVerification ? 'Saving…' : 'Save Verification Notes'}
                  </Button>
                  {verificationSavedAt ? (
                    <p role="status" className="text-sm text-emerald-700">
                      Saved at {verificationSavedAt}
                    </p>
                  ) : null}
                </div>
                {verificationError ? (
                  <Alert tone="error" className="mt-3">
                    {verificationError}
                  </Alert>
                ) : null}
              </Section>
            </div>

            {/* ── Sticky action panel ─────────────────────────────────────── */}
            <aside className="w-full lg:w-64 lg:shrink-0">
              <div className="sticky top-6 flex flex-col gap-3 rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
                <div>
                  <h2 className="text-sm font-semibold text-ink-900">Moderation</h2>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {profile.profileStatus === 'APPROVED'
                      ? 'This tutor is live in the public directory.'
                      : 'This tutor is not visible in the public directory.'}
                  </p>
                </div>

                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => {
                    setApproveError(null)
                    setApproveOpen(true)
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Approve Tutor
                </Button>

                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => {
                    setInfoError(null)
                    setInfoMessage('')
                    setNeedsInfoOpen(true)
                  }}
                >
                  Request More Information
                </Button>

                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => {
                    setRejectError(null)
                    setRejectMessage('')
                    setRejectReason('MISSING_DOCUMENT')
                    setRejectOpen(true)
                  }}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  Reject Application
                </Button>

                {/*
                  Suspend is offered only to a tutor who is currently approved —
                  suspending somebody who was never approved changes nothing an
                  admin can see, and offering it anyway would fill the panel with
                  controls that do nothing.
                */}
                {profile.profileStatus === 'APPROVED' ? (
                  <Button
                    variant="outline"
                    fullWidth
                    onClick={() => {
                      setSuspendError(null)
                      setSuspendOpen(true)
                    }}
                    className="border-amber-300 text-amber-800 hover:bg-amber-50"
                  >
                    Suspend Tutor
                  </Button>
                ) : null}
              </div>
            </aside>
          </div>

          {/* ── Approve modal ──────────────────────────────────────────────── */}
          <Modal
            open={approveOpen}
            title="Approve tutor?"
            description="Approving this tutor will make their profile publicly visible in the tutor directory."
            onClose={() => { setApproveOpen(false); setApproveError(null) }}
            footer={
              <>
                <Button variant="outline" onClick={() => { setApproveOpen(false); setApproveError(null) }} disabled={approving}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleApprove()}
                  disabled={approving}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {approving ? 'Approving…' : 'Confirm Approval'}
                </Button>
              </>
            }
          >
            {approveError ? <Alert tone="error">{approveError}</Alert> : null}
          </Modal>

          {/* ── Request More Information modal ─────────────────────────────── */}
          <Modal
            open={needsInfoOpen}
            title="Request more information"
            onClose={() => { setNeedsInfoOpen(false); setInfoError(null); setInfoMessage('') }}
            footer={
              <>
                <Button variant="outline" onClick={() => { setNeedsInfoOpen(false); setInfoError(null); setInfoMessage('') }} disabled={sendingInfo}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleSendInfoRequest()}
                  disabled={sendingInfo || !infoMessage.trim()}
                >
                  {sendingInfo ? 'Sending…' : 'Send Request'}
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="info-message" className="text-sm font-medium text-ink-800">
                Message to applicant <span aria-hidden="true" className="text-red-500">*</span>
              </label>
              <Textarea
                id="info-message"
                value={infoMessage}
                rows={4}
                maxLength={2000}
                onChange={(e) => setInfoMessage(e.target.value)}
                placeholder="Describe what additional information or documents are needed…"
              />
              <p className="text-xs text-ink-500">{infoMessage.length} / 2000</p>
              {infoError ? <Alert tone="error">{infoError}</Alert> : null}
            </div>
          </Modal>

          {/* ── Reject modal ───────────────────────────────────────────────── */}
          <Modal
            open={rejectOpen}
            title="Reject application"
            onClose={() => { setRejectOpen(false); setRejectError(null); setRejectMessage('') }}
            footer={
              <>
                <Button variant="outline" onClick={() => { setRejectOpen(false); setRejectError(null); setRejectMessage('') }} disabled={rejecting}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleReject()}
                  disabled={rejecting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {rejecting ? 'Rejecting…' : 'Reject Application'}
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="reject-reason" className="text-sm font-medium text-ink-800">
                  Reason <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <Select
                  id="reject-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value as RejectionReasonCategory)}
                >
                  {REJECTION_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {REJECTION_REASON_LABELS[r]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="reject-message" className="text-sm font-medium text-ink-800">
                  Additional message{' '}
                  <span className="text-xs font-normal text-ink-500">(optional)</span>
                </label>
                <Textarea
                  id="reject-message"
                  value={rejectMessage}
                  rows={3}
                  maxLength={2000}
                  onChange={(e) => setRejectMessage(e.target.value)}
                  placeholder="Any additional context for the applicant…"
                />
                <p className="text-xs text-ink-500">{rejectMessage.length} / 2000</p>
              </div>
              {rejectError ? <Alert tone="error">{rejectError}</Alert> : null}
            </div>
          </Modal>

          {/* ── Suspend modal ──────────────────────────────────────────────── */}
          <Modal
            open={suspendOpen}
            title="Suspend this tutor?"
            onClose={() => { setSuspendOpen(false); setSuspendError(null) }}
            footer={
              <>
                <Button variant="outline" onClick={() => { setSuspendOpen(false); setSuspendError(null) }} disabled={suspending}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleSuspend()}
                  disabled={suspending}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {suspending ? 'Suspending…' : 'Suspend Tutor'}
                </Button>
              </>
            }
          >
            {/*
              The consequence is stated rather than softened. Suspending removes
              the profile from the public directory, and there is no restore action
              anywhere in the admin API — so the admin is told that before the
              button, not after.
            */}
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink-700">
                Suspending removes <span className="font-semibold">{profile.displayName}</span> from
                the public tutor directory straight away. Anyone already booked with them is not
                notified automatically.
              </p>
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                There is no &ldquo;unsuspend&rdquo; action in this admin area. To bring the profile
                back you would have to approve it again from the queue.
              </p>
              {suspendError ? <Alert tone="error">{suspendError}</Alert> : null}
            </div>
          </Modal>
        </>
      ) : null}
    </AdminShell>
  )
}
