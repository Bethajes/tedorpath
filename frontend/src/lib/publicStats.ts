/**
 * How a public statistic is turned into words.
 *
 * Shared rather than copied, because the rule is an honesty rule and a second
 * copy of it is a second chance to get it wrong: a count is printed only when
 * the API returned a positive integer for it, and every other case — the
 * request still in flight, a failed request, a zero marketplace, a malformed
 * payload — resolves to wording instead of a figure.
 *
 * "Growing community" is defensible on an empty platform. "0 tutors" reads as a
 * dead one, and a rounded-up alternative would be a number nobody has earned.
 *
 * Requirement 4.2, 4.3 and 14.5.
 */
export function statDisplayValue(count: number | undefined, fallback: string): string {
  if (typeof count === 'number' && Number.isInteger(count) && count > 0) {
    // Rendered as written rather than through `toLocaleString`: a thousands
    // separator would put "1,234" in the DOM where the API said "1234", and the
    // displayed figure should be the count itself, not a reformatting of it.
    return String(count)
  }

  return fallback
}
