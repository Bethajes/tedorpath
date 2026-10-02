/**
 * API tests for tutor profile photo uploads.
 *
 * Example-based, like the other *.api.test.mjs files: each test pins one
 * concrete behaviour. The emphasis is on the boundary the upload sits on —
 * user-supplied bytes that end up being served back from a public URL — so the
 * interesting cases are the ones where the client lies about what it is
 * sending, or tries to choose where the file lands.
 *
 * Runs against the real Express app and PostgreSQL database, and writes into a
 * temporary upload directory so nothing touches the developer's real one.
 *
 * Requirements: 17.1, 17.3
 */

import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

// Must be set before src/config/env.js is imported by anything below: uploadDir
// is read lazily, but setting it here keeps the tests off the real `uploads/`.
const uploadDir = await mkdtemp(path.join(tmpdir(), 'tedor-uploads-'))
process.env.UPLOAD_DIR = uploadDir

const { createApp } = await import('../src/app.js')
const { SESSION_COOKIE_NAME } = await import('../src/modules/auth/cookies.js')
const { closePrisma, prisma } = await import('../src/lib/prisma.js')
const { MAX_PHOTO_BYTES } = await import('../src/modules/uploads/validation.js')

let server
let baseUrl

const createdUserIds = []
const createdProfileIds = []

/** A 1x1 PNG — the smallest real file with valid magic bytes. */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

/** A 1x1 GIF, for the second accepted format. */
const GIF_BYTES = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

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
  await rm(uploadDir, { recursive: true, force: true })
})

/** Calls the API with a JSON body. Pass `token: null` to send no cookie. */
async function api(path_, { method = 'GET', body, token } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Cookie = `${SESSION_COOKIE_NAME}=${token}`

  const response = await fetch(`${baseUrl}${path_}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await response.text()
  let parsed = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }
  return { status: response.status, body: parsed }
}

/**
 * Calls the upload endpoint with a real multipart body.
 *
 * `contentType` and `fileName` are parameters because the whole point of several
 * of these tests is a client that lies about them.
 */
async function uploadPhoto(token, bytes, { contentType = 'image/png', fileName = 'me.png', field = 'photo' } = {}) {
  const form = new FormData()
  form.append(field, new Blob([bytes], { type: contentType }), fileName)

  const headers = {}
  if (token) headers.Cookie = `${SESSION_COOKIE_NAME}=${token}`

  const response = await fetch(`${baseUrl}/api/tutor-profile/photo`, {
    method: 'POST',
    headers,
    body: form,
  })

  const text = await response.text()
  let parsed = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }
  return { status: response.status, body: parsed }
}

async function deletePhoto(token) {
  return api('/api/tutor-profile/photo', { method: 'DELETE', token })
}

/** A user with a live session. */
async function createUser() {
  const user = await prisma.user.create({
    data: { email: `uploads-${randomBytes(8).toString('hex')}@test.local`, name: 'Photo Tutor' },
  })
  createdUserIds.push(user.id)

  const token = randomBytes(32).toString('hex')
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 3600000),
    },
  })

  return { userId: user.id, token }
}

/** A user with a live session and a DRAFT profile to attach a photo to. */
async function createUserWithProfile() {
  const { userId, token } = await createUser()
  const profile = await prisma.tutorProfile.create({
    data: {
      userId,
      displayName: 'Photo Tutor',
      headline: 'Headline',
      bio: 'Bio',
      teachingMode: 'ONLINE',
      studentLevels: ['High School'],
      profileStatus: 'DRAFT',
      verificationStatus: 'UNVERIFIED',
    },
  })
  createdProfileIds.push(profile.id)
  return { userId, token, profileId: profile.id }
}

function storedPhotoOf(userId) {
  return prisma.tutorProfile.findUnique({ where: { userId }, select: { profilePhotoUrl: true } })
}

/**
 * Whether a file is currently in the upload directory.
 *
 * Scoped to one filename rather than asserted against the whole directory:
 * every test in this file shares one temporary upload directory, so a
 * directory-wide assertion would also be asserting that the other tests cleaned
 * up after themselves.
 */
function isOnDisk(url) {
  if (!url?.startsWith('/api/uploads/')) return false
  return readdir(uploadDir).then((names) => names.includes(path.basename(url)))
}

/** The files in the upload directory, so a test can compare before and after. */
function uploadDirContents() {
  return readdir(uploadDir)
}

describe('POST /api/tutor-profile/photo', () => {
  it('stores a valid image and records it on the session user\'s profile', async () => {
    const { userId, token } = await createUserWithProfile()

    const res = await uploadPhoto(token, PNG_BYTES)

    assert.equal(res.status, 201)
    assert.equal(res.body.success, true)
    assert.match(res.body.data.profilePhotoUrl, /^\/api\/uploads\/[\w-]+\.png$/)
    assert.equal(res.body.data.type, 'image/png')
    assert.equal(res.body.data.bytes, PNG_BYTES.length)

    const stored = await storedPhotoOf(userId)
    assert.equal(stored.profilePhotoUrl, res.body.data.profilePhotoUrl)
  })

  it('serves the stored file back byte-for-byte', async () => {
    const { token } = await createUserWithProfile()
    const res = await uploadPhoto(token, GIF_BYTES)
    assert.equal(res.status, 201)

    const served = await fetch(`${baseUrl}${res.body.data.profilePhotoUrl}`)
    assert.equal(served.status, 200)
    assert.deepEqual(Buffer.from(await served.arrayBuffer()), GIF_BYTES)
  })

  it('requires authentication', async () => {
    const res = await uploadPhoto(null, PNG_BYTES)
    assert.equal(res.status, 401)
    assert.equal(res.body.error.code, 'UNAUTHORIZED')
  })

  it('reports the missing profile instead of failing silently (Req 17.3)', async () => {
    const { token } = await createUser()

    const res = await uploadPhoto(token, PNG_BYTES)

    assert.equal(res.status, 404)
    assert.equal(res.body.error.code, 'PROFILE_NOT_FOUND')
    assert.match(res.body.error.message, /Start your tutor profile/)
    assert.deepEqual(await readdir(uploadDir), [])
  })

  it('rejects a file whose bytes are not an image, whatever it claims to be', async () => {
    const { userId, token } = await createUserWithProfile()

    const res = await uploadPhoto(token, '<script>alert(1)</script>'.padEnd(64, ' '), {
      contentType: 'image/png',
      fileName: 'evil.png',
    })

    assert.equal(res.status, 400)
    assert.equal(res.body.error.code, 'INVALID_FILE_TYPE')

    const stored = await storedPhotoOf(userId)
    assert.equal(stored.profilePhotoUrl, null)
  })

  it('rejects an SVG, which is why the list is a whitelist of four raster formats', async () => {
    const { token } = await createUserWithProfile()
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')

    const res = await uploadPhoto(token, svg, { contentType: 'image/svg+xml', fileName: 'x.svg' })

    assert.equal(res.status, 400)
    assert.equal(res.body.error.code, 'INVALID_FILE_TYPE')
  })

  it('rejects an empty file', async () => {
    const { token } = await createUserWithProfile()

    const res = await uploadPhoto(token, Buffer.alloc(0))

    assert.equal(res.status, 400)
    assert.equal(res.body.error.code, 'INVALID_FILE_TYPE')
  })

  it('rejects a request with no file part', async () => {
    const { token } = await createUserWithProfile()

    const res = await uploadPhoto(token, PNG_BYTES, { field: 'notAPhoto' })

    assert.equal(res.status, 400)
    assert.equal(res.body.error.code, 'NO_FILE')
  })

  it('rejects an oversized file before storing it', async () => {
    const { userId, token } = await createUserWithProfile()
    // Valid PNG header, then more than the limit. multer refuses on size while
    // it streams, so this never reaches the byte sniffing.
    const oversized = Buffer.concat([PNG_BYTES, Buffer.alloc(MAX_PHOTO_BYTES + 1024)])

    const res = await uploadPhoto(token, oversized)

    assert.equal(res.status, 413)
    assert.equal(res.body.error.code, 'FILE_TOO_LARGE')
    assert.equal((await storedPhotoOf(userId)).profilePhotoUrl, null)
    assert.deepEqual(await readdir(uploadDir), [])
  })

  it('names the stored file itself rather than trusting the uploaded name', async () => {
    const { token } = await createUserWithProfile()

    const res = await uploadPhoto(token, PNG_BYTES, { fileName: '../../../../etc/passwd' })

    assert.equal(res.status, 201)
    // A traversal attempt in the client-supplied name cannot reach the path.
    assert.match(res.body.data.profilePhotoUrl, /^\/api\/uploads\/[\w-]+\.png$/)
    const stored = await readFile(path.join(uploadDir, path.basename(res.body.data.profilePhotoUrl)))
    assert.deepEqual(stored, PNG_BYTES)
  })

  it('replaces the previous photo and deletes the file it superseded', async () => {
    const { userId, token } = await createUserWithProfile()

    const first = await uploadPhoto(token, PNG_BYTES)
    const firstName = path.basename(first.body.data.profilePhotoUrl)
    const second = await uploadPhoto(token, GIF_BYTES)

    assert.equal(second.status, 201)
    assert.notEqual(second.body.data.profilePhotoUrl, first.body.data.profilePhotoUrl)
    assert.equal((await storedPhotoOf(userId)).profilePhotoUrl, second.body.data.profilePhotoUrl)

    // The superseded upload is gone rather than accumulating on disk forever.
    assert.deepEqual(await readdir(uploadDir), [path.basename(second.body.data.profilePhotoUrl)])
    await assert.rejects(() => readFile(path.join(uploadDir, firstName)))
  })

  it('does not touch an externally hosted photo when a new one is uploaded', async () => {
    const { userId, token } = await createUserWithProfile()
    const external = 'https://example.com/photo.jpg'
    await prisma.tutorProfile.update({ where: { userId }, data: { profilePhotoUrl: external } })

    const res = await uploadPhoto(token, PNG_BYTES)

    assert.equal(res.status, 201)
    assert.equal((await storedPhotoOf(userId)).profilePhotoUrl, res.body.data.profilePhotoUrl)
  })

  it('only ever writes to the session user\'s own profile', async () => {
    const { token } = await createUserWithProfile()
    const other = await createUserWithProfile()

    const res = await uploadPhoto(token, PNG_BYTES)

    assert.equal(res.status, 201)
    assert.equal((await storedPhotoOf(other.userId)).profilePhotoUrl, null)
  })
})

describe('DELETE /api/tutor-profile/photo', () => {
  it('clears the stored photo and removes the file', async () => {
    const { userId, token } = await createUserWithProfile()
    const uploaded = await uploadPhoto(token, PNG_BYTES)
    const fileName = path.basename(uploaded.body.data.profilePhotoUrl)

    const res = await deletePhoto(token)

    assert.equal(res.status, 200)
    assert.deepEqual(res.body.data, { profilePhotoUrl: null })
    assert.equal((await storedPhotoOf(userId)).profilePhotoUrl, null)
    await assert.rejects(() => readFile(path.join(uploadDir, fileName)))
  })

  it('is idempotent when there is no photo', async () => {
    const { token } = await createUserWithProfile()

    const res = await deletePhoto(token)

    assert.equal(res.status, 200)
    assert.deepEqual(res.body.data, { profilePhotoUrl: null })
  })

  it('requires authentication', async () => {
    const res = await deletePhoto(null)
    assert.equal(res.status, 401)
    assert.equal(res.body.error.code, 'UNAUTHORIZED')
  })

  it('reports a missing profile', async () => {
    const { token } = await createUser()

    const res = await deletePhoto(token)

    assert.equal(res.status, 404)
    assert.equal(res.body.error.code, 'PROFILE_NOT_FOUND')
  })
})
