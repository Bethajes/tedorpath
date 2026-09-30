/**
 * Unit tests for GET /api/tutors (public tutor directory).
 *
 * Runs against the real Express app and PostgreSQL database.
 * Requirements: 4.1–4.11
 */

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { createApp } from '../src/app.js'
import { closePrisma, prisma } from '../src/lib/prisma.js'

let server
let baseUrl

const createdUserIds = []
const createdProfileIds = []

before(async () => {
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (createdProfileIds.length) {
    await prisma.tutorProfile.deleteMany({ where: { id: { in: createdProfileIds } } })
  }
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
  }
  await new Promise((resolve) => server.close(resolve))
  await closePrisma()
})

async function api(path) {
  const response = await fetch(`${baseUrl}${path}`)
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, body }
}

async function seedProfile(overrides = {}) {
  const user = await prisma.user.create({
    data: {
      email: `unit-${crypto.randomUUID()}@test.local`,
      name: overrides.displayName ?? 'Test Tutor',
    },
  })
  createdUserIds.push(user.id)

  const profile = await prisma.tutorProfile.create({
    data: {
      userId: user.id,
      displayName: overrides.displayName ?? 'Test Tutor',
      headline: overrides.headline ?? 'Great tutor for any subject',
      bio: overrides.bio ?? 'Bio text here',
      teachingMode: overrides.teachingMode ?? 'ONLINE',
      studentLevels: overrides.studentLevels ?? ['High School'],
      profileStatus: overrides.profileStatus ?? 'APPROVED',
      location: overrides.location ?? null,
      // Explicit for the same reason as `languages`: the homepage stats count
      // distinct universities, and leaving this to the column default would
      // make a stats test depend on the schema rather than on its own rows.
      education: overrides.education ?? null,
      hourlyRate: overrides.hourlyRate ?? null,
      // Explicit rather than left to the column default, so a test that does
      // not care about languages gets an empty list rather than "English" and
      // a language-filter test does not accidentally match everything.
      languages: overrides.languages ?? [],
    },
  })
  createdProfileIds.push(profile.id)
  return profile
}

// ---------------------------------------------------------------------------
// Basic shape and APPROVED-only guarantee
// ---------------------------------------------------------------------------

describe('GET /api/tutors — basic response shape', () => {
  it('returns 200 with success envelope', async () => {
    const { status, body } = await api('/api/tutors')
    assert.equal(status, 200)
    assert.equal(body.success, true)
    assert.ok(Array.isArray(body.data.items))
    assert.ok(typeof body.data.pagination === 'object')
  })

  it('only returns APPROVED profiles — Req 4.1', async () => {
    const approved = await seedProfile({ displayName: 'Approved One', profileStatus: 'APPROVED' })
    const draft = await seedProfile({ displayName: 'Draft One', profileStatus: 'DRAFT' })
    const pending = await seedProfile({ displayName: 'Pending One', profileStatus: 'PENDING_REVIEW' })
    const suspended = await seedProfile({ displayName: 'Suspended One', profileStatus: 'SUSPENDED' })
    const rejected = await seedProfile({ displayName: 'Rejected One', profileStatus: 'REJECTED' })

    const { body } = await api('/api/tutors?limit=100')
    const ids = body.data.items.map((i) => i.id)

    assert.ok(ids.includes(approved.id), 'APPROVED profile must be in results')
    assert.ok(!ids.includes(draft.id), 'DRAFT profile must NOT be in results')
    assert.ok(!ids.includes(pending.id), 'PENDING_REVIEW profile must NOT be in results')
    assert.ok(!ids.includes(suspended.id), 'SUSPENDED profile must NOT be in results')
    assert.ok(!ids.includes(rejected.id), 'REJECTED profile must NOT be in results')
  })
})

// ---------------------------------------------------------------------------
// Search (q parameter) — Req 4.2
// ---------------------------------------------------------------------------

describe('GET /api/tutors — search by q', () => {
  it('matches by displayName', async () => {
    const profile = await seedProfile({ displayName: 'UniqueSearchNameXYZ' })
    const { body } = await api('/api/tutors?q=UniqueSearchNameXYZ&limit=100')
    assert.ok(body.data.items.some((i) => i.id === profile.id))
  })

  it('matches by headline', async () => {
    const profile = await seedProfile({ headline: 'UniqueHeadlineZQW expert tutor' })
    const { body } = await api('/api/tutors?q=UniqueHeadlineZQW&limit=100')
    assert.ok(body.data.items.some((i) => i.id === profile.id))
  })

  it('returns empty for unmatched search', async () => {
    const { body } = await api('/api/tutors?q=zzz-no-match-absolutely-xyz-9999')
    assert.equal(body.data.items.length, 0)
  })
})

// ---------------------------------------------------------------------------
// Individual filters
// ---------------------------------------------------------------------------

describe('GET /api/tutors — mode filter — Req 4.5', () => {
  it('filters by ONLINE', async () => {
    await seedProfile({ teachingMode: 'ONLINE', displayName: 'Online Tutor' })
    const { body } = await api('/api/tutors?mode=ONLINE&limit=100')
    for (const item of body.data.items) {
      assert.equal(item.teachingMode, 'ONLINE')
    }
  })

  it('filters by IN_PERSON', async () => {
    await seedProfile({ teachingMode: 'IN_PERSON', displayName: 'InPerson Tutor' })
    const { body } = await api('/api/tutors?mode=IN_PERSON&limit=100')
    for (const item of body.data.items) {
      assert.equal(item.teachingMode, 'IN_PERSON')
    }
  })
})

describe('GET /api/tutors — level filter — Req 4.4', () => {
  it('filters by student level', async () => {
    await seedProfile({ studentLevels: ['Primary School'], displayName: 'Primary Tutor' })
    await seedProfile({ studentLevels: ['University'], displayName: 'Uni Tutor' })

    const { body } = await api('/api/tutors?level=Primary%20School&limit=100')
    for (const item of body.data.items) {
      assert.ok(item.studentLevels.includes('Primary School'))
    }
  })
})

describe('GET /api/tutors — location filter — Req 4.6', () => {
  it('returns only profiles whose location contains the search term', async () => {
    await seedProfile({ location: 'Sydney CBD', displayName: 'Sydney Tutor' })
    await seedProfile({ location: 'Melbourne', displayName: 'Melbourne Tutor' })

    const { body } = await api('/api/tutors?location=Sydney&limit=100')
    for (const item of body.data.items) {
      assert.ok(item.location?.toLowerCase().includes('sydney'))
    }
  })
})

// ---------------------------------------------------------------------------
// Free-text search coverage (Requirements 4.3, 30.6)
// ---------------------------------------------------------------------------

describe('GET /api/tutors — free-text search covers every searchable field — Req 4.3', () => {
  const ids = (body) => body.data.items.map((item) => item.id)

  it('finds a tutor by their teaching language', async () => {
    // The regression: `q` matched only name, headline and subject name, so a
    // visitor searching "english" got only tutors who teach an English *subject*
    // and silently missed every tutor who lists English as a language.
    const tutor = await seedProfile({
      displayName: 'Polyglot Person',
      headline: 'Lessons',
      bio: 'x',
      languages: ['Wolof', 'English'],
    })
    const other = await seedProfile({
      displayName: 'Monolingual Person',
      headline: 'Lessons',
      bio: 'x',
      languages: ['Wolof'],
    })

    const { status, body } = await api('/api/tutors?q=English&limit=100')

    assert.equal(status, 200)
    assert.ok(ids(body).includes(tutor.id), 'a language must be searchable from the search box')
    assert.ok(!ids(body).includes(other.id), 'a tutor without that language must not match')
  })

  it('finds a tutor by their location', async () => {
    const tutor = await seedProfile({ displayName: 'Remote Person', location: 'Addis Ababa' })
    const other = await seedProfile({ displayName: 'Elsewhere Person', location: 'Remote' })

    const { body } = await api('/api/tutors?q=Addis&limit=100')

    assert.ok(ids(body).includes(tutor.id), 'a location must be searchable from the search box')
    assert.ok(!ids(body).includes(other.id))
  })

  it('matches a partial word in a language, the same as in a headline', async () => {
    // Substring semantics have to match the scalar fields: `contains` on a
    // headline finds "chem" inside "Chemistry", so a language must too.
    const tutor = await seedProfile({
      displayName: 'Partial Match Person',
      headline: 'Lessons',
      bio: 'x',
      languages: ['English'],
    })

    for (const term of ['eng', 'ngl', 'ENGLI']) {
      const { body } = await api(`/api/tutors?q=${term}&limit=100`)
      assert.ok(ids(body).includes(tutor.id), `"${term}" should match a language as a substring`)
    }
  })

  it('still finds tutors by name, headline and subject', async () => {
    const named = await seedProfile({ displayName: 'Zaphod Beeblebrox', headline: 'x', bio: 'x' })
    const headlined = await seedProfile({ displayName: 'Plain Name', headline: 'Quantum Tutor', bio: 'x' })

    const byName = await api('/api/tutors?q=Beeblebrox&limit=100')
    assert.ok(ids(byName.body).includes(named.id), 'searching by name must keep working')

    const byHeadline = await api('/api/tutors?q=Quantum&limit=100')
    assert.ok(ids(byHeadline.body).includes(headlined.id), 'searching by headline must keep working')
  })

  it('narrows a search with the other filters rather than ignoring them', async () => {
    const unisex = await seedProfile({
      displayName: 'Broad Match',
      languages: ['English'],
      studentLevels: ['University'],
    })
    const schoolOnly = await seedProfile({
      displayName: 'Narrow Match',
      languages: ['English'],
      studentLevels: ['Primary School'],
    })

    const { body } = await api('/api/tutors?q=English&level=University&limit=100')

    assert.ok(ids(body).includes(unisex.id))
    assert.ok(
      !ids(body).includes(schoolOnly.id),
      'a filter must narrow a language match, not be swallowed by it',
    )
  })

  it('treats a search term as literal text, not as a SQL wildcard', async () => {
    // `%` in a term must not turn into "match every tutor". The wildcards are
    // stripped before the term reaches any filter.
    const tutor = await seedProfile({ displayName: 'Wildcard Person', languages: ['English'] })

    for (const term of ['%25', '_', '%25%25%25']) {
      const { status, body } = await api(`/api/tutors?q=${term}&limit=100`)
      assert.equal(status, 200)
      assert.ok(
        !ids(body).includes(tutor.id),
        `q=${term} must not match every tutor that teaches any language`,
      )
    }
  })

  it('still finds a tutor when a wildcard is typed around a real term', async () => {
    // Stripping the wildcards must not break the rest of the term.
    const tutor = await seedProfile({
      displayName: 'Bounded Person',
      headline: 'Lessons',
      bio: 'x',
      languages: ['English'],
    })

    const { body } = await api('/api/tutors?q=%25%25%25english%25%25%25&limit=100')
    assert.ok(ids(body).includes(tutor.id), '%%%english%%% should still match English')
  })

  it('treats a wildcard-only location as matching nothing, not everything', async () => {
    // The same Prisma `contains` wildcard leak applied to the location filter,
    // where it was just as wrong: `?location=%` used to return the whole
    // directory.
    const tutor = await seedProfile({ displayName: 'Placed Person', location: 'Addis Ababa' })

    for (const params of ['?location=%25', '?location=_', '?q=english&location=%25']) {
      const { status, body } = await api(`/api/tutors${params}&limit=100`)
      assert.equal(status, 200, `${params} must not error`)
      assert.ok(
        !ids(body).includes(tutor.id),
        `${params} must return an empty page rather than the whole directory`,
      )
    }
  })

  it('leaves a blank search or filter alone', async () => {
    const tutor = await seedProfile({ displayName: 'Unfiltered Person', location: 'Addis Ababa' })

    // No filter and an empty filter are different from a filter that cannot
    // match: the first two show the directory, the third does not.
    for (const params of ['?q=', '?location=']) {
      const { body } = await api(`/api/tutors${params}&limit=100`)
      assert.ok(
        ids(body).includes(tutor.id),
        `${params} should behave as no filter, not as a search that matches nothing`,
      )
    }
  })
})

// ---------------------------------------------------------------------------
// Language filter (Requirements 30.2, 30.4)
// ---------------------------------------------------------------------------

describe('GET /api/tutors — language filter — Req 30.2, 30.4', () => {
  const ids = (body) => body.data.items.map((item) => item.id)

  it('returns only tutors who teach in the requested language', async () => {
    const french = await seedProfile({
      displayName: 'French Speaker',
      languages: ['French', 'English'],
    })
    const arabic = await seedProfile({ displayName: 'Arabic Speaker', languages: ['Arabic'] })

    const { status, body } = await api('/api/tutors?language=French&limit=100')

    assert.equal(status, 200)
    assert.ok(ids(body).includes(french.id), 'the French tutor must be returned')
    assert.ok(!ids(body).includes(arabic.id), 'the Arabic tutor must not be returned')
  })

  it('ignores the capitalisation a tutor actually typed', async () => {
    // The real failure mode: the array is tutor-authored free text, so a
    // case-sensitive match would hide every tutor who wrote "english".
    const tutor = await seedProfile({ displayName: 'Lowercase', languages: ['english'] })

    for (const query of ['English', 'english', 'ENGLISH']) {
      const { body } = await api(`/api/tutors?language=${query}&limit=100`)
      assert.ok(
        ids(body).includes(tutor.id),
        `"${query}" must find a tutor who wrote "english"`,
      )
    }
  })

  it('matches a language held among several, not only the first', async () => {
    const tutor = await seedProfile({
      displayName: 'Multi Language',
      languages: ['English', 'Amharic', 'Spanish'],
    })

    const { body } = await api('/api/tutors?language=Amharic&limit=100')
    assert.ok(ids(body).includes(tutor.id))
  })

  it('excludes a tutor with no languages when a language is requested', async () => {
    const none = await seedProfile({ displayName: 'No Languages', languages: [] })
    const french = await seedProfile({ displayName: 'Has French', languages: ['French'] })

    const { body } = await api('/api/tutors?language=French&limit=100')
    assert.ok(!ids(body).includes(none.id))
    assert.ok(ids(body).includes(french.id))
  })

  it('ignores an empty language parameter', async () => {
    const tutor = await seedProfile({ displayName: 'Still Listed', languages: ['French'] })

    // A blank value must behave as no filter. A `has ''` style match on an empty
    // array would return nobody and look like the whole directory broke.
    const { status, body } = await api('/api/tutors?language=&limit=100')
    assert.equal(status, 200)
    assert.ok(ids(body).includes(tutor.id))
  })

  it('returns an empty list for a language nobody teaches', async () => {
    await seedProfile({ displayName: 'Not Icelandic', languages: ['English'] })

    const { status, body } = await api('/api/tutors?language=Icelandic&limit=100')
    assert.equal(status, 200)
    assert.deepEqual(body.data.items, [])
  })

  it('reports a total consistent with the filtered items', async () => {
    await seedProfile({ displayName: 'Counted French', languages: ['French'] })
    await seedProfile({ displayName: 'Counted German', languages: ['German'] })

    const { body } = await api('/api/tutors?language=French&limit=100')

    // The language filter resolves ids outside the main query, so a mismatch
    // between the count and the rows is the specific bug this guards.
    assert.equal(body.data.pagination.total, body.data.items.length)
  })

  it('still hides unapproved tutors when a language is applied', async () => {
    const pending = await seedProfile({
      displayName: 'Pending French',
      languages: ['French'],
      profileStatus: 'PENDING_REVIEW',
    })

    const { body } = await api('/api/tutors?language=French&limit=100')
    assert.ok(
      !ids(body).includes(pending.id),
      'a language filter must not become a way to see an unapproved profile',
    )
  })

  it('rejects an over-long language parameter', async () => {
    const { status } = await api(`/api/tutors?language=${'x'.repeat(51)}`)
    assert.equal(status, 400)
  })
})

describe('GET /api/tutors — rate filters — Req 4.7', () => {
  it('minRate excludes profiles below the threshold', async () => {
    await seedProfile({ hourlyRate: 10, displayName: 'Cheap Tutor' })
    await seedProfile({ hourlyRate: 80, displayName: 'Expensive Tutor' })

    const { body } = await api('/api/tutors?minRate=50&limit=100')
    for (const item of body.data.items) {
      if (item.hourlyRate !== null) {
        assert.ok(item.hourlyRate >= 50)
      }
    }
  })

  it('maxRate excludes profiles above the threshold', async () => {
    await seedProfile({ hourlyRate: 200, displayName: 'Very Expensive Tutor' })
    await seedProfile({ hourlyRate: 30, displayName: 'Affordable Tutor' })

    const { body } = await api('/api/tutors?maxRate=100&limit=100')
    for (const item of body.data.items) {
      if (item.hourlyRate !== null) {
        assert.ok(item.hourlyRate <= 100)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Pagination — Req 4.8, 4.11
// ---------------------------------------------------------------------------

describe('GET /api/tutors — pagination', () => {
  it('returns a valid pagination envelope', async () => {
    const { body } = await api('/api/tutors?page=1&limit=5')
    const { pagination } = body.data
    assert.equal(pagination.page, 1)
    assert.equal(pagination.limit, 5)
    assert.ok(typeof pagination.total === 'number')
    assert.ok(typeof pagination.totalPages === 'number')
    assert.ok(body.data.items.length <= 5)
  })

  it('default limit is 12', async () => {
    const { body } = await api('/api/tutors')
    assert.equal(body.data.pagination.limit, 12)
  })

  it('limit is capped at 100 — Req 4.8', async () => {
    const { status, body } = await api('/api/tutors?limit=200')
    assert.equal(status, 400, 'limit > 100 should be rejected')
    assert.equal(body.error.code, 'VALIDATION_ERROR')
  })

  it('page=0 is rejected', async () => {
    const { status } = await api('/api/tutors?page=0')
    assert.equal(status, 400)
  })
})

// ---------------------------------------------------------------------------
// Sort — Req 4.9, 4.10
// ---------------------------------------------------------------------------

describe('GET /api/tutors — sort modes', () => {
  it('accepts all valid sort values', async () => {
    for (const sort of ['recommended', 'price_asc', 'price_desc', 'newest']) {
      const { status } = await api(`/api/tutors?sort=${sort}`)
      assert.equal(status, 200, `sort=${sort} should be accepted`)
    }
  })

  it('rejects an invalid sort value', async () => {
    const { status, body } = await api('/api/tutors?sort=bogus')
    assert.equal(status, 400)
    assert.equal(body.error.code, 'VALIDATION_ERROR')
  })
})

// ---------------------------------------------------------------------------
// Invalid params
// ---------------------------------------------------------------------------

describe('GET /api/tutors — invalid params rejected', () => {
  it('rejects an invalid mode', async () => {
    const { status } = await api('/api/tutors?mode=FLYING')
    assert.equal(status, 400)
  })

  it('rejects a non-numeric minRate', async () => {
    const { status } = await api('/api/tutors?minRate=abc')
    assert.equal(status, 400)
  })

  it('rejects a non-numeric maxRate', async () => {
    const { status } = await api('/api/tutors?maxRate=abc')
    assert.equal(status, 400)
  })
})

// ---------------------------------------------------------------------------
// Empty result — Req 4.11
// ---------------------------------------------------------------------------

describe('GET /api/tutors — empty result', () => {
  it('returns a valid envelope when no profiles match — Req 4.11', async () => {
    const { status, body } = await api('/api/tutors?q=zzz-no-match-absolutely-xyz-9999')
    assert.equal(status, 200)
    assert.equal(body.success, true)
    assert.equal(body.data.items.length, 0)
    assert.equal(body.data.pagination.total, 0)
    assert.equal(body.data.pagination.totalPages, 0)
  })
})

// ---------------------------------------------------------------------------
// Private field exclusion — Req 16.1
// ---------------------------------------------------------------------------

describe('GET /api/tutors — private fields excluded', () => {
  it('never includes private user fields', async () => {
    await seedProfile({ displayName: 'Privacy Tutor' })
    const { body } = await api('/api/tutors?limit=100')

    const raw = JSON.stringify(body)
    for (const field of ['passwordHash', 'tokenHash', 'revokedAt', 'emailVerifiedAt', 'phoneVerifiedAt', 'adminNotes']) {
      assert.ok(!raw.includes(field), `Response must not contain "${field}"`)
    }
  })
})

// ---------------------------------------------------------------------------
// GET /api/tutors/:id — Req 5.1–5.4
// ---------------------------------------------------------------------------

describe('GET /api/tutors/:id — valid approved profile', () => {
  it('returns 200 with full TutorDetailDTO for an approved profile', async () => {
    const profile = await seedProfile({ displayName: 'Detail Tutor', bio: 'Full bio content here' })
    const { status, body } = await api(`/api/tutors/${profile.id}`)

    assert.equal(status, 200)
    assert.equal(body.success, true)
    assert.equal(body.data.id, profile.id)
    assert.equal(body.data.displayName, 'Detail Tutor')
    assert.ok('bio' in body.data, 'full bio must be present')
    assert.ok('subjects' in body.data)
    assert.ok('studentLevels' in body.data)
    assert.ok('teachingMode' in body.data)
    assert.ok('languages' in body.data)
  })

  it('bio is not truncated in the detail view', async () => {
    const longBio = 'A'.repeat(500)
    const profile = await seedProfile({ displayName: 'Long Bio Tutor', bio: longBio })
    const { body } = await api(`/api/tutors/${profile.id}`)

    assert.equal(body.data.bio.length, 500, 'Full bio should not be truncated')
  })
})

describe('GET /api/tutors/:id — 404 cases', () => {
  it('returns 404 for a non-existent ID — Req 5.3', async () => {
    const fakeId = crypto.randomUUID()
    const { status, body } = await api(`/api/tutors/${fakeId}`)

    assert.equal(status, 404)
    assert.equal(body.success, false)
    assert.equal(body.error.code, 'NOT_FOUND')
  })

  it('returns 404 for a DRAFT profile — Req 5.2', async () => {
    const profile = await seedProfile({ displayName: 'Draft Detail', profileStatus: 'DRAFT' })
    const { status } = await api(`/api/tutors/${profile.id}`)
    assert.equal(status, 404)
  })

  it('returns 404 for a PENDING_REVIEW profile — Req 5.2', async () => {
    const profile = await seedProfile({ displayName: 'Pending Detail', profileStatus: 'PENDING_REVIEW' })
    const { status } = await api(`/api/tutors/${profile.id}`)
    assert.equal(status, 404)
  })

  it('returns 404 for a SUSPENDED profile — Req 5.2', async () => {
    const profile = await seedProfile({ displayName: 'Suspended Detail', profileStatus: 'SUSPENDED' })
    const { status } = await api(`/api/tutors/${profile.id}`)
    assert.equal(status, 404)
  })

  it('returns 404 for a REJECTED profile — Req 5.2', async () => {
    const profile = await seedProfile({ displayName: 'Rejected Detail', profileStatus: 'REJECTED' })
    const { status } = await api(`/api/tutors/${profile.id}`)
    assert.equal(status, 404)
  })

  // NEEDS_INFORMATION is a new state from the extended verification workflow.
  // A tutor waiting on an admin must not be publicly listed in the meantime.
  // Requirements: 19.6, 29.2
  it('returns 404 for a NEEDS_INFORMATION profile — Req 19.6, 29.2', async () => {
    const profile = await seedProfile({
      displayName: 'Needs Info Detail',
      profileStatus: 'NEEDS_INFORMATION',
    })
    const { status } = await api(`/api/tutors/${profile.id}`)
    assert.equal(status, 404, 'a tutor awaiting more information must not be publicly visible')
  })

  it('keeps a NEEDS_INFORMATION profile out of the directory list — Req 19.6, 29.2', async () => {
    const profile = await seedProfile({
      displayName: 'Needs Info Listed',
      profileStatus: 'NEEDS_INFORMATION',
    })

    const { body } = await api('/api/tutors?limit=100')
    const ids = body.data.items.map((item) => item.id)

    assert.ok(
      !ids.includes(profile.id),
      'NEEDS_INFORMATION profile must NOT appear in the public directory',
    )
  })

  it('does not leak the admin message through a NEEDS_INFORMATION profile — Req 29.2', async () => {
    const profile = await seedProfile({
      displayName: 'Needs Info Message',
      profileStatus: 'NEEDS_INFORMATION',
      adminMessage: 'INTERNAL-ONLY-ADMIN-NOTE',
      rejectionReason: 'MISSING_DOCUMENT',
    })

    const { status, body } = await api(`/api/tutors/${profile.id}`)
    assert.equal(status, 404)

    const { body: listBody } = await api('/api/tutors?limit=100')
    const raw = JSON.stringify(listBody)
    assert.ok(!raw.includes('INTERNAL-ONLY-ADMIN-NOTE'), 'the admin message must never reach the public API')
    assert.ok(!raw.includes(profile.id), 'the profile must not be listed at all')
  })
})

describe('GET /api/tutors/:id — private fields excluded — Req 5.4, 16.1', () => {
  it('never includes private user fields in the detail response', async () => {
    const profile = await seedProfile({ displayName: 'Private Check Tutor' })
    const { body } = await api(`/api/tutors/${profile.id}`)

    const raw = JSON.stringify(body)
    for (const field of ['passwordHash', 'tokenHash', 'revokedAt', 'emailVerifiedAt', 'phoneVerifiedAt', 'adminNotes']) {
      assert.ok(!raw.includes(field), `Response must not contain "${field}"`)
    }
  })
})

// ---------------------------------------------------------------------------
// GET /api/public/stats — public homepage counts — Req 4.2, 4.4
// ---------------------------------------------------------------------------

describe('GET /api/public/stats — public homepage counts', () => {
  const COUNT_FIELDS = ['approvedTutors', 'subjects', 'universities', 'countries']

  /**
   * Reads the current counts.
   *
   * Assertions are made on the *difference* before and after seeding rather
   * than on absolute values: this file shares one database with every other
   * backend test and with whatever the developer already has locally, so only
   * the change this test caused is something we can actually promise.
   */
  async function counts() {
    const { status, body } = await api('/api/public/stats')
    assert.equal(status, 200)
    return body.data
  }

  it('returns 200 with the standard success envelope — Req 4.4', async () => {
    const { status, body } = await api('/api/public/stats')

    assert.equal(status, 200)
    assert.equal(body.success, true)
    assert.ok(body.data !== null && typeof body.data === 'object')
  })

  it('returns all four counts as non-negative integers — Req 4.4', async () => {
    const data = await counts()

    assert.deepEqual(
      Object.keys(data).sort(),
      [...COUNT_FIELDS].sort(),
      'the response must carry exactly the four documented counts',
    )

    for (const field of COUNT_FIELDS) {
      assert.equal(typeof data[field], 'number', `${field} must be a number`)
      assert.ok(Number.isInteger(data[field]), `${field} must be an integer, got ${data[field]}`)
      assert.ok(data[field] >= 0, `${field} must not be negative, got ${data[field]}`)
    }
  })

  it('needs no authentication — Req 4.2', async () => {
    // `api` sends no Authorization header and no session cookie, so a 200 here
    // is the whole proof: the endpoint does not sit behind requireAdmin.
    const { status, body } = await api('/api/public/stats')

    assert.equal(status, 200)
    assert.equal(body.success, true)
  })

  it('counts only APPROVED profiles, never drafts or rejected ones — Req 4.1, 4.4', async () => {
    const before = await counts()

    await seedProfile({ displayName: 'Stats Approved', profileStatus: 'APPROVED' })
    await seedProfile({ displayName: 'Stats Draft', profileStatus: 'DRAFT' })
    await seedProfile({ displayName: 'Stats Pending', profileStatus: 'PENDING_REVIEW' })
    await seedProfile({ displayName: 'Stats Rejected', profileStatus: 'REJECTED' })
    await seedProfile({ displayName: 'Stats Suspended', profileStatus: 'SUSPENDED' })

    const after = await counts()

    assert.equal(
      after.approvedTutors - before.approvedTutors,
      1,
      'only the APPROVED profile may move the tutor count',
    )
  })

  it('counts a university and a location once each, however many tutors share them', async () => {
    const university = `Stats University ${crypto.randomUUID()}`
    const location = `Statsville-${crypto.randomUUID()}`

    const before = await counts()

    await seedProfile({ displayName: 'Stats A', education: university, location })
    await seedProfile({ displayName: 'Stats B', education: university, location })
    await seedProfile({ displayName: 'Stats C', education: university, location })

    const after = await counts()

    assert.equal(
      after.universities - before.universities,
      1,
      'three tutors at one university are still one university',
    )
    assert.equal(
      after.countries - before.countries,
      1,
      'three tutors in one location are still one country',
    )
  })

  it('does not count a tutor who never said where they studied or are based — Req 4.4', async () => {
    const before = await counts()

    await seedProfile({ displayName: 'Stats No Education', education: null, location: null })
    await seedProfile({ displayName: 'Stats Blank Education', education: '   ', location: '' })

    const after = await counts()

    assert.equal(
      after.universities - before.universities,
      0,
      'a blank education field is not a university',
    )
    assert.equal(
      after.countries - before.countries,
      0,
      'a blank location field is not a country',
    )
  })

  it('ignores unapproved profiles when counting universities and countries', async () => {
    const university = `Hidden University ${crypto.randomUUID()}`
    const location = `Hiddenville-${crypto.randomUUID()}`

    const before = await counts()

    await seedProfile({
      displayName: 'Stats Hidden Draft',
      profileStatus: 'DRAFT',
      education: university,
      location,
    })

    const after = await counts()

    assert.equal(
      after.universities - before.universities,
      0,
      'a draft tutor must not put a university on the homepage',
    )
    assert.equal(
      after.countries - before.countries,
      0,
      'a draft tutor must not put a country on the homepage',
    )
  })

  it('never includes private profile fields', async () => {
    await seedProfile({
      displayName: 'Stats Privacy Tutor',
      adminMessage: 'INTERNAL-ONLY-STATS-NOTE',
    })

    const { body } = await api('/api/public/stats')
    const raw = JSON.stringify(body)

    for (const field of ['displayName', 'headline', 'adminMessage', 'adminNotes', 'passwordHash', 'tokenHash']) {
      assert.ok(!raw.includes(field), `Response must not contain "${field}"`)
    }
    assert.ok(!raw.includes('INTERNAL-ONLY-STATS-NOTE'))
  })
})
