import { prisma } from '../../lib/prisma.js'

/**
 * TutorDetailDTO field selection — full public profile, never private User fields.
 * Superset of TutorCardDTO. Requirements: 5.4, 2.8, 16.1
 */
const TUTOR_DETAIL_SELECT = {
  id: true,
  displayName: true,
  headline: true,
  bio: true,
  profilePhotoUrl: true,
  teachingMode: true,
  location: true,
  hourlyRate: true,
  studentLevels: true,
  languages: true,
  availability: true,
  experience: true,
  education: true,
  createdAt: true,
  subjects: {
    select: {
      subject: {
        select: { id: true, name: true, slug: true, category: true },
      },
    },
  },
}

/**
 * TutorCardDTO field selection — public fields only, never private User fields.
 * Requirements: 2.8, 5.4, 16.1
 */
const TUTOR_CARD_SELECT = {
  id: true,
  displayName: true,
  headline: true,
  bio: true,
  profilePhotoUrl: true,
  teachingMode: true,
  location: true,
  hourlyRate: true,
  studentLevels: true,
  createdAt: true,
  updatedAt: true,
  subjects: {
    select: {
      subject: {
        select: { id: true, name: true, slug: true },
      },
    },
  },
}

/**
 * Map a raw Prisma TutorProfile row into a TutorCardDTO.
 * Bio is truncated to 200 chars for the card view.
 */
function toTutorCardDTO(profile) {
  return {
    id: profile.id,
    displayName: profile.displayName,
    headline: profile.headline,
    bio: profile.bio ? profile.bio.substring(0, 200) : null,
    profilePhotoUrl: profile.profilePhotoUrl ?? null,
    teachingMode: profile.teachingMode,
    location: profile.location ?? null,
    hourlyRate: profile.hourlyRate !== null && profile.hourlyRate !== undefined
      ? parseFloat(profile.hourlyRate.toString())
      : null,
    studentLevels: profile.studentLevels,
    createdAt: profile.createdAt,
    subjects: profile.subjects.map((ps) => ps.subject),
  }
}

/**
 * List approved tutor profiles with optional filtering, sorting, and pagination.
 *
 * Requirements: 4.1–4.11
 *
 * @param {object} params
 * @param {string} [params.q] - full-text search
 * @param {string} [params.subject] - subject slug
 * @param {string} [params.level] - student level
 * @param {string} [params.mode] - teaching mode
 * @param {string} [params.location] - location contains
 * @param {number} [params.minRate] - minimum hourly rate
 * @param {number} [params.maxRate] - maximum hourly rate
 * @param {string} [params.sort] - sort order
 * @param {number} [params.page] - page number (1-based)
 * @param {number} [params.limit] - page size
 */
export async function listTutors({
  q,
  subject,
  level,
  mode,
  location,
  minRate,
  maxRate,
  sort = 'recommended',
  page = 1,
  limit = 12,
} = {}) {
  // Base where clause — APPROVED only, always
  const where = {
    profileStatus: 'APPROVED',
  }

  // Subject slug filter
  if (subject) {
    where.subjects = {
      some: {
        subject: { slug: subject },
      },
    }
  }

  // Student level filter
  if (level) {
    where.studentLevels = { has: level }
  }

  // Teaching mode filter
  if (mode) {
    where.teachingMode = mode
  }

  // Location filter — case-insensitive contains
  if (location) {
    where.location = { contains: location, mode: 'insensitive' }
  }

  // Rate range filter
  if (minRate !== undefined || maxRate !== undefined) {
    where.hourlyRate = {}
    if (minRate !== undefined) where.hourlyRate.gte = minRate
    if (maxRate !== undefined) where.hourlyRate.lte = maxRate
  }

  // Full-text search: displayName, headline, or subject names
  if (q) {
    const searchConditions = [
      { displayName: { contains: q, mode: 'insensitive' } },
      { headline: { contains: q, mode: 'insensitive' } },
      {
        subjects: {
          some: {
            subject: { name: { contains: q, mode: 'insensitive' } },
          },
        },
      },
    ]
    // Merge with existing where — AND with other filters, OR within search
    where.AND = [{ OR: searchConditions }]
  }

  // Build orderBy
  let orderBy
  if (sort === 'price_asc') {
    // nulls last via Prisma nulls option
    orderBy = [{ hourlyRate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }]
  } else if (sort === 'price_desc') {
    orderBy = [{ hourlyRate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }]
  } else if (sort === 'newest') {
    orderBy = [{ createdAt: 'desc' }]
  } else {
    // 'recommended' — deterministic: most recently updated first as a
    // reasonable proxy when no search term is provided. With a search term the
    // service layer cannot do weighted scoring without a raw query, so we fall
    // back to newest updated.
    orderBy = [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
  }

  const skip = (page - 1) * limit

  // Run count and findMany in parallel
  const [total, items] = await Promise.all([
    prisma.tutorProfile.count({ where }),
    prisma.tutorProfile.findMany({
      where,
      select: TUTOR_CARD_SELECT,
      orderBy,
      skip,
      take: limit,
    }),
  ])

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit)

  return {
    items: items.map(toTutorCardDTO),
    pagination: { page, limit, total, totalPages },
  }
}

/**
 * Map a raw Prisma TutorProfile row into a TutorDetailDTO.
 * Full bio is included (not truncated).
 */
function toTutorDetailDTO(profile) {
  return {
    id: profile.id,
    displayName: profile.displayName,
    headline: profile.headline,
    bio: profile.bio ?? null,
    profilePhotoUrl: profile.profilePhotoUrl ?? null,
    teachingMode: profile.teachingMode,
    location: profile.location ?? null,
    hourlyRate: profile.hourlyRate !== null && profile.hourlyRate !== undefined
      ? parseFloat(profile.hourlyRate.toString())
      : null,
    studentLevels: profile.studentLevels,
    languages: profile.languages,
    availability: profile.availability ?? null,
    experience: profile.experience ?? null,
    education: profile.education ?? null,
    createdAt: profile.createdAt,
    subjects: profile.subjects.map((ps) => ps.subject),
  }
}

/**
 * Fetch a single approved tutor profile by ID.
 *
 * Returns null for non-existent or non-APPROVED profiles.
 * Requirements: 5.1, 5.2, 5.3, 5.4
 *
 * @param {string} id - TutorProfile UUID
 * @returns {Promise<object|null>} TutorDetailDTO or null
 */
export async function getTutorById(id) {
  const profile = await prisma.tutorProfile.findFirst({
    where: { id, profileStatus: 'APPROVED' },
    select: TUTOR_DETAIL_SELECT,
  })

  if (!profile) return null
  return toTutorDetailDTO(profile)
}
