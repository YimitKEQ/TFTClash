import { useLocation, Link } from 'react-router-dom'
import Icon from '../ui/Icon'

const MOBILE_ITEMS = [
  { label: 'Home', path: '/', icon: 'home' },
  { label: 'Events', path: '/events', icon: 'calendar_month' },
  { label: 'Clash', path: '/clash', icon: 'swords', isCenter: true },
  { label: 'Recap', path: '/recap', icon: 'bar_chart' },
  { label: 'Account', path: '/account', icon: 'person' },
]

export default function MobileNav() {
  const location = useLocation()

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-3 bg-[#13131A]/95 backdrop-blur-xl border-t border-outline-variant/15">
      {MOBILE_ITEMS.map(({ label, path, icon, isCenter }) => {
        const active = isActive(path)
        return (
          <Link
            key={path}
            to={path}
            className={`flex flex-col items-center justify-center ${
              active
                ? 'text-primary'
                : 'text-on-surface/50'
            }`}
          >
            <div className={isCenter && active ? 'bg-primary text-on-primary rounded-xl px-4 py-1' : 'mb-1'}>
              <Icon name={icon} size={24} />
            </div>
            <span className="text-[10px] uppercase font-bold font-sans">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
