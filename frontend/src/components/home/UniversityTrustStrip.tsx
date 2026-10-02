import { useState } from 'react'

import { Container } from '@/components/layout/PageShell'
import { Reveal } from '@/components/ui/Reveal'
import { UNIVERSITIES } from '@/data/universities'

/**
 * Strip of university logos for tutors on the platform.
 *
 * Two deliberate constraints:
 *
 * - The copy says "Tutors with backgrounds from", never "our partner
 *   universities". Tutors studied somewhere; that is not a formal agreement
 *   with the institution, and implying otherwise would be a claim we cannot
 *   support.
 * - Every entry comes from `UNIVERSITIES`, and that file only lists universities
 *   with a logo that actually ships. An entry whose file is missing anyway is
 *   dropped at runtime by the image's own `onError`, so a broken path leaves a
 *   gap rather than a broken-image icon.
 * - The logos are shown in their own colours. A greyscale wall of university
 *   crests reads as decoration; the marks are the content here.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8, 3.9
 */
export function UniversityTrustStrip() {
  // Logos that failed to load are held in state rather than tracked one by one:
  // the map is small and static, and a Set keeps the filter a single pass.
  const [missingLogos, setMissingLogos] = useState<ReadonlySet<string>>(() => new Set())

  const entries = UNIVERSITIES.filter((entry) => !missingLogos.has(entry.logo))

  return (
    <section className="section-y border-y border-brand-100 bg-ink-50" aria-labelledby="university-trust-heading">
      <Container>
        <Reveal>
          <h2
            id="university-trust-heading"
            className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-ink-500 sm:text-sm"
          >
            Tutors with backgrounds from
          </h2>
        </Reveal>

        {/*
          A horizontal scroller on mobile rather than a wrapping row: with four
          or more logos, wrapping changes height as the viewport changes and
          makes the strip jump while the page settles. `snap` keeps a partially
          visible logo readable as "there is more to scroll".
        */}
        {entries.length > 0 ? (
          <ul
            className="-mx-5 mt-7 flex snap-x snap-mandatory items-center justify-start gap-x-8 gap-y-6 overflow-x-auto px-5 pb-2 sm:mx-0 sm:flex-wrap sm:justify-center sm:gap-x-12 sm:overflow-x-visible sm:px-0 lg:gap-x-16"
            data-testid="university-trust-logos"
          >
            {entries.map((entry) => (
              <li
                key={entry.logo}
                className="group flex shrink-0 snap-center items-center justify-center"
              >
                <img
                  src={entry.logo}
                  // The name is the content here. The logo is a mark, not
                  // additional information, so the alt text is the university's
                  // name rather than a description of the image.
                  alt={entry.name}
                  loading="lazy"
                  decoding="async"
                  /*
                    Full colour, not greyscaled: these are the real marks, and
                    washing them out hides the one thing the strip exists to
                    show. `h-11` fixes the height so logos of very different
                    aspect ratios — Cairo's crest is a tall portrait, the IIT's
                    is nearly square — sit on a common baseline, and
                    `object-contain` keeps each one undistorted inside that box.
                    `max-w` stops a wide wordmark from dominating the row.
                  */
                  className="h-11 w-auto max-w-[10rem] object-contain transition-transform duration-200 group-hover:scale-105 sm:h-12"
                  onError={() =>
                    setMissingLogos((current) => {
                      const next = new Set(current)
                      next.add(entry.logo)
                      return next
                    })
                  }
                />
              </li>
            ))}
          </ul>
        ) : null}
      </Container>
    </section>
  )
}
