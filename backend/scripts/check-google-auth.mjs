/**
 * Is Google sign-in wired up correctly?
 *
 *   npm run auth:check
 *
 * Asks the real app which redirect URI it will send, then sends a real
 * authorization request to Google and reports whether it is accepted. This is
 * the difference between "it does not work" and "the console is missing one
 * line", without clicking through the consent screen to find out.
 *
 * The URI is read from the running code rather than recomputed here, so this
 * can never drift from what the app actually sends.
 *
 * The one failure it cannot explain is a sign-in Google accepts and then
 * refuses to complete, which in practice means the app is still in the Testing
 * publishing status and the account is not listed as a test user.
 */

import { createHash } from 'node:crypto'

import 'dotenv/config'

import { createApp } from '../src/app.js'
import { closePrisma } from '../src/lib/prisma.js'
import { env } from '../src/config/env.js'

const AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

function fail(message) {
  console.error(`\n  ✗ ${message}\n`)
  process.exitCode = 1
}

if (!env.googleClientId) {
  fail('GOOGLE_CLIENT_ID is not set. Add it to backend/.env to enable Google sign-in.')
  process.exit(1)
}

if (!env.googleAuthEnabled) {
  console.log('\n  ! GOOGLE_AUTH_ENABLED is off, so the sign-in page is not showing Google.\n')
}

/** The app origin the visitor's browser is on, as the dev proxy would report it. */
const appUrl =
  env.frontendUrl ||
  env.corsOrigins[0]?.replace(/\/+$/, '') ||
  `http://localhost:${env.port}`

// Ask the app itself, through a real request, which URI it will use.
const server = createApp().listen(0)
await new Promise((resolve) => server.once('listening', resolve))
const { port } = server.address()

const { host } = new URL(appUrl)
const start = await fetch(`http://127.0.0.1:${port}/api/auth/google`, {
  redirect: 'manual',
  headers: { 'x-forwarded-host': host, 'x-forwarded-proto': new URL(appUrl).protocol.replace(':', '') },
})

const location = start.headers.get('location') ?? ''
const redirectUri = new URL(location, appUrl).searchParams.get('redirect_uri')

await new Promise((resolve) => server.close(resolve))
await closePrisma()

console.log('\n  Google sign-in check\n  ─────────────────────────────────────────────')
console.log(`  client id     ${env.googleClientId}`)
console.log(`  app origin    ${appUrl}`)
console.log(`  redirect URI  ${redirectUri ?? '(the app did not return one)'}`)
console.log(`  client secret ${env.googleClientSecret ? 'set' : 'not set (fine — the flow uses PKCE)'}`)

if (!redirectUri) {
  fail('The app did not produce an authorization URL. Is /api/auth/google mounted?')
  process.exit(1)
}

const url = new URL(AUTHORIZATION_URL)
url.searchParams.set('client_id', env.googleClientId)
url.searchParams.set('redirect_uri', redirectUri)
url.searchParams.set('response_type', 'code')
url.searchParams.set('scope', 'openid email profile')
url.searchParams.set('state', 'check')
// A real S256 challenge: Google validates the challenge before it looks at the
// redirect URI, so a made-up one would mask the answer we came for.
url.searchParams.set('code_challenge', createHash('sha256').update('check').digest('base64url'))
url.searchParams.set('code_challenge_method', 'S256')

let html
try {
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  html = await response.text()
} catch (error) {
  fail(`Could not reach Google: ${error.message}`)
  process.exit(1)
}

const visible = html
  .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z]+;/g, ' ')
  .replace(/\s+/g, ' ')

if (/redirect_uri_mismatch/i.test(visible)) {
  console.log('\n  ✗ Google does not recognise this redirect URI.\n')
  console.log('    Add exactly this line to the Google Cloud console:')
  console.log('')
  console.log('      APIs & Services → Credentials → your OAuth client')
  console.log('      → Authorized redirect URIs, and add:')
  console.log('')
  console.log(`        ${redirectUri}`)
  console.log('')
  console.log('    It has to match character for character — scheme, port and path.')
  console.log('    Then run this command again.\n')
  process.exit(1)
}

// Any "Error NNN:" is a failure, whichever one it is.
const error = visible.match(/Error \d{3}: [a-z_]+/i)?.[0]
if (error) {
  console.log(`\n  ✗ Google rejected the request: ${error}\n`)
  console.log(`    ${visible.slice(visible.indexOf(error), visible.indexOf(error) + 150)}\n`)
  process.exit(1)
}

// A real sign-in page: Google's account form. An error page also contains the
// words "Sign in", so the form itself is what counts.
if (/ServiceLogin|id="identifier"|Choose an account/.test(html)) {
  console.log('\n  ✓ Google accepted the client id and the redirect URI.\n')
  console.log('    Sign-in should work now. If Google then refuses a particular')
  console.log('    account, the app is in the Testing status and that account has to')
  console.log('    be added under OAuth consent screen → Test users.\n')
} else {
  console.log('\n  ? Google answered, but not with a sign-in page. First thing it sent:\n')
  console.log(`    ${visible.trim().slice(0, 200)}\n`)
  process.exit(1)
}
