import { prisma } from '../../lib/prisma.js'

/**
 * Database access for tutor requests.
 *
 * Maps the API field names onto the stored columns. The service returns only
 * the new id — the full record (which contains personal contact details) is
 * never echoed back to the client.
 */
export async function createTutorRequest(data) {
  const record = await prisma.tutorRequest.create({
    data: {
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
