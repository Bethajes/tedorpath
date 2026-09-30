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
 * and verification fields. This is the only place the tutor's bio, experience
 * and contact-linked account details are exposed, and it stays behind
 * requireAdmin.
 */
const DETAIL_COLUMNS = {
  ...LIST_COLUMNS,
  bio: true,
  profilePhotoUrl: true,
  languages: true,
  availability: true,
  experience: true,
  education: true,
  // Extended verification workflow fields. Needed on the review workspace so an
  // admin sees the reference number, any prior rejection, and whatever the last
  // admin already checked. Requirements: 21.5, 22.4, 26.3
  applicationReference: true,
  rejectionReason: true,
  adminMessage: true,
  adminNotes: true,
  verificationChecklist: true,
  verifiedAt: true,
}

/**
 * Builds the list filter.
 *
 * Search spans the display name and the headline — the two things an admin
 * knows when someone calls to ask about "the maths tutor" — plus the account
 * name and email, which is what a colleague would have typed if the applicant
 * has two identities. Case-insensitive, so "Sarah" finds "sarah".
 *
 * The status filter and the search sit in the same object, which Prisma ANDs.
 * Requirement 23.4
 */
function buildWhere({ status, q }) {
  const where = {}

  if (status && status !== 'all') {
    where.profileStatus = status
  }

  if (q) {
    const contains = { contains: q, mode: 'insensitive' }
    where.OR = [
      { displayName: contains },
      { headline: contains },
      { user: { name: contains } },
      { user: { email: contains } },
    ]
  }

  return where
}

export async function listTutorProfiles({ page, limit, status, q }) {
  const where = buildWhere({ status, q })

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
 *
 * `rejectionReason` and `adminMessage` follow the same rule: the schema decides
 * which of them a given status requires, and whatever arrives is what gets
 * written. A field the admin did not send is left alone rather than blanked, so
 * a decision never destroys a previous admin's note.
 *
 * Requirements: 19.3, 22.1, 22.2, 22.3, 22.4
 */
export async function updateTutorProfileStatus(
  id,
  { status, verificationStatus, rejectionReason, adminMessage },
) {
  const data = { profileStatus: status }
  if (verificationStatus !== undefined) {
    data.verificationStatus = verificationStatus
  }
  if (rejectionReason !== undefined) {
    data.rejectionReason = rejectionReason
  }
  if (adminMessage !== undefined) {
    data.adminMessage = adminMessage
  }

  const profile = await prisma.tutorProfile.update({
    where: { id },
    data,
    select: DETAIL_COLUMNS,
  })

  return shapeSubjectList(profile)
}

/**
 * Records the outcome of an external document check.
 *
 * Deliberately separate from `updateTutorProfileStatus`: `profileStatus` is
 * never read or written here, so saving a checklist or a note can never approve,
 * reject or suspend anyone. That is the whole reason this is its own endpoint
 * rather than more fields on the status one (Requirement 27.3).
 *
 * `verifiedAt` is stamped automatically when the admin records a VERIFIED
 * status without naming a date, and is left alone otherwise. An explicit
 * `verifiedAt` in the payload always wins, so an admin can backdate a result.
 * The point is that a plain note edit does not make the profile look freshly
 * verified.
 *
 * Requirements: 26.3, 26.4, 26.5, 27.3, 27.4, 27.5
 */
export async function updateTutorVerification(id, { verificationStatus, adminNotes, verificationChecklist, verifiedAt }) {
  const data = {}
  if (verificationStatus !== undefined) {
    data.verificationStatus = verificationStatus
  }
  if (adminNotes !== undefined) {
    data.adminNotes = adminNotes
  }
  if (verificationChecklist !== undefined) {
    data.verificationChecklist = verificationChecklist
  }
  if (verifiedAt !== undefined) {
    data.verifiedAt = verifiedAt
  } else if (verificationStatus === 'VERIFIED') {
    data.verifiedAt = new Date()
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
