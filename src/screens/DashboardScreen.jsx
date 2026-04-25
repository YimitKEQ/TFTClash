import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getStats } from '../lib/stats.js'
import { ordinal } from '../lib/utils.js'
import { writeActivityEvent } from '../lib/notifications.js'
import { supabase } from '../lib/supabase.js'
import useCountdown from '../lib/useCountdown'
import PageLayout from '../components/layout/PageLayout'
import { Btn, Panel, Icon } from '../components/ui'
import SponsorShowcase from '../components/shared/SponsorShowcase'
import { DISCORD_URL } from '../lib/constants'
import { LEADERBOARD_TIERS as TIER_THRESHOLDS, getPlayerTierInfo, getNextTierInfo } from '../lib/tiers.js'
import { canRegisterInRegion, regionMismatchMessage } from '../lib/regions.js'
import { RegionBadge } from '../components/shared'
import WatchlistPanel from '../components/shared/WatchlistPanel'
import NextMilestoneCard from '../components/shared/NextMilestoneCard'
import { tickStreak, streakTier } from '../lib/loginStreak.js'

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
            key={"bar-" + i}
            className={'w-full rounded-t-sm ' + alphaClass + (isLast ? ' bg-gradient-to-t from-secondary/40 to-secondary' : '')}
            style={{ height: pct + '%' }}
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
            key={"form-" + i}
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
      className={'flex items-center gap-2.5 rounded px-4 py-2.5 mb-3 border ' + (isHost ? 'bg-secondary/5 border-secondary/20' : 'bg-primary/[0.06] border-primary/20')}
    >
      <Icon name="campaign" size={16} className={isHost ? 'text-secondary flex-shrink-0' : 'text-primary flex-shrink-0'} />
      <span className={'font-semibold text-sm ' + (isHost ? 'text-secondary' : 'text-primary')}>{text}</span>
    </div>
  )
}

// --- PULSE HEADER (stitch-matched) ---

function PulseHeader({
  linkedPlayer, currentUser, myRankIdx, totalPlayers, rankDelta, currentTierInfo,
  nextTier, ptsToNextTier, tPhase, tRound, registeredCount, checkedInCount,
  tournamentState, clashName, clashDate, clashTime, diff, D, H, M, S,
  isMyRegistered, isMyWaitlisted, myWaitlistPos, myCheckedIn, profileComplete,
  phaseActionBtn, pointsTrend
}) {
  var phaseLabel = tPhase === 'registration' ? 'Registration Open'
    : tPhase === 'checkin' ? 'Check-in Open'
    : tPhase === 'inprogress' ? 'LIVE - Game ' + tRound + '/' + (tournamentState.totalGames || 4)
    : tPhase === 'complete' ? 'Results Posted'
    : 'Next Clash'

  var playerName = linkedPlayer ? linkedPlayer.name : (currentUser && currentUser.username ? currentUser.username : 'Summoner')
  var playerRank = linkedPlayer ? (linkedPlayer.rank || 'Unranked') : ''
  var topPct = (myRankIdx && totalPlayers > 0) ? Math.max(1, Math.round((myRankIdx / totalPlayers) * 100)) : null
  var seasonLabel = currentTierInfo ? ('Season - Top ' + (topPct !== null ? topPct : '?') + '%') : 'Season'

  // Format countdown as HH:MM:SS for primary display
  var countdownStr = (H < 10 ? '0' + H : '' + H) + ':' + (M < 10 ? '0' + M : '' + M) + ':' + (S < 10 ? '0' + S : '' + S)
  if (D > 0) countdownStr = D + 'd ' + countdownStr

  return (
    <section className="relative overflow-hidden p-8 rounded-lg border border-secondary/10 mb-6 bg-surface-container/60 backdrop-blur-2xl shadow-[inset_0_0_20px_rgba(217,185,255,0.15)]"
    >
      {/* Top-right countdown */}
      <div className="absolute top-0 right-0 p-4 text-right">
        <div className="flex items-center gap-2 justify-end">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="font-label uppercase text-[10px] tracking-widest text-on-surface/40">
            {phaseLabel}
          </span>
        </div>
        <div className="font-mono text-2xl text-primary mt-1">{countdownStr}</div>
        {diff > 0 && clashName && (
          <div className="font-label text-[10px] text-on-surface/40 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{clashName}{clashDate ? ' - ' + clashDate : ''}</span>
            {tournamentState.region && <RegionBadge region={tournamentState.region} size="sm" />}
          </div>
        )}
        {Array.isArray(tournamentState.prizePool) && tournamentState.prizePool[0] && (
          <div className="mt-1 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-medal-gold">
            {tournamentState.prizePool[0].image ? (
              <img src={tournamentState.prizePool[0].image} alt="1st prize" className="w-5 h-5 rounded object-cover border border-medal-gold/40" loading="lazy" />
            ) : (
              <Icon name="redeem" size={10} />
            )}
            <span className="truncate max-w-[220px]">{tournamentState.prizePool[0].prize}</span>
          </div>
        )}
        {tournamentState.isFinale && (
          <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-medal-gold">
            <Icon name="emoji_events" size={10} /> Season Finale
          </div>
        )}
      </div>

      {/* Player identity row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 relative z-10 pr-24">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div
            className="w-20 h-20 rounded-full border-4 border-secondary/40 p-1 shadow-[0_0_20px_rgba(217,185,255,0.3)]"
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
              className="absolute -bottom-1 -right-1 px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-tighter bg-secondary text-on-secondary-fixed"
            >
              {currentTierInfo.name.toUpperCase()}
            </div>
          )}
        </div>

        {/* Name + season label */}
        <div>
          <h1 className="font-editorial text-2xl sm:text-4xl text-on-surface leading-none italic">{playerName}</h1>
          <p className="font-label text-xs uppercase tracking-[0.2em] text-secondary mt-2">
            {linkedPlayer
              ? ('Season - ' + (playerRank ? playerRank + ' - ' : '') + 'Top ' + (totalPlayers > 0 ? Math.max(1, Math.round((myRankIdx / totalPlayers) * 100)) : myRankIdx) + '%')
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
    <Panel>
      {/* Header */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <span className="font-label uppercase text-xs tracking-widest text-on-surface/40 block mb-1">Season Trajectory</span>
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
        <div className="h-24 w-full flex items-center justify-center">
          <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface/20">Play your first clash to see trajectory</span>
        </div>
      )}
    </Panel>
  )
}

// --- RECENT FORM CARD (stitch-matched) ---

function RecentFormCard({ linkedPlayer, clashHistory, onViewProfile }) {
  if (!linkedPlayer) return null

  var recent = (clashHistory || []).slice(-5)

  return (
    <Panel>
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-label uppercase text-xs tracking-widest text-on-surface/40">
          Recent Form (Last {recent.length})
        </h3>
        {recent.length > 0 && <FormCircles history={recent} />}
      </div>

      {recent.length === 0 ? (
        <div className="py-6 text-center">
          <span className="text-on-surface/40 text-xs font-label uppercase tracking-widest">No clashes yet</span>
          <p className="text-on-surface/30 text-[10px] font-mono mt-1">Register for the next one to start your form streak.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recent.slice(-2).map(function (h, i) {
            var p = h.placement || h.place || 1
            var isTop4 = p <= 4
            var gameLabel = h.comp || ('Game ' + (h.clashId || (i + 1)))
            var timeStr = h.date || ''
            return (
              <div
                key={h.clashId || ("recent-" + i)}
                className={'flex items-center justify-between p-3 bg-surface-container rounded border-l-4 ' + (isTop4 ? 'border-tertiary' : 'border-outline-variant/30')}
              >
                <div className="flex items-center gap-3">
                  <span className={'font-mono font-bold ' + (isTop4 ? 'text-tertiary' : 'text-on-surface/60')}>
                    {'#' + p}
                  </span>
                  <span className="font-label uppercase text-xs tracking-widest text-on-surface">{gameLabel}</span>
                </div>
                <span className="text-[10px] font-mono text-on-surface/40">{timeStr}</span>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

// --- STANDINGS MINI (stitch-matched) ---

function StandingsMini({ top5, linkedPlayer, onViewPlayer, onViewAll }) {
  return (
    <Panel>
      <h3 className="font-label uppercase text-xs tracking-widest text-on-surface/40 mb-4">
        Clash Standings
      </h3>
      <div className="space-y-2">
        {top5.length === 0 && (
          <div className="py-6 text-center">
            <div className="text-on-surface/40 text-xs font-label uppercase tracking-widest mb-1">Waiting for first clash</div>
            <div className="text-on-surface/30 text-[10px] font-mono">Standings unlock when results are in.</div>
          </div>
        )}
        {top5.slice(0, 4).map(function (p, i) {
          var isMe = linkedPlayer && p.id === linkedPlayer.id
          var isLast = i === (Math.min(top5.length, 4) - 1)
          return (
            <div
              key={p.id || p.name}
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
      <Btn
        variant="secondary"
        size="sm"
        className="w-full mt-4"
        onClick={function () { onViewAll && onViewAll() }}
      >
        View Full Standings
      </Btn>
    </Panel>
  )
}

// --- ACTIVITY FEED (stitch-matched) ---

function ActivityFeed({ items, hasMore, onLoadMore, loading }) {
  var hasItems = items && items.length > 0

  var displayItems = hasItems ? items.map(function (item) {
    return {
      id: item.id,
      icon: item.icon || 'notifications',
      message: item.message || (item.detail_json && item.detail_json.text) || '',
      timeStr: item.created_at
        ? new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        : ''
    }
  }) : []

  return (
    <Panel className="overflow-hidden relative">
      {/* Decorative blur */}
      <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-secondary/5 rounded-full blur-3xl" />
      <h3 className="font-label uppercase text-xs tracking-widest text-on-surface/40 mb-4">Live Activity</h3>
      {displayItems.length === 0 ? (
        <div className="py-6 text-center">
          <div className="text-on-surface/40 text-xs font-label uppercase tracking-widest mb-1">Activity feed is quiet</div>
          <div className="text-on-surface/30 text-[10px] font-mono">Check-ins, wins, and milestones land here live.</div>
        </div>
      ) : (
        <div className="space-y-4">
          {displayItems.map(function (item, idx) {
            return (
              <div key={item.id || item.message} className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center">
                  <Icon name={item.icon} size={16} className="text-on-surface/60" />
                </div>
                <div>
                  <p className="text-xs text-on-surface/80">{item.message}</p>
                  <span className="text-[10px] font-mono text-on-surface/30">{item.timeStr}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {hasMore && (
        <Btn
          variant="link"
          className="mt-4 w-full justify-center text-on-surface/40 hover:text-on-surface/70 hover:no-underline"
          onClick={onLoadMore}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Load more'}
        </Btn>
      )}
    </Panel>
  )
}

// --- FLASH TOURNAMENT BANNER ---

function FlashTournamentBanner(props) {
  var tournament = props.tournament
  var onView = props.onView
  var isRegistered = props.isRegistered
  if (!tournament) return null
  return (
    <div
      className="flex items-center gap-3 p-4 rounded-lg border border-tertiary/20 mb-6 cursor-pointer hover:bg-surface-container transition-colors bg-tertiary/[0.04]"
      onClick={onView}
    >
      <Icon name="bolt" fill size={18} className="text-tertiary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-label text-[10px] font-bold uppercase tracking-widest text-tertiary mb-0.5">Flash Tournament</div>
        <div className="font-bold text-sm text-on-surface truncate">{tournament.name}</div>
      </div>
      {isRegistered ? (
        <span className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-success/15 border border-success/30 text-success font-label text-[10px] font-bold uppercase tracking-widest">
          <Icon name="check_circle" size={12} /> Registered
        </span>
      ) : (
        <Btn variant="primary" size="sm">Register</Btn>
      )}
    </div>
  )
}

// --- CLASH COUNTDOWN ---

function ClashCountdown(props) {
  var target = props.target
  var _state = useState(function() {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 }
  })
  var t = _state[0]
  var setT = _state[1]

  useEffect(function() {
    function calc() {
      var diff = Math.max(0, new Date(target) - new Date())
      return {
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000)
      }
    }
    setT(calc())
    var iv = setInterval(function() { setT(calc()) }, 1000)
    return function() { clearInterval(iv) }
  }, [target])

  function p(n) { return String(n).padStart(2, '0') }

  if (t.days > 0) {
    return <span className="font-display text-5xl text-primary tracking-tight">{t.days}d {p(t.hours)}:{p(t.minutes)}:{p(t.seconds)}</span>
  }
  return <span className="font-display text-5xl text-primary tracking-tight">{p(t.hours)}:{p(t.minutes)}:{p(t.seconds)}</span>
}

// --- COMPLETE TOP THREE ---

function CompleteTopThree(props) {
  var tournamentState = props.tournamentState
  var results = tournamentState.results || []
  var top3 = results.slice(0, 3)
  if (!top3.length) return null

  return (
    <div>
      {top3.map(function(r, i) {
        var pName = typeof r === 'string' ? r : (r.name || ('Player ' + (i + 1)))
        var pts = typeof r === 'object' ? r.pts : null
        return (
          <div key={pName + '-' + (i + 1)} className={'flex items-center gap-2 py-1.5 ' + (i < 2 ? 'border-b border-white/[0.04]' : '')}>
            <div className={
              'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold font-mono flex-shrink-0 ' +
              (i === 0 ? 'bg-primary text-on-primary' : 'bg-white/[0.08] text-on-surface-variant')
            }>
              {i + 1}
            </div>
            <span className={'text-sm font-semibold ' + (i === 0 ? 'text-on-surface' : 'text-on-surface/70')}>{pName}</span>
            {pts !== null && (
              <span className={'ml-auto font-mono text-xs font-bold ' + (i === 0 ? 'text-primary' : 'text-on-surface-variant')}>
                +{pts} pts
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// --- CLASH CARD ---

function ClashCard() {
  var ctx = useApp()
  var currentUser = ctx.currentUser
  var players = ctx.players || []
  var setPlayers = ctx.setPlayers
  var tournamentState = ctx.tournamentState || {}
  var setTournamentState = ctx.setTournamentState
  var seasonConfig = ctx.seasonConfig || {}
  var pendingResults = ctx.pendingResults
  var toast = ctx.toast
  var navigate = useNavigate()

  var _showPicker = useState(false)
  var showPicker = _showPicker[0]
  var setShowPicker = _showPicker[1]
  var _selectedPlace = useState(0)
  var selectedPlace = _selectedPlace[0]
  var setSelectedPlace = _selectedPlace[1]
  var _submitting = useState(false)
  var submitting = _submitting[0]
  var setSubmitting = _submitting[1]

  var phase = tournamentState.phase || 'idle'
  var clashTimestamp = tournamentState.clashTimestamp
  var hasCountdown = clashTimestamp && new Date(clashTimestamp) > new Date()

  var linkedPlayer = currentUser && players.find(function(p) {
    return p.name === (currentUser.username || currentUser.name)
  })

  var sortedPlayers = players.slice().sort(function(a, b) { return (b.pts || 0) - (a.pts || 0) })
  var myRank = linkedPlayer
    ? sortedPlayers.findIndex(function(p) { return p.id === linkedPlayer.id }) + 1
    : null

  var seasonName = seasonConfig.seasonName || 'Season 1'
  var clashName = tournamentState.clashName || (tournamentState.clashNumber ? 'Clash Week ' + tournamentState.clashNumber : 'Clash')
  var registeredCount = (tournamentState.registeredIds || []).length
  var maxPlayers = tournamentState.maxPlayers || 24
  var tRound = tournamentState.round || 1
  var totalGames = tournamentState.totalGames || 3

  var linkedPlayerId = linkedPlayer ? String(linkedPlayer.id) : null
  var isRegistered = linkedPlayerId && (tournamentState.registeredIds || []).indexOf(linkedPlayerId) > -1
  var isCheckedIn  = linkedPlayerId && (tournamentState.checkedInIds  || []).indexOf(linkedPlayerId) > -1

  var server = tournamentState.server || 'EU'
  var riotField = server === 'NA' ? 'riot_id_na' : 'riot_id_eu'
  var linkedRiotId = currentUser ? (currentUser[riotField] || '') : ''
  var canRegister = isRegistered || !!linkedRiotId

  var myLobby = null
  var lobbies = tournamentState.lobbies || []
  if (currentUser) {
    for (var i = 0; i < lobbies.length; i++) {
      var lob = lobbies[i]
      var lobPlayers = lob.players || lob.playerIds || []
      var inLobby = lobPlayers.some(function(pid) {
        if (typeof pid === 'object') return pid.id === currentUser.id || pid.name === currentUser.username
        return pid === currentUser.id
      })
      if (inLobby) { myLobby = lob; break; }
    }
  }
  var lobbyPlayerList = myLobby
    ? (myLobby.players && myLobby.players.length > 0
        ? myLobby.players
        : (myLobby.playerIds || []).map(function(pid) {
            var found = players.find(function(p) { return p.id === pid || String(p.id) === String(pid) })
            return found ? { name: found.username || found.name } : null
          }).filter(Boolean)
      )
    : []
  var lobbyNames = lobbyPlayerList.map(function(p) { return typeof p === 'object' ? (p.name || p.username) : p }).join(' \u00b7 ')
  var lobbyNum = myLobby ? (myLobby.num || myLobby.number || myLobby.id || '?') : '?'

  var myLobbyNumber = 1
  if (tournamentState.lobbies) {
    tournamentState.lobbies.forEach(function(lobby, idx) {
      var lobPlayers = lobby.players || lobby.playerIds || []
      lobPlayers.forEach(function(pid) {
        var pidVal = typeof pid === 'object' ? pid.id : pid
        if (pidVal === (currentUser && currentUser.id)) myLobbyNumber = idx + 1
      })
    })
  }

  var mySubmission = pendingResults && pendingResults.find(function(r) {
    return r.round === tournamentState.round && r.status !== 'disputed'
  })

  function handleSubmitPlacement() {
    if (!selectedPlace || !currentUser || !tournamentState.id) return
    setSubmitting(true)
    supabase.from('pending_results').upsert({
      tournament_id: tournamentState.id,
      round: tournamentState.round,
      lobby_number: myLobbyNumber,
      player_id: currentUser.id,
      placement: selectedPlace,
      status: 'pending'
    }, { onConflict: 'tournament_id,round,player_id' })
    .then(function(res) {
      setSubmitting(false)
      if (res.error) {
        toast('Failed to submit placement. Try again.', 'error')
        return
      }
      setShowPicker(false)
      setSelectedPlace(0)
      toast('Placement submitted!', 'success')
    }).catch(function() { setSubmitting(false); toast('Failed to submit placement', 'error'); })
  }

  function registerFromAccount() {
    if (!currentUser) return
    if (!linkedPlayer) { toast('Account not linked to a player profile', 'error'); return }
    if (!linkedRiotId) { toast('Set your Riot ID on the Account page first', 'error'); navigate('/account'); return }
    if (!tournamentState.dbTournamentId) { toast('Registration is not open yet. Wait for a host to open the next clash.', 'error'); return }
    if (linkedPlayer.banned) { toast('Your account is banned from registration. Contact an admin.', 'error'); return }
    if ((linkedPlayer.dnpCount || 0) >= 3) { toast('You have 3 no-shows. Ask an admin to clear your strikes before re-registering.', 'error'); return }
    if (!canRegisterInRegion(linkedPlayer.region, tournamentState.region)) {
      var regMsg = regionMismatchMessage(linkedPlayer.region, tournamentState.region)
      toast(regMsg || 'Region mismatch. Check your account region.', 'error')
      if (!linkedPlayer.region) navigate('/account')
      return
    }
    var sid = String(linkedPlayer.id)
    if ((tournamentState.registeredIds || []).indexOf(sid) > -1) { toast("You're already registered!", 'error'); return }
    if ((tournamentState.waitlistIds || []).indexOf(sid) > -1) { toast("You're already on the waitlist!", 'error'); return }
    var maxCap = parseInt(tournamentState.maxPlayers || 24, 10)
    var regCount = (tournamentState.registeredIds || []).length
    if (regCount >= maxCap) {
      if (setTournamentState) {
        setTournamentState(function(ts) {
          var wl = ts.waitlistIds || []
          if (wl.indexOf(sid) > -1) return ts
          return Object.assign({}, ts, { waitlistIds: wl.concat([sid]) })
        })
      }
      toast(currentUser.username + ' added to waitlist', 'info')
      return
    }
    if (setTournamentState) {
      setTournamentState(function(ts) {
        var ids = ts.registeredIds || []
        return ids.indexOf(sid) > -1 ? ts : Object.assign({}, ts, { registeredIds: ids.concat([sid]) })
      })
    }
    if (supabase.from) {
      supabase.from('registrations').upsert({
        tournament_id: tournamentState.dbTournamentId,
        player_id: linkedPlayer.id,
        status: 'registered'
      }, { onConflict: 'tournament_id,player_id' }).then(function(r) {
        if (r.error) {
          toast('Registration failed: ' + (r.error.message || 'unknown'), 'error')
          if (setTournamentState) {
            setTournamentState(function(ts) {
              return Object.assign({}, ts, { registeredIds: (ts.registeredIds || []).filter(function(id) { return id !== sid }) })
            })
          }
        }
      }).catch(function() {
        toast('Registration failed - check your connection', 'error')
        if (setTournamentState) {
          setTournamentState(function(ts) {
            return Object.assign({}, ts, { registeredIds: (ts.registeredIds || []).filter(function(id) { return id !== sid }) })
          })
        }
      })
    }
    toast(currentUser.username + ' registered for ' + clashName + '!', 'success')
    writeActivityEvent('registration', linkedPlayer.id, currentUser.username + ' registered for ' + clashName)
  }

  function unregisterFromClash() {
    if (!linkedPlayer) return
    var sid = String(linkedPlayer.id)
    if (setTournamentState) {
      setTournamentState(function(ts) {
        var ids = ts.registeredIds || []
        return Object.assign({}, ts, { registeredIds: ids.filter(function(id) { return id !== sid }) })
      })
    }
    if (supabase.from && tournamentState.dbTournamentId) {
      supabase.from('registrations').delete()
        .eq('tournament_id', tournamentState.dbTournamentId)
        .eq('player_id', linkedPlayer.id)
        .then(function(r) { if (r.error) toast('Unregister may not have saved', 'error') })
        .catch(function() { toast('Unregister may not have saved', 'error') })
    }
    toast('Unregistered from ' + clashName, 'info')
  }

  function handleCheckIn() {
    if (!linkedPlayer) return
    var sid = String(linkedPlayer.id)
    if (setPlayers) {
      setPlayers(function(ps) {
        return ps.map(function(p) {
          return p.id === linkedPlayer.id ? Object.assign({}, p, { checkedIn: true }) : p
        })
      })
    }
    if (setTournamentState) {
      setTournamentState(function(ts) {
        var ids = ts.checkedInIds || []
        return ids.indexOf(sid) > -1 ? ts : Object.assign({}, ts, { checkedInIds: ids.concat([sid]) })
      })
    }
    if (supabase.from && tournamentState.dbTournamentId) {
      supabase.from('registrations').update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
        .eq('tournament_id', tournamentState.dbTournamentId)
        .eq('player_id', linkedPlayer.id)
        .then(function(r) { if (r.error) toast('Check-in may not have saved', 'error') })
        .catch(function() { toast('Check-in may not have saved', 'error') })
    }
    toast("You're checked in! Good luck, " + linkedPlayer.name, 'success')
  }

  var phaseTagMap = {
    idle:         { label: 'Next clash TBA',                          cls: 'bg-surface-container text-on-surface-variant',                  icon: 'schedule', dot: false },
    registration: { label: 'Registration Open',                       cls: 'bg-primary/10 text-primary border border-primary/20',            icon: 'how_to_reg', dot: false },
    checkin:      { label: 'Check-In Open',                           cls: 'bg-primary/10 text-primary border border-primary/20',            icon: 'fact_check', dot: false },
    live:         { label: 'Live \u00b7 Round ' + tRound + ' of ' + totalGames, cls: 'bg-tertiary/10 text-tertiary border border-tertiary/20', icon: null, dot: true },
    inprogress:   { label: 'Live \u00b7 Round ' + tRound + ' of ' + totalGames, cls: 'bg-tertiary/10 text-tertiary border border-tertiary/20', icon: null, dot: true },
    complete:     { label: clashName + ' Complete',                   cls: 'bg-secondary/10 text-secondary border border-secondary/20',      icon: 'military_tech', dot: false },
  }
  var phaseTag = phaseTagMap[phase] || phaseTagMap.idle

  var weekNum = (tournamentState && tournamentState.clashNumber) || 1
  var weekLabel = seasonName + ' \u00b7 Week ' + weekNum

  return (
    <div className="rounded-xl overflow-hidden border border-outline-variant/10 mb-6 bg-[rgba(52,52,60,0.5)] backdrop-blur-[24px]"
    >
      <div className="p-5 pb-4">
        <div className="flex items-baseline justify-between mb-1">
          <span className="font-display text-base font-bold text-on-surface">
            {weekLabel}
          </span>
          {linkedPlayer && (
            <span className="font-label text-xs text-on-surface-variant uppercase tracking-widest">
              {linkedPlayer.rank || ''} &middot; {linkedPlayer.region || 'EUW'}
            </span>
          )}
        </div>
        <div className="font-label text-xs text-on-surface-variant mb-3">
          {currentUser ? (currentUser.username || 'Summoner') : 'Not signed in'}
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white/[0.04] rounded-lg p-2.5">
            <div className="font-mono text-base font-bold text-primary leading-none">
              {linkedPlayer ? (linkedPlayer.pts || 0).toLocaleString() : '\u2014'}
            </div>
            <div className="font-label text-[9px] uppercase tracking-widest text-on-surface-variant mt-1">Season PTS</div>
          </div>
          <div className="bg-white/[0.04] rounded-lg p-2.5">
            <div className="font-mono text-base font-bold text-on-surface leading-none">
              {linkedPlayer ? (linkedPlayer.wins || 0) : '\u2014'}
            </div>
            <div className="font-label text-[9px] uppercase tracking-widest text-on-surface-variant mt-1">Wins</div>
          </div>
          <div className="bg-white/[0.04] rounded-lg p-2.5">
            <div className="font-mono text-base font-bold text-tertiary leading-none">
              {myRank ? ('#' + myRank) : '\u2014'}
            </div>
            <div className="font-label text-[9px] uppercase tracking-widest text-on-surface-variant mt-1">Standing</div>
          </div>
          <div className="bg-white/[0.04] rounded-lg p-2.5">
            <div className="font-mono text-base font-bold text-on-surface leading-none">
              {linkedPlayer ? (linkedPlayer.games || 0) : '\u2014'}
            </div>
            <div className="font-label text-[9px] uppercase tracking-widest text-on-surface-variant mt-1">Clashes</div>
          </div>
        </div>
      </div>

      <div className="h-px mx-5 bg-white/[0.05]"></div>

      <div className="p-5 pt-4">
        <div className={'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-label font-bold uppercase tracking-wider mb-3 ' + phaseTag.cls}>
          {phaseTag.dot && <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>}
          {phaseTag.icon && <Icon name={phaseTag.icon} size={12} />}
          {phaseTag.label}
        </div>

        {(phase === 'idle') && (
          <div className="flex flex-col items-center text-center gap-3 py-2">
            <div className="w-12 h-12 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center">
              <Icon name="swords" size={24} className="text-primary" />
            </div>
            <div>
              <div className="font-display text-sm font-bold text-on-surface mb-1">No clash this week - yet</div>
              <div className="text-xs text-on-surface/40 leading-relaxed max-w-[220px] mx-auto">Next clash is scheduled for Saturday night. Registration opens 24h before.</div>
            </div>
            <div className="cond text-[9px] font-bold uppercase tracking-widest text-on-surface/30 px-3 py-1.5 rounded-full border border-on-surface/10 bg-on-surface/[0.02]">
              Next: Saturday - 20:00 CET
            </div>
            <div className="flex gap-2 w-full">
              <Btn variant="primary" size="sm" className="flex-1" onClick={function() { navigate('/standings') }}>View Standings</Btn>
              <Btn variant="ghost" size="sm" className="flex-1" onClick={function() { navigate('/events') }}>Browse Events</Btn>
            </div>
          </div>
        )}

        {(phase === 'registration') && (
          <div>
            {hasCountdown && (
              <div className="mb-1">
                <ClashCountdown target={clashTimestamp} />
              </div>
            )}
            <div className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-3">
              {registeredCount + '/' + maxPlayers + ' registered \u00b7 ' + server + ' week'}
            </div>
            {linkedRiotId ? (
              <div className="flex items-center gap-2 bg-tertiary/[0.05] border border-tertiary/15 rounded-lg p-2.5 mb-3">
                <Icon name="sports_esports" size={16} className="text-tertiary flex-shrink-0" />
                <div>
                  <div className="font-label text-[9px] uppercase tracking-widest text-on-surface-variant">{'Your ' + server + ' account'}</div>
                  <div className="font-mono text-sm font-semibold">{linkedRiotId}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-primary/[0.06] border border-primary/20 rounded-lg p-2.5 mb-3">
                <Icon name="warning" size={16} className="text-primary flex-shrink-0" />
                <div className="text-[12px] text-primary">{'Link your ' + server + ' Riot ID in Account settings before registering.'}</div>
              </div>
            )}
            <div className="flex gap-2">
              <Btn
                variant={isRegistered ? 'ghost' : 'primary'}
                size="sm"
                className="flex-[2]"
                disabled={!canRegister}
                onClick={function() { if (isRegistered) { unregisterFromClash() } else { registerFromAccount() } }}
              >
                {isRegistered ? 'Registered (tap to unregister)' : 'Register Now'}
              </Btn>
              {(!linkedRiotId && !isRegistered)
                ? <Btn variant="ghost" size="sm" className="flex-1" onClick={function() { navigate('/account') }}>Go to Account</Btn>
                : <Btn variant="ghost" size="sm" className="flex-1" onClick={function() { navigate('/clash') }}>{"Who's In"}</Btn>
              }
            </div>
          </div>
        )}

        {(phase === 'checkin') && (
          <div>
            {hasCountdown && (
              <div className="mb-1">
                <ClashCountdown target={clashTimestamp} />
              </div>
            )}
            <div className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-3">
              Until clash starts
            </div>
            <Btn
              variant={isCheckedIn ? 'ghost' : 'primary'}
              size="sm"
              className="w-full"
              disabled={isCheckedIn || !linkedPlayer}
              onClick={function() { if (!isCheckedIn) { handleCheckIn() } }}
            >
              {isCheckedIn ? 'Checked In' : 'Check In Now'}
            </Btn>
          </div>
        )}

        {(phase === 'live' || phase === 'inprogress') && (
          <div>
            <div className="text-sm text-on-surface-variant mb-3">{'Round ' + tRound + ' of ' + totalGames}</div>
            {mySubmission ? (
              <div>
                <div className="bg-tertiary/[0.06] border border-tertiary/20 rounded-lg p-3 text-center mb-3">
                  <div className="font-display text-[40px] text-primary leading-none">{ordinal(mySubmission.placement)}</div>
                  <div className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mt-1">{'Your submission \u00b7 Lobby ' + myLobbyNumber}</div>
                  <div className="flex items-center justify-center gap-1 text-[11px] text-tertiary mt-1.5">
                    <Icon name="schedule" size={13} />Waiting for admin to confirm
                  </div>
                </div>
                <div className="text-[11px] text-on-surface-variant text-center">Results lock in once admin confirms all lobbies.</div>
              </div>
            ) : showPicker ? (
              <div>
                <div className="text-[12px] text-on-surface-variant mb-2">{'How did you finish in Lobby ' + myLobbyNumber + '?'}</div>
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {[1,2,3,4,5,6,7,8].map(function(n) {
                    return (
                      <button
                        key={n}
                        onClick={function() { setSelectedPlace(n) }}
                        className={'py-2.5 rounded-lg border text-center cursor-pointer transition-all ' +
                          (selectedPlace === n
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-white/[0.04] border-white/[0.08] text-on-surface/70'
                          )
                        }
                      >
                        <div className="font-mono text-base font-semibold leading-none">{n}</div>
                        <div className="font-label text-[8px] uppercase tracking-wide mt-0.5 opacity-70">{ordinal(n).replace(String(n), '')}</div>
                      </button>
                    )
                  })}
                </div>
                <Btn
                  variant="primary"
                  size="sm"
                  className="w-full mb-1"
                  disabled={!selectedPlace || submitting}
                  onClick={handleSubmitPlacement}
                >
                  {selectedPlace ? ('Confirm ' + ordinal(selectedPlace) + ' Place') : 'Select your placement'}
                </Btn>
                <Btn
                  variant="link"
                  className="w-full justify-center text-on-surface-variant hover:no-underline"
                  onClick={function() { setShowPicker(false); setSelectedPlace(0) }}
                >Cancel</Btn>
              </div>
            ) : (
              <div>
                <div className="flex gap-2">
                  <Btn
                    variant="ghost"
                    size="sm"
                    className="flex-[2] bg-tertiary/10 text-tertiary border border-tertiary/20"
                    onClick={function() { setShowPicker(true) }}
                  >Submit Results</Btn>
                  <Btn variant="ghost" size="sm" className="flex-1" onClick={function() { navigate('/bracket') }}>Live Board</Btn>
                </div>
              </div>
            )}
          </div>
        )}

        {(phase === 'complete') && (
          <div>
            <CompleteTopThree tournamentState={tournamentState} />
            <div className="flex gap-2 mt-3">
              <Btn variant="ghost" size="sm" className="flex-1" onClick={function() { navigate('/results') }}>Full Results</Btn>
              <Btn variant="ghost" size="sm" className="flex-1" onClick={function() { navigate('/standings') }}>Standings</Btn>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// --- ONBOARDING CHECKLIST ---

function OnboardingChecklist(props) {
  var steps = props.steps || []
  if (steps.length === 0) return null
  var done = 0
  for (var i = 0; i < steps.length; i++) { if (steps[i].done) done++ }
  if (done === steps.length) return null
  var pct = Math.round((done / steps.length) * 100)

  return (
    <div className="mb-4 rounded-lg border border-primary/30 bg-gradient-to-br from-primary/10 to-secondary/5 p-5">
      <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="font-display text-sm uppercase tracking-wider text-primary font-bold">Get ready to clash</div>
          <div className="text-[11px] text-on-surface/60 mt-0.5">{done} of {steps.length} complete. Finish these to compete.</div>
        </div>
        <div className="flex-1 max-w-[200px] min-w-[120px] mt-1">
          <div className="h-1.5 bg-outline-variant/20 rounded overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: pct + '%' }} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {steps.map(function (s) {
          var baseCls = 'flex items-center gap-3 p-3 rounded border text-left transition-colors no-underline ' +
            (s.done
              ? 'border-success/30 bg-success/10 cursor-default'
              : 'border-outline-variant/30 bg-surface-container-low/60 hover:bg-surface-container hover:border-primary/40 cursor-pointer')
          var inner = (
            <>
              <div className={'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ' +
                (s.done ? 'bg-success/30 text-success' : 'bg-primary/20 text-primary')}>
                <Icon name={s.done ? 'check' : s.icon} size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className={'text-xs font-bold ' + (s.done ? 'text-on-surface/60 line-through' : 'text-on-surface')}>{s.label}</div>
                <div className="text-[10px] text-on-surface/50 truncate">{s.hint}</div>
              </div>
              {!s.done && <Icon name="arrow_forward" size={14} className="text-on-surface/40 flex-shrink-0" />}
            </>
          )
          if (s.href && !s.done) {
            return (
              <a
                key={s.key}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className={baseCls}
              >
                {inner}
              </a>
            )
          }
          return (
            <button
              key={s.key}
              type="button"
              onClick={s.done ? undefined : s.onClick}
              disabled={s.done}
              className={baseCls}
            >
              {inner}
            </button>
          )
        })}
      </div>
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
  var toast = ctx.toast
  var navigate = useNavigate()

  // Countdown state (shared hook - single source of truth)
  var countdown = useCountdown(tournamentState)
  var clashName = countdown.clashName
  var clashDate = (tournamentState && tournamentState.clashDate) || ''
  var clashTime = (tournamentState && tournamentState.clashTime) || ''
  var diff = countdown.total
  var D = countdown.days
  var H = countdown.hours
  var M = countdown.minutes
  var S = countdown.seconds

  // Daily login streak (localStorage). Bumps on first dashboard mount per UTC day.
  var _streak = useState(function () { return tickStreak() })
  var streak = _streak[0]
  var streakInfo = streakTier(streak.streak || 0)

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

  var _upcomingRegistered = useState(false)
  var upcomingRegistered = _upcomingRegistered[0]
  var setUpcomingRegistered = _upcomingRegistered[1]

  useEffect(function () {
    supabase.from('tournaments').select('*')
      .eq('type', 'flash_tournament')
      .in('phase', ['registration', 'check_in', 'upcoming'])
      .order('date', { ascending: true })
      .limit(1)
      .then(function (res) {
        if (res.data && res.data.length > 0) setUpcomingTournament(res.data[0])
      }).catch(function () {})
  }, [])

  // Activity feed
  var _af = useState([])
  var activityFeed = _af[0]
  var setActivityFeed = _af[1]

  var _afOffset = useState(0)
  var afOffset = _afOffset[0]
  var setAfOffset = _afOffset[1]

  var _afHasMore = useState(false)
  var afHasMore = _afHasMore[0]
  var setAfHasMore = _afHasMore[1]

  var _afLoading = useState(false)
  var afLoading = _afLoading[0]
  var setAfLoading = _afLoading[1]

  useEffect(function () {
    setAfLoading(true)
    supabase.from('activity_feed').select('*')
      .order('created_at', { ascending: false })
      .limit(21)
      .then(function (res) {
        setAfLoading(false)
        if (res.data) {
          var capped = res.data.slice(0, 20)
          setActivityFeed(capped)
          setAfHasMore(res.data.length > 20)
          setAfOffset(0)
        }
      }).catch(function () { setAfLoading(false); })
  }, [tick])

  function handleLoadMoreActivity() {
    var nextOffset = afOffset + 20
    setAfLoading(true)
    supabase.from('activity_feed').select('*')
      .order('created_at', { ascending: false })
      .range(nextOffset, nextOffset + 20)
      .then(function (res) {
        setAfLoading(false)
        if (res.data) {
          setActivityFeed(function (prev) { return prev.concat(res.data.slice(0, 20)) })
          setAfHasMore(res.data.length > 20)
          setAfOffset(nextOffset)
        }
      }).catch(function () { setAfLoading(false); })
  }

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

  var linkedPlayerIdForReg = linkedPlayer ? linkedPlayer.id : null
  var upcomingTournamentId = upcomingTournament ? upcomingTournament.id : null
  useEffect(function () {
    if (!upcomingTournamentId || !linkedPlayerIdForReg) { setUpcomingRegistered(false); return }
    supabase.from('registrations').select('id, status, disqualified')
      .eq('tournament_id', upcomingTournamentId)
      .eq('player_id', linkedPlayerIdForReg)
      .limit(1)
      .then(function (res) {
        var rows = res && res.data ? res.data : []
        var row = rows[0]
        var active = !!row && !row.disqualified && row.status !== 'dropped' && row.status !== 'cancelled'
        setUpcomingRegistered(active)
      }).catch(function () { setUpcomingRegistered(false) })
  }, [upcomingTournamentId, linkedPlayerIdForReg])

  function hasRiotId(p) {
    if (!p) return false
    var fields = [p.riot_id, p.riotId, p.riot_id_eu, p.riot_id_na]
    for (var i = 0; i < fields.length; i++) {
      var v = fields[i]
      if (typeof v === 'string' && v.trim().length > 0 && v.indexOf('#') > 0) return true
    }
    return false
  }
  var profileComplete = hasRiotId(linkedPlayer)

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
        .then(function (r) { if (r.error) toast('Check-in may not have saved', 'error'); })
        .catch(function () { toast('Check-in may not have saved', 'error'); })
    }
    toast("You're checked in! Good luck, " + linkedPlayer.name, 'success')
  }

  function registerFromAccount() {
    if (!currentUser) return
    if (!linkedPlayer) { toast('Account not linked to a player profile', 'error'); return }
    if (!profileComplete) { toast('Set your Riot ID on the Account page first', 'error'); navigate('/account'); return }
    if (!tournamentState.dbTournamentId) { toast('Registration is not open yet. Wait for a host to open the next clash.', 'error'); return }
    if (linkedPlayer.banned) { toast('Your account is banned from registration. Contact an admin.', 'error'); return }
    if ((linkedPlayer.dnpCount || 0) >= 3) { toast('You have 3 no-shows. Ask an admin to clear your strikes before re-registering.', 'error'); return }
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
      supabase.from('registrations').upsert({
        tournament_id: tournamentState.dbTournamentId,
        player_id: linkedPlayer.id,
        status: 'registered'
      }, { onConflict: 'tournament_id,player_id' }).then(function (r) {
        if (r.error) {
          toast('Registration failed: ' + (r.error.message || 'unknown'), 'error');
          setTournamentState(function (ts) {
            return Object.assign({}, ts, { registeredIds: (ts.registeredIds || []).filter(function (id) { return id !== sid }) })
          })
        }
      }).catch(function () {
        toast('Registration failed - check your connection', 'error');
        setTournamentState(function (ts) {
          return Object.assign({}, ts, { registeredIds: (ts.registeredIds || []).filter(function (id) { return id !== sid }) })
        })
      })
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
        .then(function (r) { if (r.error) toast('Unregister may not have saved', 'error'); })
        .catch(function () { toast('Unregister may not have saved', 'error'); })
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
      phaseActionBtn = <Btn variant="primary" size="sm" onClick={function () { navigate('/account') }}>Complete Profile</Btn>
    }
  } else if (tPhase === 'checkin') {
    if (!myCheckedIn && isMyRegistered) {
      phaseActionBtn = <Btn variant="primary" size="sm" onClick={handleCheckIn}>Check In Now</Btn>
    } else if (myCheckedIn) {
      phaseActionBtn = <span className="text-xs font-bold text-success">Checked In</span>
    }
  } else if (tPhase === 'inprogress') {
    phaseActionBtn = <Btn variant="secondary" size="sm" onClick={function () { navigate('/bracket') }}>Watch Live</Btn>
  } else if (tPhase === 'complete') {
    phaseActionBtn = <Btn variant="secondary" size="sm" onClick={function () { navigate('/results') }}>View Results</Btn>
  }

  function handleViewPlayer(p) {
    setProfilePlayer(p)
    navigate('/player/' + p.name)
  }

  function handleViewProfile() {
    if (linkedPlayer) {
      setProfilePlayer(linkedPlayer)
      navigate('/player/' + linkedPlayer.name)
    }
  }

  // Ticker items
  var tickerItems = (tickerOverrides || []).filter(function (t) { return t && (typeof t === 'string' ? t.trim() : t.text) })

  // Season stat cards data
  var totalGames = clashHistory.length
  var wins = clashHistory.filter(function (h) { return (h.placement || h.place) === 1 }).length
  var top4s = clashHistory.filter(function (h) { return (h.placement || h.place) <= 4 }).length
  var winRate = totalGames > 0 ? Math.round((top4s / totalGames) * 100) : 0
  var bestPlacement = totalGames > 0
    ? Math.min.apply(null, clashHistory.map(function (h) { return h.placement || h.place || 8 }))
    : null

  // Season narrative
  var seasonNarrative = generateSeasonNarrative(players, sortedPts)

  // Next upcoming event
  var nextEvent = featuredEvents && featuredEvents.length > 0 ? featuredEvents[0] : null

  // --- Onboarding checklist steps ---
  var onboardingSteps = []
  if (linkedPlayer) {
    onboardingSteps.push({
      key: 'riot',
      done: hasRiotId(linkedPlayer),
      icon: 'badge',
      label: 'Set your Riot ID',
      hint: 'Required for lobby invites',
      onClick: function () { navigate('/account') }
    })
    onboardingSteps.push({
      key: 'region',
      done: !!linkedPlayer.region,
      icon: 'public',
      label: 'Choose your region',
      hint: 'EU or NA, locks your eligibility',
      onClick: function () { navigate('/account') }
    })
    onboardingSteps.push({
      key: 'discord',
      done: !!linkedPlayer.discord_user_id,
      icon: 'forum',
      label: 'Join our Discord',
      hint: 'Lobby invites & community chat',
      href: DISCORD_URL
    })
    if (tPhase === 'registration' || tPhase === 'checkin') {
      onboardingSteps.push({
        key: 'register',
        done: !!(tPhase === 'checkin' ? myCheckedIn : isMyRegistered),
        icon: tPhase === 'checkin' ? 'how_to_reg' : 'event_available',
        label: tPhase === 'checkin' ? 'Check in for the clash' : 'Register for the clash',
        hint: tPhase === 'checkin' ? 'Doors closing soon' : 'Claim your seat before it fills',
        onClick: function () {
          var el = typeof document !== 'undefined' ? document.getElementById('dashboard-clash-card') : null
          if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          else if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      })
    }
  }

  return (
    <PageLayout maxWidth="max-w-[1200px]">
      <div className="mb-8">
        <SponsorShowcase placement="dashboard" variant="featured" />
      </div>

      <OnboardingChecklist steps={onboardingSteps} />

      <div id="dashboard-clash-card">
        <ClashCard />
      </div>

      {/* Announcements */}
      {announcement && <AnnouncementStrip text={announcement} />}
      {hostAnnouncements && hostAnnouncements.length > 0 && (
        <AnnouncementStrip text={hostAnnouncements[0].msg} variant="host" />
      )}

      {/* Daily login streak strip */}
      {streak && streak.streak > 0 && (
        <div className="flex items-center justify-between gap-3 rounded px-4 py-2.5 mb-3 border bg-surface-container/60 border-outline-variant/15 backdrop-blur-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: streakInfo.color + '22', color: streakInfo.color }}>
              <Icon name={streakInfo.icon} size={16} />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-sm font-bold text-on-surface">Day {streak.streak} <span className="font-label text-[10px] uppercase tracking-widest" style={{ color: streakInfo.color }}>{streakInfo.label}</span></div>
              <div className="font-mono text-[10px] text-on-surface/40 truncate">Best {streak.best || streak.streak} - {streak.total} total visits - come back tomorrow to keep it going</div>
            </div>
          </div>
          <span className="font-mono text-[10px] text-on-surface/40 hidden sm:inline">streak</span>
        </div>
      )}

      {/* Pulse Header - player identity + countdown */}
      <PulseHeader
        linkedPlayer={linkedPlayer}
        currentUser={currentUser}
        myRankIdx={myRankIdx}
        totalPlayers={players.length}
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

      {/* Season Stats Row */}
      {linkedPlayer && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Panel padding="tight" className="flex items-center gap-3 hover:bg-surface-container transition-colors">
            <div className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
              <Icon name="sports_esports" size={18} className="text-secondary" />
            </div>
            <div>
              <div className="font-mono text-xl text-on-surface font-bold">{totalGames}</div>
              <div className="font-label text-[10px] uppercase tracking-widest text-on-surface/40">Total Games</div>
            </div>
          </Panel>
          <Panel padding="tight" className="flex items-center gap-3 hover:bg-surface-container transition-colors">
            <div className="w-9 h-9 rounded-full bg-tertiary/10 flex items-center justify-center flex-shrink-0">
              <Icon name="trending_up" size={18} className="text-tertiary" />
            </div>
            <div>
              <div className="font-mono text-xl text-on-surface font-bold">{winRate}%</div>
              <div className="font-label text-[10px] uppercase tracking-widest text-on-surface/40">Top-4 Rate</div>
            </div>
          </Panel>
          <Panel padding="tight" className="flex items-center gap-3 hover:bg-surface-container transition-colors">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon name="emoji_events" size={18} className="text-primary" />
            </div>
            <div>
              <div className="font-mono text-xl text-on-surface font-bold">{bestPlacement !== null ? '#' + bestPlacement : '-'}</div>
              <div className="font-label text-[10px] uppercase tracking-widest text-on-surface/40">Best Place</div>
            </div>
          </Panel>
          <Panel padding="tight" className="flex items-center gap-3 hover:bg-surface-container transition-colors">
            <div className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
              <Icon name="local_fire_department" size={18} className="text-secondary" />
            </div>
            <div>
              <div className="font-mono text-xl text-on-surface font-bold">{currentStreak > 0 ? currentStreak : wins}</div>
              <div className="font-label text-[10px] uppercase tracking-widest text-on-surface/40">
                {currentStreak > 0 ? (streakType === 'win' ? 'Win Streak' : 'Top-4 Streak') : 'Total Wins'}
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* Flash tournament banner */}
      <FlashTournamentBanner
        tournament={upcomingTournament}
        isRegistered={upcomingRegistered}
        onView={function () { navigate('/flash/' + upcomingTournament.id) }}
      />

      {/* Three-column layout: main left, sidebar right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT MAIN (2/3): Season cards + narrative + quick actions */}
        <div className="lg:col-span-2 space-y-6">
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

          {/* Season Narrative */}
          {seasonNarrative && (
            <div
              className="rounded-lg border border-secondary/10 p-5 flex items-start gap-4 bg-secondary/[0.04]"
            >
              <Icon name="auto_awesome" size={18} className="text-secondary flex-shrink-0 mt-0.5" />
              <p className="text-sm text-on-surface/70 font-medium leading-relaxed">{seasonNarrative}</p>
            </div>
          )}

          {/* Upcoming Event */}
          {nextEvent && (
            <Panel padding="none" className="p-5">
              <div className="font-label uppercase text-[10px] tracking-widest text-on-surface/40 mb-3">Upcoming Event</div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-display text-base text-on-surface font-semibold">{nextEvent.name || nextEvent.title}</div>
                  {nextEvent.date && (
                    <div className="font-mono text-xs text-on-surface/40 mt-1">{nextEvent.date}</div>
                  )}
                </div>
                <Btn variant="secondary" size="sm" onClick={function () { navigate('/events') }}>View Events</Btn>
              </div>
            </Panel>
          )}

          {/* Quick Actions Row */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={function () { handleViewProfile() }}
              className="bg-surface-container-low rounded-lg border border-outline-variant/10 p-4 min-h-[72px] flex flex-col items-center justify-center gap-2 hover:border-secondary/30 hover:bg-secondary/5 transition-all group"
            >
              <Icon name="person" size={20} className="text-on-surface/40 group-hover:text-secondary transition-colors" />
              <span className="font-label text-[10px] uppercase tracking-widest text-on-surface/60 group-hover:text-on-surface transition-colors text-center">My Profile</span>
            </button>
            <button
              onClick={function () { navigate('/events') }}
              className="bg-surface-container-low rounded-lg border border-outline-variant/10 p-4 min-h-[72px] flex flex-col items-center justify-center gap-2 hover:border-primary/30 hover:bg-primary/5 transition-all group"
            >
              <Icon name="calendar_month" size={20} className="text-on-surface/40 group-hover:text-primary transition-colors" />
              <span className="font-label text-[10px] uppercase tracking-widest text-on-surface/60 group-hover:text-on-surface transition-colors text-center">Events</span>
            </button>
            <button
              onClick={function () { navigate('/standings') }}
              className="bg-surface-container-low rounded-lg border border-outline-variant/10 p-4 min-h-[72px] flex flex-col items-center justify-center gap-2 hover:border-tertiary/30 hover:bg-tertiary/5 transition-all group"
            >
              <Icon name="leaderboard" size={20} className="text-on-surface/40 group-hover:text-tertiary transition-colors" />
              <span className="font-label text-[10px] uppercase tracking-widest text-on-surface/60 group-hover:text-on-surface transition-colors text-center">Standings</span>
            </button>
          </div>
        </div>

        {/* RIGHT SIDEBAR (1/3): Standings + Activity + Ad Space */}
        <div className="space-y-6">
          <StandingsMini
            top5={top5}
            linkedPlayer={linkedPlayer}
            onViewPlayer={handleViewPlayer}
            onViewAll={function () { navigate('/standings') }}
          />
          <ActivityFeed items={activityFeed} hasMore={afHasMore} onLoadMore={handleLoadMoreActivity} loading={afLoading} />

          {/* Ad Space */}
          <div
            className="rounded-lg border border-dashed border-outline-variant/20 p-6 flex flex-col items-center justify-center gap-2 min-h-[140px] bg-white/[0.01]"
          >
            <Icon name="ads_click" size={20} className="text-on-surface/20" />
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface/20">Ad Space</span>
          </div>
        </div>
      </div>

      {/* Ticker */}
      {tickerItems.length > 0 && (
        <div
          className="overflow-hidden rounded mt-6 bg-secondary/[0.03] border border-secondary/[0.08]"
        >
          <div className="ticker-scroll">
            {[].concat(tickerItems, tickerItems).map(function (item, i) {
              return (
                <span
                  key={"ticker-" + i}
                  className="inline-flex items-center px-5 py-2 text-[11px] text-on-surface/60 font-semibold whitespace-nowrap border-r border-secondary/[0.08]"
                >
                  {typeof item === 'object' ? item.text : item}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {linkedPlayer && (
        <div className="mt-6">
          <NextMilestoneCard player={linkedPlayer} />
        </div>
      )}

      <div className="mt-6">
        <WatchlistPanel limit={6} />
      </div>
    </PageLayout>
  )
}
