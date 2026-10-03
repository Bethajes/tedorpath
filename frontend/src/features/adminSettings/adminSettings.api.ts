/**
 * API client for the homepage statistics settings screen.
 *
 * Goes through the shared admin session, so the backend's `requireAdmin` guard
 * applies to every call here. There is no client-side permission question to
 * answer — the server decides.
 *
 * Reads and writes go to the same path: the PATCH answers with the same shape
 * the GET does, so the screen renders the server's view of what it just saved
 * rather than a local guess that could disagree with the database.
 */

import { getJson, patchJson } from '@/lib/api'

import type { SiteStatsSettings, SiteStatsUpdate } from './adminSettings.types'

const BASE_PATH = '/api/admin/site-stats'

/** Live counts, stored overrides and the figures currently being published. */
export function fetchSiteStats(): Promise<SiteStatsSettings> {
  return getJson<SiteStatsSettings>(BASE_PATH)
}

/**
 * Saves overrides.
 *
 * `null` in the body clears that figure's override; a key left out is not
 * touched, so a save of one figure cannot reset the other three.
 */
export function updateSiteStats(update: SiteStatsUpdate): Promise<SiteStatsSettings> {
  return patchJson<SiteStatsSettings>(BASE_PATH, update)
}
