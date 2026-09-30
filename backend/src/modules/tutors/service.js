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
  // Sent on the card so a visitor filtering by language can see why a tutor
  // matched, without opening the profile. Requirement: 30.6
  languages: true,
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
    languages: profile.languages,
    createdAt: profile.createdAt,
    subjects: profile.subjects.map((ps) => ps.subject),
  }
}

/**
 * Ids of profiles that teach in a language matching `term`.
 *
 * Two things make this a raw query rather than a Prisma filter:
 *
 * 1. `languages` is a Postgres text array, and `contains` is not a valid filter
 *    on a scalar list. Only `has` is, and that is exact — so `has: 'english'`
 *    would never find a tutor who wrote "English".
 * 2. The array is tutor-authored free text, so an exact match is the wrong
 *    semantics anyway; a visitor typing "eng" or "English" expects the tutor
 *    who teaches in English.
 *
 * `unnest` + `ILIKE '%…%'` gives a case-insensitive substring match over each
 * element, which is the same semantics Prisma's `contains` gives the scalar
 * fields — so one search behaves consistently whether it is matching a headline
 * or a language.
 *
 * The term is a bound parameter, so it cannot break out of the SQL, but LIKE
 * metacharacters still have to be escaped: a visitor who types `%` would
 * otherwise wrap it into `%%%` and match every tutor who lists any language at
 * all. `#` is used as the escape character rather than a backslash so the
 * escaping has no interaction with JavaScript string escapes, and the
 * wildcards are added around the escaped value, never around raw input.
 *
 * A full scan, so it is only worth doing for a search box or an explicit
 * language filter. Once `languages` is indexed properly this becomes a plain
 * Prisma `has`.
 *
 * @param {string} term
 * @returns {Promise<string[]>}
 */
/**
 * Whether a filter was actually asked for.
 *
 * Kept separate from the sanitised term because the two answer different
 * questions. A term of only wildcards sanitises down to nothing, and treating
 * that as "no filter" would be the worst possible answer: the visitor typed
 * something, and the response would be the entire directory rather than the
 * empty set they asked for.
 *
 * @param {string | undefined} term
 */
function isFilterPresent(term) {
  return typeof term === 'string' && term.trim() !== ''
}

/**
 * Strips LIKE wildcards out of a search term.
 *
 * Prisma's `contains` compiles to `LIKE '%' || $1 || '%'` with no escape clause,
 * so a `%` or `_` in the term is interpreted as a wildcard rather than as the
 * character the visitor typed. Searching for "100%" would match every tutor, and
 * searching for "a_b" would match "axb" — a visitor asking a literal question and
 * silently being handed the whole directory.
 *
 * The characters are removed rather than escaped because there is no way to add
 * an `ESCAPE` clause through Prisma's `contains`. A search box is a literal
 * substring search, so this is the semantics it should have had. Requirement 4.3
 *
 * @param {string | undefined} term
 * @returns {string} possibly empty — callers must not treat empty as "no filter"
 */
function sanitizeSearchTerm(term) {
  return typeof term === 'string' ? term.replace(/[%_\\]/g, '').trim() : ''
}

/**
 * A condition that cannot match any row.
 *
 * Used when a filter was asked for but nothing is left to search with, so the
 * result is an empty page instead of the unfiltered list.
 */
const MATCHES_NOTHING = { id: { in: [] } }

async function findProfileIdsByLanguage(term) {
  const escaped = term.replace(/[#%_]/g, (char) => `#${char}`)
  const rows = await prisma.$queryRaw`
    SELECT "id" FROM "tutor_profiles"
    WHERE EXISTS (
      SELECT 1 FROM unnest("languages") AS lang WHERE lang ILIKE ${`%${escaped}%`} ESCAPE '#'
    )
  `
  return rows.map((row) => row.id)
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
 * @param {string} [params.language] - teaching language (case-insensitive)
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
  language,
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

  // Both of these reach a Prisma `contains`, which would treat a `%` or `_` in
  // the term as a wildcard, so they are stripped first.
  const searchTerm = sanitizeSearchTerm(q)
  const locationTerm = sanitizeSearchTerm(location)

  // Conditions that have to hold in addition to the plain field filters.
  // Collected here rather than written straight onto `where` so that more than
  // one of them can apply, and so an impossible condition is ANDed in as a
  // standalone clause instead of being assigned to a field that does not exist.
  const and = []

  // Location filter — case-insensitive contains
  if (isFilterPresent(location)) {
    if (locationTerm) {
      where.location = { contains: locationTerm, mode: 'insensitive' }
    } else {
      and.push(MATCHES_NOTHING)
    }
  }

  // Teaching language — case-insensitive match inside the array.
  if (language) {
    where.id = { in: await findProfileIdsByLanguage(language) }
  }

  // Rate range filter
  if (minRate !== undefined || maxRate !== undefined) {
    where.hourlyRate = {}
    if (minRate !== undefined) where.hourlyRate.gte = minRate
    if (maxRate !== undefined) where.hourlyRate.lte = maxRate
  }

  // Free-text search.
  //
  // Covers the five things a visitor might plausibly type: a name, a specialism
  // in the headline, a subject, a language, or a town. Language and location were
  // the two that used to be missing, which is why searching "english" returned
  // only tutors who happened to teach an English *subject* and "addis" returned
  // nobody at all — even when every tutor in the result set matched. The search
  // box is where people type; a visitor should not have to discover the sidebar
  // filter to find a tutor who speaks their language.
  //
  // Requirements: 4.3, 30.6
  if (isFilterPresent(q)) {
    if (!searchTerm) {
      // Nothing left after stripping wildcards: the visitor asked for something
      // that cannot match any tutor, so the honest answer is an empty page.
      and.push(MATCHES_NOTHING)
    } else {
      const searchConditions = [
        { displayName: { contains: searchTerm, mode: 'insensitive' } },
        { headline: { contains: searchTerm, mode: 'insensitive' } },
        { location: { contains: searchTerm, mode: 'insensitive' } },
        {
          subjects: {
            some: {
              subject: { name: { contains: searchTerm, mode: 'insensitive' } },
            },
          },
        },
      ]

      // A language lives inside an array, which Prisma cannot match with
      // `contains`, so the ids are resolved separately and OR'd in. Omitted
      // when empty: an `id in []` branch can never match and would only make the
      // generated SQL harder to read.
      const languageMatches = await findProfileIdsByLanguage(searchTerm)
      if (languageMatches.length > 0) {
        searchConditions.push({ id: { in: languageMatches } })
      }

      // OR within the search, AND with every other filter, so adding a subject
      // filter narrows a search rather than being ignored by it.
      and.push({ OR: searchConditions })
    }
  }

  if (and.length > 0) {
    where.AND = and
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

/**
 * Count distinct non-blank values in a `groupBy` result.
 *
 * `groupBy` already collapses the rows in the database, so this only has to
 * discard values that are present but empty: `education` and `location` are
 * both free text a tutor may have left as an empty string, and counting a
 * blank as a distinct university or country would put a number on the homepage
 * that no record actually supports.
 */
function countDistinctNonBlank(rows, field) {
  const values = new Set()

  for (const row of rows) {
    const value = row[field]
    if (typeof value === 'string' && value.trim() !== '') {
      values.add(value.trim())
    }
  }

  return values.size
}

/**
 * Aggregate counts for the public homepage.
 *
 * Every number here is a live count of real records — nothing is seeded or
 * hardcoded — so a brand new deployment honestly reports zeros and the
 * frontend renders non-numerical wording for them.
 *
 * Only APPROVED profiles contribute. A draft, rejected or suspended tutor is not
 * publicly visible, so counting one would overstate the marketplace.
 *
 * `universities` and `countries` are counted from tutor-authored free text
 * rather than a normalised table, so they are "how many distinct entries
 * approved tutors have written", not a verified institution or country list.
 * Requirements: 4.4
 *
 * @returns {Promise<{approvedTutors: number, subjects: number, universities: number, countries: number}>}
 */
export async function getPublicStats() {
  const approvedWhere = { profileStatus: 'APPROVED' }

  const [approvedTutors, subjects, educationGroups, locationGroups] = await Promise.all([
    prisma.tutorProfile.count({ where: approvedWhere }),
    // Deactivated subjects are hidden from every picker, so they must not be
    // counted as subjects a visitor can actually find a tutor for.
    prisma.subject.count({ where: { active: true } }),
    prisma.tutorProfile.groupBy({
      by: ['education'],
      where: { ...approvedWhere, education: { not: null } },
    }),
    prisma.tutorProfile.groupBy({
      by: ['location'],
      where: { ...approvedWhere, location: { not: null } },
    }),
  ])

  return {
    approvedTutors,
    subjects,
    universities: countDistinctNonBlank(educationGroups, 'education'),
    countries: countDistinctNonBlank(locationGroups, 'location'),
  }
}
