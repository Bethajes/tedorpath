import { Link } from 'react-router-dom'

import { Logo } from '@/components/brand/Logo'
import { SocialIcon } from '@/components/brand/SocialIcons'
import { Container } from '@/components/layout/PageShell'
import { telegramHandle, telegramLink, emailContact, emailLink } from '@/lib/contactConfig'
import { socialPlatforms } from '@/lib/socialConfig'

interface FooterColumn {
  title: string
  links: { to: string; label: string }[]
}

/**
 * Every link below points at a route that exists.
 *
 * The "Learn" slugs are the real `subjects.slug` values in the database
 * (mathematics, physics, programming, english, exam-preparation). Two labels the
 * redesign originally asked for — "Science" and "Languages" — are not subjects
 * this platform has, so pointing at them would filter the directory to a slug
 * that matches nothing and show a visitor an empty result. Physics and English
 * are the real subjects those links were reaching for.
 *
 * There is no phone number, email address or postal address anywhere here.
 * Nothing of that kind exists in the project configuration, and Requirement
 * 11.6 forbids inventing it. The two things that *are* configurable are rendered
 * only when they have a value:
 *
 * - a Telegram contact handle, from the environment;
 * - the six social profiles in `lib/socialConfig`.
 *
 * A half-configured deployment therefore shows no dead link. For the social row
 * specifically the placeholder is still *visible* — see `SocialRow` — so the
 * operator can see which slots are empty, but an empty slot is not a link and
 * cannot be clicked.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
 */
const COLUMNS: FooterColumn[] = [
  {
    title: 'Tedor Tutors',
    links: [
      { to: '/about', label: 'About' },
      { to: '/how-it-works', label: 'How It Works' },
      { to: '/tutors', label: 'Find a Tutor' },
      { to: '/become-a-tutor', label: 'Become a Tutor' },
    ],
  },
  {
    title: 'Learn',
    links: [
      { to: '/tutors?subject=mathematics', label: 'Mathematics' },
      { to: '/tutors?subject=physics', label: 'Physics' },
      { to: '/tutors?subject=programming', label: 'Programming' },
      { to: '/tutors?subject=english', label: 'English' },
      { to: '/tutors?subject=exam-preparation', label: 'Exam Preparation' },
    ],
  },
  {
    title: 'Account',
    links: [
      { to: '/login', label: 'Log in' },
      { to: '/register', label: 'Sign up' },
    ],
  },
  {
    title: 'Support',
    links: [{ to: '/contact', label: 'Contact' }],
  },
]

export function Footer() {
  // Read at render time, not from a module-level constant: build-time env is
  // resolved on first import, so a constant read once could go stale and would
  // make this untestable. See lib/contactConfig.
  const handle = telegramHandle()
  const telegram = telegramLink(handle)
  const emailAddress = emailContact()
  const email = emailLink(emailAddress)
  const social = socialPlatforms()

  return (
    <footer className="mt-auto bg-ink-950 text-ink-300">
      <Container className="py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2.4fr] lg:gap-16">
          <div className="max-w-sm">
            <Link to="/" className="inline-flex rounded-md">
              <Logo size="md" inverted />
            </Link>
            <p className="mt-4 leading-relaxed text-ink-400">
              Learn better. Find the right tutor. Tell us what you want to learn and our team
              will help you find someone who fits.
            </p>

            <SocialRow platforms={social} />
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {COLUMNS.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-white">
                  {column.title}
                </h2>
                <ul className="mt-4 flex flex-col gap-3">
                  {column.links.map((link) => (
                    <li key={`${column.title}-${link.to}-${link.label}`}>
                      <Link
                        to={link.to}
                        className="text-ink-400 transition-colors hover:text-accent-400"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                  {/* Only when a handle is actually configured, so a deployment
                      without one shows no contact channel at all. */}
                  {column.title === 'Support' && telegram && handle ? (
                    <li>
                      <a
                        href={telegram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ink-400 transition-colors hover:text-accent-400"
                      >
                        Telegram
                      </a>
                    </li>
                  ) : null}

                  {/*
                    The email is printed rather than hidden behind an icon,
                    because an address a person has to copy out of a picture is
                    not much of a contact channel. Same rule as everything else
                    here: shown only when configured.
                  */}
                  {column.title === 'Support' && email && emailAddress ? (
                    <li>
                      <a
                        href={email}
                        className="break-all text-ink-400 transition-colors hover:text-accent-400"
                      >
                        {emailAddress}
                      </a>
                    </li>
                  ) : null}
                </ul>
              </nav>
            ))}
          </div>
        </div>
      </Container>

      <div className="border-t border-ink-800">
        <Container className="py-6">
          {/* Computed at render rather than baked in, so the year cannot go
              stale. Requirement 11.5. */}
          <p className="text-sm text-ink-500">
            &copy; {new Date().getFullYear()} Tedor Tutors. All rights reserved.
          </p>
        </Container>
      </div>
    </footer>
  )
}

/**
 * The social profile row.
 *
 * Six fixed slots, always rendered. An empty slot is shown muted rather than
 * removed, which is the whole point of a placeholder: the operator can see which
 * platforms still need a URL, and adding one does not reflow the row.
 *
 * An empty slot is NOT a link. It is a `<span>`, so there is nothing to click,
 * no `href` to point at a page that does not exist, and no way for it to become
 * a dead link on a live site. The `title` says why, so hovering explains the
 * placeholder rather than leaving it looking like a bug.
 */
function SocialRow({
  platforms,
}: {
  platforms: ReturnType<typeof socialPlatforms>
}) {
  return (
    <nav aria-label="Social profiles" className="mt-7">
      <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-white">
        Follow Tedor
      </h2>

      <ul className="mt-4 flex flex-wrap items-center gap-2.5">
        {platforms.map((platform) =>
          platform.url ? (
            <li key={platform.id} data-platform={platform.id}>
              <a
                href={platform.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`${platform.label} — opens in a new tab`}
                className="grid h-10 w-10 place-items-center rounded-lg border border-ink-800 text-ink-400 transition-colors hover:border-accent-500 hover:text-accent-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
              >
                <SocialIcon platform={platform.id} className="h-5 w-5" />
                <span className="sr-only">
                  {platform.label} (opens in a new tab)
                </span>
              </a>
            </li>
          ) : (
            <li key={platform.id} data-platform={platform.id}>
              <span
                title={`${platform.label} — no profile URL configured yet`}
                aria-hidden="true"
                className="grid h-10 w-10 place-items-center rounded-lg border border-dashed border-ink-800 text-ink-700"
              >
                <SocialIcon platform={platform.id} className="h-5 w-5" />
              </span>
              {/*
                Hidden from assistive tech on purpose: an unconfigured platform is
                not a destination, so announcing it as one would be a dead end.
                The platform names still appear once, in the list of configured
                links, through each link's own sr-only label.
              */}
            </li>
          ),
        )}
      </ul>
    </nav>
  )
}
