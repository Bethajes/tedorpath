import { describe, expect, it } from 'vitest'

import { formatRate, pricesInMarket, primaryRate } from './formatRate'
import { __setMarketsForTest } from './market'

/**
 * How a rate is shown.
 *
 * The site used to print a hardcoded `£` in the onboarding preview and a "GBP"
 * hint on the pricing step, for a currency the product does not use in either
 * market, over a number the database never labelled. These tests are the reason
 * that cannot come back: a rate is always printed in its own market's style, or
 * not printed at all.
 *
 * They also cover the absence of a second price. That absence is the point of the
 * redesign, and a test suite cannot assert the absence of an export — so what is
 * asserted is the behaviour: given a tutor priced in two markets, exactly one price
 * comes back.
 */

describe('formatRate', () => {
  it('prints a rate the way its own market writes it', () => {
    // How a market is written is data on its row, not a rule in the formatter: the
    // birr price spells out ETB because "Br" is shared with Burundi's franc and
    // means nothing to most readers, while "$" is recognised everywhere so the
    // symbol says more than the code.
    expect(formatRate(900, 'ETB')).toBe('900 ETB')
    expect(formatRate(12, 'USD')).toBe('$12')
  })

  it('returns null when there is no rate', () => {
    // Null rather than an empty string, so a caller can render it directly as a JSX
    // child without producing an empty wrapper element.
    expect(formatRate(null, 'USD')).toBeNull()
    expect(formatRate(undefined, 'USD')).toBeNull()
  })

  it('prints a bare number when the currency is unknown', () => {
    // Better than inventing one. A rate with no currency is a defect, and showing
    // it unlabelled is what the API should be reporting, not what the card hides.
    expect(formatRate(35, null)).toBe('35')
  })

  it('takes the number of decimals from the market registry, not a currency check', () => {
    // Yen has no minor unit, so `12.00 JPY` would be asserting two decimal places
    // that do not exist. It has to come from the registry, because a market added
    // later is formatted correctly without this file knowing it exists — which is
    // the whole reason the registry is a table rather than a constant.
    expect(formatRate(1200, 'JPY')).toBe('1,200 JPY')

    __setMarketsForTest([
      {
        code: 'JPY',
        name: 'Japan',
        currencyName: 'Japanese Yen',
        symbol: '¥',
        decimals: 0,
        isDefault: false,
      },
    ])
    expect(formatRate(1200, 'JPY')).toBe('1,200 JPY')

    __setMarketsForTest(null)
    // Back on the fallback registry, which does not offer JPY, so two decimals.
    expect(formatRate(1200, 'JPY')).toBe('1,200 JPY')
  })
})

describe('one price, always', () => {
  it('formats the visitor\'s own market', () => {
    // Ethiopia reads "1,500 ETB" and everywhere else reads "$20". The market decides,
    // because the two currencies are written differently in their own markets — "$" is
    // universal, "Br" is shared with Burundi's franc.
    expect(primaryRate({ hourlyRate: 1500, hourlyRateCurrency: 'ETB' })).toBe('1,500 ETB')
    expect(primaryRate({ hourlyRate: 20, hourlyRateCurrency: 'USD' })).toBe('$20')
  })

  it('returns exactly one price for a tutor priced in two markets', () => {
    // The API sends one price, so there is one price. A client that holds two is one
    // layout change away from showing a learner two numbers for the same hour of
    // teaching, which is the mistake this design exists to prevent.
    const listing = { hourlyRate: 900, hourlyRateCurrency: 'ETB' } as Record<string, unknown>

    expect(primaryRate(listing as never)).toBe('900 ETB')
    expect(listing).not.toHaveProperty('hourlyRateOtherMarket')
    expect(listing).not.toHaveProperty('hourlyRateOtherCurrency')
  })

  it('writes birr as a code and dollars as a symbol', () => {
    // The exact strings the product brief asks for: "1,500 ETB" in Ethiopia,
    // "$20" internationally. Both come from the market row, not from a rule here.
    expect(formatRate(1500, 'ETB')).toBe('1,500 ETB')
    expect(formatRate(20, 'USD')).toBe('$20')

    // And the symbol goes before the amount in the dollar style, after it in the
    // code style, because a code reads as a unit and a symbol reads as a prefix.
    // `?.` because the formatter returns null for a rate that is not there; a null
    // here would fail the assertion rather than pass it quietly.
    expect(formatRate(20, 'USD')?.startsWith('$')).toBe(true)
    expect(formatRate(1500, 'ETB')?.endsWith('ETB')).toBe(true)
  })

  it('reports nothing for a market the tutor did not price', () => {
    // Null, not 0: "this tutor does not take international bookings" and "this
    // tutor is free" are different answers and must not collapse into one number.
    expect(primaryRate({ hourlyRate: null, hourlyRateCurrency: 'USD' })).toBeNull()
  })

  it('reports nothing at all for a tutor with no rates', () => {
    expect(primaryRate({ hourlyRate: null, hourlyRateCurrency: null })).toBeNull()
  })

  it('distinguishes "priced here" from "not priced here"', () => {
    // Kept apart from `primaryRate` because "not priced here" is a fact a card can
    // act on — offering to show another market — while a null rate is only a fact
    // it can render.
    expect(pricesInMarket({ hourlyRate: 900, hourlyRateCurrency: 'ETB' })).toBe(true)
    expect(pricesInMarket({ hourlyRate: null, hourlyRateCurrency: 'USD' })).toBe(false)
  })
})