import { getJson } from '@/lib/api'

/**
 * The public subject catalogue.
 *
 * `GET /api/subjects` is public and read-only. It returns a flat, unpaginated
 * list, so it is fetched once and filtered in the browser — a catalogue of a few
 * dozen subjects does not need pagination, and asking for it would mean adding a
 * shape the endpoint does not have.
 *
 * This client is deliberately thin. There is no admin endpoint that writes to
 * subjects, so there is nothing here to create, update or deactivate.
 */
export interface SubjectOption {
  id: string
  name: string
  slug: string
  category: string
}

/** The active subjects, which is the default the endpoint applies. */
export function fetchPublicSubjects(): Promise<SubjectOption[]> {
  return getJson<SubjectOption[]>('/api/subjects')
}
