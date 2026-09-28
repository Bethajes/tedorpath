/**
 * Types for the admin dashboard.
 *
 * These mirror the admin API responses. The list shape is intentionally
 * narrower than the detail shape — the server does not send admin notes or
 * full contact details in list responses.
 */

export const ADMIN_STATUSES = [
  'NEW',
  'CONTACTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const

export type AdminStatus = (typeof ADMIN_STATUSES)[number]

export const STATUS_FILTERS = ['all', ...ADMIN_STATUSES] as const
export type StatusFilter = (typeof STATUS_FILTERS)[number]

export interface AdminRequestListItem {
  id: string
  fullName: string
  subject: string
  educationLevel: string
  learningMode: string
  status: AdminStatus
  createdAt: string
}

export interface AdminRequestDetail extends AdminRequestListItem {
  phone: string
  telegramUsername: string | null
  email: string | null
  description: string
  location: string | null
  preferredDays: string | null
  preferredTime: string | null
  budget: string | null
  additionalInfo: string | null
  adminNotes: string | null
  updatedAt: string
}

export interface AdminRequestList {
  items: AdminRequestListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface AdminStats {
  total: number
  NEW: number
  CONTACTED: number
  IN_PROGRESS: number
  COMPLETED: number
  CANCELLED: number
}

export interface ListParams {
  page?: number
  limit?: number
  status?: StatusFilter
  search?: string
}

/** Fields the admin API accepts. Client-submitted data is immutable. */
export interface AdminRequestUpdate {
  status?: AdminStatus
  adminNotes?: string | null
}
