import { prisma } from '../../lib/prisma.js'

/**
 * Database access for admin tutor moderation.
 *
 * Every query selects explicit columns rather than returning whole rows, so a
 * column added to the table later cannot leak into the admin API by accident.
 * Requirements: 7.1, 7.2, 7.3, 7.5
 */

const SUBJECT_INCLUDE = {
  include: { subject: true },
}

/**
 * Columns for the moderation queue. Carries everything a moderator needs to
 * make a decision, and nothing that only matters once a decision is made.
 */
const LIST_COLUMNS = {
  id: true,
  userId: true,
  displayName: true,
  headline: true,
  location: true,
  teachingMode: true,
  studentLevels: true,
  hourlyRate: true,
  profileStatus: true,
  verificationStatus: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, name: true, email: true } },
  subjects: SUBJECT_INCLUDE,
}

/**
 * Columns for the detail view: the full submitted content plus the moderation
 * fields. This is the only place the tutor's bio, experience and contact-linked
 * account details are exposed, and it stays behind requireAdmin.
 */
const DETAIL_COLUMNS = {
  ...LIST_COLUMNS,
  bio: true,
  profilePhotoUrl: true,
  languages: true,
  availability: true,
  experience: true,
  education: true,
}

export async function listTutorProfiles({ page, limit, status }) {
  const where = status && status !== 'all' ? { profileStatus: status } : {}

  const [items, total] = await Promise.all([
    prisma.tutorProfile.findMany({
      where,
      select: LIST_COLUMNS,
      // Newest first, with id as a stable tiebreaker for equal timestamps.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.tutorProfile.count({ where }),
  ])

  return {
    items: items.map(shapeSubjectList),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  }
}

export async function getTutorProfileAdmin(id) {
  const profile = await prisma.tutorProfile.findUnique({
    where: { id },
    select: DETAIL_COLUMNS,
  })

  return profile ? shapeSubjectList(profile) : null
}

/**
 * Applies a moderation decision.
 *
 * `verificationStatus` is written only when the admin actually sent it
 * (Requirement 7.5). Omitting it from `data` entirely leaves the stored value
 * untouched, which is why the `undefined` check is written the way it is.
 */
export async function updateTutorProfileStatus(id, { status, verificationStatus }) {
  const data = { profileStatus: status }
  if (verificationStatus !== undefined) {
    data.verificationStatus = verificationStatus
  }

  const profile = await prisma.tutorProfile.update({
    where: { id },
    data,
    select: DETAIL_COLUMNS,
  })

  return shapeSubjectList(profile)
}

/** Flattens the join rows into plain subjects for the response. */
function shapeSubjectList(profile) {
  return { ...profile, subjects: profile.subjects.map((row) => row.subject) }
}
