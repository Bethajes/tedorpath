import { prisma } from '../../lib/prisma.js'
import { validateProfileCompleteness } from './validation.js'

/**
 * TutorProfile service layer.
 *
 * Handles business logic for tutor profile management.
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */

/**
 * Create a new tutor profile for a user.
 *
 * Requirements: 6.1, 6.2
 * - Creates profile with profileStatus: DRAFT
 * - Returns 409 if profile already exists for userId
 *
 * @param {string} userId - User ID creating the profile
 * @param {object} data - Validated profile data from validation.js
 * @returns {Promise<{success: true, data: object}|{success: false, code: string, message: string, fields?: Array<string>}>}
 */
export async function createTutorProfile(userId, data) {
  try {
    // Check if user already has a profile
    const existingProfile = await prisma.tutorProfile.findUnique({
      where: { userId },
    })

    if (existingProfile) {
      return {
        success: false,
        code: 'PROFILE_ALREADY_EXISTS',
        message: 'User already has a tutor profile.',
      }
    }

    // Prepare data for creation
    const profileData = {
      userId,
      displayName: data.displayName,
      headline: data.headline,
      bio: data.bio,
      location: data.location,
      profilePhotoUrl: data.profilePhotoUrl,
      // Default to ONLINE so the NOT NULL DB column is always satisfied.
      // The real value is collected in step 4 and updated via PATCH.
      teachingMode: data.teachingMode || 'ONLINE',
      studentLevels: data.studentLevels || [],
      languages: data.languages || ['English'],
      availability: data.availability,
      hourlyRate: data.hourlyRate,
      experience: data.experience,
      education: data.education,
      // Always start as DRAFT per requirements 2.3, 2.4, 6.1
      profileStatus: 'DRAFT',
      verificationStatus: 'UNVERIFIED',
    }

    // Create the profile with subjects if provided
    const createData = {
      ...profileData,
    }

    if (data.subjectIds && data.subjectIds.length > 0) {
      createData.subjects = {
        create: data.subjectIds.map((subjectId) => ({
          subject: { connect: { id: subjectId } },
        })),
      }
    }

    const profile = await prisma.tutorProfile.create({
      data: createData,
      include: {
        subjects: {
          include: {
            subject: true,
          },
        },
      },
    })

    return {
      success: true,
      data: {
        id: profile.id,
        displayName: profile.displayName,
        headline: profile.headline,
        bio: profile.bio,
        location: profile.location,
        profilePhotoUrl: profile.profilePhotoUrl,
        teachingMode: profile.teachingMode,
        studentLevels: profile.studentLevels,
        languages: profile.languages,
        availability: profile.availability,
        hourlyRate: profile.hourlyRate,
        experience: profile.experience,
        education: profile.education,
        profileStatus: profile.profileStatus,
        verificationStatus: profile.verificationStatus,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        subjects: profile.subjects.map((ps) => ps.subject),
      },
    }
  } catch (error) {
    console.error('Error creating tutor profile:', error)
    return {
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Failed to create tutor profile.',
    }
  }
}

/**
 * Update a tutor profile.
 *
 * Requirements 6.3, 6.4
 * - Partial update (only specified fields)
 * - Verifies ownership server-side: the target is always derived from the
 *   session user, never from the request body. A `userId` in the body is only
 *   an assertion of intent; if it names somebody else the request is refused
 *   with FORBIDDEN rather than quietly redirected at the caller's own profile.
 *
 * @param {string} userId - Authenticated user ID from the session
 * @param {object} data - Validated partial update data
 * @returns {Promise<{success: true, data: object}|{success: false, code: string, message: string}>}
 */
export async function updateTutorProfile(userId, data) {
  try {
    // Requirement 6.4: refuse a tampered identifier before touching the database.
    if (data.userId !== undefined && data.userId !== userId) {
      return {
        success: false,
        code: 'FORBIDDEN',
        message: 'You can only update your own tutor profile.',
      }
    }

    // Ownership is established by the lookup key itself: the profile addressed
    // is always the one owned by the session user.
    const profile = await prisma.tutorProfile.findUnique({
      where: { userId },
      include: {
        subjects: {
          include: {
            subject: true,
          },
        },
      },
    })

    if (!profile) {
      return {
        success: false,
        code: 'PROFILE_NOT_FOUND',
        message: 'Tutor profile not found.',
      }
    }

    // Build update data. Fields are listed explicitly so that neither the
    // client-supplied `userId` nor any unrecognised key can reach the update.
    const updateData = {
      displayName: data.displayName,
      headline: data.headline,
      bio: data.bio,
      location: data.location,
      profilePhotoUrl: data.profilePhotoUrl,
      teachingMode: data.teachingMode,
      studentLevels: data.studentLevels,
      languages: data.languages,
      availability: data.availability,
      hourlyRate: data.hourlyRate,
      experience: data.experience,
      education: data.education,
    }

    // Remove undefined fields (partial update)
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key]
      }
    })

    // Handle subjects if provided
    if (data.subjectIds !== undefined) {
      // First, disconnect all existing subjects
      await prisma.tutorProfileSubject.deleteMany({
        where: { tutorProfileId: profile.id },
      })

      // Then connect new subjects if any
      if (data.subjectIds.length > 0) {
        updateData.subjects = {
          create: data.subjectIds.map((subjectId) => ({
            subject: { connect: { id: subjectId } },
          })),
        }
      }
    }

    const updatedProfile = await prisma.tutorProfile.update({
      where: { userId },
      data: updateData,
      include: {
        subjects: {
          include: {
            subject: true,
          },
        },
      },
    })

    return {
      success: true,
      data: {
        id: updatedProfile.id,
        displayName: updatedProfile.displayName,
        headline: updatedProfile.headline,
        bio: updatedProfile.bio,
        location: updatedProfile.location,
        profilePhotoUrl: updatedProfile.profilePhotoUrl,
        teachingMode: updatedProfile.teachingMode,
        studentLevels: updatedProfile.studentLevels,
        languages: updatedProfile.languages,
        availability: updatedProfile.availability,
        hourlyRate: updatedProfile.hourlyRate,
        experience: updatedProfile.experience,
        education: updatedProfile.education,
        profileStatus: updatedProfile.profileStatus,
        verificationStatus: updatedProfile.verificationStatus,
        createdAt: updatedProfile.createdAt,
        updatedAt: updatedProfile.updatedAt,
        subjects: updatedProfile.subjects.map((ps) => ps.subject),
      },
    }
  } catch (error) {
    console.error('Error updating tutor profile:', error)
    return {
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Failed to update tutor profile.',
    }
  }
}

/**
 * Get the authenticated user's tutor profile.
 *
 * Requirements: 6.5
 * - Returns full profile including draft fields
 *
 * @param {string} userId - User ID
 * @returns {Promise<{success: true, data: object}|{success: false, code: string, message: string}>}
 */
export async function getMyTutorProfile(userId) {
  try {
    const profile = await prisma.tutorProfile.findUnique({
      where: { userId },
      include: {
        subjects: {
          include: {
            subject: true,
          },
        },
      },
    })

    if (!profile) {
      return {
        success: false,
        code: 'PROFILE_NOT_FOUND',
        message: 'Tutor profile not found.',
      }
    }

    return {
      success: true,
      data: {
        id: profile.id,
        displayName: profile.displayName,
        headline: profile.headline,
        bio: profile.bio,
        location: profile.location,
        profilePhotoUrl: profile.profilePhotoUrl,
        teachingMode: profile.teachingMode,
        studentLevels: profile.studentLevels,
        languages: profile.languages,
        availability: profile.availability,
        hourlyRate: profile.hourlyRate,
        experience: profile.experience,
        education: profile.education,
        profileStatus: profile.profileStatus,
        verificationStatus: profile.verificationStatus,
        // Moderation feedback for the applicant. These are written only by the
        // admin API and read back only by the tutor who owns the profile, so
        // returning them here is safe: the status page needs the reference
        // number, and on REJECTED or NEEDS_INFORMATION the reason and the
        // admin's message are what the tutor has to act on.
        // Requirements: 20.3, 21.5, 21.6, 22.7
        applicationReference: profile.applicationReference,
        rejectionReason: profile.rejectionReason,
        adminMessage: profile.adminMessage,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        subjects: profile.subjects.map((ps) => ps.subject),
      },
    }
  } catch (error) {
    console.error('Error fetching tutor profile:', error)
    return {
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch tutor profile.',
    }
  }
}

/**
 * Generate an application reference in the format TT-YYYY-NNNNNN.
 *
 * Must be called inside a Prisma transaction so that the count + write is
 * atomic and concurrent submissions cannot produce duplicate references.
 *
 * @param {object} tx - Prisma transaction client
 * @returns {Promise<string>}
 */
async function generateApplicationReference(tx) {
  const year = new Date().getFullYear()
  const prefix = `TT-${year}-`

  // Count profiles that already have a reference for this year
  const count = await tx.tutorProfile.count({
    where: {
      applicationReference: {
        startsWith: prefix,
      },
    },
  })

  const seq = String(count + 1).padStart(6, '0')
  return `${prefix}${seq}`
}

/**
 * Submit a tutor profile for review.
 *
 * Requirements: 6.6, 6.7, 20.1, 20.2, 20.5, 20.6, 25.4, 25.5, 28.4, 28.5, 28.6
 * - Accepts profileStatus in ['DRAFT', 'REJECTED', 'NEEDS_INFORMATION']
 * - Returns ALREADY_UNDER_REVIEW for PENDING_REVIEW
 * - Returns ALREADY_APPROVED for APPROVED
 * - Generates applicationReference (TT-YYYY-NNNNNN) on first submission
 * - Retains existing applicationReference on resubmission
 * - Validates completeness before transitioning to PENDING_REVIEW
 *
 * @param {string} userId - User ID
 * @returns {Promise<{success: true, data: object}|{success: false, code: string, message: string, fields?: Array<string>}>}
 */
export async function submitTutorProfile(userId) {
  try {
    // Get full profile with subjects
    const profile = await prisma.tutorProfile.findUnique({
      where: { userId },
      include: {
        subjects: {
          include: {
            subject: true,
          },
        },
      },
    })

    if (!profile) {
      return {
        success: false,
        code: 'PROFILE_NOT_FOUND',
        message: 'Tutor profile not found.',
      }
    }

    // Guard: only DRAFT, REJECTED, and NEEDS_INFORMATION may submit
    if (profile.profileStatus === 'PENDING_REVIEW') {
      return {
        success: false,
        code: 'ALREADY_UNDER_REVIEW',
        message: 'Profile is already under review.',
      }
    }

    if (profile.profileStatus === 'APPROVED') {
      return {
        success: false,
        code: 'ALREADY_APPROVED',
        message: 'Profile is already approved.',
      }
    }

    if (profile.profileStatus === 'SUSPENDED') {
      return {
        success: false,
        code: 'INVALID_STATUS',
        message: 'Suspended profiles cannot be resubmitted.',
      }
    }

    // Validate completeness
    const missingFields = validateProfileCompleteness({
      displayName: profile.displayName,
      headline: profile.headline,
      bio: profile.bio,
      teachingMode: profile.teachingMode,
      hourlyRate: profile.hourlyRate,
      subjects: profile.subjects,
      studentLevels: profile.studentLevels,
    })

    if (missingFields.length > 0) {
      return {
        success: false,
        code: 'INCOMPLETE_PROFILE',
        message: 'Profile does not meet minimum completeness requirements.',
        fields: missingFields,
      }
    }

    // Wrap the reference generation and status update in a transaction so
    // concurrent submissions cannot produce duplicate references.
    const updatedProfile = await prisma.$transaction(async (tx) => {
      // Generate a reference only if one does not already exist
      let applicationReference = profile.applicationReference
      if (!applicationReference) {
        applicationReference = await generateApplicationReference(tx)
      }

      return tx.tutorProfile.update({
        where: { userId },
        data: {
          profileStatus: 'PENDING_REVIEW',
          applicationReference,
          updatedAt: new Date(),
        },
        include: {
          subjects: {
            include: {
              subject: true,
            },
          },
        },
      })
    })

    return {
      success: true,
      data: {
        id: updatedProfile.id,
        profileStatus: updatedProfile.profileStatus,
        applicationReference: updatedProfile.applicationReference,
        updatedAt: updatedProfile.updatedAt,
      },
    }
  } catch (error) {
    console.error('Error submitting tutor profile:', error)
    return {
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Failed to submit tutor profile.',
    }
  }
}