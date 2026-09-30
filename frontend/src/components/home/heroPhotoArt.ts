/**
 * Fallback artwork for a hero photo frame that has no photograph yet.
 *
 * Every current slot carries a real photograph from `public/homepage_images`,
 * so nothing renders this today. It stays because a new slot — or a photograph
 * that fails to load in review — should still produce a complete, intentional
 * frame rather than an empty one, and because it makes the swap in
 * `heroPhotos.ts` testable without a binary asset in the repository.
 *
 * Why a data URI rather than inline `<svg>` markup: the frame has to be a real
 * `<img>` so that it carries real `alt` text, real intrinsic dimensions, real
 * lazy loading and real `object-fit` cropping — the same as the photograph that
 * replaces it. Setting `src` on a photo entry in `heroPhotos.ts` is then the
 * only change needed to swap placeholder for photograph; nothing else in the
 * composition knows or cares which of the two it is showing.
 *
 * The scenes are deliberately abstract flat shapes rather than drawings of
 * people: a stylised figure reads as deliberate art direction, a half-drawn
 * realistic one would read as a broken image.
 */

/** Which flat scene a placeholder slot renders. */
export type PlaceholderScene = 'study' | 'teach' | 'online'

/** Every scene is drawn on this canvas and cropped by the frame's own ratio. */
const VIEW_BOX = 'viewBox="0 0 400 500" width="400" height="500"'

/** Shared paper tint, so the three frames read as one set. */
const GROUND = '#eef7fe'
const HALO = '#dcf0fd'
const RULE = '#bce1fb'
const WARM = '#ffa564'

/**
 * One scene per slot, chosen to match what the slot says: the learner studies,
 * the tutor teaches, the third frame is a lesson happening online.
 */
const SCENES: Record<PlaceholderScene, string> = {
  study: [
    `<rect width="400" height="500" fill="${GROUND}"/>`,
    `<circle cx="196" cy="250" r="176" fill="${HALO}"/>`,
    `<circle cx="196" cy="222" r="86" fill="#0b5f9f"/>`,
    `<path d="M76 500c0-104 54-166 120-166s120 62 120 166Z" fill="#1e96e8"/>`,
    // Above the shoulder rather than across it, so it reads as a graphic accent
    // instead of as something the figure is holding.
    `<rect x="40" y="104" width="76" height="12" rx="6" fill="${WARM}"/>`,
  ].join(''),
  teach: [
    `<rect width="400" height="500" fill="${GROUND}"/>`,
    `<circle cx="132" cy="292" r="170" fill="${HALO}"/>`,
    // Kept inside the circle a square frame masks down to, so the board is not
    // sliced off by the tutor frame's rounded corners.
    `<rect x="196" y="126" width="154" height="106" rx="20" fill="#ffffff"/>`,
    `<rect x="218" y="154" width="80" height="12" rx="6" fill="${RULE}"/>`,
    `<rect x="218" y="180" width="110" height="12" rx="6" fill="${RULE}"/>`,
    `<rect x="218" y="206" width="58" height="12" rx="6" fill="${WARM}"/>`,
    `<circle cx="132" cy="296" r="70" fill="#104269"/>`,
    `<path d="M38 500c0-98 42-156 94-156s94 58 94 156Z" fill="#0f78c4"/>`,
  ].join(''),
  online: [
    `<rect width="400" height="500" fill="${GROUND}"/>`,
    `<circle cx="118" cy="132" r="96" fill="${HALO}"/>`,
    `<rect x="188" y="236" width="184" height="128" rx="22" fill="#ffffff"/>`,
    `<rect x="212" y="268" width="98" height="12" rx="6" fill="#8acdf7"/>`,
    `<rect x="212" y="296" width="136" height="12" rx="6" fill="${RULE}"/>`,
    `<rect x="212" y="324" width="64" height="12" rx="6" fill="${WARM}"/>`,
    `<circle cx="116" cy="338" r="66" fill="#0b5f9f"/>`,
    `<path d="M28 500c0-92 40-146 88-146s88 54 88 146Z" fill="#1e96e8"/>`,
  ].join(''),
}

/**
 * Encodes a scene as a data URI.
 *
 * `encodeURIComponent` also escapes the `#` in every colour, which is what makes
 * the result a valid URI — without it the browser stops parsing at the first
 * hex digit and paints nothing.
 */
export function placeholderImage(scene: PlaceholderScene): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" ${VIEW_BOX} ` +
    `preserveAspectRatio="xMidYMid slice">${SCENES[scene]}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
