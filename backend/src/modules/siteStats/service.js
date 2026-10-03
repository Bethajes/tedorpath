import { prisma } from '../../lib/prisma.js'

import { STAT_KEYS } from './validation.js'

/**
 * The homepage statistics: how they are counted, and how an admin may adjust
 * them.
 *
 * TWO NUMBERS, NOT ONE. Every figure the homepage shows is a live count of real
 * records, and an admin may replace any of them with an override stored in
 * `platform_stats`. This module owns both halves so the public endpoint cannot
 * report a live count without also applying an override — the distinction only
 * means something if the two are resolved in one place.
 *
 * Why overrides exist at all: the live count is honest but it only tells part
 * of the story. "6 subjects" is true of the marketplace today; it is not the
 * answer to "what does Tedor Tutors teach?", and a founder who has agreed to
 * cover a syllabus with three more tutors cannot publish that promise until the
 * record exists. The override is how the published figure and the current
 * record are both allowed to be true.
 *
 * What this is NOT: a place to invent a number with no basis. An override is
 * always applied ON TOP of a live count, is stored with a timestamp, and the
 * admin UI shows both numbers side by side — so the difference between "the
 * database says 6" and "the homepage says 24" is visible rather than hidden.
 */

/** The single row's primary key. Fixed, so "one row" is enforced by a CHECK. */
const SINGLETON_ID = 'singleton'

/** Columns read from and written to the singleton row. Mirrors STAT_KEYS. */
const OVERRIDE_COLUMNS = Object.fromEntries(STAT_KEYS.map((key) => [key, true]))

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
 * The live counts, straight from the database. Nothing here reads an override,
 * so this function is the single source of truth for what the records actually
 * say — the admin UI shows it next to the published figure for exactly that
 * reason.
 *
 * Only APPROVED profiles contribute. A draft, rejected or suspended tutor is
 * not publicly visible, so counting one would overstate the marketplace.
 *
 * `universities` and `countries` are counted from tutor-authored free text
 * rather than a normalised table, so they are "how many distinct entries
 * approved tutors have written", not a verified institution or country list.
 * Requirements: 4.4
 *
 * @returns {Promise<Record<string, number>>}
 */
export async function countLiveStats() {
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

/**
 * The stored overrides, normalised to a value for every key.
 *
 * A missing row and a row of all nulls are the same state — "no overrides" —
 * and both come back as all-nulls here. Normalising at the read means every
 * caller can destructure without a null check, and a partially filled row
 * cannot produce `undefined` for a key the UI expects to exist.
 *
 * Never throws: a settings problem must not be able to take the homepage down.
 * A failure here degrades to "no overrides", so the public endpoint still
 * answers with the live counts it would have shown anyway.
 *
 * @returns {Promise<{overrides: Record<string, number|null>, updatedAt: Date|null}>}
 */
export async function readOverrides() {
  const none = () => Object.fromEntries(STAT_KEYS.map((key) => [key, null]))

  let row
  try {
    row = await prisma.platformStats.findUnique({
      where: { id: SINGLETON_ID },
      select: { ...OVERRIDE_COLUMNS, updatedAt: true },
    })
  } catch (error) {
    console.error('[siteStats] failed to read overrides, falling back to live counts:', error)
    return { overrides: none(), updatedAt: null }
  }

  if (!row) return { overrides: none(), updatedAt: null }

  const overrides = none()
  for (const key of STAT_KEYS) {
    const value = row[key]
    // A stored value is only trusted if it is a positive integer. The write path
    // already guarantees that, but a row edited by hand in a SQL client may not
    // have been through it, and the homepage must not print "NaN".
    overrides[key] =
      typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
  }

  return { overrides, updatedAt: row.updatedAt }
}

/**
 * What the public endpoint serves: the live count for every metric with no
 * override, and the override where there is one.
 *
 * @returns {Promise<Record<string, number>>}
 */
export async function getPublicStats() {
  const [{ overrides }, live] = await Promise.all([readOverrides(), countLiveStats()])

  const published = {}
  for (const key of STAT_KEYS) {
    published[key] = overrides[key] ?? live[key]
  }

  return published
}

/**
 * Everything the admin screen needs in one response: the live counts, the stored
 * overrides, what each figure currently resolves to, and when the overrides
 * were last changed.
 *
 * Returned together rather than as separate calls because the whole point of the
 * screen is the comparison — a "live 6 / showing 24" row only makes sense if
 * both numbers arrived in the same response.
 */
export async function getSettings() {
  const [{ overrides, updatedAt }, live] = await Promise.all([
    readOverrides(),
    countLiveStats(),
  ])

  return {
    live,
    overrides,
    showing: Object.fromEntries(
      STAT_KEYS.map((key) => [key, overrides[key] ?? live[key]]),
    ),
    updatedAt: updatedAt ? updatedAt.toISOString() : null,
  }
}

/**
 * Saves overrides.
 *
 * The row is upserted rather than created on demand at read time, so the table
 * stays empty until somebody actually changes something — an empty table is an
 * unambiguous "nothing has been overridden here".
 *
 * A key that arrives as `undefined` is not written, so a partial save cannot
 * clear an override the admin did not touch. A key that arrives as `null` is
 * written as null, which is how an override is removed.
 *
 * @param {Record<string, number|null|undefined>} patch
 */
export async function updateOverrides(patch) {
  const data = {}
  for (const key of STAT_KEYS) {
    if (patch[key] !== undefined) data[key] = patch[key]
  }

  await prisma.platformStats.upsert({
    where: { id: SINGLETON_ID },
    // `create` needs every column the model requires; the absent ones fall back
    // to "no override" rather than to zero.
    create: { id: SINGLETON_ID, ...data },
    update: data,
    select: { ...OVERRIDE_COLUMNS, updatedAt: true },
  })

  return getSettings()
}
