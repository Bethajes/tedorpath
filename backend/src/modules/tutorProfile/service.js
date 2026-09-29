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
      teachingMode: data.teachingMode,
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
 * Requirements: 6.3, 6.4
 * - Partial update (only specified fields)
 * - Verifies ownership server-side
 *
 * @param {string} userId - User ID requesting the update
 * @param {object} data - Validated partial update data
 * @returns {Promise<{success: true, data: object}|{success: false, code: string, message: string}>}
 */
export async function updateTutorProfile(userId, data) {
  try {
    // First, verify the profile exists and belongs to the user
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

    // Requirements 6.4: ownership is verified by userId lookup above
    // Build update data
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
 * Submit a tutor profile for review.
 *
 * Requirements: 6.6, 6.7
 * - Validates completeness (displayName, headline, bio, ≥1 subject, ≥1 level, teachingMode, hourlyRate)
 * - Transitions to PENDING_REVIEW if complete
 * - Returns 422 with missing field list if incomplete
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

    // Check if profile is already in a non-DRAFT state
    if (profile.profileStatus !== 'DRAFT') {
      return {
        success: false,
        code: 'INVALID_STATUS',
        message: `Profile cannot be submitted from ${profile.profileStatus} status.`,
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

    // Update profile status to PENDING_REVIEW
    const updatedProfile = await prisma.tutorProfile.update({
      where: { userId },
      data: {
        profileStatus: 'PENDING_REVIEW',
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

    return {
      success: true,
      data: {
        id: updatedProfile.id,
        profileStatus: updatedProfile.profileStatus,
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