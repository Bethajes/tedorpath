import { Link } from 'react-router-dom'

import { Logo } from '@/components/brand/Logo'
import { Container } from '@/components/layout/PageShell'

interface FooterColumn {
  title: string
  links: { to: string; label: string }[]
}

/**
 * Every link below points at a route that exists. There is no tutor
 * registration, help centre, social profile or contact detail in the product
 * yet, so none are listed rather than linking to something that 404s.
 */
const COLUMNS: FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { to: '/request-tutor', label: 'Find a Tutor' },
      { to: '/#how-it-works', label: 'How It Works' },
      { to: '/about#become-a-tutor', label: 'Become a Tutor' },
    ],
  },
  {
    title: 'Company',
    links: [
      { to: '/about', label: 'About' },
      { to: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Support',
    links: [
      { to: '/request-tutor', label: 'Request a Tutor' },
      { to: '/#subjects', label: 'Subjects' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-ink-200 bg-ink-50">
      <Container className="py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2fr] lg:gap-16">
          <div className="max-w-sm">
            <Link to="/" className="inline-flex rounded-md">
              <Logo size="md" />
            </Link>
            <p className="mt-4 leading-relaxed text-ink-600">
              Learn better. Find the right tutor. Tell us what you want to learn and our team
              will help you find someone who fits.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-ink-900">
                  {column.title}
                </h2>
                <ul className="mt-4 flex flex-col gap-3">
                  {column.links.map((link) => (
                    <li key={`${column.title}-${link.to}-${link.label}`}>
                      <Link
                        to={link.to}
                        className="text-ink-600 transition-colors hover:text-brand-700"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
      </Container>

      <div className="border-t border-ink-200">
        <Container className="py-6">
          <p className="text-sm text-ink-500">
            &copy; {new Date().getFullYear()} Tedor Tutors. All rights reserved.
          </p>
        </Container>
      </div>
    </footer>
  )
}
