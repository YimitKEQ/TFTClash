import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase.js'
import Icon from '../ui/Icon'

var PLAY_LINKS = [
  { label: 'Dashboard', path: '/', icon: 'dashboard' },
  { label: 'Results', path: '/results', icon: 'emoji_events' },
  { label: 'Archive', path: '/archive', icon: 'inventory_2' },
]

var COMPETE_LINKS = [
  { label: 'Standings', path: '/standings', icon: 'leaderboard' },
  { label: 'Leaderboard', path: '/leaderboard', icon: 'military_tech' },
  { label: 'Hall of Fame', path: '/hof', icon: 'workspace_premium' },
]

var ME_LINKS = [
  { label: 'Profile', path: null, icon: 'person', useUsername: true },
  { label: 'Account', path: '/account', icon: 'settings' },
]

export default function Sidebar() {
  var navigate = useNavigate()
  var location = useLocation()
  var ctx = useApp()
  var currentUser = ctx.currentUser
  var isAdmin = ctx.isAdmin
  var setAuthScreen = ctx.setAuthScreen

  function isActive(path) {
    if (!path) return false
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  function handleNav(path) {
    navigate(path)
  }

  function handleSignOut() {
    supabase.auth.signOut().then(function() {
      navigate('/')
    })
  }

  function handleSignIn() {
    setAuthScreen && setAuthScreen('login')
  }

  function renderLink(item) {
    var path = item.useUsername && currentUser
      ? '/player/' + currentUser.username
      : item.path
    var active = isActive(path)
    return (
      <button
        key={item.label}
        onClick={function() { handleNav(path) }}
        className={
          'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150 ' +
          (active
            ? 'bg-primary/10 text-primary border-l-2 border-primary'
            : 'text-on-surface/40 hover:text-on-surface hover:bg-white/5 border-l-2 border-transparent')
        }
      >
        <Icon name={item.icon} size={18} />
        <span className="font-label text-xs uppercase tracking-widest">{item.label}</span>
      </button>
    )
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-60 z-40 bg-[#13131A] border-r border-outline-variant/10 hidden xl:flex flex-col pt-20">

      {/* Brand */}
      <div className="px-5 mb-8">
        <div className="font-display text-lg font-black text-primary tracking-tighter">TFT CLASH</div>
        <div className="font-label text-[10px] uppercase tracking-widest text-on-surface/30 mt-0.5">Season 1</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto">

        {/* PLAY */}
        <div className="mb-4">
          <div className="px-5 mb-1.5 font-label text-[9px] uppercase tracking-[0.15em] text-on-surface/25">Play</div>
          {PLAY_LINKS.map(renderLink)}
        </div>

        {/* COMPETE */}
        <div className="mb-4">
          <div className="px-5 mb-1.5 font-label text-[9px] uppercase tracking-[0.15em] text-on-surface/25">Compete</div>
          {COMPETE_LINKS.map(renderLink)}
        </div>

        {/* ME — logged-in only */}
        {currentUser && (
          <div className="mb-4">
            <div className="px-5 mb-1.5 font-label text-[9px] uppercase tracking-[0.15em] text-on-surface/25">Me</div>
            {ME_LINKS.map(renderLink)}
            {isAdmin && renderLink({ label: 'Admin', path: '/admin', icon: 'admin_panel_settings' })}
          </div>
        )}

      </nav>

      {/* Join Clash CTA */}
      <div className="px-5 mb-4">
        <button
          className="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-label font-bold uppercase py-2.5 rounded-lg text-xs tracking-widest transition-transform hover:scale-105"
          onClick={function() { handleNav('/') }}
        >
          Join Clash
        </button>
      </div>

      {/* Footer */}
      <div className="px-5 pb-6 flex items-center gap-4 border-t border-outline-variant/10 pt-4">
        <button
          className="font-label text-[10px] uppercase tracking-widest text-on-surface/40 hover:text-on-surface transition-colors"
          onClick={function() { handleNav('/faq') }}
        >
          Support
        </button>
        {currentUser
          ? (
            <button
              className="font-label text-[10px] uppercase tracking-widest text-on-surface/40 hover:text-on-surface transition-colors"
              onClick={handleSignOut}
            >
              Sign Out
            </button>
          )
          : (
            <button
              className="font-label text-[10px] uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
              onClick={handleSignIn}
            >
              Sign In
            </button>
          )
        }
      </div>
    </aside>
  )
}
