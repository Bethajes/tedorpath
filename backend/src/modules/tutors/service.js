import { Prisma } from '@prisma/client'

import { prisma } from '../../lib/prisma.js'

/**
 * Markets: the currencies a tutor can sell into.
 *
 * Ethiopia is Tedor's primary local market; the international market is what
 * everyone else buys in. Both live in the `markets` table, so adding a third is a
 * row rather than a schema change — and nothing here converts between them. A
 * tutor states their own price per market, and the only question this module ever
 * answers is *which of those prices to show*.
 *
 * The list is read from the database rather than kept as a constant here and a
 * duplicate in the frontend, because a third market that only half the system
 * knows about is worse than no third market at all.
 *
 * Ethiopia is the default market: somebody who has told us nothing is served birr,
 * because this is an Ethiopian marketplace. That is only the last resort — a
 * country the learner has given us outranks it, and `resolveMarket` owns that order.
 *
 * Falls back to the shipped two when the table cannot be read, so a broken registry
 * degrades to today's behaviour instead of taking the directory down.
 */
const FALLBACK_MARKETS = [
  {
    code: 'ETB',
    name: 'Ethiopia',
    currencyName: 'Ethiopian Birr',
    symbol: 'Br',
    decimals: 2,
    priceFormat: 'code',
    isDefault: true,
    sortOrder: 0,
  },
  {
    code: 'USD',
    name: 'International',
    currencyName: 'US Dollar',
    symbol: '$',
    decimals: 2,
    priceFormat: 'symbol',
    isDefault: false,
    sortOrder: 1,
  },
]

const RATE_SELECT = { select: { marketCode: true, amount: true } }

const MARKET_SELECT = {
  code: true,
  name: true,
  currencyName: true,
  symbol: true,
  decimals: true,
  priceFormat: true,
  isDefault: true,
}

/**
 * Every active market, in the order they should be offered.
 *
 * The default is whatever the table marks as such, falling back to the last entry
 * when the flag is missing or ambiguous — a directory with no prices on it is a
 * worse outcome than one that guessed.
 */
export async function listMarkets() {
  try {
    const rows = await prisma.market.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      select: MARKET_SELECT,
    })

    if (rows.length > 0) return rows
  } catch (error) {
    console.error('[tutors] failed to read markets, using the built-in list:', error)
  }

  return FALLBACK_MARKETS
}

/** The market served to a visitor who has told us nothing. */
export async function defaultMarket() {
  const markets = await listMarkets()
  return markets.find((market) => market.isDefault) ?? markets.at(-1) ?? FALLBACK_MARKETS[0]
}

/**
 * Whether a code names a market the platform offers.
 *
 * Returns false rather than throwing so a caller can decide between ignoring it
 * (a profile link carrying a stale `?market=`) and rejecting it (the directory's
 * 400, where an unrecognised value is a mistake worth naming).
 */
export async function isKnownMarket(code) {
  if (!code) return false
  const wanted = code.toUpperCase()
  const markets = await listMarkets()
  return markets.some((market) => market.code === wanted)
}

/**
 * The market a learner's country buys in, or null when it implies none.
 *
 * Ethiopia is the only market named after one country, so it is the only one this
 * function can answer from a country code. Everything else buys in the default
 * market — a statement about how the platform is configured, not a claim that
 * everyone outside Ethiopia pays in the same money.
 */
export async function marketForCountry(countryCode) {
  if (!countryCode) return null
  if (countryCode.toUpperCase() === 'ET') return 'ETB'
  return (await defaultMarket()).code
}

/**
 * The market to show one request's prices in.
 *
 * Nobody chooses this. The learner sees one price, in a currency the platform has
 * worked out belongs to them, and there is no control anywhere in the interface
 * that changes it. So this function is the whole of the market logic, and the order
 * below is the whole of the design.
 *
 *   1. **`requested`** — an explicit `?market=` in the URL, if it names a market we
 *      offer. Not something the interface produces any more. It is here so a link
 *      somebody shared before this change keeps showing what it showed when it was
 *      sent, which is the only reason it still exists.
 *   2. **`savedCountry`** — the country on the person's account. An answer they
 *      gave and kept, so it outranks anything inferred.
 *   3. **`rememberedCountry`** — the country they picked in the request wizard,
 *      held in a cookie. Above the network on purpose: somebody who chose Ethiopia
 *      while on a VPN, or who has since flown, is still shopping for Ethiopia.
 *      This is the only way an anonymous learner can have their choice respected at
 *      all, since there is no account to save it to.
 *   4. **`requestCountry`** — the country header the hosting platform sets. The
 *      reason a brand-new visitor sees the right prices on their first page view
 *      without being asked anything, which is what "invisible" has to mean.
 *   5. **The default** — whatever `markets.is_default` says. Only reached when
 *      nothing at all is known: a bare API client, or a proxy that sets no header.
 *
 * Every candidate is checked against the `markets` table, so a country whose market
 * has been withdrawn falls through to the next source rather than producing a page
 * where every price is missing.
 *
 * @param {object} [context]
 * @param {string|null} [context.savedCountry] - `users.countryCode`, if known.
 * @param {string|null} [context.rememberedCountry] - the country cookie, if set.
 * @param {string|null} [context.requestCountry] - from the platform's headers.
 * @param {string|null} [context.requested] - an explicit `?market=` value.
 * @returns {Promise<{market: string, source: 'requested'|'saved'|'remembered'|'request'|'default'}>}
 */
export async function resolveMarket({
  savedCountry,
  rememberedCountry,
  requestCountry,
  requested,
} = {}) {
  if (requested && (await isKnownMarket(requested))) {
    return { market: requested.toUpperCase(), source: 'requested' }
  }

  if (savedCountry) {
    return { market: await marketForCountry(savedCountry), source: 'saved' }
  }

  if (rememberedCountry) {
    return { market: await marketForCountry(rememberedCountry), source: 'remembered' }
  }

  if (requestCountry) {
    return { market: await marketForCountry(requestCountry), source: 'request' }
  }

  return { market: (await defaultMarket()).code, source: 'default' }
}

/**
 * A rate as the number the browser works with.
 *
 * Prisma returns a Decimal, which serialises as a string — so an unconverted
 * value reaches the client as `"900.00"` where a number is expected. Null passes
 * through: "this tutor does not price in this market" is a real answer, and
 * turning it into 0 would advertise free lessons.
 */
export function toRate(value) {
  if (value === null || value === undefined) return null
  return parseFloat(value.toString())
}

/**
 * The rate for one market from a profile's rate rows.
 *
 * ONE price, always labelled. The response deliberately carries no other market:
 * a client holding both is one layout change away from showing a learner two
 * prices for the same hour of teaching, which is the mistake this design exists to
 * prevent.
 */
function rateForMarket(rates, market) {
  const row = rates.find((rate) => rate.marketCode === market)
  return row ? toRate(row.amount) : null
}
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
  rates: RATE_SELECT,
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
  rates: RATE_SELECT,
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
function toTutorCardDTO(profile, market) {
  return {
    id: profile.id,
    displayName: profile.displayName,
    headline: profile.headline,
    bio: profile.bio ? profile.bio.substring(0, 200) : null,
    profilePhotoUrl: profile.profilePhotoUrl ?? null,
    teachingMode: profile.teachingMode,
    location: profile.location ?? null,
    // The rate for the market this listing was requested in, plus the market
    // itself. The pair travels together so the client shows the price it was
    // given rather than assuming the number it received is the one it asked for.
    // The rate for the market this listing was requested in, and the market it is
    // in. One price, never two: the pair travels together so the client cannot
    // render a number it has not been told the unit of, and nothing else is sent
    // so there is no second price available to display by mistake.
    hourlyRate: rateForMarket(profile.rates, market),
    hourlyRateCurrency: market,
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
 * Profile ids ordered by their price in one market.
 *
 * WHY NOT AN `orderBy`
 *
 * The price lives in a `tutor_profile_rates` row and Prisma cannot sort by a
 * relation — only by columns on the model, or by aggregates on to-one relations.
 * A rate-per-column schema would sort natively, and would also mean a migration
 * every time a market is added, which is the thing being designed out.
 *
 * So the ordering is taken straight from the database and every filter stays in
 * Prisma: `listTutors` builds its `where` exactly as it always has, and the
 * ranked ids go in as one more condition. Only the ordering is hand-written, and
 * it is the part with no subtlety to get wrong.
 *
 * Tutors with no rate in this market are simply absent from the ranking, so
 * "cheapest first" can never present an unpriced tutor as the cheapest thing on
 * the page.
 *
 * @param {string} market
 * @param {boolean} ascending
 * @returns {Promise<string[]>}
 */
async function rankedProfileIds(market, ascending) {
  // The direction is built from a boolean, never from request input, so it cannot
  // reach the query as anything but ASC or DESC.
  const direction = ascending ? Prisma.sql`ASC` : Prisma.sql`DESC`

  const rows = await prisma.$queryRaw(
    Prisma.sql`
      SELECT "tutorProfileId"
      FROM "tutor_profile_rates"
      WHERE "marketCode" = ${market}
      ORDER BY "amount" ${direction}, "tutorProfileId" ASC
    `,
  )

  return rows.map((row) => row.tutorProfileId)
}

/**
 * Puts a page of cards back into price order.
 *
 * Prisma orders by a fixed column rather than by the order of an array, so the
 * ranked ids cannot be re-imposed as an `ORDER BY`. Ordering the page's own rows
 * in memory gives exactly the ranked order, because the page was already
 * restricted to ids that came out of that ranking.
 *
 * @param {Array<object>} items
 * @param {{market: string, ascending: boolean} | null} priceOrder
 */
function orderByPrice(items, priceOrder) {
  if (!priceOrder) return items

  const sorted = [...items].sort((a, b) => {
    const left = a.hourlyRate
    const right = b.hourlyRate

    // Only reached if a row lost its rate between the query and the mapping, which
    // nothing does today; sorted last rather than compared as null.
    if (left === null || right === null) {
      if (left === right) return 0
      return left === null ? 1 : -1
    }

    return priceOrder.ascending ? left - right : right - left
  })

  return sorted
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
  market,
  sort = 'recommended',
  page = 1,
  limit = 12,
} = {}) {
  /*
   * Resolved once, here, so the filter, the sort and the response mapping cannot
   * disagree about which market is in play — and so an unrecognised `?market=`
   * is settled once rather than three times.
   */
  const activeMarket = (await isKnownMarket(market))
    ? market.toUpperCase()
    : (await defaultMarket()).code
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

  /*
   * Rate range filter, applied to the row for the visitor's own market.
   *
   * This is why the filter takes a market at all. `minRate=10` is a different
   * question for someone in Addis than for someone in London: birr against
   * thousands of birr, dollars against tens of dollars. Filtering one market's
   * price while showing another's would quietly return the wrong tutors, so the
   * filter and the displayed price are held to the same one.
   */
  if (minRate !== undefined || maxRate !== undefined) {
    const range = {}
    if (minRate !== undefined) range.gte = minRate
    if (maxRate !== undefined) range.lte = maxRate

    where.rates = { some: { marketCode: activeMarket, amount: range } }
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
  /** Set only for a price sort; see the comment at the mapping below. */
  let priceOrder = null
  if (sort === 'price_asc' || sort === 'price_desc') {
    // See `rankedProfileIds` for why the ordering is not an `orderBy`.
    const ranked = await rankedProfileIds(activeMarket, sort === 'price_asc')

    if (ranked.length === 0) {
      // A market nobody prices in has nothing to rank. Falling back to the default
      // ordering shows tutors rather than an empty directory.
      orderBy = [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    } else {
      and.push({ id: { in: ranked } })
      orderBy = [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    }

    // Sorted in memory below, once the page's rows are known — see the comment on
    // the `items` mapping.
    priceOrder = { market: activeMarket, ascending: sort === 'price_asc' }
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
    items: orderByPrice(
      items.map((profile) => toTutorCardDTO(profile, activeMarket)),
      priceOrder,
    ),
    pagination: { page, limit, total, totalPages },
  }
}

/**
 * Map a raw Prisma TutorProfile row into a TutorDetailDTO.
 * Full bio is included (not truncated).
 */
function toTutorDetailDTO(profile, market) {
  return {
    id: profile.id,
    displayName: profile.displayName,
    headline: profile.headline,
    bio: profile.bio ?? null,
    profilePhotoUrl: profile.profilePhotoUrl ?? null,
    teachingMode: profile.teachingMode,
    location: profile.location ?? null,
    // The rate for the market this listing was requested in, plus the market
    // itself. The pair travels together so the client shows the price it was
    // given rather than assuming the number it received is the one it asked for.
    // The rate for the market this listing was requested in, and the market it is
    // in. One price, never two: the pair travels together so the client cannot
    // render a number it has not been told the unit of, and nothing else is sent
    // so there is no second price available to display by mistake.
    hourlyRate: rateForMarket(profile.rates, market),
    hourlyRateCurrency: market,
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
export async function getTutorById(id, market) {
  const profile = await prisma.tutorProfile.findFirst({
    where: { id, profileStatus: 'APPROVED' },
    select: TUTOR_DETAIL_SELECT,
  })

  if (!profile) return null
  return toTutorDetailDTO(
    profile,
    (await isKnownMarket(market)) ? market.toUpperCase() : (await defaultMarket()).code,
  )
}
