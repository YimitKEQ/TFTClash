import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import Icon from '../ui/Icon'

const NAV_LINKS = [
  { label: 'Home', path: '/' },
  { label: 'Clash', path: '/clash' },
  { label: 'Standings', path: '/standings' },
  { label: 'Events', path: '/events' },
  { label: 'Profile', path: '/player' },
]

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoggedIn, currentUser } = useAuth()

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <nav className="flex justify-between items-center w-full px-8 py-4 sticky top-0 z-50 bg-[#13131A] obsidian-shadow">
      {/* Logo */}
      <Link to="/" className="font-headline text-2xl font-black text-[#E8A838] tracking-tighter">
        TFT CLASH
      </Link>

      {/* Center nav links - hidden on mobile */}
      <div className="hidden md:flex items-center gap-8">
        {NAV_LINKS.map(({ label, path }) => {
          const active = isActive(path)
          const profilePath = path === '/player' && currentUser
            ? `/player/${currentUser.name || currentUser.id}`
            : path

          return (
            <Link
              key={path}
              to={profilePath}
              className={
                active
                  ? 'font-sans uppercase tracking-wider text-sm text-primary border-b-2 border-primary pb-1 font-bold opacity-100'
                  : 'font-sans uppercase tracking-wider text-sm text-on-surface opacity-70 hover:opacity-100 transition-opacity'
              }
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {isLoggedIn ? (
          <>
            <button
              className="p-2 rounded-full hover:bg-[#2A2931] hover:text-primary transition-all duration-300"
              onClick={() => navigate('/notifications')}
            >
              <Icon name="notifications" />
            </button>
            <button
              className="p-2 rounded-full hover:bg-[#2A2931] hover:text-primary transition-all duration-300"
              onClick={() => navigate('/settings')}
            >
              <Icon name="settings" />
            </button>
            <div
              className="w-10 h-10 rounded-full bg-surface-container-high border border-outline-variant/20 flex items-center justify-center font-mono text-sm text-on-surface/60 cursor-pointer"
              onClick={() => navigate('/account')}
            >
              {currentUser?.name?.[0] || '?'}
            </div>
          </>
        ) : (
          <Link
            to="/login"
            className="font-sans uppercase tracking-wider text-sm text-primary hover:text-primary-container transition-colors"
          >
            Login
          </Link>
        )}
      </div>
    </nav>
  )
}
