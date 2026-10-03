import { prisma } from '../../lib/prisma.js'

/**
 * Database access for the admin dashboard.
 *
 * Every query selects explicit columns. `adminNotes` is included only for the
 * detail endpoint so list views stay light, and no list endpoint ever returns
 * contact details that the table does not need.
 */

/**
 * The tutor a client picked, when they picked one.
 *
 * A request that came from a tutor's profile is aimed at that tutor, and an
 * admin triaging the queue has to know that: it decides who the request should
 * go to and whether it should go to them at all. Without it the queue showed
 * only "Mathematics / High School" and the fact that someone had already chosen
 * a tutor was invisible.
 *
 * `onDelete: SetNull` on the relation means a deleted profile leaves the request
 * readable with a null tutor, so this has to tolerate the absent case rather
 * than assume the join always resolves.
 */
const TUTOR_INCLUDE = {
  select: {
    id: true,
    displayName: true,
    headline: true,
    profileStatus: true,
  },
}

/**
 * Flattens the joined profile into a `tutor` object or null.
 *
 * The raw `tutorProfile` key is dropped so the response shape is the same whether
 * a request was aimed at a tutor or not — a client reading `request.tutor?.id`
 * should not have to know which column it came from.
 *
 * The subjects a request asked for are flattened the same way: the join rows
 * become names, so the detail screen shows "Mathematics, Physics" rather than a
 * list of ids. A request from before multi-select has no join rows and keeps an
 * empty list alongside its `subject` text.
 */
function shapeTutor(request) {
  const { tutorProfile, subjects, budgetAmount, ...rest } = request
  return {
    ...rest,
    // Decimal.js serialises as a string, which would be read as text by the
    // admin UI's number formatting. The amount is money the client typed, not a
    // quantity to compute with, so a plain number is the honest shape.
    budgetAmount: budgetAmount === null || budgetAmount === undefined ? null : Number(budgetAmount),
    // Only the detail endpoint selects the join; the list keeps its columns
    // narrow and reports an empty list rather than a second query per row.
    subjects: (subjects ?? []).map((row) => row.subject.name),
    tutor: tutorProfile
      ? {
          id: tutorProfile.id,
          displayName: tutorProfile.displayName,
          headline: tutorProfile.headline,
          profileStatus: tutorProfile.profileStatus,
        }
      : null,
  }
}

const LIST_COLUMNS = {
  id: true,
  fullName: true,
  subject: true,
  educationLevel: true,
  learningMode: true,
  status: true,
  createdAt: true,
  // Where the client is, which decides the currency and the timezone of any
  // budget they quoted. Null on requests from before the wizard.
  countryCode: true,
  // Which market the request was made in, so a moderator can see whether the
  // requester was after a local or an international price without inferring it
  // from the country again — and so the two cannot disagree if that mapping changes.
  market: true,
  // Which tutor the client chose, if any. Requirement 13.1
  tutorProfileId: true,
  tutorProfile: TUTOR_INCLUDE,
}

/**
 * Subjects a request asked for.
 *
 * Only the name is selected: the detail screen lists what was asked for, and a
 * slug would be an id the person reading it has no use for.
 */
const REQUEST_SUBJECT_INCLUDE = {
  select: { subject: { select: { name: true } } },
  orderBy: { subject: { name: 'asc' } },
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
  // Everything the wizard collects beyond the original form. An admin triaging
  // the queue needs the country (to know the currency) and the timezone (to
  // know when "18:00" actually is), and the goal tells them who to send.
  countryCode: true,
  // Which market the request was made in, so a moderator can see whether the
  // requester was after a local or an international price without inferring it
  // from the country again — and so the two cannot disagree if that mapping changes.
  market: true,
  timezone: true,
  educationLevelCode: true,
  subjectOther: true,
  subjects: REQUEST_SUBJECT_INCLUDE,
  learningGoal: true,
  learningGoalOther: true,
  preferredDayNames: true,
  preferredTimeRanges: true,
  budgetAmount: true,
  budgetCurrency: true,
  // The chosen tutor, named on the detail view so an admin can route the
  // request without opening the tutor's profile first. Requirement 13.1
  tutorProfileId: true,
  tutorProfile: TUTOR_INCLUDE,
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
      // The chosen tutor's name. An admin asked "what did Bethel get asked for?"
      // should find it by typing "Bethel", not by reading every row looking for
      // a tutor they have to recognise from a column they cannot see.
      { tutorProfile: { displayName: { contains: term, mode: 'insensitive' } } },
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
    items: items.map(shapeTutor),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  }
}

/**
 * Counts per status, computed from the database.
 *
 * `tutorApplications` is the one number here that is not about requests. It
 * exists because a tutor application waiting for review is invisible on a
 * dashboard built only from `TutorRequest`: an admin sees a wall of zeroes and
 * concludes nothing has arrived, when in fact someone is waiting on them. The
 * tutor-facing statuses are counted separately and never mixed into `total`.
 */
export async function getRequestStats() {
  const [total, grouped, tutorApplications] = await Promise.all([
    prisma.tutorRequest.count(),
    prisma.tutorRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.tutorProfile.groupBy({ by: ['profileStatus'], _count: { _all: true } }),
  ])

  const byStatus = Object.fromEntries(
    grouped.map((row) => [row.status, row._count._all]),
  )
  const byProfileStatus = Object.fromEntries(
    tutorApplications.map((row) => [row.profileStatus, row._count._all]),
  )

  return {
    total,
    NEW: byStatus.NEW ?? 0,
    CONTACTED: byStatus.CONTACTED ?? 0,
    IN_PROGRESS: byStatus.IN_PROGRESS ?? 0,
    COMPLETED: byStatus.COMPLETED ?? 0,
    CANCELLED: byStatus.CANCELLED ?? 0,
    tutorApplications: {
      total: tutorApplications.reduce((sum, row) => sum + row._count._all, 0),
      PENDING_REVIEW: byProfileStatus.PENDING_REVIEW ?? 0,
      NEEDS_INFORMATION: byProfileStatus.NEEDS_INFORMATION ?? 0,
      APPROVED: byProfileStatus.APPROVED ?? 0,
    },
  }
}

export async function getTutorRequest(id) {
  const request = await prisma.tutorRequest.findUnique({
    where: { id },
    select: DETAIL_COLUMNS,
  })

  return request ? shapeTutor(request) : null
}

/** Applies only the fields the admin is allowed to change. */
export async function updateTutorRequest(id, { status, adminNotes }) {
  const data = {}
  if (status !== undefined) data.status = status
  if (adminNotes !== undefined) data.adminNotes = adminNotes

  const request = await prisma.tutorRequest.update({
    where: { id },
    data,
    select: DETAIL_COLUMNS,
  })

  // Shaped like `getTutorRequest` rather than returned raw. It used to leak the
  // joined `tutorProfile` column here while GET returned a flattened `tutor`,
  // and the detail endpoint's column set now includes the subject join — two
  // different shapes for the same record from two URLs on the same screen is
  // the kind of thing that quietly breaks a client later.
  return shapeTutor(request)
}

export async function deleteTutorRequest(id) {
  // deleteMany avoids throwing when the row is already gone, letting the
  // controller answer 404 consistently.
  const { count } = await prisma.tutorRequest.deleteMany({ where: { id } })
  return count > 0
}
