import { beforeEach, describe, expect, it, vi } from 'vitest'

import { patchJson, postJson } from '@/lib/api'
import { __setMarketsForTest } from '@/features/tutors/market'

import { createTutorProfile, updateTutorProfile } from './tutorOnboarding.api'
import type { OnboardingFormData } from './tutorOnboarding.types'

/**
 * How the wizard sends a tutor's prices.
 *
 * The rate contract is the one part of the wizard that is not a local type
 * question. A tutor types two numbers on step 7 and, several requests later, the
 * directory shows one of them to a learner in one currency. Every step in between
 * has to be right, and the only place it can be checked is here — at the wire.
 *
 * The rule these tests protect: each market's number is the tutor's own, sent
 * separately, and nothing anywhere derives one from another.
 */

vi.mock('@/lib/api', () => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
  patchJson: vi.fn(),
  postFile: vi.fn(),
  deleteJson: vi.fn(),
}))

const postMock = vi.mocked(postJson)
const patchMock = vi.mocked(patchJson)

/** A minimal draft, with the rates under test. */
function form(rates: Record<string, string>): Partial<OnboardingFormData> {
  return {
    displayName: 'Ada',
    headline: 'Mathematics',
    bio: 'I teach mathematics.',
    rates,
  }
}

/** The payload the last create/patch call sent. */
function lastPayload(): Record<string, unknown> {
  return (postMock.mock.calls.at(-1)?.[1] ?? patchMock.mock.calls.at(-1)?.[1]) as Record<
    string,
    unknown
  >
}

beforeEach(() => {
  postMock.mockReset().mockResolvedValue({ id: 'p1' })
  patchMock.mockReset().mockResolvedValue({ id: 'p1' })
  __setMarketsForTest(null)
})

describe('sending prices', () => {
  it('sends one rate per market, keyed by market code', async () => {
    await createTutorProfile(form({ ETB: '900', USD: '12' }))

    expect(lastPayload().rates).toEqual({ ETB: 900, USD: 12 })
  })

  it('never derives one market from another', async () => {
    // The whole point of the product: 900 birr and 12 dollars are two prices the
    // tutor chose. Anything that computed the second from the first would be
    // quoting a rate nobody agreed to.
    await createTutorProfile(form({ ETB: '900', USD: '12' }))

    const rates = lastPayload().rates as Record<string, number>
    expect(rates.ETB).toBe(900)
    expect(rates.USD).toBe(12)
  })

  it('sends null for a market the tutor left blank, so they can take a price down', async () => {
    // Omitting the key would leave the stored price in place, and the tutor would
    // have no way to withdraw it.
    await updateTutorProfile(form({ ETB: '900', USD: '' }))

    expect(lastPayload().rates).toEqual({ ETB: 900, USD: null })
  })

  it('treats a whitespace-only field as blank rather than as zero', async () => {
    // A field the tutor tabbed through still holds a space. Reading that as 0
    // would store a free lesson they never offered.
    await createTutorProfile(form({ ETB: '  ' }))

    expect(lastPayload().rates).toEqual({ ETB: null })
  })

  it('parses the tutor\'s own number, not a rounded or converted one', async () => {
    await createTutorProfile(form({ ETB: '750.50', USD: '9.99' }))

    expect(lastPayload().rates).toEqual({ ETB: 750.5, USD: 9.99 })
  })

  it('sends whatever markets the platform offers, without knowing their names', async () => {
    // A third market is a row in the backend's `markets` table. The wizard used to
    // name ETB and USD in this file, so adding one meant editing the payload, the
    // form type and two components.
    __setMarketsForTest([
      { code: 'ETB', name: 'Ethiopia', currencyName: 'Ethiopian Birr', symbol: 'Br', decimals: 2, isDefault: false },
      { code: 'USD', name: 'International', currencyName: 'US Dollar', symbol: '$', decimals: 2, isDefault: true },
      { code: 'EUR', name: 'Europe', currencyName: 'Euro', symbol: '€', decimals: 2, isDefault: false },
    ])

    await createTutorProfile(form({ EUR: '20' }))

    expect(lastPayload().rates).toEqual({ EUR: 20 })
  })

  it('sends no rates at all when the step has not been reached', async () => {
    // The wizard creates the draft at step 1 and collects prices at step 7, so most
    // saves legitimately have nothing to say about them.
    await createTutorProfile({ displayName: 'Ada' })

    expect(lastPayload()).not.toHaveProperty('rates')
  })

  it('omits rates from a patch that does not mention them', async () => {
    // Omitting a key means "I am not changing it". Sending an empty map instead
    // would read as "I priced nothing", and would wipe a tutor's prices because
    // they edited their headline.
    await updateTutorProfile({ headline: 'A new headline' })

    expect(lastPayload()).not.toHaveProperty('rates')
    expect(lastPayload().headline).toBe('A new headline')
  })
})