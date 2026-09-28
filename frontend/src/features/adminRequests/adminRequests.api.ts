import { deleteJson, getJson, patchJson } from '@/lib/api'

import type {
  AdminRequestDetail,
  AdminRequestList,
  AdminRequestUpdate,
  AdminStats,
  ListParams,
} from './types'

const BASE_PATH = '/api/admin'

/** Admin dashboard statistics, counted from the database. */
export function fetchAdminStats(): Promise<AdminStats> {
  return getJson<AdminStats>(`${BASE_PATH}/stats`)
}

/** Paginated, searchable, status-filtered list of tutor requests (newest first). */
export function fetchAdminRequests(params: ListParams = {}): Promise<AdminRequestList> {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 1))
  query.set('limit', String(params.limit ?? 20))
  query.set('status', params.status ?? 'all')
  if (params.search) query.set('q', params.search)

  return getJson<AdminRequestList>(`${BASE_PATH}/tutor-requests?${query.toString()}`)
}

export function fetchAdminRequest(id: string): Promise<AdminRequestDetail> {
  return getJson<AdminRequestDetail>(`${BASE_PATH}/tutor-requests/${encodeURIComponent(id)}`)
}

/** Updates only `status` and/or `adminNotes`. */
export function updateAdminRequest(
  id: string,
  update: AdminRequestUpdate,
): Promise<AdminRequestDetail> {
  return patchJson<AdminRequestDetail>(
    `${BASE_PATH}/tutor-requests/${encodeURIComponent(id)}`,
    update,
  )
}

export function deleteAdminRequest(id: string): Promise<{ deleted: boolean }> {
  return deleteJson<{ deleted: boolean }>(
    `${BASE_PATH}/tutor-requests/${encodeURIComponent(id)}`,
  )
}
