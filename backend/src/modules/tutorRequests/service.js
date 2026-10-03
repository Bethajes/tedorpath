import { prisma } from '../../lib/prisma.js'
import { defaultMarket, marketForCountry } from '../tutors/service.js'

/**
 * Database access for tutor requests.
 *
 * Maps the API field names onto the stored columns. The service returns only
 * the new id — the full record (which contains personal contact details) is
 * never echoed back to the client.
 *
 * `options.userId` links the request to a signed-in account when the visitor
 * has one. It is optional on purpose: anonymous requests are the norm today.
 *
 * `data.tutorProfileId` is the optional link to a specific tutor the client
 * chose from the directory. It is verified rather than trusted, but only for
 * existence: the client's choice is honoured whatever the profile's status is,
 * because deciding what is contactable is moderation's job, not the form's.
 *
 * THE TWO REQUEST SHAPES
 *
 * The original form sent `subject` and `educationLevel` as text from a fixed
 * list. The wizard sends identifiers (`subjectIds`, `educationLevelCode`) drawn
 * from the database-driven catalogue. Both are supported here, and both end up
 * in the same two text columns, because those columns are what the admin list
 * and the existing request detail screen read. Resolving identifiers to names in
 * one place is what stops the two paths from drifting into meaning different
 * things under the same column.
 *
 * NOTHING IS CONVERTED
 *
 * The budget is stored as an amount plus a currency code, and the timezone is
 * stored as the zone the client chose. Neither is translated into anything else:
 * no exchange rate is stored, applied or inferred, and a time the client wrote
 * down stays the time they wrote down. Where a country implies a different
 * currency the client is told, and the choice is theirs to make.
 */

/** Thrown for a tutorProfileId that is well-formed but points at nothing. */
export const TUTOR_PROFILE_NOT_FOUND = 'TUTOR_PROFILE_NOT_FOUND'

/** Thrown when an identifier from the wizard does not name an active row. */
export const REFERENCE_NOT_FOUND = 'REFERENCE_NOT_FOUND'

/**
 * A validation failure raised from the service layer because checking it needs
 * the database: the shape was legal, the reference was not.
 *
 * Reported to the client as a normal field-level validation error, because from
 * the visitor's point of view "that option no longer exists" is a form problem
 * to correct, not a server failure.
 *
 * @param {string} field
 * @param {string} message
 */
function referenceError(field, message) {
  const error = new Error(message)
  error.code = REFERENCE_NOT_FOUND
  error.field = field
  return error
}

/**
 * Resolve the wizard's subject ids to their names, in the order given.
 *
 * Returns null when nothing was asked for, so the caller can fall back to the
 * free-text `subject` the original form sends.
 *
 * @param {string[] | undefined} subjectIds
 * @returns {Promise<{ ids: string[], summary: string } | null>}
 */
async function resolveSubjects(subjectIds) {
  const ids = [...new Set(subjectIds ?? [])]
  if (ids.length === 0) return null

  // Selecting the rows we are about to link is what makes this check free: no
  // second query is needed to learn which ids were real.
  const subjects = await prisma.subject.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  })

  if (subjects.length !== ids.length) {
    throw referenceError(
      'subjectIds',
      'One or more of the selected subjects no longer exists. Please choose again.',
    )
  }

  const byId = new Map(subjects.map((subject) => [subject.id, subject.name]))
  const names = ids.map((id) => byId.get(id))
  return { ids, summary: names.join(', ') }
}

/**
 * Resolve the education level from a code to the display name stored alongside it.
 *
 * The name comes from the database rather than from the client so that a renamed
 * level is reported to the team under its current wording.
 *
 * @param {string | undefined} code
 * @returns {Promise<string | null>}
 */
async function resolveEducationLevelName(code) {
  if (!code) return null

  const level = await prisma.educationLevel.findUnique({
    where: { code },
    select: { name: true },
  })

  if (!level) {
    throw referenceError(
      'educationLevelCode',
      'The selected education level no longer exists. Please choose again.',
    )
  }

  return level.name
}

/**
 * Check the configurable references the wizard sends.
 *
 * Only the ones that have a human-facing consequence are checked: an unknown
 * country or goal is worth telling the visitor about, because the currency and
 * the education levels they were shown were derived from it.
 *
 * @param {{ countryCode?: string, learningGoal?: string }} data
 */
async function assertReferencesExist(data) {
  if (data.countryCode) {
    const country = await prisma.country.findUnique({
      where: { code: data.countryCode },
      select: { code: true },
    })
    if (!country) {
      throw referenceError('countryCode', 'The selected country is not available. Please choose again.')
    }
  }

  if (data.learningGoal) {
    const goal = await prisma.learningGoal.findUnique({
      where: { code: data.learningGoal },
      select: { code: true },
    })
    if (!goal) {
      throw referenceError('learningGoal', 'The selected learning goal is not available. Please choose again.')
    }
  }
}

/**
 * The single readable budget string the admin screens have always shown.
 *
 * A request that sent free-text budget keeps it verbatim, because it is the
 * client's own words and rewriting it would lose detail ("negotiable for a
 * package of ten hours"). A request that sent an amount and a currency gets the
 * two composed together — and only that: an amount is never rendered on its own,
 * and a currency code is never replaced with a symbol here, because the code is
 * the unambiguous one.
 *
 * @param {{ budget?: string | null, budgetAmount?: number, budgetCurrency?: string }} data
 * @returns {string | null}
 */
function formatBudget({ budget, budgetAmount, budgetCurrency }) {
  if (budget) return budget
  if (budgetAmount !== undefined && budgetCurrency) return `${budgetAmount} ${budgetCurrency}`
  return null
}

/**
 * Days the client can meet, as the readable sentence the admin detail screen shows.
 *
 * @param {string[] | undefined} days
 * @returns {string | null}
 */
function formatDays(days) {
  const unique = [...new Set(days ?? [])].filter(Boolean)
  if (unique.length === 0) return null
  if (unique.length === 1) return unique[0]
  return `${unique.slice(0, -1).join(', ')} and ${unique.at(-1)}`
}

/**
 * Availability windows, as the readable sentence the admin detail screen shows.
 *
 * @param {string[] | undefined} ranges
 * @returns {string | null}
 */
function formatTimeRanges(ranges) {
  const unique = [...new Set(ranges ?? [])].filter(Boolean)
  if (unique.length === 0) return null
  if (unique.length === 1) return unique[0]
  return `${unique.slice(0, -1).join(', ')} and ${unique.at(-1)}`
}

export async function createTutorRequest(data, { userId = null } = {}) {
  const tutorProfileId = data.tutorProfileId ?? null

  if (tutorProfileId) {
    // Existence only — no status filter, by design. Selecting just the id also
    // keeps this from pulling the tutor's contact details into a hot path.
    const profile = await prisma.tutorProfile.findUnique({
      where: { id: tutorProfileId },
      select: { id: true },
    })

    if (!profile) {
      const error = new Error('Referenced tutor profile does not exist.')
      error.code = TUTOR_PROFILE_NOT_FOUND
      throw error
    }
  }

  // Looked up before the insert so a stale option cannot leave a half-written
  // request behind.

  /*
   * Which of a tutor's two prices this request is about.
   *
   * Ethiopia buys in birr, everything else in dollars — the same mapping the
   * directory uses, so a parent who requests a tutor from Kenya was quoted the
   * international rate on the listing they came from and the request row says so.
   * A request with no country falls back to the platform default, which is birr.
   *
   * Resolved here rather than in the insert so it is plainly a separate question
   * from "write this request", and so the same value can be reported back to the
   * requester in the summary without recomputing it.
   */
  const market = (await marketForCountry(data.countryCode)) ?? (await defaultMarket()).code

  const [subjects, educationLevelName] = await Promise.all([

    resolveSubjects(data.subjectIds),
    resolveEducationLevelName(data.educationLevelCode),
    assertReferencesExist(data),
  ])

  const subjectSummary = subjects?.summary ?? data.subject ?? null

  const record = await prisma.tutorRequest.create({
    data: {
      userId,
      tutorProfileId,
      fullName: data.fullName,
      phone: data.phone,
      telegramUsername: data.telegram ?? null,
      email: data.email ?? null,
      // The two text columns stay the single readable summary the admin list
      // shows, whichever shape the request arrived in.
      subject: subjectSummary,
      educationLevel: educationLevelName ?? data.educationLevel,
      description: data.helpDescription,
      learningMode: data.learningMode,
      location: data.preferredLocation ?? null,
      // Composed from the wizard's sets when it sent them, taken verbatim from a
      // request that wrote its own sentence.
      preferredDays: formatDays(data.preferredDayNames) ?? data.preferredDays ?? null,
      preferredTime: formatTimeRanges(data.preferredTimeRanges) ?? data.preferredTime ?? null,
      budget: formatBudget(data),
      additionalInfo: data.additionalInfo ?? null,

      // Wizard-only columns. All nullable, so a request from the original form
      // stores null here rather than failing.
      countryCode: data.countryCode ?? null,
      // Which of a tutor's two prices this request is about. Resolved from the
      // country above — Ethiopia buys in birr, everywhere else in dollars — and
      // stored rather than left to be derived later, because "which market was this
      // request made in" is a fact about the request and has to keep its answer
      // even if the default market changes.
      market,
      timezone: data.timezone ?? null,
      educationLevelCode: data.educationLevelCode ?? null,
      subjectOther: data.subjectOther ?? null,
      learningGoal: data.learningGoal ?? null,
      learningGoalOther: data.learningGoalOther ?? null,
      preferredDayNames: data.preferredDayNames ?? [],
      preferredTimeRanges: data.preferredTimeRanges ?? [],
      budgetAmount: data.budgetAmount ?? null,
      budgetCurrency: data.budgetCurrency ?? null,

      ...(subjects
        ? {
            // Nested create rather than a follow-up write, so the request and
            // its subjects are one atomic insert: there is no window in which a
            // request exists with no subject rows.
            subjects: {
              create: subjects.ids.map((subjectId) => ({ subjectId })),
            },
          }
        : {}),

      // status defaults to NEW in the schema; adminNotes stays null.
    },
    select: { id: true },
  })

  /*
   * Remember the country on the account, so this learner's tutor prices stop
   * depending on where their network says they are.
   *
   * This is where a market actually becomes established for someone: the request
   * flow is the first point at which a learner is asked where they are, so it is
   * the one place an answer is worth keeping. Without it, `users.countryCode` is a
   * column nothing writes and the saved-country branch of market resolution is
   * unreachable.
   *
   * Two rules keep this from being a surprise:
   *
   *   - Only when the account has none. A country someone set deliberately at sign
   *     up is not overwritten by a default the wizard happened to preselect.
   *   - Never fatal. If the write fails the request still exists and still reaches
   *     a human, which matters far more than remembering a country.
   */
  if (userId && data.countryCode && !(await hasSavedCountry(userId))) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { countryCode: data.countryCode.toUpperCase() },
      })
    } catch (error) {
      console.error('[tutorRequests] failed to save the country on the account:', error)
    }
  }

  return record
}

/**
 * Whether an account already has a country of its own.
 *
 * A separate read rather than a conditional update so the "do not overwrite"
 * decision is made against the value we read, instead of a compare-and-set in SQL
 * that nobody would read.
 */
async function hasSavedCountry(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { countryCode: true },
  })

  return Boolean(user?.countryCode)
}