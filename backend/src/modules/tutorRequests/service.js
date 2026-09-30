import { prisma } from '../../lib/prisma.js'

/**
 * Database access for tutor requests.
 *
 * Maps the API field names onto the stored columns. The service returns only
 * the new id — the full record (which contains personal contact details) is
 * never echoed back to the client.
 *
 * `options.userId` links the request to a signed-in account when the visitor
 * has one. It is optional on purpose: anonymous requests are the norm today.
 *
 * `data.tutorProfileId` is the optional link to a specific tutor the client
 * chose from the directory. It is verified rather than trusted, but only for
 * existence: the client's choice is honoured whatever the profile's status is,
 * because deciding what is contactable is moderation's job, not the form's.
 */

/** Thrown for a tutorProfileId that is well-formed but points at nothing. */
export const TUTOR_PROFILE_NOT_FOUND = 'TUTOR_PROFILE_NOT_FOUND'

export async function createTutorRequest(data, { userId = null } = {}) {
  const tutorProfileId = data.tutorProfileId ?? null

  if (tutorProfileId) {
    // Existence only — no status filter, by design. Selecting just the id also
    // keeps this from pulling the tutor's contact details into a hot path.
    const profile = await prisma.tutorProfile.findUnique({
      where: { id: tutorProfileId },
      select: { id: true },
    })

    if (!profile) {
      const error = new Error('Referenced tutor profile does not exist.')
      error.code = TUTOR_PROFILE_NOT_FOUND
      throw error
    }
  }

  const record = await prisma.tutorRequest.create({
    data: {
      userId,
      tutorProfileId,
      fullName: data.fullName,
      phone: data.phone,
      telegramUsername: data.telegram ?? null,
      email: data.email ?? null,
      subject: data.subject,
      educationLevel: data.educationLevel,
      description: data.helpDescription,
      learningMode: data.learningMode,
      location: data.preferredLocation ?? null,
      preferredDays: data.preferredDays ?? null,
      preferredTime: data.preferredTime ?? null,
      budget: data.budget ?? null,
      additionalInfo: data.additionalInfo ?? null,
      // status defaults to NEW in the schema; adminNotes stays null.
    },
    select: { id: true },
  })

  return record
}
