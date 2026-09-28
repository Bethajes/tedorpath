import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { AdminBackLink, AdminPageHeader, AdminShell } from '@/components/layout/AdminShell'
import { Alert, Button, Select, Textarea } from '@/components/ui'
import {
  deleteAdminRequest,
  fetchAdminRequest,
  updateAdminRequest,
} from '@/features/adminRequests/adminRequests.api'
import { DetailRow, DetailSection } from '@/features/adminRequests/components/DetailSection'
import { StatusBadge } from '@/features/adminRequests/components/StatusBadge'
import {
  ADMIN_STATUSES,
  type AdminRequestDetail,
  type AdminStatus,
} from '@/features/adminRequests/types'
import { ApiError } from '@/lib/api'
import { formatDate } from '@/lib/formatDate'

const STATUS_LABELS: Record<AdminStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const MAX_NOTES = 5000

export function AdminRequestDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const [record, setRecord] = useState<AdminRequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [status, setStatus] = useState<AdminStatus>('NEW')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Guards against a slow response overwriting state after unmount.
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError(null)
      setNotFound(false)
      try {
        const data = await fetchAdminRequest(id)
        if (cancelled) return
        setRecord(data)
        setStatus(data.status)
        setNotes(data.adminNotes ?? '')
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true)
        } else {
          setLoadError(
            err instanceof ApiError && err.status === 401
              ? 'Your admin session is no longer valid. Please sign in again.'
              : 'Unable to load this tutor request. Please try again.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleSave() {
    if (!record) return
    setSaving(true)
    setSaveError(null)
    setSavedAt(null)
    try {
      const updated = await updateAdminRequest(record.id, {
        status,
        adminNotes: notes.trim() === '' ? null : notes,
      })
      if (!active.current) return
      setRecord(updated)
      setStatus(updated.status)
      setNotes(updated.adminNotes ?? '')
      setSavedAt(new Date().toLocaleTimeString('en-GB'))
    } catch {
      if (!active.current) return
      setSaveError('Unable to save your changes. Please try again.')
    } finally {
      if (active.current) setSaving(false)
    }
  }

  async function handleDelete() {
    if (!record) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteAdminRequest(record.id)
      if (active.current) navigate('/admin/requests')
    } catch {
      if (!active.current) return
      setDeleteError('Unable to delete this request. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <AdminShell>
      <div className="mb-4">
        <AdminBackLink />
      </div>
      <AdminPageHeader
        title={record ? record.fullName : 'Tutor Request'}
        description={record ? `${record.subject} · ${record.educationLevel}` : undefined}
      />

      {loading ? (
        <p
          role="status"
          className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm"
        >
          Loading request…
        </p>
      ) : null}

      {notFound ? (
        <Alert tone="error">
          <p>This tutor request does not exist. It may have been deleted.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/admin/requests')}>
            Back to all requests
          </Button>
        </Alert>
      ) : null}

      {loadError ? (
        <Alert tone="error">
          <p>{loadError}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => window.location.reload()}
          >
            Try again
          </Button>
        </Alert>
      ) : null}

      {record ? (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <DetailSection title="Client Information">
              <dl className="mt-2 divide-y divide-slate-100">
                <DetailRow label="Full name" value={record.fullName} />
                <DetailRow label="Phone" value={record.phone} />
                <DetailRow label="Telegram" value={record.telegramUsername} />
                <DetailRow label="Email" value={record.email} />
              </dl>
            </DetailSection>

            <DetailSection title="Request Information">
              <dl className="mt-2 divide-y divide-slate-100">
                <DetailRow
                  label="Status"
                  value={<StatusBadge status={record.status} />}
                />
                <DetailRow label="Created" value={formatDate(record.createdAt)} />
                <DetailRow label="Last updated" value={formatDate(record.updatedAt)} />
              </dl>
            </DetailSection>
          </div>

          <DetailSection title="Learning Requirements">
            <dl className="mt-2 grid grid-cols-1 gap-x-6 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0">
              <div className="sm:col-span-2">
                <DetailRow label="Description" value={record.description} />
              </div>
              <DetailRow label="Subject" value={record.subject} />
              <DetailRow label="Education level" value={record.educationLevel} />
              <DetailRow label="Learning mode" value={record.learningMode} />
              <DetailRow label="Location" value={record.location} />
              <DetailRow label="Preferred days" value={record.preferredDays} />
              <DetailRow label="Preferred time" value={record.preferredTime} />
              <DetailRow label="Budget" value={record.budget} />
              <div className="sm:col-span-2">
                <DetailRow label="Additional information" value={record.additionalInfo} />
              </div>
            </dl>
          </DetailSection>

          <DetailSection
            title="Internal Admin Notes"
            description="Only visible to Tedor staff. Never shown on the public website or to the client."
            tone="internal"
          >
            <div className="mt-3 flex flex-col gap-3">
              <label htmlFor="admin-notes" className="sr-only">
                Internal admin notes
              </label>
              <Textarea
                id="admin-notes"
                value={notes}
                maxLength={MAX_NOTES}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Call summary, tutor candidates, follow-up dates…"
                className="bg-white"
              />
              <p className="text-xs text-amber-800">
                {notes.length} / {MAX_NOTES} characters
              </p>
            </div>
          </DetailSection>

          <DetailSection title="Update Status" description="Status changes are manual — nothing moves automatically.">
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="status-select" className="text-sm font-medium text-slate-800">
                  Status
                </label>
                <Select
                  id="status-select"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as AdminStatus)}
                  className="sm:w-56"
                >
                  {ADMIN_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {STATUS_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </div>
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
              {savedAt ? (
                <p role="status" className="text-sm text-emerald-700">
                  Saved at {savedAt}
                </p>
              ) : null}
            </div>
            {saveError ? (
              <Alert tone="error" className="mt-3">
                {saveError}
              </Alert>
            ) : null}
          </DetailSection>

          <DetailSection title="Danger zone">
            <div className="mt-3">
              {deleteError ? (
                <Alert tone="error" className="mb-3">
                  {deleteError}
                </Alert>
              ) : null}

              {confirmDelete ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-medium text-red-900">
                    Delete this request permanently? This cannot be undone.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleDelete()}
                      disabled={deleting}
                      className="border-red-300 text-red-800 hover:bg-red-100"
                    >
                      {deleting ? 'Deleting…' : 'Yes, delete it'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setConfirmDelete(true)}>
                  Delete request
                </Button>
              )}
            </div>
          </DetailSection>
        </div>
      ) : null}
    </AdminShell>
  )
}
