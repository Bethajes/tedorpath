import { placeholderImage, type PlaceholderScene } from './heroPhotoArt'

/**
 * The human slots in the hero's right-hand composition.
 *
 * Three frames, each doing a different job in the story the composition tells:
 * the learner who arrives with something to learn, the tutor who meets them,
 * and the lesson itself happening between them. They are layered into one
 * arrangement rather than set side by side in a row, and they are the whole
 * visual — there is no diagram for them to sit around.
 *
 * PHOTOGRAPHY. The frames carry real photographs from `public/homepage_images`.
 * A slot with no `src` falls back to the flat brand-coloured scene in
 * `heroPhotoArt.ts` rather than disappearing, so a new slot can be laid out and
 * reviewed before its photograph exists; dropping a file into `public/` and
 * setting `src` is then the only change needed to swap one for the other.
 *
 * `learners-hero.webp` is a 960px re-encode of the 2880px original
 * (`learners.webp`), which is what the largest frame actually needs: the frame
 * renders at about 240 CSS pixels, and a 630KB hero image on the critical path
 * is a measurable cost for detail no one can see.
 *
 * CROPPING. The frames are portrait and square; the photographs are landscape,
 * so `object-fit: cover` keeps roughly half of each. `objectPosition` is what
 * chooses which half — it is set per slot against the subject's actual place in
 * the photograph, and is the thing to revisit first if an image is ever
 * replaced.
 *
 * NOTHING HERE IS A CLAIM. No names, no credentials, no universities, no
 * ratings, no counts, and the labels name subject areas and teaching modes
 * rather than users. Requirement 2.8 forbids trust points that imply scale, and
 * Requirement 14 forbids fabricated data: these are photographs of learning,
 * and the hero makes no statement about who they are of.
 */

/** Which slot a frame fills, and the CSS hook it is positioned by. */
export type HeroPhotoId = 'learner' | 'tutor' | 'study'

export interface HeroPhoto {
  /** Slot name. Doubles as the React key and the styling hook. */
  id: HeroPhotoId
  /**
   * Photograph for this slot. Left unset, the frame renders the placeholder
   * scene below rather than going empty.
   */
  src?: string
  /** Describes the picture, for anyone who cannot see it. */
  alt: string
  /** Small contextual label sitting under the frame. Never a filter or a link. */
  label: string
  /** Tailwind aspect-ratio utility. Fixed, so the frame reserves its space. */
  ratioClass: string
  /**
   * Which part of the photograph survives the crop, as CSS `object-position`
   * percentages. Required for any slot with a photograph: landscape images in
   * portrait and square frames lose most of themselves to `object-fit: cover`,
   * so "where the subject is" has to be a decision rather than a default.
   */
  objectPosition?: string
  /** The flat scene drawn while `src` is unset. */
  scene: PlaceholderScene
  /**
   * `eager` for the one frame above the fold, so the composition does not
   * assemble itself out of order. Everything else waits its turn.
   */
  eager?: boolean
  /** Orange reads as action and progress; blue as trust and learning. */
  tone: 'brand' | 'accent'
}

export const HERO_PHOTOS: readonly HeroPhoto[] = [
  {
    id: 'learner',
    // The largest frame and the first one the eye lands on after the headline,
    // so it is the one that loads eagerly.
    src: '/homepage_images/learners-hero.webp',
    alt: 'A student writing in a notebook at a classroom desk',
    label: 'Student studying',
    ratioClass: 'aspect-[4/5]',
    // Two students share the frame; the left one is the subject, and a centred
    // crop would have taken the blurred figure between them instead.
    objectPosition: '22% center',
    scene: 'study',
    eager: true,
    tone: 'brand',
  },
  {
    id: 'tutor',
    src: '/homepage_images/tutor.jpeg',
    alt: 'A tutor smiling in front of a chalkboard covered in equations',
    label: 'Tutor teaching',
    ratioClass: 'aspect-square',
    // Stated rather than left to the default: he is dead centre, and saying so
    // is what makes it obvious if the photograph is ever swapped for one where
    // he is not.
    objectPosition: 'center center',
    scene: 'teach',
    tone: 'accent',
  },
  {
    id: 'study',
    src: '/homepage_images/online_tutoring.jpeg',
    alt: 'A learner at a desk joining an online lesson with a tutor on the screen',
    label: 'Online tutoring',
    // Square, not portrait: this frame sits under the subject, and a portrait
    // crop here made the whole stack taller than the column it stands in.
    ratioClass: 'aspect-square',
    // The tutor's face on the screen is the point of this picture, so the crop
    // is pushed right of centre to keep the screen whole and the learner's
    // shoulder in the foreground. A centred or left crop takes the screen and
    // leaves a back of a head.
    objectPosition: '58% center',
    scene: 'online',
    tone: 'brand',
  },
] as const

/** Resolves a slot's image source: the photograph if there is one, else the scene. */
export function heroPhotoSrc(photo: HeroPhoto): string {
  return photo.src ?? placeholderImage(photo.scene)
}

/** Looks a slot up by id. Narrow return type keeps the call sites honest. */
export function heroPhoto(id: HeroPhotoId): HeroPhoto {
  const found = HERO_PHOTOS.find((photo) => photo.id === id)
  // The three ids are a closed union and HERO_PHOTOS covers all of them, so this
  // is unreachable — a fallback keeps the render total rather than crashing a
  // homepage over a bad constant.
  return found ?? HERO_PHOTOS[0]
}
