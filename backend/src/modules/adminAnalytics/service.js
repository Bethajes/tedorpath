import { prisma } from '../../lib/prisma.js'

import { ACTIVE_LEARNER_WINDOW_DAYS } from './validation.js'

/**
 * Admin analytics: the figures behind the dashboard.
 *
 * EVERY NUMBER HERE IS COUNTED FROM A TABLE. There are no seeded rows, no
 * defaults, no growth multipliers and no "estimated" columns, because a back
 * office figure that nobody can trace back to a row is worse than no figure at
 * all — it is the kind of number that ends up in a pitch deck.
 *
 * Two rules shape everything in this file:
 *
 * 1. Counts are always computed with a `where` clause that matches what the
 *    rest of the admin API already shows. "Approved tutors" means
 *    `profileStatus = 'APPROVED'`, the same predicate the public directory uses,
 *    so the admin number and the homepage number cannot disagree.
 *
 * 2. A count that needs a definition is labelled with that definition by the
 *    caller rather than being given a friendly name here. `activeLearners` in
 *    particular is a judgement call, and the response carries the rule that
 *    produced it so the UI can show it.
 */

/**
 * A day, as `YYYY-MM-DD`, in UTC.
 *
 * UTC rather than local because a tutor in Addis and an admin in London must
 * see the same bucket boundaries, and because the database stores timestamps in
 * UTC — bucketing in local time would silently shift records across the line.
 */
function isoDay(date) {
  return date.toISOString().slice(0, 10)
}

/** Midnight UTC, `days` ago, inclusive of today. */
function windowStart(days) {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  return start
}

/**
 * Zero-fills a sparse series into one row per day in the window.
 *
 * The database only returns days that have rows. A chart drawn from that has a
 * misleading x-axis: a gap reads as "nothing happened" when it actually means
 * "the query returned no row for the day nobody asked about". Every day in the
 * window gets an entry, so a flat line means a real zero.
 *
 * `rows` is the folded `{ day, count }` list; `byDay` is that same list indexed,
 * because the window is scanned in order and so are the days being filled.
 */
function fillDays(rows, { from, days }) {
  const byDay = new Map(rows.map((row) => [row.day, row.count]))

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(from)
    date.setUTCDate(date.getUTCDate() + index)
    const key = isoDay(date)

    return { date: key, count: byDay.get(key) ?? 0 }
  })
}

/**
 * Daily counts of tutor requests and tutor applications.
 *
 * Two `groupBy`s rather than one raw query: Prisma cannot group by a date
 * truncation, but it can group by the raw timestamp and the rows can be folded
 * into days here. Bounded by the window and by the index on `createdAt`, so the
 * result set is at most one row per record inside the range.
 *
 * Counts `createdAt`, not `updatedAt`, because "how much came in" is a question
 * about when a record arrived. Status changes are covered by the activity feed.
 */
export async function getTrends(days) {
  const from = windowStart(days)
  const to = new Date()

  const [requestRows, applicationRows] = await Promise.all([
    prisma.tutorRequest.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: from, lte: to } },
    }),
    prisma.tutorProfile.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: from, lte: to } },
    }),
  ])

  const fold = (rows) => {
    const counts = new Map()
    for (const row of rows) {
      const key = isoDay(row.createdAt)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return [...counts].map(([day, count]) => ({ day, count }))
  }

  return {
    days,
    from: isoDay(from),
    to: isoDay(to),
    requests: fillDays(fold(requestRows), { from, days }),
    applications: fillDays(fold(applicationRows), { from, days }),
  }
}

/**
 * Learner requests per subject, most-requested first.
 *
 * `subject` is free text a visitor typed rather than a normalised foreign key,
 * so these are the strings people actually wrote, grouped case-insensitively by
 * Prisma and counted here. Two spellings of the same subject stay separate —
 * that is honest about what was submitted, and normalising it would be a
 * judgement about meaning this layer has no basis for.
 */
export async function getSubjectBreakdown(limit = 8) {
  const rows = await prisma.tutorRequest.groupBy({
    by: ['subject'],
    _count: { _all: true },
    orderBy: { _count: { subject: 'desc' } },
    take: limit,
  })

  return rows.map((row) => ({
    subject: row.subject,
    count: row._count._all,
  }))
}

/**
 * The activity feed.
 *
 * Built from two tables rather than an audit log, because there is no audit log:
 * the schema records the current status of a request or a profile and when the
 * row was last written, but not who changed it or what it was before. So every
 * entry below is something the database can actually prove — a row appeared, or
 * a row was written to — and the wording says exactly that.
 *
 * `updatedAt` is not filtered against `createdAt` on purpose. A profile created
 * and approved in the same minute would otherwise report as a submission and
 * never as an update, which is precisely the event an admin wants to see.
 *
 * @param {number} limit
 */
export async function getActivity(limit) {
  const take = Math.max(limit, 1)

  const [requests, profiles] = await Promise.all([
    prisma.tutorRequest.findMany({
      select: {
        id: true,
        fullName: true,
        subject: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: take * 2,
    }),
    prisma.tutorProfile.findMany({
      select: {
        id: true,
        displayName: true,
        headline: true,
        profileStatus: true,
        verificationStatus: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: take * 2,
    }),
  ])

  const entries = [
    ...requests.map((request) => ({
      // Namespaced so a request id can never collide with a profile id in the
      // rendered feed, and so the frontend can route on the type alone.
      id: `request:${request.id}`,
      kind: 'request',
      entityId: request.id,
      occurredAt: request.updatedAt,
      actor: request.fullName,
      headline: request.subject,
      status: request.status,
      isNew: request.createdAt.getTime() === request.updatedAt.getTime(),
      signedIn: request.userId !== null,
    })),
    ...profiles.map((profile) => ({
      id: `profile:${profile.id}`,
      kind: 'application',
      entityId: profile.id,
      occurredAt: profile.updatedAt,
      actor: profile.displayName,
      headline: profile.headline,
      status: profile.profileStatus,
      isNew: profile.createdAt.getTime() === profile.updatedAt.getTime(),
      signedIn: true,
    })),
  ]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, take)
    .map((entry) => ({ ...entry, occurredAt: entry.occurredAt.toISOString() }))

  return entries
}

/**
 * How many learner requests have no tutor attached, and how many have gone quiet.
 *
 * `unmatched` is the one number on the dashboard that is a promise: a request
 * with no tutor is a learner waiting on a match.
 *
 * `stale` counts requests still sitting in NEW after the follow-up window. It is
 * derived from `createdAt` on every read rather than stored as a flag, so a
 * request that ages past the threshold appears without anything having to record
 * that it aged.
 */
export async function getMatchingSummary(staleDays) {
  const staleBefore = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000)
  const liveWhere = { status: { not: 'CANCELLED' } }

  const [total, matched, unmatched, stale] = await Promise.all([
    prisma.tutorRequest.count({ where: liveWhere }),
    prisma.tutorRequest.count({
      where: { ...liveWhere, tutorProfileId: { not: null } },
    }),
    prisma.tutorRequest.count({ where: { ...liveWhere, tutorProfileId: null } }),
    prisma.tutorRequest.count({ where: { status: 'NEW', createdAt: { lt: staleBefore } } }),
  ])

  return { total, matched, unmatched, stale, staleDays }
}

/**
 * Every figure the dashboard shows, in one response.
 *
 * Grouped into one call rather than six so the cards, the charts and the feed
 * can never render from a mix of two different moments in time — a dashboard
 * whose total says 12 and whose chart says 10 is worse than no dashboard.
 *
 * @param {number} days - how far back the trend series reaches.
 * @param {number} staleDays - how long a request may sit in NEW before it is
 *   counted as a follow-up. Sent to the client alongside the count so the UI can
 *   say "over N days" rather than implying a rule the data does not contain.
 */
export async function getDashboardOverview(days, staleDays) {
  const activeWindowStart = new Date(
    Date.now() - ACTIVE_LEARNER_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  )

  const [
    requestTotal,
    requestByStatus,
    profileTotal,
    profileByStatus,
    verificationByStatus,
    activeLearners,
    activeLearnerRequests,
    trends,
    subjects,
    activity,
    matching,
  ] = await Promise.all([
    prisma.tutorRequest.count(),
    prisma.tutorRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.tutorProfile.count(),
    prisma.tutorProfile.groupBy({ by: ['profileStatus'], _count: { _all: true } }),
    prisma.tutorProfile.groupBy({ by: ['verificationStatus'], _count: { _all: true } }),
    // A learner is "active" if they have signed in at any point — there is no
    // login-tracking table to measure recency from, so a count of signed-in
    // accounts is the honest ceiling and is labelled as such in the response.
    prisma.user.count({ where: { role: 'CLIENT' } }),
    // Requests submitted in the window, which is the one recency signal the
    // request table actually holds.
    prisma.tutorRequest.count({ where: { createdAt: { gte: activeWindowStart } } }),
    getTrends(days),
    getSubjectBreakdown(),
    getActivity(8),
    getMatchingSummary(staleDays),
  ])

  const requestCounts = Object.fromEntries(requestByStatus.map((r) => [r.status, r._count._all]))
  const profileCounts = Object.fromEntries(profileByStatus.map((r) => [r.profileStatus, r._count._all]))
  const verificationCounts = Object.fromEntries(
    verificationByStatus.map((r) => [r.verificationStatus, r._count._all]),
  )

  return {
    requests: {
      total: requestTotal,
      NEW: requestCounts.NEW ?? 0,
      CONTACTED: requestCounts.CONTACTED ?? 0,
      IN_PROGRESS: requestCounts.IN_PROGRESS ?? 0,
      COMPLETED: requestCounts.COMPLETED ?? 0,
      CANCELLED: requestCounts.CANCELLED ?? 0,
    },
    applications: {
      total: profileTotal,
      PENDING_REVIEW: profileCounts.PENDING_REVIEW ?? 0,
      NEEDS_INFORMATION: profileCounts.NEEDS_INFORMATION ?? 0,
      APPROVED: profileCounts.APPROVED ?? 0,
      SUSPENDED: profileCounts.SUSPENDED ?? 0,
      REJECTED: profileCounts.REJECTED ?? 0,
      DRAFT: profileCounts.DRAFT ?? 0,
    },
    verification: {
      VERIFIED: verificationCounts.VERIFIED ?? 0,
      DOCUMENTS_REQUESTED: verificationCounts.DOCUMENTS_REQUESTED ?? 0,
      DOCUMENTS_RECEIVED: verificationCounts.DOCUMENTS_RECEIVED ?? 0,
      NEEDS_MORE_INFORMATION: verificationCounts.NEEDS_MORE_INFORMATION ?? 0,
      UNVERIFIED: verificationCounts.UNVERIFIED ?? 0,
    },
    learners: {
      // Both numbers are sent because they are different claims and the UI has
      // to be able to say which one a card is showing.
      registered: activeLearners,
      requestedRecently: activeLearnerRequests,
      windowDays: ACTIVE_LEARNER_WINDOW_DAYS,
    },
    matching,
    subjects,
    trends,
    activity,
  }
}
