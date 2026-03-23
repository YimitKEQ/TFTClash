import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import Icon from '../ui/Icon'

const SIDEBAR_LINKS = [
  { label: 'Dashboard', path: '/', icon: 'dashboard' },
  { label: 'Tournaments', path: '/tournaments', icon: 'emoji_events' },
  { label: 'Leaderboards', path: '/leaderboard', icon: 'leaderboard' },
  { label: 'Events', path: '/events', icon: 'calendar_month' },
  { label: 'Profile', path: '/account', icon: 'person' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoggedIn } = useAuth()

  if (!isLoggedIn) return null

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-64 z-40 bg-[#13131A] border-r border-outline-variant/15 hidden xl:flex flex-col pt-24">
      {/* Logo section */}
      <div className="px-6 mb-10">
        <div className="font-headline text-xl font-black text-primary tracking-tighter">TFT CLASH</div>
        <div className="font-sans text-xs uppercase tracking-widest text-on-surface/40 mt-1">Elite Competition</div>
      </div>

      {/* Nav links */}
      <nav className="flex-1">
        {SIDEBAR_LINKS.map(({ label, path, icon }) => {
          const active = isActive(path)
          return (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-4 px-6 py-4 font-sans uppercase text-xs font-semibold tracking-widest transition-all duration-200 ${
                active
                  ? 'bg-gradient-to-r from-primary/20 to-transparent text-primary border-l-4 border-primary translate-x-1'
                  : 'text-on-surface/40 hover:text-on-surface hover:bg-white/5'
              }`}
            >
              <Icon name={icon} size={20} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* CTA button */}
      <div className="px-6 mb-6">
        <button
          className="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold uppercase py-3 rounded-full font-sans tracking-wider text-sm transition-transform hover:scale-105"
          onClick={() => navigate('/clash')}
        >
          Join Clash
        </button>
      </div>

      {/* Footer links */}
      <div className="px-6 pb-6 flex items-center gap-4">
        <button
          className="text-on-surface/60 text-xs font-sans uppercase tracking-wider hover:text-on-surface transition-colors"
          onClick={() => navigate('/support')}
        >
          Support
        </button>
        <button
          className="text-on-surface/60 text-xs font-sans uppercase tracking-wider hover:text-on-surface transition-colors"
          onClick={() => navigate('/logout')}
        >
          Logout
        </button>
      </div>
    </aside>
  )
}
