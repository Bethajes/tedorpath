/**
 * API wrappers for the tutor onboarding flow.
 *
 * Wraps:
 *  - POST   /api/tutor-profile        create a new draft profile
 *  - PATCH  /api/tutor-profile        update own draft profile
 *  - GET    /api/tutor-profile/me     load own profile (draft-inclusive)
 *  - POST   /api/tutor-profile/submit submit profile for review
 *
 * Requirements: 6.1, 6.2, 6.3, 6.5, 6.6, 6.7, 11.3, 11.4
 */

import { getJson, patchJson, postJson, postFile, deleteJson } from '@/lib/api'
import type { MyTutorProfile, OnboardingFormData } from './tutorOnboarding.types'

const PROFILE_PATH = '/api/tutor-profile'

/**
 * Converts the form's flat data into the shape the API expects.
 *
 * `hourlyRate` is submitted as a number (or null when the string is blank).
 * `languages` is split on commas so the user can type "English, French".
 */
function toApiPayload(data: Partial<OnboardingFormData>): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  if (data.displayName !== undefined) payload.displayName = data.displayName
  if (data.headline !== undefined) payload.headline = data.headline
  if (data.bio !== undefined) payload.bio = data.bio
  if (data.location !== undefined) payload.location = data.location || null
  if (data.profilePhotoUrl !== undefined) payload.profilePhotoUrl = data.profilePhotoUrl || null
  if (data.teachingMode !== undefined && data.teachingMode !== '') {
    payload.teachingMode = data.teachingMode
  }
  if (data.studentLevels !== undefined) payload.studentLevels = data.studentLevels
  if (data.subjectIds !== undefined) payload.subjectIds = data.subjectIds
  if (data.experience !== undefined) payload.experience = data.experience || null
  if (data.education !== undefined) payload.education = data.education || null
  if (data.availability !== undefined) payload.availability = data.availability || null

  if (data.hourlyRate !== undefined) {
    const parsed = parseFloat(data.hourlyRate)
    payload.hourlyRate = isNaN(parsed) ? null : parsed
  }

  if (data.languages !== undefined) {
    const langs = data.languages
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean)
    payload.languages = langs.length > 0 ? langs : ['English']
  }

  return payload
}

/**
 * Create a new draft TutorProfile. Returns 409 if one already exists.
 * Requirement 6.1
 */
export function createTutorProfile(data: Partial<OnboardingFormData>): Promise<MyTutorProfile> {
  return postJson<MyTutorProfile>(PROFILE_PATH, toApiPayload(data))
}

/**
 * Partially update the authenticated user's TutorProfile.
 * Requirement 6.3
 */
export function updateTutorProfile(data: Partial<OnboardingFormData>): Promise<MyTutorProfile> {
  return patchJson<MyTutorProfile>(PROFILE_PATH, toApiPayload(data))
}

/**
 * Load the authenticated user's own TutorProfile, including DRAFT fields.
 * Returns null via ApiError NOT_FOUND when no profile exists yet.
 * Requirement 6.5
 */
export function getMyTutorProfile(): Promise<MyTutorProfile> {
  return getJson<MyTutorProfile>(`${PROFILE_PATH}/me`)
}

/**
 * Submit the authenticated user's profile for admin review.
 * Returns 422 with missing field list when completeness requirements are not met.
 * Requirement 6.6, 6.7
 */
export function submitTutorProfile(): Promise<MyTutorProfile> {
  return postJson<MyTutorProfile>(`${PROFILE_PATH}/submit`, {})
}

/** The server's answer to a photo upload. */
export interface PhotoUploadResult {
  /** Path of the stored photo, to be saved on the profile. */
  profilePhotoUrl: string
  type: string
  bytes: number
}

/**
 * Upload a profile photo from the user's device and record it on the profile.
 *
 * The file is sent as multipart rather than as a data URL: a base64 payload
 * would inflate the image by a third and has to fit in a JSON column, whereas
 * the server stores the bytes once and returns a path.
 *
 * Rejects with an `ApiError` carrying the server's reason, which is what the
 * picker shows the user.
 */
export function uploadProfilePhoto(file: File): Promise<PhotoUploadResult> {
  return postFile<PhotoUploadResult>(`${PROFILE_PATH}/photo`, file, 'photo')
}

/** Remove the current profile photo. */
export function deleteProfilePhoto(): Promise<{ profilePhotoUrl: null }> {
  return deleteJson<{ profilePhotoUrl: null }>(`${PROFILE_PATH}/photo`)
}
