/**
 * The markets a tutor can sell in.
 *
 * Tedor Tutors serves Ethiopian learners, who think in birr, and learners
 * elsewhere, who think in dollars. A tutor states one price per market, and
 * nothing anywhere converts between them — so the only question this module helps
 * answer is how a number should be *written*, once the server has already decided
 * which market it is in.
 *
 * WHY THERE IS NO MARKET-SELECTION LOGIC HERE
 *
 * There used to be. The client resolved a market, sent `?market=` on every request,
 * stored the answer in `sessionStorage`, and offered a "Prices shown for Ethiopia —
 * Change" control so a learner could override it.
 *
 * All of it is gone, and the reason is worth keeping in mind before adding
 * something similar: every one of those steps was a way for the price on screen and
 * the market the server priced in to disagree. The card could show one market and
 * the profile it linked to could show another; the rate filter could be applied in
 * birr against prices rendered in dollars; a learner on a VPN got whichever source
 * happened to be consulted first.
 *
 * So the server decides, once, from who is asking — saved country, then the country
 * remembered from the request wizard, then the country the hosting platform reports
 * — and sends a single price. This module only describes the markets so a rendered
 * number can be formatted correctly. There is deliberately no `changeMarket` and no
 * control that calls one.
 *
 * The list comes from the backend's `markets` table via the onboarding config. A
 * third market is a row there, not an entry in this file and three components.
 */

import { getJson } from '@/lib/api'

/** A market, as the backend's registry describes it. */
export interface MarketDefinition {
  /** The three-letter code used in the API and in URLs. */
  code: string
  /** What the market is called to a visitor: "Ethiopia", "International". */
  name: string
  /** The currency's own name, for "prices in Ethiopian Birr". */
  currencyName: string
  /** The currency's symbol, e.g. "$". */
  symbol: string
  /** How many decimal places this currency is normally shown with. */
  decimals: number
  /**
   * Whether a price in this market is written "$20" or "1,500 ETB".
   *
   * Per market rather than a rule in the formatter because the two shipped markets
   * need opposite answers: "$" is recognised everywhere, so the symbol says more
   * than the code, while "Br" is shared with Burundi's franc and means nothing to
   * most readers, so the birr price has to spell out ETB to be usable at all.
   */
  priceFormat?: 'symbol' | 'code'
  /** Whether this is the market served to a visitor who has said nothing. */
  isDefault: boolean
}

/**
 * The shipped markets, used before the config arrives and if it cannot.
 *
 * Deliberately identical to what the table is seeded with, so the first paint and
 * the steady state agree and no price visibly changes format once the real list
 * lands.
 */
const FALLBACK_MARKETS: MarketDefinition[] = [
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
]

/** A market code. */
export type Market = string

/**
 * The registry.
 *
 * Module-level because it is a fact about the platform, not about a component:
 * every surface that renders a price needs it and none of them own it. Replaced
 * wholesale by `loadMarkets`, and the fallback is in place until then, so there is
 * no "not loaded yet" branch at each call site.
 */
let registry: MarketDefinition[] = FALLBACK_MARKETS

/** The markets currently known, in the order they should be offered. */
export function knownMarkets(): MarketDefinition[] {
  return registry
}

/** One market by code, or undefined. */
export function findMarket(code: string | null | undefined): MarketDefinition | undefined {
  if (!code) return undefined
  return registry.find((market) => market.code === code)
}

/**
 * Loads the market registry from the onboarding config.
 *
 * No extra request: the config already carries the countries and currencies the
 * wizard needs, so this is reading one more field off a response that was being
 * fetched anyway. Resolves to the markets in force afterwards, which is the
 * fallback list if the request fails — a caller never has to handle a failure,
 * because there is always something to format a price with.
 */
export async function loadMarkets(): Promise<MarketDefinition[]> {
  try {
    const config = await getJson<{ markets?: MarketDefinition[] }>('/api/onboarding/config')

    if (Array.isArray(config?.markets) && config.markets.length > 0) {
      registry = config.markets
    }
  } catch {
    // Left on the fallback, which is exactly right for every deployment that has
    // not added a market.
  }

  return registry
}

/**
 * Loads the registry once per page load.
 *
 * Every surface that renders a price needs this before it can format one, and
 * every surface already waits on its own fetch. A hook rather than a bare call so
 * each surface waits once rather than once per price on the page, and so React
 * re-renders the prices when the real registry arrives instead of leaving them
 * formatted by the fallback.
 */
let registryPromise: Promise<MarketDefinition[]> | null = null

export function ensureMarketsLoaded(): Promise<MarketDefinition[]> {
  if (!registryPromise) {
    registryPromise = loadMarkets().catch(() => registry)
  }

  return registryPromise
}

/** Test-only: replaces the registry. Restores the shipped markets on reset. */
export function __setMarketsForTest(markets: MarketDefinition[] | null): void {
  registry = markets && markets.length > 0 ? markets : FALLBACK_MARKETS
  registryPromise = null
}