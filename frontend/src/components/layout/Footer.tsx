import { Link } from 'react-router-dom'

const FOOTER_LINKS = [
  { to: '/request-tutor', label: 'Find a Tutor' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <p className="text-base font-bold text-slate-900">Tedor Tutors</p>
          <p className="mt-2 text-sm text-slate-600">
            We connect students with tutors for personalized learning, online or in person.
          </p>
        </div>

        <nav aria-label="Footer">
          <ul className="flex flex-col gap-2 text-sm">
            {FOOTER_LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="text-slate-600 transition-colors hover:text-brand-700"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Tedor Tutors. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
