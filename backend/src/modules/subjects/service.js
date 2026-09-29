import { prisma } from '../../lib/prisma.js'

/**
 * Subjects service layer.
 *
 * Subjects are public reference data: the tutor directory filters, the
 * onboarding subject picker and the preview step all need the list, and none of
 * them expose anything private about a subject.
 */

/**
 * Field selection for a subject option. `description` and `active` are left out
 * because the option list is a compact picker, not a catalogue.
 */
const SUBJECT_SELECT = {
  id: true,
  name: true,
  slug: true,
  category: true,
}

/**
 * Translate the validated `active` scope into a Prisma `where` clause.
 *
 * @param {'active' | 'inactive' | 'all'} scope
 */
function scopeToWhere(scope) {
  if (scope === 'all') return undefined
  return { active: scope === 'active' }
}

/**
 * List subjects for the pickers (onboarding step 2, directory filters).
 *
 * The default scope is active subjects only: a subject an operator has
 * deactivated must disappear from every picker rather than be offered to a
 * tutor and then rejected. Admin tooling can widen the scope with the `active`
 * query parameter.
 *
 * Ordering is category-then-name so the picker renders in a stable order and
 * the category grouping the frontend does client-side is deterministic.
 *
 * @param {{ active?: 'active' | 'inactive' | 'all' }} [options]
 * @returns {Promise<Array<{id: string, name: string, slug: string, category: string}>>}
 */
export async function listSubjects({ active = 'active' } = {}) {
  return prisma.subject.findMany({
    where: scopeToWhere(active),
    select: SUBJECT_SELECT,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })
}
