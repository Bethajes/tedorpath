import { prisma } from '../../lib/prisma.js'

/**
 * Database access for the admin dashboard.
 *
 * Every query selects explicit columns. `adminNotes` is included only for the
 * detail endpoint so list views stay light, and no list endpoint ever returns
 * contact details that the table does not need.
 */

const LIST_COLUMNS = {
  id: true,
  fullName: true,
  subject: true,
  educationLevel: true,
  learningMode: true,
  status: true,
  createdAt: true,
}

const DETAIL_COLUMNS = {
  id: true,
  fullName: true,
  phone: true,
  telegramUsername: true,
  email: true,
  subject: true,
  educationLevel: true,
  description: true,
  learningMode: true,
  location: true,
  preferredDays: true,
  preferredTime: true,
  budget: true,
  additionalInfo: true,
  status: true,
  adminNotes: true,
  createdAt: true,
  updatedAt: true,
}

/** Case-insensitive "contains" across the searchable client/subject columns. */
function searchFilter(term) {
  if (!term) return undefined
  return {
    OR: [
      { fullName: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
      { telegramUsername: { contains: term, mode: 'insensitive' } },
      { subject: { contains: term, mode: 'insensitive' } },
    ],
  }
}

export async function listTutorRequests({ page, limit, status, search }) {
  const where = {
    ...(status && status !== 'all' ? { status } : {}),
    ...(searchFilter(search) ?? {}),
  }

  const [items, total] = await Promise.all([
    prisma.tutorRequest.findMany({
      where,
      select: LIST_COLUMNS,
      // Newest first, with id as a stable tiebreaker for equal timestamps.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.tutorRequest.count({ where }),
  ])

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  }
}

/** Counts per status, computed from the database. */
export async function getRequestStats() {
  const [total, grouped] = await Promise.all([
    prisma.tutorRequest.count(),
    prisma.tutorRequest.groupBy({ by: ['status'], _count: { _all: true } }),
  ])

  const byStatus = Object.fromEntries(
    grouped.map((row) => [row.status, row._count._all]),
  )

  return {
    total,
    NEW: byStatus.NEW ?? 0,
    CONTACTED: byStatus.CONTACTED ?? 0,
    IN_PROGRESS: byStatus.IN_PROGRESS ?? 0,
    COMPLETED: byStatus.COMPLETED ?? 0,
    CANCELLED: byStatus.CANCELLED ?? 0,
  }
}

export async function getTutorRequest(id) {
  return prisma.tutorRequest.findUnique({ where: { id }, select: DETAIL_COLUMNS })
}

/** Applies only the fields the admin is allowed to change. */
export async function updateTutorRequest(id, { status, adminNotes }) {
  const data = {}
  if (status !== undefined) data.status = status
  if (adminNotes !== undefined) data.adminNotes = adminNotes

  return prisma.tutorRequest.update({
    where: { id },
    data,
    select: DETAIL_COLUMNS,
  })
}

export async function deleteTutorRequest(id) {
  // deleteMany avoids throwing when the row is already gone, letting the
  // controller answer 404 consistently.
  const { count } = await prisma.tutorRequest.deleteMany({ where: { id } })
  return count > 0
}
