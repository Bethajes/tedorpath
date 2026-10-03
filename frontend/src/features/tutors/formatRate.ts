import { findMarket } from './market'

/**
 * How a tutor's rate is shown.
 *
 * One formatter, because the alternative is what the site had before: a `£` typed
 * into a profile preview, a hardcoded "GBP" in a hint, and a bare number on the
 * card — three different claims about the same price, none of them stored. A
 * caller that knows the market gets the unit spelled correctly rather than
 * guessing.
 *
 * ONE PRICE, AND THE SERVER PICKS IT
 *
 * This file formats a number that has already been decided. It never chooses a
 * market, never compares two of them, and never converts: `900 ETB` and `12 USD`
 * are two prices a tutor typed, and the only question anywhere is which one this
 * particular learner is looking at. The server answers that from who is asking.
 *
 * An earlier version of this file had `secondaryRate` and `otherMarketLabel`, for
 * a card that printed "also 500 ETB for local students". Both are gone. That was a
 * true fact about the tutor and a bad thing to put on a card: two numbers for the
 * same hour of teaching, with no way for a learner to tell which one they would be
 * charged.
 */

/** A rate as the API sends it. */
export interface TutorRates {
  /** The rate for the market this listing was priced in. */
  hourlyRate: number | null
  /** Which market that number is in. Travels with it, never assumed. */
  hourlyRateCurrency?: string | null
}

/**
 * Renders a rate in its own market's style, or `null` when there is nothing to
 * show.
 *
 * Ethiopia reads "1,500 ETB" and everywhere else reads "$20", because that is how
 * each currency is actually written in its own market — the choice is data on the
 * market row, not a rule here, so a currency added later is formatted the way it
 * should be without this file being edited.
 *
 * Returns null rather than an empty string so a caller can render it directly as a
 * JSX child without producing an empty wrapper element.
 */
export function formatRate(
  rate: number | null | undefined,
  currency?: string | null,
): string | null {
  if (rate === null || rate === undefined) return null
  if (!currency) return String(rate)

  const market = findMarket(currency)

  /*
   * How many decimals to print.
   *
   * The brief is explicit about the two shapes: "1,500 ETB / hour" in Ethiopia and
   * "$20 / hour" internationally. Neither carries decimals, and forcing two onto
   * them reads as false precision — nobody sets a dollar rate to the cent, and
   * "1,500.00 ETB" implies a precision the tutor never claimed.
   *
   * Rounded rather than truncated, so a stored 12.50 shows as 13 rather than 12:
   * the direction that never under-quotes a tutor's time.
   *
   * `maximumFractionDigits` alone, with no minimum, so a rate the tutor *did* enter
   * as 12.50 keeps its decimals and one entered as 12 stays as 12. That is the tutor's
   * precision, not ours.
   */
  const decimals = market?.decimals ?? 2
  const amount = rate.toLocaleString('en-US', {
    maximumFractionDigits: decimals,
  })

  // A market we have never heard of, or one with no stated preference, is written
  // with its code. Inventing a symbol would put a character in front of a price
  // that the platform cannot vouch for.
  //
  // Tested against `!== 'symbol'` rather than `=== 'code'` so that a row added to the
  // registry without saying how it should be written falls on the cautious side.
  // An explicit `'symbol'` is what earns a symbol.
  if (!market || market.priceFormat !== 'symbol') {
    return `${amount} ${currency}`
  }

  const symbol = market.symbol
  return symbol.startsWith('$') ? `${symbol}${amount}` : `${amount} ${symbol}`
}

/**
 * The rate to show, as one line.
 *
 * Returns null when the tutor does not price in the market this listing was priced
 * for. The caller must then say the tutor does not serve this market, or say
 * nothing — rendering "0 USD" would advertise free lessons.
 */
export function primaryRate(tutor: Pick<TutorRates, 'hourlyRate' | 'hourlyRateCurrency'>) {
  return formatRate(tutor.hourlyRate, tutor.hourlyRateCurrency)
}

/**
 * Whether this tutor priced in the market being served.
 *
 * Kept separate from `primaryRate` because "not priced here" is a fact a card can
 * act on — saying so, or offering nothing — while a null rate is only a fact it
 * can render.
 */
export function pricesInMarket(
  tutor: Pick<TutorRates, 'hourlyRate' | 'hourlyRateCurrency'>,
): boolean {
  return tutor.hourlyRate !== null && tutor.hourlyRate !== undefined
}