import { Link } from 'react-router-dom'

const FOOTER_LINKS = [
  { label: 'Rules', path: '/rules' },
  { label: 'Privacy', path: '/privacy' },
  { label: 'Terms', path: '/terms' },
  { label: 'FAQ', path: '/faq' },
]

export default function Footer() {
  return (
    <footer className="hidden md:block bg-surface-container-lowest border-t border-outline-variant/10">
      <div className="max-w-7xl mx-auto px-8 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
        {/* Left - copyright */}
        <p className="font-sans text-xs text-on-surface/40 uppercase tracking-widest">
          &copy; {new Date().getFullYear()} TFT Clash. All rights reserved.
        </p>

        {/* Center - links */}
        <div className="flex items-center gap-6">
          {FOOTER_LINKS.map(({ label, path }) => (
            <Link
              key={path}
              to={path}
              className="font-sans text-xs uppercase tracking-wider text-on-surface/40 hover:text-on-surface transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Right - brand */}
        <span className="font-display text-sm text-primary/40">TFT Clash</span>
      </div>
    </footer>
  )
}
