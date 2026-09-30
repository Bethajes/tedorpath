/**
 * Universities shown in the homepage trust strip.
 *
 * Two rules govern this file, and both exist so the strip cannot overstate
 * anything:
 *
 * 1. An entry may only be added when a logo file actually exists at that path
 *    under `frontend/public/universities/`. A name with no file behind it is a
 *    broken image.
 * 2. An entry is not a claim of partnership. These are universities that tutors
 *    on the platform have studied at, nothing more — the strip's heading is
 *    worded accordingly.
 *
 * Requirements: 3.2, 3.5, 3.6, 3.7
 */

export interface UniversityEntry {
  name: string
  /** Path relative to the site root, e.g. "/universities/aau.svg". */
  logo: string
}

export const UNIVERSITIES: UniversityEntry[] = [
  { name: 'Addis Ababa University', logo: '/universities/aau.svg' },
  {
    name: 'Addis Ababa Science and Technology University',
    logo: '/universities/aastu.svg',
  },
  { name: 'Cairo University', logo: '/universities/Cairo_University_crest.svg_.svg' },
  // The file is a traced crest with no text in it, so the name could not be
  // read from the artwork. `indian_uni` is an IIT — narrow this to the specific
  // campus once you know which one it is, and rename the file to match so the
  // name stays readable from the asset alone.
  { name: 'Indian Institute of Technology', logo: '/universities/indian_uni.svg' },
  { name: 'University of Cape Town', logo: '/universities/uct.svg' },
]
