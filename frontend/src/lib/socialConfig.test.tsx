import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { Footer } from '@/components/layout/Footer'
import { hasSocialLinks, socialPlatforms, socialUrl } from '@/lib/socialConfig'

/**
 * Footer social profiles.
 *
 * Two things are protected here.
 *
 * The first is the absence of behaviour: a platform with no URL must not become
 * a link. The project's rule is that nothing is invented, so a plausible-looking
 * default (`facebook.com/tedor-tutors`) would be worse than nothing — it would
 * either 404 or point at a stranger's page. The deployment-with-nothing-set case
 * lives in `socialConfig.empty.test.tsx`, which mocks the config module.
 *
 * The second is the URLs this repository actually ships. A typo in a handle is
 * invisible in review and produces a 404 in production, so they are pinned here
 * as resolved URLs — which also covers the bare-handle normalisation, since
 * `@Tedor_Path` has to become a working link.
 */

function renderFooter() {
  return render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// URL normalisation
// ---------------------------------------------------------------------------

describe('socialUrl — turns a configured value into a safe absolute URL', () => {
  it('strips spaces out of a bare handle instead of percent-encoding them', () => {
    // "tedor path" is a natural thing to type for a page called "Tedor Path",
    // but a slug cannot contain a space: left alone it would silently become
    // `x.com/tedor%20path`, which 404s instead of failing visibly.
    expect(socialUrl('x', '@Tedor path')).toBe('https://x.com/Tedorpath')
    expect(socialUrl('x', 'tedor path')).toBe('https://x.com/tedorpath')
  })

  it('treats an absent or blank override as "not provided", not as a value', () => {
    // The precedence is env → argument → the declared URL, and each step is
    // skipped when empty. A blank argument therefore means "use the declared
    // value", not "clear it" — clearing happens by editing the config or by
    // removing the row, never by sending an empty string.
    expect(socialUrl('x', '')).toBe('https://x.com/Tedorpath')
    expect(socialUrl('x', '   ')).toBe('https://x.com/Tedorpath')
  })

  it('prefers an explicit value over the declared one', () => {
    expect(socialUrl('x', 'tedor.tutors')).toBe('https://x.com/tedor.tutors')
  })

  it('does not mistake a dotted page name for a hostname', () => {
    // Regression: a "looks like a domain" rule read `tedor.tutors` as a host and
    // produced https://tedor.tutors/ — a dead link on somebody's site. Dots are
    // legal in social page names, so only a host we recognise counts as a host.
    expect(socialUrl('x', 'tedor.path')).toBe('https://x.com/tedor.path')
    expect(socialUrl('telegram', 'tedor.path')).toBe('https://t.me/tedor.path')
  })

  it('still recognises a real host written without a scheme', () => {
    expect(socialUrl('x', 'x.com/tedor')).toBe('https://x.com/tedor')
    expect(socialUrl('instagram', 'www.instagram.com/tedor')).toBe(
      'https://www.instagram.com/tedor',
    )
    expect(socialUrl('telegram', 't.me/tedor')).toBe('https://t.me/tedor')
  })

  it('keeps a full https URL as it is', () => {
    expect(socialUrl('x', 'https://x.com/tedortutors')).toBe(
      'https://x.com/tedortutors',
    )
  })

  it('prefixes a bare handle with the platform host', () => {
    expect(socialUrl('telegram', 'tedor_team')).toBe('https://t.me/tedor_team')
  })

  it('adds a scheme to a value that already names its host', () => {
    // Without this the platform host would be prepended too, producing
    // `linkedin.com/company/linkedin.com/company/tedor`.
    expect(socialUrl('linkedin', 'linkedin.com/company/tedor')).toBe(
      'https://linkedin.com/company/tedor',
    )
  })

  it('keeps a www the person typed rather than rewriting it', () => {
    expect(socialUrl('instagram', 'www.instagram.com/tedor')).toBe(
      'https://www.instagram.com/tedor',
    )
  })

  it('resolves a scheme-relative value', () => {
    expect(socialUrl('x', '//x.com/tedor')).toBe('https://x.com/tedor')
  })

  it('strips a leading @ so a pasted handle works', () => {
    expect(socialUrl('instagram', '@tedortutors')).toBe(
      'https://www.instagram.com/tedortutors',
    )
  })

  it('refuses a javascript: URL rather than putting it in an href', () => {
    // Configured values are operator input, but they still land in an href on
    // every page, so a script URL must never survive.
    expect(socialUrl('x', 'javascript:alert(1)')).toBeNull()
  })

  it('refuses a data: URL for the same reason', () => {
    expect(socialUrl('x', 'data:text/html,<script>alert(1)</script>')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// The committed configuration
// ---------------------------------------------------------------------------

describe('socialPlatforms — the URLs this repository ships with', () => {
  /**
   * Pinned deliberately. These are real profile URLs, and a typo in one of them
   * is invisible in review and produces a 404 in production. If a handle is
   * changed on purpose, this test should be changed with it — that is the point.
   *
   * Written as the expected URL, not as the configured value, so it also covers
   * the bare-handle normalisation: `@Tedor_Path` has to become a real link.
   */
  it('resolves each configured handle to an absolute https URL', () => {
    const resolved = Object.fromEntries(
      socialPlatforms().map((platform) => [platform.id, platform.url]),
    )

    expect(resolved).toEqual({
      tiktok: 'https://www.tiktok.com/@tedorpath0',
      facebook: 'https://web.facebook.com/profile.php?id=61595039309878',
      instagram: 'https://www.instagram.com/Tedor_Path',
      telegram: 'https://t.me/Tedor_Tutors',
      linkedin:
        'https://www.linkedin.com/in/tedor-undefined-8a44a9440?utm_source=share_via&utm_content=profile&utm_medium=member_android',
      x: 'https://x.com/Tedorpath',
    })
  })

  it('preserves the capitalisation a platform treats as significant', () => {
    // Instagram and X handles are case-insensitive on the web but this project
    // should still show them as written, and the URL must not be lower-cased on
    // its way through normalisation.
    const byId = Object.fromEntries(socialPlatforms().map((p) => [p.id, p.url]))

    expect(byId.instagram).toContain('Tedor_Path')
    expect(byId.x).toContain('Tedorpath')
  })

  it('configures all six platforms', () => {
    const configured = socialPlatforms().filter((p) => p.url !== null)
    expect(configured).toHaveLength(6)
    expect(hasSocialLinks()).toBe(true)
  })

  it('points every platform at its own host', () => {
    // A copy-paste error that gave two platforms the same URL would be
    // invisible on the page, since both render as a working link.
    const hosts = socialPlatforms().map((p) => new URL(p.url as string).host)
    expect(new Set(hosts).size).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// Footer rendering — the shipped configuration
// ---------------------------------------------------------------------------

describe('Footer — social row with the shipped configuration', () => {
  it('renders every configured platform as a safe external link', () => {
    renderFooter()
    const nav = screen.getByRole('navigation', { name: 'Social profiles' })
    const links = within(nav).getAllByRole('link')

    expect(links).toHaveLength(6)

    for (const link of links) {
      const href = link.getAttribute('href') ?? ''
      expect(href.startsWith('https://')).toBe(true)
      // `noopener` matters more than usual here: every one of these hands the
      // opener to a third-party site.
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      expect(link).toHaveAttribute('target', '_blank')
    }
  })

  it('renders all six as links, with none left as a placeholder', () => {
    renderFooter()
    const nav = screen.getByRole('navigation', { name: 'Social profiles' })

    expect(nav.querySelectorAll('li')).toHaveLength(6)
    expect(nav.querySelectorAll('a')).toHaveLength(6)
    // No slot is left explaining that it has no URL.
    expect(nav.querySelectorAll('[title*="no profile URL"]')).toHaveLength(0)
  })

  it('gives Facebook the exact profile URL, query string and all', () => {
    // This one is a `profile.php?id=` numeric URL rather than a slug, so it has
    // to survive normalisation untouched — dropping the query string would send
    // visitors to a generic Facebook page instead of the profile.
    renderFooter()
    const nav = screen.getByRole('navigation', { name: 'Social profiles' })

    const link = nav.querySelector('[data-platform="facebook"] a')
    expect(link?.getAttribute('href')).toBe(
      'https://web.facebook.com/profile.php?id=61595039309878',
    )
  })

  it('names every link for assistive tech, with the new-tab warning', () => {
    renderFooter()
    const nav = screen.getByRole('navigation', { name: 'Social profiles' })

    const names = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent)

    for (const label of ['TikTok', 'Facebook', 'Instagram', 'Telegram', 'LinkedIn', 'X']) {
      expect(names).toContain(`${label} (opens in a new tab)`)
    }
  })
})
