import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import useCountdown from '../../lib/useCountdown'
import { Icon } from '../ui'
import RegionBadge from '../shared/RegionBadge'
import { normalizeRegion, canRegisterInRegion } from '../../lib/regions'

var HIDDEN_ROUTES = ['/login', '/signup', '/auth', '/oauth', '/callback']

function pad2(n) { return String(n).padStart(2, '0') }

function resolvePhase(phase) {
  if (!phase) return null
  if (phase === 'inprogress' || phase === 'in_progress' || phase === 'live') return 'live'
  if (phase === 'checkin' || phase === 'check_in') return 'checkin'
  if (phase === 'registration') return 'registration'
  if (phase === 'complete') return 'complete'
  return null
}

export default function TournamentStatusStrip() {
  var ctx = useApp()
  var tournamentState = ctx.tournamentState || {}
  var currentUser = ctx.currentUser
  var players = ctx.players || []
  var setAuthScreen = ctx.setAuthScreen
  var navigate = useNavigate()
  var location = useLocation()
  var countdown = useCountdown(tournamentState)

  var pathname = location && location.pathname ? location.pathname : '/'
  // Hide on auth routes or deep clash/bracket pages (they render their own status UI)
  if (HIDDEN_ROUTES.indexOf(pathname) !== -1) return null
  if (pathname === '/clash' || pathname === '/bracket') return null
  if (pathname.indexOf('/admin') === 0) return null
  if (pathname.indexOf('/ops') === 0) return null

  var phaseKey = resolvePhase(tournamentState.phase)
  // Don't render a strip when there's nothing meaningful to show
  if (!phaseKey || phaseKey === 'complete') return null
  // During registration we only surface the strip if we have a real tournament context
  if (!tournamentState.dbTournamentId && !tournamentState.clashTimestamp && phaseKey === 'registration') return null

  var region = normalizeRegion(tournamentState.region || 'EU')

  var linkedPlayer = null
  if (currentUser) {
    linkedPlayer = players.find(function(p) {
      if (p.authUserId && currentUser.id && String(p.authUserId) === String(currentUser.id)) return true
      if (p.name && currentUser.username && p.name.toLowerCase() === String(currentUser.username).toLowerCase()) return true
      return false
    }) || null
  }
  var userRegion = linkedPlayer ? linkedPlayer.region : null
  var regionMismatch = userRegion && region && !canRegisterInRegion(userRegion, region)
  var sid = linkedPlayer ? String(linkedPlayer.id) : null
  var isRegistered = !!(sid && (tournamentState.registeredIds || []).indexOf(sid) > -1)
  var isCheckedIn = !!(sid && (tournamentState.checkedInIds || []).indexOf(sid) > -1)

  var clashName = tournamentState.clashName || 'Weekly Clash'

  var statusLabel = ''
  var tone = 'text-primary'
  var dot = 'bg-primary'
  var ctaLabel = ''
  var ctaHandler = null
  var ctaTone = 'text-primary hover:text-on-surface'

  if (phaseKey === 'live') {
    statusLabel = 'LIVE NOW'
    tone = 'text-tertiary'
    dot = 'bg-tertiary animate-pulse'
    ctaLabel = currentUser ? 'Open Dashboard' : 'Sign Up'
    ctaHandler = function() {
      if (currentUser) navigate('/')
      else if (setAuthScreen) setAuthScreen('signup')
    }
  } else if (phaseKey === 'checkin') {
    statusLabel = 'CHECK-IN OPEN'
    tone = 'text-primary'
    dot = 'bg-primary animate-pulse'
    if (!currentUser) { ctaLabel = 'Sign In'; ctaHandler = function() { setAuthScreen && setAuthScreen('login') } }
    else if (regionMismatch) { ctaLabel = 'Locked to ' + userRegion; ctaHandler = function() { navigate('/account') } }
    else if (isCheckedIn) { ctaLabel = "You're In"; ctaHandler = function() { navigate('/') } }
    else if (isRegistered) { ctaLabel = 'Check In'; ctaHandler = function() { navigate('/') } }
    else { ctaLabel = 'Register'; ctaHandler = function() { navigate('/') } }
  } else if (phaseKey === 'registration') {
    statusLabel = 'REGISTRATION OPEN'
    tone = 'text-primary'
    dot = 'bg-primary'
    if (!currentUser) { ctaLabel = 'Sign Up'; ctaHandler = function() { setAuthScreen && setAuthScreen('signup') } }
    else if (regionMismatch) { ctaLabel = 'Locked to ' + userRegion; ctaHandler = function() { navigate('/account') } }
    else if (isRegistered) { ctaLabel = "You're In"; ctaHandler = function() { navigate('/') } }
    else { ctaLabel = 'Register'; ctaHandler = function() { navigate('/') } }
  }

  var showCountdown = countdown.hasCountdown && phaseKey !== 'live'

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-20 z-40 bg-surface-container-low/90 backdrop-blur-md border-b border-outline-variant/20"
    >
      <div className="max-w-[1920px] mx-auto px-3 sm:px-6 xl:px-8 py-1.5 flex items-center gap-2 sm:gap-4 overflow-hidden">

        {/* Status pip */}
        <span className={'inline-flex items-center gap-1.5 text-[10px] font-label uppercase tracking-widest font-bold shrink-0 ' + tone}>
          <span className={'w-1.5 h-1.5 rounded-full ' + dot}></span>
          {statusLabel}
        </span>

        <span className="hidden sm:inline w-px h-3 bg-outline-variant/20 shrink-0" />

        {/* Region */}
        {region && (
          <div className="shrink-0">
            <RegionBadge region={region} size="sm" />
          </div>
        )}

        {/* Name */}
        <span className="font-display text-xs sm:text-sm text-on-surface truncate flex-1 min-w-0">
          {clashName}
        </span>

        {/* Countdown */}
        {showCountdown && (
          <div className="hidden sm:flex items-center gap-1.5 font-mono text-xs text-on-surface shrink-0">
            <Icon name="schedule" size={14} className="text-on-surface-variant" />
            {countdown.days > 0
              ? <span>{countdown.days}d {pad2(countdown.hours)}:{pad2(countdown.minutes)}</span>
              : <span>{pad2(countdown.hours)}:{pad2(countdown.minutes)}:{pad2(countdown.seconds)}</span>}
          </div>
        )}

        {/* CTA */}
        {ctaLabel && ctaHandler && (
          <button
            type="button"
            onClick={ctaHandler}
            className={'shrink-0 px-3 py-1 rounded border border-primary/30 bg-primary/5 font-label text-[10px] uppercase tracking-widest font-bold cursor-pointer transition-colors ' + ctaTone}
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  )
}
