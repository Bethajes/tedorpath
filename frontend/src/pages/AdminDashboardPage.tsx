import { Link } from 'react-router-dom'

import { AdminPageHeader, AdminShell } from '@/components/layout/AdminShell'
import { Alert, Button } from '@/components/ui'
import { fetchAdminRequests, fetchAdminStats } from '@/features/adminRequests/adminRequests.api'
import { StatsCards } from '@/features/adminRequests/components/StatsCards'
import { StatusBadge } from '@/features/adminRequests/components/StatusBadge'
import { ApiError } from '@/lib/api'
import { formatDate } from '@/lib/formatDate'
import { useAsyncData } from '@/lib/useAsyncData'

const RECENT_LIMIT = 5

function describeError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    return 'Your admin session is no longer valid. Please sign in again.'
  }
  return 'Unable to load the dashboard. Please try again.'
}

export function AdminDashboardPage() {
  const { data, loading, error, reload } = useAsyncData(
    async () => {
      const [stats, list] = await Promise.all([
        fetchAdminStats(),
        fetchAdminRequests({ page: 1, limit: RECENT_LIMIT }),
      ])
      return { stats, recent: list.items }
    },
    [],
    describeError,
  )

  const recent = data?.recent ?? null

  return (
    <AdminShell>
      <AdminPageHeader
        title="Dashboard"
        description="An overview of incoming tutor requests."
        actions={
          <Button variant="outline" onClick={reload} disabled={loading}>
            Refresh
          </Button>
        }
      />

      {error ? (
        <Alert tone="error" className="mb-5">
          <p>{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
            Try again
          </Button>
        </Alert>
      ) : null}

      {loading ? (
        <p
          role="status"
          className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm"
        >
          Loading dashboard…
        </p>
      ) : null}

      {data && !loading ? <StatsCards stats={data.stats} /> : null}

      <section className="mt-8" aria-labelledby="recent-requests">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent-requests" className="text-lg font-semibold text-slate-900">
            Recent requests
          </h2>
          <Link to="/admin/requests" className="text-sm font-medium text-brand-700 hover:underline">
            View all
          </Link>
        </div>

        {!loading && recent && recent.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            No tutor requests yet.
          </p>
        ) : null}

        {recent && recent.length > 0 ? (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {recent.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link
                    to={`/admin/requests/${item.id}`}
                    className="font-medium text-slate-900 hover:text-brand-700"
                  >
                    {item.fullName}
                  </Link>
                  <p className="text-sm text-slate-600">
                    {item.subject} · {item.educationLevel} · {formatDate(item.createdAt)}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </AdminShell>
  )
}
