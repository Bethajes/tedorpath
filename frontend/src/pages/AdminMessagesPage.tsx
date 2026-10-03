import { AdminIcon } from '@/components/admin/icons'
import { AdminPageHeader, AdminShell } from '@/components/layout/AdminShell'

/**
 * Messages — `/admin/messages`
 *
 * A placeholder with an honest explanation, not a fake inbox.
 *
 * WHY THIS PAGE HAS NO CONTENT
 *
 * The platform has no messaging. There is no message table in the schema, no
 * thread, no read receipt and no endpoint that returns one. A learner submits a
 * request form and a tutor submits a profile; contact details are stored as
 * fields on those two records, and nothing is sent or received through the
 * product.
 *
 * So this screen states that, and points at what does exist. Rendering a
 * conversation list here — even an empty-looking one with a sample thread, or a
 * "0 unread" badge — would imply a feature that does not exist, and an operator
 * would reasonably believe they had missed messages.
 *
 * The nav entry for this section is marked "Soon" rather than hidden, so it is
 * clear the section was planned and is not finished.
 */
export function AdminMessagesPage() {
  return (
    <AdminShell>
      <AdminPageHeader
        title="Messages"
        description="Reserved for tutor and learner conversations. There is nothing here yet."
      />

      <div className="rounded-xl border border-ink-200 bg-white px-5 py-12 text-center shadow-sm">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ink-100 text-ink-500">
          <AdminIcon name="messages" className="h-7 w-7" />
        </span>

        <h2 className="mt-4 text-base font-semibold text-ink-900">No messaging on the platform</h2>

        <p className="mx-auto mt-2 max-w-xl text-sm text-ink-600">
          Tutors and learners do not message each other here. A learner submits a request form and a
          tutor submits a profile; the contact details on those records are the only messaging the
          product handles, and they are stored rather than sent.
        </p>

        <div className="mx-auto mt-6 max-w-xl rounded-xl border border-ink-200 bg-ink-50 p-4 text-left">
          <p className="text-sm font-medium text-ink-800">What exists instead</p>
          <ul className="mt-2 space-y-2 text-sm text-ink-600">
            <li className="flex items-start gap-2">
              <AdminIcon name="requests" className="mt-0.5 h-4 w-4 shrink-0 fill-ink-400" />
              Learner requests carry a phone number, and optionally an email address or Telegram
              handle, in the request detail screen.
            </li>
            <li className="flex items-start gap-2">
              <AdminIcon name="tutors" className="mt-0.5 h-4 w-4 shrink-0 fill-ink-400" />
              Tutor profiles carry the applicant's email address in the review workspace.
            </li>
            <li className="flex items-start gap-2">
              <AdminIcon name="document" className="mt-0.5 h-4 w-4 shrink-0 fill-ink-400" />
              Asking a tutor for documents uses the moderation workflow — a status change plus a
              message the applicant reads on their own status page.
            </li>
          </ul>
        </div>
      </div>
    </AdminShell>
  )
}
