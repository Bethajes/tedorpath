import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  __setMarketsForTest,
  ensureMarketsLoaded,
  findMarket,
  knownMarkets,
  loadMarkets,
} from './market'
import { getJson } from '@/lib/api'

/**
 * The market registry.
 *
 * Deliberately much smaller than it used to be. This module once owned the whole
 * question of *which* market a visitor was shopping in — resolution order, a
 * timezone table, a sessionStorage cache, a network probe, and a "Prices shown for
 * Ethiopia  Change" control that called it. All of that moved to the server, which
 * resolves the market once per request from the account, a cookie and the network
 * header, and sends a single price.
 *
 * What is left here is purely descriptive: the markets the platform sells in, so a
 * number that has already been chosen can be written the way its currency is
 * actually written. These tests are the check that adding a market is a database row
 * rather than an edit to this file and three components.
 */

vi.mock('@/lib/api', () => ({
  getJson: vi.fn(),
}))

/*
 * The registry is module-level state, because every surface that renders a price
 * reads it and none of them own it. These tests replace it, so each one puts the
 * shipped list back first: without that, a test that loads three markets leaks
 * them into the next test in the file and fails on an assertion about the two that
 * ship. A real bug of exactly this shape — one component's config leaking into
 * another's — is what module state invites.
 */
afterEach(() => {
  __setMarketsForTest(null)
})

describe('the shipped markets', () => {
  it('offers Ethiopia and the international market', () => {
    const codes = knownMarkets().map((market) => market.code)

    expect(codes).toContain('ETB')
    expect(codes).toContain('USD')
  })

  it('defaults to Ethiopia, because that is the platform\'s home market', () => {
    // The server's default. Mirrored here only so the client formats a price the
    // same way on first paint as it does once the real registry lands — a first
    // paint in dollars that then switches to birr is the flash this avoids.
    expect(knownMarkets().find((market) => market.isDefault)?.code).toBe('ETB')
  })

  it('writes birr as a code and dollars as a symbol', () => {
    // The two cases are opposites: "$" is recognised everywhere, "Br" is shared
    // with Burundi's franc and means nothing to most readers.
    expect(findMarket('ETB')?.priceFormat).toBe('code')
    expect(findMarket('USD')?.priceFormat).toBe('symbol')
  })
})

describe('loading the registry', () => {
  it('takes the offered markets from the onboarding config', async () => {
    vi.mocked(getJson).mockResolvedValue({
      markets: [
        {
          code: 'ETB',
          name: 'Ethiopia',
          currencyName: 'Ethiopian Birr',
          symbol: 'Br',
          decimals: 2,
          priceFormat: 'code',
          isDefault: true,
        },
        {
          code: 'USD',
          name: 'International',
          currencyName: 'US Dollar',
          symbol: '$',
          decimals: 2,
          priceFormat: 'symbol',
          isDefault: false,
        },
        {
          code: 'EUR',
          name: 'Europe',
          currencyName: 'Euro',
          symbol: '€',
          decimals: 2,
          priceFormat: 'symbol',
          isDefault: false,
        },
      ],
    })

    const markets = await loadMarkets()

    expect(markets.map((market) => market.code)).toEqual(['ETB', 'USD', 'EUR'])
    expect(findMarket('EUR')).toBeDefined()
  })

  it('keeps the shipped markets when the request fails', async () => {
    // Prices still render when the registry cannot be loaded. The two that ship are
    // what the table is seeded with, so the first paint and the steady state agree.
    vi.mocked(getJson).mockRejectedValue(new Error('offline'))

    const markets = await loadMarkets()

    expect(markets.map((market) => market.code)).toEqual(['ETB', 'USD'])
    expect(findMarket('ETB')?.isDefault).toBe(true)
  })

  it('keeps the shipped markets when the config carries none', async () => {
    // An empty list is not a platform with no markets — it is a broken response,
    // and falling back to nothing would leave every price unformattable.
    vi.mocked(getJson).mockResolvedValue({ markets: [] })

    const markets = await loadMarkets()

    expect(markets.map((market) => market.code)).toEqual(['ETB', 'USD'])
  })
})

describe('finding a market', () => {
  it('returns nothing for a code we do not offer', () => {
    expect(findMarket('GBP')).toBeUndefined()
    expect(findMarket(null)).toBeUndefined()
    expect(findMarket(undefined)).toBeUndefined()
  })

  it('can be replaced and reset for a test', () => {
    __setMarketsForTest([
      {
        code: 'EUR',
        name: 'Europe',
        currencyName: 'Euro',
        symbol: '€',
        decimals: 2,
        isDefault: true,
      },
    ])
    expect(knownMarkets()).toHaveLength(1)

    __setMarketsForTest(null)
    expect(knownMarkets()).toHaveLength(2)
  })
})

describe('ensureMarketsLoaded', () => {
  it('asks once however many prices are on the page', async () => {
    vi.mocked(getJson).mockResolvedValue({ markets: undefined })

    await Promise.all([ensureMarketsLoaded(), ensureMarketsLoaded(), ensureMarketsLoaded()])

    // One call for a page with a dozen prices on it. A bare `loadMarkets` per price
    // would be a dozen identical requests to read one more field off a response the
    // wizard is already fetching.
    expect(getJson).toHaveBeenCalledTimes(1)
  })
})
