import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getStats } from '../lib/stats.js'
import { ordinal } from '../lib/utils.js'
import { writeActivityEvent } from '../lib/notifications.js'
import { supabase } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'
import { Btn, Panel, Icon } from '../components/ui'

// --- TIER CONFIG ---

var TIER_THRESHOLDS = [
  { name: 'Champion', minRank: 1, maxRank: 1, color: '#E8A838', icon: 'crown' },
  { name: 'Challenger', minRank: 2, maxRank: 3, color: '#9B72CF', icon: 'diamond' },
  { name: 'Contender', minRank: 4, maxRank: 8, color: '#4ECDC4', icon: 'shield' }
]

function getPlayerTierInfo(rank, totalPlayers) {
  for (var i = 0; i < TIER_THRESHOLDS.length; i++) {
    if (rank >= TIER_THRESHOLDS[i].minRank && rank <= TIER_THRESHOLDS[i].maxRank) {
      return TIER_THRESHOLDS[i]
    }
  }
  return { name: 'Competitor', minRank: 9, maxRank: totalPlayers, color: '#9AAABF', icon: 'person' }
}

function getNextTierInfo(rank) {
  for (var i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (rank > TIER_THRESHOLDS[i].maxRank) {
      return TIER_THRESHOLDS[i]
    }
  }
  return null
}

function generateSeasonNarrative(players, sortedPts) {
  if (!sortedPts || sortedPts.length < 2) return null
  var leader = sortedPts[0]
  var second = sortedPts[1]
  var gap = leader.pts - second.pts
  if (gap <= 5) return 'The race for #1 is tight. Only ' + gap + ' pts separate ' + leader.name + ' and ' + second.name + '.'
  if (gap > 50) return leader.name + ' leads the season with a commanding ' + gap + '-point advantage.'
  if (sortedPts.length >= 5) {
    var thirdPts = sortedPts[2].pts
    var fifthPts = sortedPts[4].pts
    if (thirdPts - fifthPts <= 10) return 'Positions 3 through 5 are separated by just ' + (thirdPts - fifthPts) + ' pts. Every clash matters.'
  }
  return leader.name + ' leads the season with ' + leader.pts + ' pts.'
}

// --- SPARKLINE BAR CHART (matching stitch design) ---

function SparklineBars({ data }) {
  if (!data || data.length < 2) return null
  var min = Math.min.apply(null, data)
  var max = Math.max.apply(null, data)
  var range = max - min || 1
  var ALPHAS = ['bg-secondary/10', 'bg-secondary/10', 'bg-secondary/20', 'bg-secondary/20', 'bg-secondary/30', 'bg-secondary/40', 'bg-secondary/50', 'bg-secondary/60', 'bg-secondary/70']
  var total = data.length
  return (
    <div className="h-24 w-full flex items-end gap-1 overflow-hidden">
      {data.map(function (v, i) {
        var pct = Math.round(((v - min) / range) * 80 + 20)
        var isLast = i === data.length - 1
        var alphaClass = isLast ? '' : (ALPHAS[Math.min(i, ALPHAS.length - 1)])
        return (
          <div
            key={i}
            className={'w-full rounded-t-sm ' + alphaClass}
            style={{
              height: pct + '%',
              background: isLast ? 'linear-gradient(to top, rgba(217,185,255,0.4), rgba(217,185,255,1))' : undefined
            }}
          />
        )
      })}
    </div>
  )
}

// --- FORM CIRCLES (matching stitch design) ---

function FormCircles({ history, max }) {
  var n = max || 5
  var recent = (history || []).slice(-n)
  if (recent.length === 0) return null
  return (
    <div className="flex gap-2">
      {recent.map(function (h, i) {
        var p = h.placement || h.place || 5
        var isTop4 = p <= 4
        return (
          <div
            key={i}
            title={'Game ' + (i + 1) + ': #' + p}
            className={
              'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ' +
              (isTop4
                ? 'bg-tertiary-container/10 border border-tertiary/30 text-tertiary'
                : 'bg-surface-container-high border border-outline-variant/30 text-on-surface/60')
            }
          >
            {p}
          </div>
        )
      })}
    </div>
  )
}

// --- ANNOUNCEMENT STRIP ---

function AnnouncementStrip({ text, variant }) {
  if (!text) return null
  var isHost = variant === 'host'
  return (
    <div
      className="flex items-center gap-2.5 rounded-sm px-4 py-2.5 mb-3"
      style={{
        background: isHost ? 'rgba(155,114,207,.05)' : 'rgba(232,168,56,.06)',
        border: '1px solid ' + (isHost ? 'rgba(155,114,207,.2)' : 'rgba(232,168,56,.2)')
      }}
    >
      <Icon name="campaign" size={16} className={isHost ? 'text-secondary flex-shrink-0' : 'text-primary flex-shrink-0'} />
      <span className={'font-semibold text-sm ' + (isHost ? 'text-secondary' : 'text-primary')}>{text}</span>
    </div>
  )
}

// --- PULSE HEADER (stitch-matched) ---

function PulseHeader({
  linkedPlayer, currentUser, myRankIdx, rankDelta, currentTierInfo,
  nextTier, ptsToNextTier, tPhase, tRound, registeredCount, checkedInCount,
  tournamentState, clashName, clashDate, clashTime, diff, D, H, M, S,
  isMyRegistered, isMyWaitlisted, myWaitlistPos, myCheckedIn, profileComplete,
  phaseActionBtn, pointsTrend
}) {
  var pColor = tPhase === 'registration' ? '#9B72CF'
    : tPhase === 'checkin' ? '#E8A838'
    : tPhase === 'inprogress' ? '#52C47C'
    : tPhase === 'complete' ? '#4ECDC4'
    : '#9B72CF'

  var phaseLabel = tPhase === 'registration' ? 'Registration Open'
    : tPhase === 'checkin' ? 'Check-in Open'
    : tPhase === 'inprogress' ? 'LIVE - Game ' + tRound + '/' + (tournamentState.totalGames || 4)
    : tPhase === 'complete' ? 'Results Posted'
    : 'Next Clash'

  var playerName = linkedPlayer ? linkedPlayer.name : (currentUser && currentUser.username ? currentUser.username : 'Summoner')
  var playerRank = linkedPlayer ? (linkedPlayer.rank || 'Unranked') : ''
  var seasonLabel = currentTierInfo ? ('Season - Top ' + (myRankIdx || '?') + '%') : 'Season'

  // Format countdown as HH:MM:SS for primary display
  var countdownStr = (H < 10 ? '0' + H : '' + H) + ':' + (M < 10 ? '0' + M : '' + M) + ':' + (S < 10 ? '0' + S : '' + S)
  if (D > 0) countdownStr = D + 'd ' + countdownStr

  return (
    <section className="relative overflow-hidden p-8 rounded-lg border border-secondary/10 mb-6"
      style={{ background: 'rgba(52,52,60,0.6)', backdropFilter: 'blur(24px)', boxShadow: 'inset 0 0 20px rgba(217,185,255,0.15)' }}
    >
      {/* Top-right countdown */}
      <div className="absolute top-0 right-0 p-4 text-right">
        <div className="flex items-center gap-2 justify-end">
          <span
            className="w-2 h-2 rounded-full bg-primary"
            style={{ animation: 'pulse 2s infinite' }}
          />
          <span className="font-condensed uppercase text-[10px] tracking-widest text-on-surface/40">
            {phaseLabel}
          </span>
        </div>
        <div className="font-mono text-2xl text-primary mt-1">{countdownStr}</div>
        {diff > 0 && clashName && (
          <div className="font-condensed text-[10px] text-on-surface/40 mt-0.5">
            {clashName}{clashDate ? ' - ' + clashDate : ''}
          </div>
        )}
      </div>

      {/* Player identity row */}
      <div className="flex items-center gap-6 relative z-10">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div
            className="w-20 h-20 rounded-full border-4 border-secondary/40 p-1"
            style={{ boxShadow: '0 0 20px rgba(217,185,255,0.3)' }}
          >
            <div className="w-full h-full rounded-full overflow-hidden bg-surface-container-high flex items-center justify-center">
              {linkedPlayer ? (
                <span
                  className="font-display text-2xl font-black"
                  style={{ color: currentTierInfo ? currentTierInfo.color : '#E8A838' }}
                >
                  {playerName.charAt(0).toUpperCase()}
                </span>
              ) : (
                <Icon name="person" size={32} className="text-secondary/60" />
              )}
            </div>
          </div>
          {linkedPlayer && currentTierInfo && (
            <div
              className="absolute -bottom-1 -right-1 px-2 py-0.5 text-[10px] font-bold rounded-sm uppercase tracking-tighter bg-secondary text-on-secondary-fixed"
            >
              {currentTierInfo.name.toUpperCase()}
            </div>
          )}
        </div>

        {/* Name + season label */}
        <div>
          <h1 className="font-editorial text-4xl text-on-surface leading-none italic">{playerName}</h1>
          <p className="font-condensed text-xs uppercase tracking-[0.2em] text-secondary mt-2">
            {linkedPlayer
              ? ('Season - ' + (playerRank ? playerRank + ' - ' : '') + 'Top ' + myRankIdx + '%')
              : 'Link your Riot ID to get started'}
          </p>
          {/* Phase action + registration status */}
          {phaseActionBtn && (
            <div className="mt-3 flex items-center gap-3">
              {phaseActionBtn}
              {isMyWaitlisted && (
                <span className="font-mono text-[10px] text-primary font-bold">Waitlist #{myWaitlistPos}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// --- SEASON TRAJECTORY CARD (stitch-matched) ---

function SeasonTrajectoryCard({ linkedPlayer, s2, clashHistory, pointsTrend, lastClash, currentStreak, streakType, onViewProfile }) {
  if (!linkedPlayer || !s2) return null

  var weekDelta = pointsTrend.length >= 2
    ? (pointsTrend[pointsTrend.length - 1] - (pointsTrend[pointsTrend.length - 2] || 0))
    : 0

  return (
    <div className="surface-container-low p-6 rounded-lg border border-outline-variant/10">
      {/* Header */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <span className="font-condensed uppercase text-xs tracking-widest text-on-surface/40 block mb-1">Season Trajectory</span>
          <div className="font-display text-2xl text-on-surface">{linkedPlayer.pts} LP</div>
        </div>
        <div className="text-right">
          {weekDelta !== 0 && (
            <span className={'font-mono text-sm ' + (weekDelta >= 0 ? 'text-tertiary' : 'text-error')}>
              {weekDelta >= 0 ? '+' : ''}{weekDelta} this week
            </span>
          )}
        </div>
      </div>

      {/* Sparkline bar chart */}
      {pointsTrend.length >= 2 ? (
        <SparklineBars data={pointsTrend} />
      ) : (
        <div className="h-24 w-full flex items-end gap-1 overflow-hidden">
          {[20, 25, 45, 40, 60, 55, 80, 75, 90].map(function (pct, i) {
            var isLast = i === 8
            return (
              <div
                key={i}
                className={'w-full rounded-t-sm ' + (!isLast ? 'bg-secondary/' + (10 + i * 10) : '')}
                style={{
                  height: pct + '%',
                  background: isLast ? 'linear-gradient(to top, rgba(217,185,255,0.4), rgba(217,185,255,1))' : undefined
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// --- RECENT FORM CARD (stitch-matched) ---

function RecentFormCard({ linkedPlayer, clashHistory, onViewProfile }) {
  if (!linkedPlayer) return null

  var recent = (clashHistory || []).slice(-5)

  var COMP_NAMES = ['Arcanist Fated', 'Storyweaver Mythic', 'Void Wanderer', 'Fated Duelist', 'Fortune Invoker']

  return (
    <div className="surface-container-low p-6 rounded-lg border border-outline-variant/10">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-condensed uppercase text-xs tracking-widest text-on-surface/40">
          Recent Form (Last {Math.min(5, recent.length || 5)})
        </h3>
        <FormCircles history={recent.length > 0 ? recent : [
          { placement: 1 }, { placement: 3 }, { placement: 6 }, { placement: 2 }, { placement: 1 }
        ]} />
      </div>

      <div className="space-y-3">
        {(recent.length > 0 ? recent.slice(-2) : [
          { placement: 1, comp: 'Arcanist Fated', timeAgo: '2h ago' },
          { placement: 3, comp: 'Storyweaver Mythic', timeAgo: '5h ago' }
        ]).map(function (h, i) {
          var p = h.placement || h.place || 1
          var isTop4 = p <= 4
          var comp = h.comp || COMP_NAMES[i % COMP_NAMES.length]
          var timeAgo = h.timeAgo || (h.date ? h.date : ((i + 2) + 'h ago'))
          return (
            <div
              key={i}
              className={'flex items-center justify-between p-3 bg-surface-container rounded-sm border-l-4 ' + (isTop4 ? 'border-tertiary' : 'border-outline-variant/30')}
            >
              <div className="flex items-center gap-3">
                <span className={'font-mono font-bold ' + (isTop4 ? 'text-tertiary' : 'text-on-surface/60')}>
                  {'#' + p}
                </span>
                <span className="font-condensed uppercase text-xs tracking-widest text-on-surface">{comp}</span>
              </div>
              <span className="text-[10px] font-mono text-on-surface/40">{timeAgo}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- STANDINGS MINI (stitch-matched) ---

function StandingsMini({ top5, linkedPlayer, onViewPlayer, onViewAll }) {
  return (
    <div className="surface-container-low p-6 rounded-lg border border-outline-variant/10">
      <h3 className="font-condensed uppercase text-xs tracking-widest text-on-surface/40 mb-4">
        Clash Standings: Group B
      </h3>
      <div className="space-y-2">
        {(top5.length > 0 ? top5 : [
          { id: 1, name: 'Soulstealer7', pts: 450 },
          { id: 2, name: 'Kael\'Thas Prime', pts: 410 },
          { id: 3, name: 'TFT_Wizard', pts: 385 },
          { id: 4, name: 'LuckyRoll', pts: 320 }
        ]).slice(0, 4).map(function (p, i) {
          var isMe = linkedPlayer && p.id === linkedPlayer.id
          var isLast = i === (Math.min(top5.length, 4) - 1)
          return (
            <div
              key={p.id || i}
              onClick={function () { onViewPlayer && onViewPlayer(p) }}
              className={
                'flex items-center justify-between py-2 ' +
                (!isLast ? 'border-b border-outline-variant/10 ' : '') +
                (isMe ? 'bg-secondary/5 -mx-2 px-2 ' : '') +
                (onViewPlayer ? 'cursor-pointer' : '')
              }
            >
              <div className="flex items-center gap-3">
                <span className={'font-mono text-[10px] ' + (isMe ? 'text-secondary' : 'text-on-surface/40')}>
                  {'0' + (i + 1)}
                </span>
                <span className={'text-xs font-semibold ' + (isMe ? 'text-secondary' : '')}>
                  {p.name}
                </span>
              </div>
              <span className={'font-mono text-[10px] ' + (i === 0 ? 'text-primary' : isMe ? 'text-secondary' : 'text-on-surface/40')}>
                {p.pts} PT
              </span>
            </div>
          )
        })}
      </div>
      <button
        onClick={function () { onViewAll && onViewAll() }}
        className="w-full mt-4 py-2 border border-outline-variant/30 text-[10px] font-condensed uppercase tracking-[0.2em] text-on-surface/60 hover:text-on-surface hover:border-outline-variant transition-colors"
      >
        View Full Standings
      </button>
    </div>
  )
}

// --- ACTIVITY FEED (stitch-matched) ---

function ActivityFeed({ items }) {
  var defaultItems = [
    {
      id: 'a1',
      icon: 'celebration',
      message: 'Promoted to',
      highlight: 'Diamond I',
      highlightColor: 'text-secondary',
      timeStr: 'Yesterday at 11:42 PM'
    },
    {
      id: 'a2',
      icon: 'groups',
      message: 'Joined Team',
      highlight: 'The Obsidian Arena',
      highlightColor: 'text-primary',
      timeStr: '2 days ago'
    }
  ]

  var displayItems = (items && items.length > 0) ? items.slice(0, 4).map(function (item) {
    return {
      id: item.id,
      icon: item.icon || 'notifications',
      message: item.message || (item.detail_json && item.detail_json.text) || '',
      highlight: null,
      highlightColor: 'text-primary',
      timeStr: item.created_at
        ? new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        : ''
    }
  }) : defaultItems

  return (
    <div className="surface-container-low p-6 rounded-lg border border-outline-variant/10 overflow-hidden relative">
      {/* Decorative blur */}
      <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-secondary/5 rounded-full blur-3xl" />
      <h3 className="font-condensed uppercase text-xs tracking-widest text-on-surface/40 mb-4">Live Activity</h3>
      <div className="space-y-4">
        {displayItems.map(function (item, idx) {
          return (
            <div key={item.id || idx} className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center">
                <Icon name={item.icon} size={16} className="text-on-surface/60" />
              </div>
              <div>
                {item.highlight ? (
                  <p className="text-xs text-on-surface/80">
                    {item.message + ' '}
                    <span className={'font-bold ' + item.highlightColor}>{item.highlight}</span>
                  </p>
                ) : (
                  <p className="text-xs text-on-surface/80">{item.message}</p>
                )}
                <span className="text-[10px] font-mono text-on-surface/30">{item.timeStr}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- FLASH TOURNAMENT BANNER ---

function FlashTournamentBanner({ tournament, onView }) {
  if (!tournament) return null
  return (
    <div
      className="flex items-center gap-3 p-4 rounded-lg border border-tertiary/20 mb-6 cursor-pointer hover:bg-surface-container transition-colors"
      style={{ background: 'rgba(103,226,217,0.04)' }}
      onClick={onView}
    >
      <Icon name="bolt" fill size={18} className="text-tertiary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-condensed text-[10px] font-bold uppercase tracking-widest text-tertiary mb-0.5">Flash Tournament</div>
        <div className="font-bold text-sm text-on-surface truncate">{tournament.name}</div>
      </div>
      <Btn variant="primary" size="sm">Register</Btn>
    </div>
  )
}

// --- MAIN DASHBOARD ---

export default function DashboardScreen() {
  var ctx = useApp()
  var players = ctx.players
  var setPlayers = ctx.setPlayers
  var currentUser = ctx.currentUser
  var tournamentState = ctx.tournamentState
  var setTournamentState = ctx.setTournamentState
  var announcement = ctx.announcement
  var tickerOverrides = ctx.tickerOverrides
  var hostAnnouncements = ctx.hostAnnouncements
  var featuredEvents = ctx.featuredEvents
  var seasonConfig = ctx.seasonConfig
  var setProfilePlayer = ctx.setProfilePlayer
  var setScreen = ctx.setScreen
  var toast = ctx.toast
  var navigate = useNavigate()

  // Countdown state
  var clashName = (tournamentState && tournamentState.clashName) || 'Next Clash'
  var clashDate = (tournamentState && tournamentState.clashDate) || ''
  var clashTime = (tournamentState && tournamentState.clashTime) || ''
  var targetMsRef = useRef(
    tournamentState && tournamentState.clashTimestamp
      ? new Date(tournamentState.clashTimestamp).getTime()
      : Date.now() + 7 * 86400000
  )

  var _now = useState(Date.now())
  var now = _now[0]
  var setNow = _now[1]

  useEffect(function () {
    var t = setInterval(function () { setNow(Date.now()) }, 1000)
    return function () { clearInterval(t) }
  }, [])

  var diff = Math.max(0, targetMsRef.current - now)
  var D = Math.floor(diff / 86400000)
  var H = Math.floor(diff % 86400000 / 3600000)
  var M = Math.floor(diff % 3600000 / 60000)
  var S = Math.floor(diff % 60000 / 1000)

  // Tick for activity feed refresh
  var _tick = useState(0)
  var tick = _tick[0]
  var setTick = _tick[1]

  useEffect(function () {
    var t = setInterval(function () { setTick(function (n) { return n + 1 }) }, 60000)
    return function () { clearInterval(t) }
  }, [])

  // Upcoming flash tournament
  var _upcomingTournament = useState(null)
  var upcomingTournament = _upcomingTournament[0]
  var setUpcomingTournament = _upcomingTournament[1]

  useEffect(function () {
    supabase.from('tournaments').select('*')
      .eq('type', 'flash_tournament')
      .in('phase', ['registration', 'check_in', 'upcoming'])
      .order('date', { ascending: true })
      .limit(1)
      .then(function (res) {
        if (res.data && res.data.length > 0) setUpcomingTournament(res.data[0])
      })
  }, [])

  // Activity feed
  var _af = useState([])
  var activityFeed = _af[0]
  var setActivityFeed = _af[1]

  useEffect(function () {
    supabase.from('activity_feed').select('*')
      .order('created_at', { ascending: false })
      .limit(8)
      .then(function (res) {
        if (res.data) setActivityFeed(res.data)
      })
  }, [tick])

  // Derived values
  var linkedPlayer = useMemo(function () {
    if (!currentUser) return null
    return players.find(function (p) {
      if (p.authUserId && currentUser.id && p.authUserId === currentUser.id) return true
      if (p.name && currentUser.username && p.name.toLowerCase() === currentUser.username.toLowerCase()) return true
      if (p.riotId && currentUser.riotId && p.riotId.toLowerCase() === currentUser.riotId.toLowerCase()) return true
      return false
    }) || null
  }, [players, currentUser])

  var profileComplete = currentUser && currentUser.riotId && currentUser.riotId.trim().length > 0

  var s2 = linkedPlayer ? getStats(linkedPlayer) : null

  var sortedPts = useMemo(function () {
    return [].concat(players).sort(function (a, b) { return (b.pts || 0) - (a.pts || 0) })
  }, [players])

  var myRankIdx = useMemo(function () {
    if (!linkedPlayer) return 0
    return sortedPts.findIndex(function (p) { return p.id === linkedPlayer.id }) + 1
  }, [sortedPts, linkedPlayer])

  var top5 = useMemo(function () {
    return sortedPts.slice(0, 5)
  }, [sortedPts])

  var rankDelta = linkedPlayer && linkedPlayer.lastClashRank ? myRankIdx - linkedPlayer.lastClashRank : 0
  var currentTierInfo = getPlayerTierInfo(myRankIdx, players.length)
  var nextTier = getNextTierInfo(myRankIdx)
  var ptsToNextTier = null
  if (nextTier && myRankIdx > nextTier.maxRank) {
    var tierBorderPlayer = sortedPts[nextTier.maxRank - 1]
    if (tierBorderPlayer && linkedPlayer) ptsToNextTier = tierBorderPlayer.pts - linkedPlayer.pts
  }

  var clashHistory = (linkedPlayer && linkedPlayer.clashHistory) || []
  var lastClash = clashHistory.length > 0 ? clashHistory[clashHistory.length - 1] : null

  var pointsTrend = []
  var cumPts = 0
  clashHistory.forEach(function (c) {
    cumPts = cumPts + (c.points || 0)
    pointsTrend.push(cumPts)
  })

  var currentStreak = 0
  var streakType = ''
  for (var si = clashHistory.length - 1; si >= 0; si--) {
    if (clashHistory[si].placement <= 4) {
      currentStreak++
      streakType = 'top-4'
    } else break
  }
  if (currentStreak === 0) {
    for (var sj = clashHistory.length - 1; sj >= 0; sj--) {
      if (clashHistory[sj].placement === 1) {
        currentStreak++
        streakType = 'win'
      } else break
    }
  }

  var tPhase = (tournamentState && tournamentState.phase) || 'registration'
  var tRound = (tournamentState && tournamentState.round) || 1
  var registeredCount = ((tournamentState && tournamentState.registeredIds) || []).length
  var checkedInCount = players.filter(function (p) { return p.checkedIn }).length
  var isMyRegistered = linkedPlayer && ((tournamentState.registeredIds || []).includes(String(linkedPlayer.id)))
  var isMyWaitlisted = linkedPlayer && ((tournamentState.waitlistIds || []).includes(String(linkedPlayer.id)))
  var myWaitlistPos = isMyWaitlisted ? (tournamentState.waitlistIds || []).indexOf(String(linkedPlayer.id)) + 1 : 0
  var myCheckedIn = linkedPlayer && linkedPlayer.checkedIn

  // --- Action handlers ---

  function handleCheckIn() {
    if (!linkedPlayer) return
    setPlayers(function (ps) {
      return ps.map(function (p) {
        return p.id === linkedPlayer.id ? Object.assign({}, p, { checkedIn: true }) : p
      })
    })
    setTournamentState(function (ts) {
      var ids = ts.checkedInIds || []
      var sid = String(linkedPlayer.id)
      return ids.includes(sid) ? ts : Object.assign({}, ts, { checkedInIds: ids.concat([sid]) })
    })
    if (supabase.from && tournamentState.dbTournamentId) {
      supabase.from('registrations').update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
        .eq('tournament_id', tournamentState.dbTournamentId)
        .eq('player_id', linkedPlayer.id)
        .then(function (r) { if (r.error) console.error('[TFT] check-in update failed:', r.error) })
    }
    toast("You're checked in! Good luck, " + linkedPlayer.name, 'success')
  }

  function registerFromAccount() {
    if (!currentUser || !profileComplete) return
    if (!linkedPlayer) { toast('Account not linked to a player profile', 'error'); return }
    var sid = String(linkedPlayer.id)
    var isReg = (tournamentState.registeredIds || []).includes(sid)
    if (isReg) { toast("You're already registered!", 'error'); return }
    var isWl = (tournamentState.waitlistIds || []).includes(sid)
    if (isWl) { toast("You're already on the waitlist!", 'error'); return }
    var maxCap = parseInt((tournamentState && tournamentState.maxPlayers) || 24)
    var regCount = (tournamentState.registeredIds || []).length
    if (regCount >= maxCap) {
      setTournamentState(function (ts) {
        var wl = ts.waitlistIds || []
        if (wl.includes(sid)) return ts
        return Object.assign({}, ts, { waitlistIds: wl.concat([sid]) })
      })
      toast(currentUser.username + ' added to waitlist (position ' + ((tournamentState.waitlistIds || []).length + 1) + ')', 'info')
      return
    }
    setTournamentState(function (ts) {
      var ids = ts.registeredIds || []
      return ids.includes(sid) ? ts : Object.assign({}, ts, { registeredIds: ids.concat([sid]) })
    })
    if (supabase.from) {
      var doInsert = function (tid) {
        supabase.from('registrations').upsert({
          tournament_id: tid,
          player_id: linkedPlayer.id,
          status: 'registered'
        }, { onConflict: 'tournament_id,player_id' }).then(function (r) {
          if (r.error) console.error('[TFT] registration insert failed:', r.error)
        })
      }
      if (tournamentState.dbTournamentId) {
        doInsert(tournamentState.dbTournamentId)
      } else {
        supabase.from('tournaments').insert({
          name: clashName || 'Next Clash',
          date: new Date().toISOString().split('T')[0],
          phase: 'registration',
          max_players: parseInt(tournamentState.maxPlayers) || 24
        }).select().single().then(function (res) {
          if (!res.error && res.data) {
            var newId = res.data.id
            setTournamentState(function (ts) { return Object.assign({}, ts, { dbTournamentId: newId }) })
            doInsert(newId)
          } else if (res.error) {
            console.error('[TFT] Failed to auto-create tournament:', res.error)
          }
        })
      }
    }
    toast(currentUser.username + ' registered for ' + clashName + '!', 'success')
    if (linkedPlayer) writeActivityEvent('registration', linkedPlayer.id, currentUser.username + ' registered for ' + clashName)
  }

  function unregisterFromClash() {
    if (!linkedPlayer) return
    var sid = String(linkedPlayer.id)
    setTournamentState(function (ts) {
      var ids = ts.registeredIds || []
      return Object.assign({}, ts, { registeredIds: ids.filter(function (id) { return id !== sid }) })
    })
    if (supabase.from && tournamentState.dbTournamentId) {
      supabase.from('registrations').delete()
        .eq('tournament_id', tournamentState.dbTournamentId)
        .eq('player_id', linkedPlayer.id)
        .then(function (r) { if (r.error) console.error('[TFT] unregister failed:', r.error) })
    }
    toast('Unregistered from ' + clashName, 'info')
    setTournamentState(function (ts2) {
      var wl = ts2.waitlistIds || []
      if (wl.length === 0) return ts2
      var promoted = wl[0]
      var remainingWl = wl.slice(1)
      var newRegIds = (ts2.registeredIds || []).concat([promoted])
      return Object.assign({}, ts2, { registeredIds: newRegIds, waitlistIds: remainingWl })
    })
  }

  function removeFromWaitlist() {
    if (!linkedPlayer) return
    var sid = String(linkedPlayer.id)
    setTournamentState(function (ts) {
      var wl = ts.waitlistIds || []
      return Object.assign({}, ts, { waitlistIds: wl.filter(function (id) { return id !== sid }) })
    })
    toast('Removed from waitlist', 'info')
  }

  // Build phase action button
  var phaseActionBtn = null
  if (tPhase === 'registration') {
    if (isMyRegistered) {
      phaseActionBtn = <Btn variant="ghost" size="sm" onClick={unregisterFromClash}>Unregister</Btn>
    } else if (isMyWaitlisted) {
      phaseActionBtn = <Btn variant="ghost" size="sm" onClick={removeFromWaitlist}>Leave Waitlist</Btn>
    } else if (linkedPlayer && profileComplete) {
      phaseActionBtn = <Btn variant="primary" size="sm" onClick={registerFromAccount}>Register</Btn>
    } else if (!profileComplete) {
      phaseActionBtn = <Btn variant="primary" size="sm" onClick={function () { setScreen('account') }}>Complete Profile</Btn>
    }
  } else if (tPhase === 'checkin') {
    if (!myCheckedIn && isMyRegistered) {
      phaseActionBtn = <Btn variant="primary" size="sm" onClick={handleCheckIn}>Check In Now</Btn>
    } else if (myCheckedIn) {
      phaseActionBtn = <span className="text-xs font-bold text-success">Checked In</span>
    }
  } else if (tPhase === 'inprogress') {
    phaseActionBtn = <Btn variant="secondary" size="sm" onClick={function () { setScreen('bracket') }}>Watch Live</Btn>
  } else if (tPhase === 'complete') {
    phaseActionBtn = <Btn variant="secondary" size="sm" onClick={function () { setScreen('results') }}>View Results</Btn>
  }

  function handleViewPlayer(p) {
    setProfilePlayer(p)
    setScreen('profile')
  }

  function handleViewProfile() {
    if (linkedPlayer) {
      setProfilePlayer(linkedPlayer)
      setScreen('profile')
    }
  }

  // Ticker items
  var tickerItems = (tickerOverrides || []).filter(function (t) { return t && (typeof t === 'string' ? t.trim() : t.text) })

  return (
    <PageLayout maxWidth="max-w-[880px]">
      {/* Announcements */}
      {announcement && <AnnouncementStrip text={announcement} />}
      {hostAnnouncements && hostAnnouncements.length > 0 && (
        <AnnouncementStrip text={hostAnnouncements[0].msg} variant="host" />
      )}

      {/* Pulse Header - player identity + countdown */}
      <PulseHeader
        linkedPlayer={linkedPlayer}
        currentUser={currentUser}
        myRankIdx={myRankIdx}
        rankDelta={rankDelta}
        currentTierInfo={currentTierInfo}
        nextTier={nextTier}
        ptsToNextTier={ptsToNextTier}
        tPhase={tPhase}
        tRound={tRound}
        registeredCount={registeredCount}
        checkedInCount={checkedInCount}
        tournamentState={tournamentState}
        clashName={clashName}
        clashDate={clashDate}
        clashTime={clashTime}
        diff={diff}
        D={D}
        H={H}
        M={M}
        S={S}
        isMyRegistered={isMyRegistered}
        isMyWaitlisted={isMyWaitlisted}
        myWaitlistPos={myWaitlistPos}
        myCheckedIn={myCheckedIn}
        profileComplete={profileComplete}
        phaseActionBtn={phaseActionBtn}
        pointsTrend={pointsTrend}
      />

      {/* Flash tournament banner */}
      <FlashTournamentBanner
        tournament={upcomingTournament}
        onView={function () { navigate('/flash/' + upcomingTournament.id) }}
      />

      {/* Two-column layout: Season stats left, Standings + Activity right */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Left col (3/5): Season Trajectory + Recent Form */}
        <div className="md:col-span-3 space-y-6">
          <SeasonTrajectoryCard
            linkedPlayer={linkedPlayer}
            s2={s2}
            clashHistory={clashHistory}
            pointsTrend={pointsTrend}
            lastClash={lastClash}
            currentStreak={currentStreak}
            streakType={streakType}
            onViewProfile={handleViewProfile}
          />
          <RecentFormCard
            linkedPlayer={linkedPlayer}
            clashHistory={clashHistory}
            onViewProfile={handleViewProfile}
          />
        </div>

        {/* Right col (2/5): Standings + Activity */}
        <div className="md:col-span-2 space-y-6">
          <StandingsMini
            top5={top5}
            linkedPlayer={linkedPlayer}
            onViewPlayer={handleViewPlayer}
            onViewAll={function () { navigate('/standings') }}
          />
          <ActivityFeed items={activityFeed} />
        </div>
      </div>

      {/* Ticker */}
      {tickerItems.length > 0 && (
        <div
          className="overflow-hidden rounded-sm mt-6"
          style={{ background: 'rgba(155,114,207,.03)', border: '1px solid rgba(155,114,207,.08)' }}
        >
          <div className="ticker-scroll">
            {[].concat(tickerItems, tickerItems).map(function (item, i) {
              return (
                <span
                  key={i}
                  className="inline-flex items-center px-5 py-2 text-[11px] text-on-surface/60 font-semibold whitespace-nowrap"
                  style={{ borderRight: '1px solid rgba(155,114,207,.08)' }}
                >
                  {typeof item === 'object' ? item.text : item}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </PageLayout>
  )
}
