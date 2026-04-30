import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getStats } from '../lib/stats.js'
import useCountdown from '../lib/useCountdown'
import PageLayout from '../components/layout/PageLayout'
import { Btn, Icon, Panel } from '../components/ui'
import SectionHeader from '../components/shared/SectionHeader'
import AdBanner from '../components/shared/AdBanner'
import SponsorShowcase from '../components/shared/SponsorShowcase'
import RegionBadge from '../components/shared/RegionBadge'
import OnboardingHint from '../components/shared/OnboardingHint'
import LiveNowPanel from '../components/shared/LiveNowPanel'
import PinnedTournamentsBar from '../components/shared/PinnedTournamentsBar'
import { REGION_META, normalizeRegion, canRegisterInRegion } from '../lib/regions'
import { supabase } from '../lib/supabase'
import { getDonateUrl } from '../lib/paypal'

// ── Region helpers ────────────────────────────────────────────────────────────

// Europe/Amsterdam DST check. DST runs from last Sunday of March 01:00 UTC
// through last Sunday of October 01:00 UTC. Returns true if the given YYYY-MM-DD
// falls in that window.
function isAmsterdamDST(dateStr) {
  var d = new Date(dateStr + 'T12:00:00Z')
  var y = d.getUTCFullYear()
  var m = d.getUTCMonth()
  if (m < 2 || m > 9) return false
  if (m > 2 && m < 9) return true
  function lastSundayUTC(year, month) {
    var lastDay = new Date(Date.UTC(year, month + 1, 0))
    return lastDay.getUTCDate() - lastDay.getUTCDay()
  }
  var switchDay = lastSundayUTC(y, m)
  var day = d.getUTCDate()
  if (m === 2) return day >= switchDay
  return day < switchDay
}

function tournamentTimestamp(tournament, tournamentState) {
  if (!tournament) return null
  if (tournamentState && tournamentState.dbTournamentId && String(tournamentState.dbTournamentId) === String(tournament.id) && tournamentState.clashTimestamp) {
    return tournamentState.clashTimestamp
  }
  if (tournament.started_at) return tournament.started_at
  if (tournament.registration_close_at) return tournament.registration_close_at
  if (tournament.date) {
    // Fall back to 20:00 Europe/Amsterdam on the stored date
    // CEST (summer) = UTC+2 so 20:00 = 18:00Z. CET (winter) = UTC+1 so 20:00 = 19:00Z.
    var utcHour = isAmsterdamDST(tournament.date) ? 18 : 19
    var hourStr = utcHour < 10 ? '0' + utcHour : String(utcHour)
    return new Date(tournament.date + 'T' + hourStr + ':00:00.000Z').toISOString()
  }
  return null
}

function normalizePhase(phase) {
  if (!phase) return 'idle'
  if (phase === 'in_progress' || phase === 'inprogress' || phase === 'live') return 'live'
  if (phase === 'check_in' || phase === 'checkin') return 'checkin'
  return phase
}

function phaseMeta(phase) {
  var p = normalizePhase(phase)
  if (p === 'live') return { label: 'Live Now', tone: 'text-tertiary', dot: 'bg-tertiary animate-pulse' }
  if (p === 'checkin') return { label: 'Check-In Open', tone: 'text-primary', dot: 'bg-primary animate-pulse' }
  if (p === 'registration') return { label: 'Registration Open', tone: 'text-primary', dot: 'bg-primary' }
  if (p === 'complete') return { label: 'Completed', tone: 'text-on-surface-variant', dot: 'bg-on-surface-variant' }
  return { label: 'Scheduled', tone: 'text-on-surface-variant', dot: 'bg-on-surface-variant' }
}

// ── RegionCommandCard ─────────────────────────────────────────────────────────

function RegionCommandCard(props) {
  var region = props.region
  var tournament = props.tournament
  var tournamentState = props.tournamentState
  var currentUser = props.currentUser
  var userRegion = props.userRegion
  var onSignUp = props.onSignUp
  var onNavigateDashboard = props.onNavigateDashboard
  var onViewDetail = props.onViewDetail

  var meta = REGION_META[region] || { label: region, full: region, flag: '', color: '#9AAABF' }
  var ts = tournamentTimestamp(tournament, tournamentState)
  var countdownState = { clashTimestamp: ts, clashName: tournament ? tournament.name : meta.full + ' Clash' }
  var countdown = useCountdown(countdownState)
  var rawPhase = (tournament && tournament.phase) || 'idle'
  var phase = normalizePhase(rawPhase)
  var pMeta = phaseMeta(phase)

  function pad2(n) { return String(n).padStart(2, '0') }

  var hasTournament = !!tournament
  var regionAllowed = userRegion ? canRegisterInRegion(userRegion, region) : true

  var ctaLabel = 'Sign Up to Play'
  var ctaHandler = onSignUp
  var ctaDisabled = false

  if (hasTournament && currentUser) {
    if (!regionAllowed) {
      ctaLabel = 'Account Locked to ' + normalizeRegion(userRegion)
      ctaHandler = function() { onViewDetail && onViewDetail(tournament) }
      ctaDisabled = true
    } else if (phase === 'live') {
      ctaLabel = 'Open Dashboard'
      ctaHandler = function() { onNavigateDashboard && onNavigateDashboard(tournament) }
    } else if (phase === 'checkin') {
      ctaLabel = 'Check In Now'
      ctaHandler = function() { onNavigateDashboard && onNavigateDashboard(tournament) }
    } else if (phase === 'registration') {
      ctaLabel = 'Register'
      ctaHandler = function() { onNavigateDashboard && onNavigateDashboard(tournament) }
    } else {
      ctaLabel = 'View Details'
      ctaHandler = function() { onViewDetail && onViewDetail(tournament) }
    }
  } else if (hasTournament && !currentUser) {
    ctaLabel = 'Sign Up to Join'
    ctaHandler = onSignUp
  }

  return (
    <div
      className="glass-panel rounded-xl border border-outline-variant/15 shadow-xl relative overflow-hidden px-5 py-6 sm:px-6 sm:py-7"
      style={{ borderColor: meta.color + '33' }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{ background: 'linear-gradient(135deg, ' + meta.color + '26 0%, transparent 55%)' }}
      />
      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <RegionBadge region={region} size="md" />
          <span className={'inline-flex items-center gap-1.5 text-[10px] font-label uppercase tracking-widest ' + pMeta.tone}>
            <span className={'w-1.5 h-1.5 rounded-full ' + pMeta.dot}></span>
            {pMeta.label}
          </span>
        </div>

        <div className="min-h-[2.5rem]">
          <div className="font-display text-lg sm:text-xl text-on-surface leading-tight truncate">
            {hasTournament ? tournament.name : 'No clash scheduled'}
          </div>
          {hasTournament && tournament.date && (
            <div className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mt-0.5">
              {new Date(tournament.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          )}
        </div>

        {hasTournament && countdown.hasCountdown ? (
          <div className="flex justify-center gap-2 sm:gap-3">
            <div className="flex flex-col items-center">
              <span className="font-mono text-2xl sm:text-3xl leading-none" style={{ color: meta.color }}>{pad2(countdown.days)}</span>
              <span className="font-label text-[9px] uppercase opacity-40">Days</span>
            </div>
            <span className="font-mono text-2xl sm:text-3xl opacity-20" style={{ color: meta.color }}>:</span>
            <div className="flex flex-col items-center">
              <span className="font-mono text-2xl sm:text-3xl leading-none" style={{ color: meta.color }}>{pad2(countdown.hours)}</span>
              <span className="font-label text-[9px] uppercase opacity-40">Hrs</span>
            </div>
            <span className="font-mono text-2xl sm:text-3xl opacity-20" style={{ color: meta.color }}>:</span>
            <div className="flex flex-col items-center">
              <span className="font-mono text-2xl sm:text-3xl leading-none" style={{ color: meta.color }}>{pad2(countdown.minutes)}</span>
              <span className="font-label text-[9px] uppercase opacity-40">Min</span>
            </div>
            <span className="font-mono text-2xl sm:text-3xl opacity-20" style={{ color: meta.color }}>:</span>
            <div className="flex flex-col items-center">
              <span className="font-mono text-2xl sm:text-3xl leading-none" style={{ color: meta.color }}>{pad2(countdown.seconds)}</span>
              <span className="font-label text-[9px] uppercase opacity-40">Sec</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-2 text-on-surface-variant text-xs font-label uppercase tracking-widest">
            {hasTournament ? 'Starting soon' : 'Watch this space'}
          </div>
        )}

        <Btn
          variant={ctaDisabled ? 'secondary' : 'primary'}
          size="lg"
          onClick={ctaHandler}
          disabled={ctaDisabled}
          className="w-full"
        >
          {ctaLabel}
        </Btn>

        {hasTournament && !ctaDisabled && (
          <button
            type="button"
            onClick={function() { onViewDetail && onViewDetail(tournament) }}
            className="block w-full text-center text-xs text-on-surface-variant underline-offset-2 hover:underline cursor-pointer bg-transparent border-0 font-label uppercase tracking-widest"
          >
            Event Details
          </button>
        )}
      </div>
    </div>
  )
}

// ── SeasonStatsBar ────────────────────────────────────────────────────────────

function SeasonStatsBar({ players, pastClashes, tournamentState, seasonConfig }) {
  var phase = tournamentState && tournamentState.phase
  var isLive = phase === 'live' || phase === 'inprogress'
  var playerCount = players && players.length > 0 ? players.length.toLocaleString() : '\u2014'
  var clashCount = pastClashes && pastClashes.length > 0 ? String(pastClashes.length) : '\u2014'
  var seasonName = (seasonConfig && seasonConfig.seasonName) || 'Season 1'

  var weekLabel = null
  if (seasonConfig && seasonConfig.seasonStartIso && seasonConfig.totalWeeks) {
    var start = new Date(seasonConfig.seasonStartIso)
    var weeks = parseInt(seasonConfig.totalWeeks, 10) || 0
    if (!isNaN(start.getTime()) && weeks > 0) {
      var now = Date.now()
      if (now >= start.getTime()) {
        var weeksElapsed = Math.floor((now - start.getTime()) / (7 * 86400000)) + 1
        var currentWeek = Math.max(1, Math.min(weeks, weeksElapsed))
        weekLabel = 'Week ' + currentWeek + ' / ' + weeks
      }
    }
  }

  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Panel padding="none" className="p-4 sm:p-6 hover:bg-surface-container transition-colors">
        <span className="block font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1">Community</span>
        <span className="font-mono text-lg sm:text-xl text-primary font-bold">Free to Play</span>
      </Panel>
      <Panel padding="none" className="p-4 sm:p-6 hover:bg-surface-container transition-colors">
        <span className="block font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1">Players</span>
        <span className="font-mono text-lg sm:text-xl text-on-surface font-bold">{playerCount}</span>
      </Panel>
      <Panel padding="none" className="p-4 sm:p-6 hover:bg-surface-container transition-colors">
        <span className="block font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1">Clashes Run</span>
        <span className="font-mono text-lg sm:text-xl text-on-surface font-bold">{clashCount}</span>
      </Panel>
      <Panel padding="none" className="p-4 sm:p-6 hover:bg-surface-container transition-colors">
        <span className="block font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1">Status</span>
        {isLive
          ? (
            <span className="flex items-center gap-2 font-mono text-lg sm:text-xl text-tertiary font-bold">
              <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
              LIVE
            </span>
          )
          : (
            <div>
              <span className="font-mono text-lg sm:text-xl text-on-surface font-bold block">{seasonName}</span>
              {weekLabel && (
                <span className="font-label text-[10px] text-tertiary uppercase tracking-widest font-bold">{weekLabel}</span>
              )}
            </div>
          )
        }
      </Panel>
    </section>
  )
}

// ── LeaderboardPreview ────────────────────────────────────────────────────────

function LeaderboardPreview({ top5, onNavigate, onViewAll }) {
  var RANK_LABELS = ['01', '02', '03', '04', '05']

  return (
    <section className="space-y-6">
      <div className="flex justify-between items-end gap-4">
        <div className="flex flex-col gap-2">
          <span className="brand-eyebrow">Top 5 · Live</span>
          <h2 className="font-display text-3xl">
            Elite <span className="text-primary">Leaderboard</span>
          </h2>
        </div>
        <Btn variant="link" onClick={onViewAll}>
          View All Standings
        </Btn>
      </div>

      <div className="space-y-3">
        {top5.map(function(player, i) {
          var isFirst = i === 0
          var stats = getStats(player)
          var playerPath = '/player/' + player.name

          function handleKey(e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(playerPath) }
          }

          if (isFirst) {
            return (
              <div
                key={player.id || player.name}
                role="button"
                tabIndex={0}
                className="group relative overflow-hidden bg-primary/5 p-4 rounded-lg flex items-center justify-between border border-primary/30 cursor-pointer hover:bg-primary/10 hover:border-primary/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                onClick={function() { onNavigate(playerPath) }}
                onKeyDown={handleKey}
              >
                <div className="flex items-center gap-3 sm:gap-6 min-w-0">
                  <span className="font-display text-2xl text-primary w-8 flex-shrink-0">{RANK_LABELS[i]}</span>
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded bg-surface-container-highest flex items-center justify-center border border-primary/20 flex-shrink-0">
                      <Icon name="military_tech" size={20} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-on-surface truncate">{player.name}</h3>
                      <div className="flex gap-2 flex-wrap">
                        <span className="bg-tertiary/10 text-tertiary text-[10px] font-label px-2 rounded uppercase tracking-tighter">
                          {player.rank || 'Challenger'}
                        </span>
                        {player.region && (
                          <RegionBadge region={player.region} size="sm" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 sm:gap-12 text-right flex-shrink-0 ml-2">
                  <div>
                    <span className="block font-label text-[10px] text-on-surface-variant uppercase tracking-widest">PTS</span>
                    <span className="font-mono text-on-surface font-bold">{(player.pts || 0).toLocaleString()}</span>
                  </div>
                  <div className="hidden sm:block">
                    <span className="block font-label text-[10px] text-on-surface-variant uppercase tracking-widest">Win Rate</span>
                    <span className="font-mono text-primary">{stats.top1Rate ? stats.top1Rate + '%' : (player.wins || 0) + 'W'}</span>
                  </div>
                </div>
              </div>
            )
          }

          var opacity = i === 3 ? 'opacity-80' : i === 4 ? 'opacity-60' : ''

          return (
            <div
              key={player.id || player.name}
              role="button"
              tabIndex={0}
              className={'bg-surface-container-low p-4 rounded-lg flex items-center justify-between hover:bg-surface-container transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ' + opacity}
              onClick={function() { onNavigate(playerPath) }}
              onKeyDown={handleKey}
            >
              <div className="flex items-center gap-3 sm:gap-6 min-w-0">
                <span className="font-display text-2xl text-on-surface-variant w-8 flex-shrink-0">{RANK_LABELS[i]}</span>
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded bg-surface-container-highest flex items-center justify-center flex-shrink-0">
                    <Icon name="person" size={20} className="text-on-surface-variant" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-on-surface truncate">{player.name}</h3>
                    <div className="flex gap-2 flex-wrap">
                      <span className="bg-tertiary/10 text-tertiary text-[10px] font-label px-2 rounded uppercase tracking-tighter">
                        {player.rank || 'Master'}
                      </span>
                      {player.region && (
                        <RegionBadge region={player.region} size="sm" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 sm:gap-12 text-right flex-shrink-0 ml-2">
                <div>
                  <span className="block font-label text-[10px] text-on-surface-variant uppercase tracking-widest">PTS</span>
                  <span className="font-mono text-on-surface font-bold">{(player.pts || 0).toLocaleString()}</span>
                </div>
                <div className="hidden sm:block">
                  <span className="block font-label text-[10px] text-on-surface-variant uppercase tracking-widest">Win Rate</span>
                  <span className="font-mono text-on-surface">{stats.top1Rate ? stats.top1Rate + '%' : (player.wins || 0) + 'W'}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── LatestChampionStrip ──────────────────────────────────────────────────────

function shortDateLabel(d) {
  if (!d) return ''
  try {
    var dt = new Date(d)
    if (isNaN(dt.getTime())) return ''
    return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch (e) {
    return ''
  }
}

function LatestChampionStrip(props) {
  var clash = props.clash
  var champPlayer = props.champPlayer
  var navigate = props.navigate

  if (!clash || !clash.champion) return null

  var dateStr = shortDateLabel(clash.date)
  var pts = (champPlayer && (champPlayer.pts || 0)) || 0
  var stats = champPlayer ? getStats(champPlayer) : null
  var initial = clash.champion ? clash.champion[0].toUpperCase() : '?'

  return (
    <button
      type="button"
      onClick={function () {
        if (champPlayer) {
          navigate('/player/' + encodeURIComponent(clash.champion))
        } else {
          navigate('/results')
        }
      }}
      className="w-full text-left rounded-2xl border border-primary/25 bg-surface-container p-4 sm:p-5 flex items-center gap-4 hover:border-primary/45 hover:shadow-[0_0_36px_rgba(255,198,107,0.18)] transition-all group"
    >
      <span className="relative flex-shrink-0">
        <span className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 border-primary/60 bg-surface-container-highest font-display text-primary text-xl">
          {initial}
        </span>
        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-on-primary shadow-md">
          <Icon name="emoji_events" size={14} />
        </span>
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-label tracking-widest uppercase text-primary/80 mb-0.5">
          Latest Champion
          {dateStr && (
            <span className="text-on-surface-variant/40 normal-case ml-2">{dateStr}</span>
          )}
        </div>
        <div className="font-display text-lg sm:text-xl tracking-wide text-on-surface truncate">
          {clash.champion}
        </div>
        <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-on-surface-variant/60 flex-wrap">
          <span className="truncate max-w-[180px]">{clash.name || 'Recent clash'}</span>
          {pts > 0 && (
            <span className="text-primary font-bold">{pts + ' pts'}</span>
          )}
          {stats && stats.avgPlacement && stats.avgPlacement !== '-' && (
            <span>AVP {stats.avgPlacement}</span>
          )}
          {clash.players > 0 && (
            <span>{clash.players + ' players'}</span>
          )}
        </div>
      </div>
      <Icon
        name="chevron_right"
        size={22}
        className="text-on-surface-variant/40 group-hover:text-primary flex-shrink-0"
      />
    </button>
  )
}

// ── HomeScreen ────────────────────────────────────────────────────────────────

// Build a synthetic tournament-like object from site_settings tournament_state
// so a region that's been *scheduled* (but not yet opened for registration via
// the admin "Open Registration" flow) still surfaces on the public home page.
function previewTournamentFromState(state, region) {
  if (!state || !state.clashTimestamp) return null
  var ts = new Date(state.clashTimestamp)
  if (isNaN(ts.getTime())) return null
  // Only show if it's within the future (or recent past, in case admin is mid-setup)
  if (ts.getTime() < Date.now() - 6 * 60 * 60 * 1000) return null
  // Treat scheduled-but-not-opened previews as 'draft' so the public page
  // says "Scheduled" with a View Details CTA — never "Register Now" (there's
  // nothing to register against until admin clicks Open Registration).
  var statePhase = state.phase
  var phase = statePhase && statePhase !== 'idle' && statePhase !== 'registration' ? statePhase : 'draft'
  return {
    id: 'preview-' + region,
    name: state.clashName || 'Weekly Clash',
    date: state.clashTimestamp.split('T')[0],
    region: region,
    phase: phase,
    type: 'season_clash',
    started_at: state.clashTimestamp,
    is_finale: !!state.isFinale,
    __preview: true
  }
}

export default function HomeScreen() {
  var ctx = useApp()
  var players = ctx.players || []
  var currentUser = ctx.currentUser
  var tournamentState = ctx.tournamentState
  var tournamentStateNa = ctx.tournamentStateNa
  var setAuthScreen = ctx.setAuthScreen
  var pastClashes = ctx.pastClashes || []
  var seasonConfig = ctx.seasonConfig || {}
  var navigate = useNavigate()

  var sorted = players.slice().sort(function(a, b) { return (b.pts || 0) - (a.pts || 0) })
  var top5 = sorted.slice(0, 5)
  var sharedCountdown = useCountdown(tournamentState)

  // Derive current user's linked player region, if any (for region-aware CTAs)
  var linkedUserRegion = null
  if (currentUser) {
    var lp = players.find(function(p) { return p.authUserId && currentUser.id && String(p.authUserId) === String(currentUser.id) })
    if (!lp && currentUser.username) {
      lp = players.find(function(p) { return p.name && p.name.toLowerCase() === String(currentUser.username).toLowerCase() })
    }
    if (lp) linkedUserRegion = lp.region || null
  }

  // Fetch active EU and NA clashes (one of each) for the dual-region command deck
  var _euT = useState(null)
  var euTournament = _euT[0]
  var setEuTournament = _euT[1]
  var _naT = useState(null)
  var naTournament = _naT[0]
  var setNaTournament = _naT[1]

  var stateClashId = tournamentState ? tournamentState.dbTournamentId : null
  var statePhase = tournamentState ? tournamentState.phase : null
  var stateNaTs = tournamentStateNa ? tournamentStateNa.clashTimestamp : null
  var stateEuTs = tournamentState ? tournamentState.clashTimestamp : null
  useEffect(function() {
    if (!supabase || !supabase.from) return
    var cancelled = false
    // The hero deck is the OFFICIAL Clash. Custom and flash tournaments have
    // their own pages (/tournament/:id, /flash/:id) and must never show up
    // here, otherwise a host-created event poses as "the EU/NA Clash".
    supabase.from('tournaments').select('id,name,date,region,phase,type,is_finale,started_at,registration_close_at,checkin_open_at,host_profile_id')
      .eq('type', 'season_clash')
      .in('phase', ['registration', 'check_in', 'in_progress', 'draft'])
      .order('date', { ascending: true })
      .limit(40)
      .then(function(res) {
        if (cancelled || res.error || !res.data) return
        var eu = null
        var na = null
        var priority = { in_progress: 0, check_in: 1, registration: 2, draft: 3 }
        res.data.forEach(function(t) {
          var r = normalizeRegion(t.region)
          if (!r) return
          if (r === 'EU') {
            if (!eu || (priority[t.phase] || 9) < (priority[eu.phase] || 9)) eu = t
          } else if (r === 'NA') {
            if (!na || (priority[t.phase] || 9) < (priority[na.phase] || 9)) na = t
          }
        })
        // Fallback to site_settings preview when admin scheduled but didn't open
        // registration yet — keeps both regions visible on the public home page.
        if (!eu) eu = previewTournamentFromState(tournamentState, 'EU')
        if (!na) na = previewTournamentFromState(tournamentStateNa, 'NA')
        setEuTournament(eu)
        setNaTournament(na)
      }).catch(function(err) {
        if (!cancelled && typeof console !== 'undefined' && console.warn) {
          console.warn('HomeScreen: failed to fetch region tournaments', err)
        }
      })
    return function() { cancelled = true }
  }, [stateClashId, statePhase, stateEuTs, stateNaTs])

  function handleSignUp() {
    setAuthScreen && setAuthScreen('signup')
  }

  function handleNavigateDashboard(t) {
    var phase = t && t.phase ? String(t.phase).toLowerCase() : ''
    var region = t && t.region ? String(t.region).toUpperCase() : 'EU'
    if (phase === 'live' || phase === 'inprogress' || phase === 'in_progress') {
      navigate('/clash')
      return
    }
    if (phase === 'check_in' || phase === 'checkin' || phase === 'registration' || phase === 'register') {
      navigate('/events#weekly-' + region.toUpperCase())
      return
    }
    if (t && t.id) { handleViewTournament(t); return }
    navigate('/events')
  }

  function handleViewTournament(t) {
    if (!t) return
    if (t.type === 'flash_tournament') navigate('/tournament/' + t.id)
    else if (t.type === 'custom' || t.host_profile_id) navigate('/tournament/' + t.id)
    else {
      // season_clash (real or preview): deep-link to the Weekly Clash panel on /events.
      // The region anchor scrolls + highlights the matching card so the CTA actually
      // lands somewhere meaningful instead of dropping users on Featured Events.
      var region = String((t && t.region) || 'EU').toUpperCase()
      var slug = region === 'NA' ? 'NA' : 'EU'
      navigate('/events#weekly-' + slug)
    }
  }

  function handleViewStandings() {
    navigate('/standings')
  }

  function handleNavigate(path) {
    navigate(path)
  }

  function handleViewLeaderboard() {
    navigate('/leaderboard')
  }

  function handleViewRules() {
    navigate('/rules')
  }

  function handleViewFaq() {
    navigate('/faq')
  }

  var seasonLabel = sharedCountdown.clashName || seasonConfig.seasonName || 'TFT Clash'

  var hasLinkedPlayer = !!(currentUser && currentUser.id && players.find(function (p) {
    return p.authUserId && String(p.authUserId) === String(currentUser.id)
  }))

  return (
    <PageLayout showSidebar={false} maxWidth="max-w-[880px]">

      <div className="space-y-8 sm:space-y-12">

        {!currentUser && (
          <OnboardingHint
            variant="guest"
            icon="rocket_launch"
            title="First time on TFT Clash?"
            body="Free weekly tournaments, EU + NA brackets, full season leaderboard. Sign in with Discord to compete or just browse upcoming events as a spectator."
            ctaLabel="Sign in"
            onCta={function () { navigate('/login') }}
            secondaryLabel="Browse events"
            onSecondary={function () { navigate('/events') }}
          />
        )}

        {currentUser && !hasLinkedPlayer && (
          <OnboardingHint
            variant="linked-player"
            icon="link"
            title="Link your Riot ID to start scoring"
            body="Add your Riot ID in account settings so your clash placements show up on the leaderboard and your stats start counting."
            ctaLabel="Open account"
            onCta={function () { navigate('/account') }}
          />
        )}

        <PinnedTournamentsBar compact={true} />
        <LiveNowPanel limit={4} />

        {pastClashes && pastClashes.length > 0 && (
          <LatestChampionStrip
            clash={pastClashes[0]}
            champPlayer={players.find(function (p) {
              // Player names are unique on the platform (enforced server-side at
              // signup), so case-insensitive name match is reliable. If two rows
              // ever share a name only the stats line could show the wrong pts —
              // the navigation target uses the clash record so click-through
              // still resolves correctly.
              return p && p.name && pastClashes[0].champion && !p.banned &&
                String(p.name).toLowerCase() === String(pastClashes[0].champion).toLowerCase()
            })}
            navigate={navigate}
          />
        )}

        {/* ── Hero Section ──────────────────────────────────────────────────── */}
        <section className="relative text-center space-y-6 sm:space-y-8 py-8 sm:py-12">
          {/* Tactical grid backdrop (decorative) */}
          <div aria-hidden="true" className="tactical-grid absolute inset-0 -z-10 pointer-events-none"></div>

          {/* Season pill — brand eyebrow */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/25 bg-primary/5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            <span className="font-label text-[11px] tracking-[0.3em] uppercase text-primary font-bold">
              {seasonLabel}
            </span>
          </div>

          {/* Main title */}
          <h1 className="text-5xl sm:text-7xl font-display text-primary tracking-tighter uppercase leading-none">
            TFT <span className="text-on-surface">CLASH</span>
          </h1>

          {/* Tagline */}
          <p className="max-w-xl mx-auto text-on-surface-variant font-display text-xl opacity-70">
            Free weekly tournaments. Real competition. One leaderboard to rule them all.
          </p>

          {/* Dual-region command deck */}
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <RegionCommandCard
                region="EU"
                tournament={euTournament}
                tournamentState={tournamentState}
                currentUser={currentUser}
                userRegion={linkedUserRegion}
                onSignUp={handleSignUp}
                onNavigateDashboard={handleNavigateDashboard}
                onViewDetail={handleViewTournament}
              />
              <RegionCommandCard
                region="NA"
                tournament={naTournament}
                tournamentState={tournamentStateNa}
                currentUser={currentUser}
                userRegion={linkedUserRegion}
                onSignUp={handleSignUp}
                onNavigateDashboard={handleNavigateDashboard}
                onViewDetail={handleViewTournament}
              />
            </div>

            <div className="flex flex-wrap justify-center items-center gap-4 mt-5 text-xs text-on-surface-variant">
              <button
                type="button"
                onClick={handleViewStandings}
                className="font-label uppercase tracking-widest hover:text-on-surface underline-offset-2 hover:underline cursor-pointer bg-transparent border-0"
              >
                View Standings
              </button>
              <span className="opacity-20">|</span>
              <button
                type="button"
                onClick={function() { navigate('/events') }}
                className="font-label uppercase tracking-widest hover:text-on-surface underline-offset-2 hover:underline cursor-pointer bg-transparent border-0"
              >
                All Events
              </button>
              {linkedUserRegion && (
                <>
                  <span className="opacity-20">|</span>
                  <span className="font-label uppercase tracking-widest inline-flex items-center gap-1.5">
                    Your Region
                    <RegionBadge region={linkedUserRegion} size="sm" />
                  </span>
                </>
              )}
              {currentUser && !linkedUserRegion && (
                <>
                  <span className="opacity-20">|</span>
                  <button
                    type="button"
                    onClick={function() { navigate('/account') }}
                    className="font-label uppercase tracking-widest text-primary hover:underline cursor-pointer bg-transparent border-0"
                  >
                    Set Your Region
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── How It Works ──────────────────────────────────────────────────── */}
        {!currentUser && (
          <section className="space-y-6">
            <div className="flex flex-col items-center gap-2">
              <span className="brand-eyebrow">Get Started</span>
              <h2 className="font-display text-2xl sm:text-3xl text-on-surface text-center">
                How It <span className="text-primary">Works</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Panel padding="default" className="text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon name="login" size={24} className="text-primary" />
                </div>
                <h3 className="font-label text-sm font-bold uppercase tracking-wider text-on-surface">Sign in with Discord</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">One click. No passwords, no emails to verify. You already have Discord open.</p>
              </Panel>
              <Panel padding="default" className="text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon name="sports_esports" size={24} className="text-primary" />
                </div>
                <h3 className="font-label text-sm font-bold uppercase tracking-wider text-on-surface">Join a Tournament</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">Register for the next weekly clash. Check in when it starts, get assigned a lobby, play your games.</p>
              </Panel>
              <Panel padding="default" className="text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon name="trending_up" size={24} className="text-primary" />
                </div>
                <h3 className="font-label text-sm font-bold uppercase tracking-wider text-on-surface">Climb the Leaderboard</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">Earn points based on placement. Track your stats, build streaks, compete for the season title.</p>
              </Panel>
            </div>
          </section>
        )}

        {/* ── Value Props ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap justify-center gap-3">
          {['Free to compete, always', 'EU \u00b7 NA servers', 'Results every week', 'Full stats + career history'].map(function(chip) {
            return (
              <span key={chip} className="px-4 py-1.5 rounded-full text-xs font-label tracking-widest uppercase border border-outline-variant/20 text-on-surface-variant bg-surface-container-low">
                {chip}
              </span>
            );
          })}
        </div>

        {/* ── Logged-in quick actions ───────────────────────────────────────── */}
        {currentUser && (
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Dashboard', icon: 'dashboard', path: '/' },
              { label: 'My Stats', icon: 'bar_chart', path: '/player/' + (currentUser.username || '') },
              { label: 'Standings', icon: 'leaderboard', path: '/standings' },
              { label: 'Events', icon: 'event', path: '/events' },
            ].map(function(item) {
              return (
                <button
                  key={item.label}
                  onClick={function() { navigate(item.path); }}
                  className="flex flex-col items-center gap-2 p-4 bg-surface-container-low rounded-lg border border-outline-variant/10 hover:bg-surface-container hover:border-primary/20 transition-all cursor-pointer group"
                >
                  <Icon name={item.icon} size={22} className="text-primary group-hover:scale-110 transition-transform" />
                  <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">{item.label}</span>
                </button>
              );
            })}
          </section>
        )}

        {/* ── Season Stats Bar ──────────────────────────────────────────────── */}
        <SeasonStatsBar
          players={players}
          pastClashes={pastClashes}
          tournamentState={tournamentState}
          seasonConfig={seasonConfig}
        />

        {/* ── Leaderboard Preview ───────────────────────────────────────────── */}
        {top5.length > 0 && (
          <LeaderboardPreview
            top5={top5}
            onNavigate={handleNavigate}
            onViewAll={handleViewLeaderboard}
          />
        )}

        {/* ── Sponsor Strip ─────────────────────────────────────────────────── */}
        <SponsorShowcase placement="homepage" variant="strip" />

        {/* ── Ad Banner ─────────────────────────────────────────────────────── */}
        <AdBanner size="banner" className="w-full" />

        {/* ── Common Questions ─────────────────────────────────────────────── */}
        {!currentUser && (
          <section className="space-y-6">
            <div className="flex flex-col items-center gap-2">
              <span className="brand-eyebrow">The Basics</span>
              <h2 className="font-display text-2xl sm:text-3xl text-on-surface text-center">
                Common <span className="text-primary">Questions</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Panel padding="none" className="p-5 space-y-2">
                <h3 className="font-label text-xs font-bold uppercase tracking-wider text-primary">Is it really free?</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">Yes, forever. Competing in clashes and climbing the leaderboard costs nothing. Pro and Host tiers add optional extras.</p>
              </Panel>
              <Panel padding="none" className="p-5 space-y-2">
                <h3 className="font-label text-xs font-bold uppercase tracking-wider text-primary">Do I need to be good?</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">All skill levels are welcome. The points system rewards consistency, not just wins. Iron to Challenger, everyone competes.</p>
              </Panel>
              <Panel padding="none" className="p-5 space-y-2">
                <h3 className="font-label text-xs font-bold uppercase tracking-wider text-primary">How long does a clash take?</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">Each clash runs a set of TFT games in one session. Register in advance, check in when it starts, and play your games. Usually a couple of hours.</p>
              </Panel>
              <Panel padding="none" className="p-5 space-y-2">
                <h3 className="font-label text-xs font-bold uppercase tracking-wider text-primary">Is my Discord data safe?</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">We only access your public Discord profile (username and avatar). We never read your messages, servers, or friends list.</p>
              </Panel>
            </div>
          </section>
        )}

        {/* ── Support the platform ─────────────────────────────────────────── */}
        <section className="mt-16 mb-4">
          <Panel padding="spacious" elevation="elevated" className="text-center">
            <SectionHeader
              eyebrow="Community Supported"
              title="Keep TFT Clash free forever"
              description="Running weekly tournaments costs real money. If you get value from competing here, a tip keeps the lights on, the servers fast, and the entry fee at zero."
              align="center"
            />
            <div className="mt-2 flex flex-col sm:flex-row justify-center items-center gap-3">
              <Btn
                href={getDonateUrl()}
                variant="primary"
                size="lg"
                icon="favorite"
                iconPosition="left"
              >
                Donate via PayPal
              </Btn>
              <Btn
                variant="link"
                onClick={function(){ navigate('/pricing') }}
              >
                Or go Pro
              </Btn>
            </div>
          </Panel>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────────── */}
        {!currentUser && (
          <section className="text-center space-y-4 pt-4">
            <p className="text-on-surface-variant text-sm">
              {players.length > 0 ? players.length.toLocaleString() + ' players are already on the leaderboard.' : 'Your spot on the leaderboard is waiting.'}
            </p>
            <Btn variant="primary" size="lg" onClick={handleSignUp}>
              Join This Week's Tournament
            </Btn>
          </section>
        )}

        {/* ── Footer Links ──────────────────────────────────────────────────── */}
        <footer className="pt-12 border-t border-outline-variant/10 text-center space-y-4">
          <div className="flex justify-center gap-4 flex-wrap">
            <Btn variant="secondary" size="md" onClick={handleViewRules}>
              Tournament Rules
            </Btn>
            <Btn variant="secondary" size="md" onClick={handleViewFaq}>
              How to Play
            </Btn>
          </div>
        </footer>

      </div>

      {/* ── FAB ───────────────────────────────────────────────────────────────── */}
      <button
        aria-label={currentUser ? 'Go to dashboard' : 'Sign up'}
        className="fixed bottom-8 right-8 z-50 w-16 h-16 rounded-xl flex items-center justify-center active:scale-95 transition-all motion-reduce:transition-none motion-reduce:active:scale-100 group overflow-hidden border-0 cursor-pointer bg-gradient-to-br from-primary to-primary-fixed-dim cta-glow-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        onClick={function() {
          if (currentUser) {
            navigate('/');
          } else {
            handleSignUp();
          }
        }}
      >
        <Icon name={currentUser ? 'dashboard' : 'add_circle'} size={30} className="text-on-primary-fixed group-hover:scale-110 transition-transform motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
      </button>
    </PageLayout>
  )
}
