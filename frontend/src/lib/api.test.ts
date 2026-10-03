import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, getJson } from '@/lib/api'

/**
 * What a visitor is told when the API cannot be reached.
 *
 * The case this exists for: in development the request goes to the Vite dev
 * server, the proxy cannot reach the backend, and Vite answers with an HTML error
 * page. That reaches the client as an unreadable body, and "the server returned
 * an unexpected response" is a true statement that helps nobody diagnose it.
 */
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the API being unreachable', () => {
  it('names the likely cause when the proxy answers with a 5xx', async () => {
    const html = new Response('<html><body>Error: connect ECONNREFUSED</body></html>', {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(html))

    const error = await getJson('/api/auth/login').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('API_UNAVAILABLE')
    expect((error as ApiError).message).toMatch(/backend is running/i)
    expect((error as ApiError).message).toMatch(/VITE_DEV_API_TARGET/i)
  })

  it('keeps the plainer wording for a server that is up but answered oddly', async () => {
    const notJson = new Response('<html>hello</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(notJson))

    const error = await getJson('/api/auth/login').catch((e: unknown) => e)

    expect((error as ApiError).code).toBe('BAD_RESPONSE')
    expect((error as ApiError).message).toMatch(/unexpected response/i)
    expect((error as ApiError).message).not.toMatch(/backend is running/i)
  })

  it('still says the network is unreachable when the request never completes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const error = await getJson('/api/auth/login').catch((e: unknown) => e)

    expect((error as ApiError).code).toBe('NETWORK_ERROR')
    expect((error as ApiError).message).toMatch(/could not reach the server/i)
  })
})
