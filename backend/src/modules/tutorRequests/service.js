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
 */
export async function createTutorRequest(data, { userId = null } = {}) {
  const record = await prisma.tutorRequest.create({
    data: {
      userId,
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
