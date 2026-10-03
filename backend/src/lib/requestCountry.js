/**
 * Reading the visitor's country from infrastructure headers.
 *
 * A tutor's rate is shown in birr or dollars depending on where the visitor is,
 * so the server needs to be able to answer "which market is this?" for a visitor
 * who has never filled in the request form. The client's own choice wins wherever
 * there is one; this is only the fallback.
 *
 * WHY HEADERS RATHER THAN A GEOLOCATION LOOKUP
 *
 * Every hosting platform a product like this ends up on already knows the
 * requester's country — Cloudflare sends `CF-IPCountry`, Vercel and Netlify send
 * `X-Vercel-IP-Country`, Fastly sends `Fastly-Geo-Country-Code`. Reading the one
 * the platform in front of us sets means no third-party request, no API key, no
 * GeoLite2 database, and no extra copy of the visitor's IP address anywhere.
 *
 * Those headers are spoofable, which is exactly why this can only ever decide
 * which of two *real prices* to display. The worst a forged header achieves is
 * showing someone a tutor's dollar rate instead of their birr rate — both of
 * which the tutor published themselves. It cannot invent a price, and it is not
 * used for anything that needs to be authoritative.
 */

/** Headers that hosting platforms use, in order of how much we trust them. */
const COUNTRY_HEADERS = [
  'cf-ipcountry', // Cloudflare
  'x-vercel-ip-country', // Vercel, Netlify
  'fastly-geo-country-code', // Fastly
  'x-geo-country-code', // several others
  'x-country-code', // a plain reverse-proxy convention
]

/** Values a platform sends that mean "we could not work it out". */
const UNKNOWN_VALUES = new Set(['', 'xx', 't1', 'unknown', 'null'])

/**
 * The ISO 3166-1 alpha-2 country code the request came from, if any of the
 * platform headers carries one.
 *
 * Lower-cased, because the headers are inconsistent about case and this is only
 * ever compared against a two-letter code.
 *
 * @param {import('express').Request} req
 * @returns {string | null}
 */
export function countryFromHeaders(req) {
  for (const header of COUNTRY_HEADERS) {
    const value = req.headers[header]
    if (typeof value !== 'string') continue

    const code = value.trim().toLowerCase()
    // A platform that cannot geolocate sends a sentinel rather than omitting the
    // header, so "present" does not mean "known".
    if (code.length !== 2 || UNKNOWN_VALUES.has(code)) continue

    return code
  }

  return null
}