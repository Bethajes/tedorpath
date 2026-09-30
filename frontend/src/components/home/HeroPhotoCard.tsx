import { cn } from '@/lib/cn'

import { heroPhotoSrc, type HeroPhoto } from './heroPhotos'

/**
 * One human frame in the hero composition.
 *
 * A real `<figure>`: the image carries its own alt text and the caption is a
 * plain label, so the frame is meaningful to a screen reader rather than being
 * announced as decoration. The frame keeps a fixed aspect ratio whether or not
 * a photograph has arrived, so the composition never reflows when one is added.
 *
 * `width`/`height` are only the intrinsic ratio hint — the frame's own
 * `aspect-ratio` utility is what actually reserves the space, and
 * `object-fit: cover` in the stylesheet is what fills it. Which part of a
 * landscape photograph survives that crop is per-slot data, not styling.
 *
 * Three nested elements, because three different transforms are in play and CSS
 * would otherwise overwrite one with another:
 *
 *   <figure>  position in the composition — offsets, nothing animated
 *   .hv-reveal  the one-shot entrance, transform + opacity
 *   .hv-frame   static tilt, the idle float, and the hover lift
 *
 * The last two use separate CSS properties (`rotate` for the tilt, `transform`
 * for the float, `translate` for the hover) so they compose instead of
 * replacing one another. That keeps the frame to one element rather than three.
 */
export interface HeroPhotoCardProps {
  photo: HeroPhoto
  className?: string
}

export function HeroPhotoCard({ photo, className }: HeroPhotoCardProps) {
  return (
    <figure className={cn('hv-item', `hv-item--${photo.id}`, className)}>
      <div className="hv-reveal">
        <div className={cn('hv-frame', `hv-frame--${photo.tone}`, photo.ratioClass)}>
          <img
            src={heroPhotoSrc(photo)}
            alt={photo.alt}
            width={400}
            height={500}
            loading={photo.eager ? 'eager' : 'lazy'}
            decoding="async"
            style={photo.objectPosition ? { objectPosition: photo.objectPosition } : undefined}
          />
        </div>
        {/*
          Presentational labels, not controls. Rendered as a span rather than a
          button or a link so nothing in the hero can be mistaken for something
          interactive that does nothing when pressed.
        */}
        <figcaption className="hv-chip">
          <span aria-hidden="true" className={cn('hv-chip-dot', `hv-chip-dot--${photo.tone}`)} />
          {photo.label}
        </figcaption>
      </div>
    </figure>
  )
}
