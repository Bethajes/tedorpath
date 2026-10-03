/**
 * IANA timezone validation.
 *
 * The wizard stores the timezone a client's availability is expressed in, and
 * never converts it. That makes this check the only thing standing between a
 * typo and a column of unusable scheduling data, so it has to accept every real
 * zone the runtime knows about and reject everything else.
 *
 * `Intl.DateTimeFormat` is the authority rather than a bundled list: the
 * runtime's own timezone database is the one `Intl` will actually be able to
 * format the stored value with later, so anything that passes here is something
 * the rest of the stack can also handle.
 */

/**
 * @param {unknown} value
 * @returns {boolean} true when `value` is an IANA identifier this runtime accepts
 */
export function isValidTimeZone(value) {
  if (typeof value !== 'string' || value.trim() === '') return false

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}