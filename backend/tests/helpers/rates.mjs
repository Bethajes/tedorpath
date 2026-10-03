/**
 * Rate fixtures for tutor profiles.
 *
 * Tests keep writing `hourlyRateEtb` and `hourlyRateUsd` in a fixture override
 * because that reads better at the call site than a nested `create`, and because
 * the profile API still accepts that shape — so the translation into rate rows
 * lives here, once, instead of being repeated in every fixture helper.
 *
 * The alternative — rewriting every call site to
 * `rates: { create: [{ marketCode: 'USD', amount: 20 }] }` — would make each test
 * say more about the storage shape than about the thing being tested.
 */

/**
 * The rate rows a fixture override implies.
 *
 * A market left `undefined` or `null` writes no row at all, which is the same
 * thing a tutor declining that market means. That matters for the sorting and
 * filtering tests: "priced in USD" and "priced at zero in USD" are different
 * states, and only one of them should ever appear in a result set.
 *
 * @param {{hourlyRateEtb?: number|null, hourlyRateUsd?: number|null}} [overrides]
 * @returns {Array<{marketCode: string, amount: number}>}
 */
export function rateRows(overrides = {}) {
  const rows = []

  for (const [marketCode, key] of [
    ['ETB', 'hourlyRateEtb'],
    ['USD', 'hourlyRateUsd'],
  ]) {
    const amount = overrides[key]
    if (amount === null || amount === undefined) continue
    rows.push({ marketCode, amount })
  }

  return rows
}

/**
 * The same rows in the nested shape `prisma.tutorProfile.create` wants.
 *
 * Returns `undefined` rather than `{ create: [] }` when there is nothing to write,
 * because an empty nested create is not the same request as no nested create and
 * the difference should not depend on how a test spelled its fixture.
 *
 * @param {object} [overrides]
 * @returns {{create: Array<{marketCode: string, amount: number}>} | undefined}
 */
export function ratesFor(overrides = {}) {
  const rows = rateRows(overrides)
  return rows.length > 0 ? { create: rows } : undefined
}

/**
 * The override object with the rate keys removed.
 *
 * Needed wherever a fixture does `...overrides` straight into a create: the keys
 * are not columns any more, and passing them through would make Prisma reject the
 * whole insert rather than silently ignore them.
 *
 * @template T
 * @param {T} overrides
 * @returns {Omit<T, 'hourlyRateEtb' | 'hourlyRateUsd'>}
 */
export function withoutRates(overrides) {
  const { hourlyRateEtb, hourlyRateUsd, ...rest } = overrides ?? {}
  return rest
}

/**
 * Prices several tutors at once in one market.
 *
 * For the sorting and range-filter tests, where the interesting fact is the
 * *relative* price of a group rather than any one tutor's rate.
 *
 * @param {Array<{market: string, amount: number|null, overrides?: object}>} specs
 * @param {(spec: object) => Promise<object>} seed
 *   The file's own profile factory, so a fixture can be created however that suite
 *   creates one.
 */
export async function seedPrices(specs, seed) {
  for (const spec of specs) {
    await seed({
      displayName: spec.overrides?.displayName,
      [spec.market === 'ETB' ? 'hourlyRateEtb' : 'hourlyRateUsd']: spec.amount,
      ...spec.overrides,
    })
  }
}