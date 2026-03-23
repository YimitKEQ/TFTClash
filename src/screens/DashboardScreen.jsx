import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getStats } from '../lib/stats.js'
import { ordinal } from '../lib/utils.js'
import { writeActivityEvent } from '../lib/notifications.js'
import { supabase } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'
import { Btn, Panel, Icon } from '../components/ui'
import RankBadge from '../components/shared/RankBadge'

// ─── TIER CONFIG ───────────────────────────────────────────────────────────────

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

// ─── MINI SPARKLINE ────────────────────────────────────────────────────────────

function Sparkline({ data, color, w, h }) {
  if (!data || data.length < 2) return null
  var W = typeof w === 'number' ? w : 80
  var H = h || 28
  var min = Math.min.apply(null, data)
  var max = Math.max.apply(null, data)
  var range = max - min || 1
  var pts = data.map(function (v, i) {
    return (i / (data.length - 1)) * W + ',' + (H - ((v - min) / range) * (H - 4) + 2)
  }).join(' ')
  var fill = pts + ' ' + W + ',' + H + ' 0,' + H
  var gid = 'sg' + (color || 'gold').replace(/[^a-z0-9]/gi, '')
  return (
    <svg width={W} height={H} style={{ overflow: 'visible', flexShrink: 0, display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color || '#E8A838'} stopOpacity=".3" />
          <stop offset="100%" stopColor={color || '#E8A838'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fill} fill={'url(#' + gid + ')'} />
      <polyline points={pts} fill="none" stroke={color || '#E8A838'} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle
        cx={(data.length - 1) / (data.length - 1) * W}
        cy={H - ((data[data.length - 1] - min) / range) * (H - 4) + 2}
        r="2.5"
        fill={color || '#E8A838'}
      />
    </svg>
  )
}

// ─── FORM DOTS ─────────────────────────────────────────────────────────────────

function FormDots({ history, max }) {
  var n = max || 5
  var recent = (history || []).slice(-n)
  if (recent.length === 0) return null
  return (
    <div className="flex gap-1 items-center">
      {recent.map(function (h, i) {
        var p = h.placement || h.place || 5
        var isTop4 = p <= 4
        return (
          <div
            key={i}
            title={'Game ' + (i + 1) + ': #' + p}
            className={'w-3 h-3 rounded-full flex-shrink-0 ' + (p === 1 ? 'bg-primary' : isTop4 ? 'bg-success' : 'bg-on-surface/20')}
          />
        )
      })}
    </div>
  )
}

// ─── PULSE HEADER ──────────────────────────────────────────────────────────────

function PulseHeader({
  linkedPlayer, currentUser, myRankIdx, rankDelta, currentTierInfo,
  nextTier, ptsToNextTier, tPhase, tRound, registeredCount, checkedInCount,
  tournamentState, clashName, clashDate, clashTime, diff, D, H, M, S,
  isMyRegistered, isMyWaitlisted, myWaitlistPos, myCheckedIn, profileComplete,
  phaseActionBtn
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

  var regPct = Math.min(100, Math.round(registeredCount / (tournamentState.maxPlayers || 24) * 100))
  var checkinPct = Math.min(100, registeredCount > 0 ? Math.round(checkedInCount / registeredCount * 100) : 0)

  return (
    <Panel className="mb-4 overflow-hidden p-0">
      {/* Phase status bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-outline-variant/10 bg-surface-container-highest/30">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            background: pColor,
            boxShadow: '0 0 8px ' + pColor,
            animation: tPhase === 'inprogress' ? 'pulse 2s infinite' : 'none'
          }}
        />
        <span
          className="font-sans text-[10px] font-bold uppercase tracking-[0.08em]"
          style={{ color: pColor }}
        >
          {phaseLabel}
        </span>
        {tPhase === 'registration' && (
          <span className="font-sans text-[10px] text-on-surface/40 ml-1">
            {registeredCount}/{tournamentState.maxPlayers || 24}
          </span>
        )}
        {tPhase === 'checkin' && (
          <span className="font-sans text-[10px] text-on-surface/40 ml-1">
            {checkedInCount} checked in
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {isMyWaitlisted && (
            <span className="font-mono text-[10px] text-primary font-bold">
              Waitlist #{myWaitlistPos}
            </span>
          )}
          {phaseActionBtn}
        </div>
      </div>

      {/* Player info row */}
      <div className="flex items-center gap-3 p-4 flex-wrap">
        {linkedPlayer ? (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-base font-black flex-shrink-0 border-2"
            style={{
              background: currentTierInfo.color + '26',
              borderColor: currentTierInfo.color + '66',
              color: currentTierInfo.color
            }}
          >
            {linkedPlayer.name.charAt(0).toUpperCase()}
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full bg-secondary/10 border-2 border-secondary/20 flex items-center justify-center flex-shrink-0">
            <Icon name="person" size={20} className="text-secondary" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-on-surface leading-tight">
            {linkedPlayer ? linkedPlayer.name : (currentUser.username || 'Summoner')}
          </div>
          {linkedPlayer ? (
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="font-sans text-[10px] font-bold uppercase tracking-[0.06em]"
                style={{ color: currentTierInfo.color }}
              >
                {currentTierInfo.name}
              </span>
              <span className="text-[10px] text-on-surface/40">{linkedPlayer.rank || 'Unranked'}</span>
            </div>
          ) : (
            <div className="text-[11px] text-on-surface/40 mt-0.5">Link your Riot ID to get started</div>
          )}
        </div>

        {linkedPlayer && (
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-center">
              <div className="flex items-center gap-1 justify-center">
                <span className="font-mono text-xl font-black" style={{ color: currentTierInfo.color }}>
                  #{myRankIdx}
                </span>
                {rankDelta !== 0 && (
                  <span
                    className="font-mono text-[9px] font-bold"
                    style={{ color: rankDelta < 0 ? '#6EE7B7' : '#F87171' }}
                  >
                    {rankDelta < 0 ? '+' + Math.abs(rankDelta) : '-' + Math.abs(rankDelta)}
                  </span>
                )}
              </div>
              <div className="font-sans text-[10px] text-on-surface/40 uppercase tracking-[0.08em]">Rank</div>
            </div>
            <div className="w-px h-6 bg-outline-variant/10" />
            <div className="text-center">
              <div className="font-mono text-xl font-black text-primary">{linkedPlayer.pts || 0}</div>
              <div className="font-sans text-[10px] text-on-surface/40 uppercase tracking-[0.08em]">Points</div>
            </div>
            {ptsToNextTier && ptsToNextTier > 0 && (
              <span className="font-sans text-[10px] text-on-surface/40 bg-surface-container rounded px-1.5 py-0.5 border border-outline-variant/10">
                {ptsToNextTier} to {nextTier.name}
              </span>
            )}
          </div>
        )}

        {!linkedPlayer && !profileComplete && (
          <Btn variant="primary" size="sm">Complete Profile</Btn>
        )}
      </div>

      {/* Countdown + clash info */}
      {diff > 0 && (tPhase === 'registration' || tPhase === 'checkin') && (
        <div className="flex items-center gap-3 px-4 pb-3 flex-wrap">
          {clashName && (
            <div className="flex items-center gap-1.5">
              <Icon name="calendar_today" size={12} className="text-on-surface/40" />
              <span className="text-xs text-on-surface/60 font-semibold">
                {clashName}{clashDate ? ' - ' + clashDate : ''}{clashTime ? ' at ' + clashTime : ''}
              </span>
            </div>
          )}
          <div className="ml-auto flex gap-1">
            {[[D, 'D'], [H, 'H'], [M, 'M'], [S, 'S']].map(function (seg) {
              return (
                <div key={seg[1]} className="bg-surface-container rounded px-2 py-1 flex items-center gap-1">
                  <span className="font-mono text-sm font-black text-primary">{seg[0]}</span>
                  <span className="font-sans text-[10px] text-on-surface/40 font-bold">{seg[1]}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Progress bar */}
      {tPhase === 'registration' && (
        <div className="px-4 pb-3">
          <div className="bg-surface-container rounded-full h-1 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: regPct + '%', background: '#9B72CF' }}
            />
          </div>
        </div>
      )}
      {tPhase === 'checkin' && (
        <div className="px-4 pb-3">
          <div className="bg-surface-container rounded-full h-1 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: checkinPct + '%', background: '#E8A838' }}
            />
          </div>
        </div>
      )}
    </Panel>
  )
}

// ─── SEASON TRAJECTORY CARD ────────────────────────────────────────────────────

function SeasonTrajectoryCard({ linkedPlayer, s2, clashHistory, pointsTrend, lastClash, currentStreak, streakType, onViewProfile }) {
  if (!linkedPlayer || !s2) return null

  return (
    <Panel className="overflow-hidden p-0">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-outline-variant/10 bg-surface-container-highest/30">
        <div className="flex items-center gap-2">
          <Icon name="show_chart" size={14} className="text-secondary" />
          <span className="font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface/60">Your Season</span>
        </div>
        <Btn variant="ghost" size="sm" onClick={onViewProfile}>Full Profile</Btn>
      </div>

      <div className="p-4">
        {/* Sparkline + total */}
        {pointsTrend.length >= 2 && (
          <div className="mb-4 p-3 rounded-sm bg-secondary/5 border border-secondary/10">
            <div className="flex items-center justify-between mb-2">
              <span className="font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface/40">
                Season Trajectory
              </span>
              <span className="font-mono text-xs font-bold text-primary">{linkedPlayer.pts} pts total</span>
            </div>
            <Sparkline data={pointsTrend} color="#9B72CF" w={260} h={32} />
            <div className="flex items-center gap-2 mt-2">
              <span className="font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface/40">Form</span>
              <FormDots history={clashHistory} />
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            [linkedPlayer.pts, 'Season Points', '#E8A838'],
            [linkedPlayer.wins || 0, 'Wins', '#6EE7B7'],
            [s2.avgPlacement || '-', 'Avg Placement', '#4ECDC4'],
            [s2.top4Rate ? s2.top4Rate + '%' : '0%', 'Top 4 Rate', '#9B72CF']
          ].map(function (item) {
            return (
              <div key={item[1]} className="bg-surface-container rounded-sm p-3 text-center">
                <div className="font-mono text-xl font-bold" style={{ color: item[2], lineHeight: 1 }}>{item[0]}</div>
                <div className="font-sans text-[10px] font-bold uppercase tracking-[0.04em] text-on-surface/50 mt-1">{item[1]}</div>
              </div>
            )
          })}
        </div>

        {/* Last clash + streak */}
        <div className="flex gap-2 flex-wrap">
          <div className="bg-surface-container rounded-sm p-3 flex-1 min-w-[120px]">
            <div className="font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface/40 mb-1.5">Last Clash</div>
            {lastClash ? (
              <div className="flex items-baseline gap-1.5">
                <span
                  className="font-mono text-2xl font-black"
                  style={{ color: lastClash.placement <= 4 ? '#E8A838' : '#9AAABF' }}
                >
                  {ordinal(lastClash.placement)}
                </span>
                <span className="text-xs text-on-surface/60 font-semibold">+{lastClash.points || 0} pts</span>
              </div>
            ) : (
              <div className="text-xs text-on-surface/40">No results yet</div>
            )}
          </div>

          {currentStreak > 1 && (
            <div className="bg-surface-container rounded-sm p-3 flex-1 min-w-[120px]">
              <div className="font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface/40 mb-1.5">Active Streak</div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-black text-success">{currentStreak}</span>
                <span className="text-xs text-on-surface/60 font-semibold">{streakType === 'win' ? 'wins' : 'top 4s'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Panel>
  )
}

// ─── STANDINGS MINI ────────────────────────────────────────────────────────────

function StandingsMini({ top5, linkedPlayer, onViewPlayer, onViewAll }) {
  var MEDAL_COLORS = ['#E8A838', '#C0C0C0', '#CD7F32']

  return (
    <Panel className="overflow-hidden p-0">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-outline-variant/10 bg-surface-container-highest/30">
        <div className="flex items-center gap-2">
          <Icon name="trophy" fill size={13} className="text-primary" />
          <span className="font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface/60">Standings</span>
        </div>
        <Btn variant="ghost" size="sm" onClick={onViewAll}>View All</Btn>
      </div>

      {top5.length === 0 && (
        <div className="text-center py-6 text-on-surface/40 text-sm">No players yet</div>
      )}

      {top5.map(function (p, i) {
        var rkCol = i < 3 ? MEDAL_COLORS[i] : '#BECBD9'
        var isMe = linkedPlayer && p.id === linkedPlayer.id
        var sparkData = (p.clashHistory || []).slice(-5).map(function (c) { return c.placement || 4 })

        return (
          <div
            key={p.id}
            onClick={function () { onViewPlayer(p) }}
            className="grid items-center px-3 py-2.5 border-b border-outline-variant/5 cursor-pointer transition-colors hover:bg-secondary/5"
            style={{
              gridTemplateColumns: '24px 1fr 56px 64px',
              background: isMe ? 'rgba(155,114,207,.08)' : 'transparent',
              borderLeft: '3px solid ' + (isMe ? '#9B72CF' : 'transparent')
            }}
          >
            <div
              className="font-mono text-center font-black"
              style={{ fontSize: i < 3 ? 14 : 12, color: rkCol }}
            >
              {i + 1}
            </div>
            <div className="min-w-0">
              <div
                className="font-semibold text-xs truncate"
                style={{ color: isMe ? '#C4B5FD' : i < 3 ? '#F2EDE4' : '#BECBD9' }}
              >
                {p.name}{isMe ? ' (you)' : ''}
              </div>
              <div className="text-[10px] text-on-surface/40 mt-0.5">{(p.rank || 'Unranked') + ' - ' + (p.wins || 0) + 'W'}</div>
            </div>
            <div
              className="font-mono font-black text-right"
              style={{ fontSize: i < 3 ? 16 : 13, color: i < 3 ? '#E8A838' : '#BECBD9' }}
            >
              {p.pts}
            </div>
            <div className="flex items-center justify-end gap-1">
              {sparkData.length >= 2 && <Sparkline data={sparkData} w={36} h={12} color="#9B72CF" />}
              <FormDots history={(p.clashHistory || []).slice(-3)} max={3} />
            </div>
          </div>
        )
      })}
    </Panel>
  )
}

// ─── ACTIVITY FEED ─────────────────────────────────────────────────────────────

function ActivityFeed({ items }) {
  if (!items || items.length === 0) return null

  return (
    <Panel className="overflow-hidden p-0">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-outline-variant/10 bg-surface-container-highest/30">
        <Icon name="bolt" fill size={13} className="text-tertiary" />
        <span className="font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface/60">Activity</span>
      </div>
      {items.slice(0, 4).map(function (item, idx) {
        return (
          <div
            key={item.id || idx}
            className="flex items-center gap-2 px-4 py-2 border-b border-outline-variant/5 last:border-b-0"
          >
            <div className="w-6 h-6 rounded-full bg-tertiary/10 flex items-center justify-center flex-shrink-0">
              <Icon name={item.icon || 'notifications'} size={12} className="text-tertiary" />
            </div>
            <span className="text-xs text-on-surface/60 flex-1 truncate">
              {item.message || (item.detail_json && item.detail_json.text) || ''}
            </span>
            {item.created_at && (
              <span className="text-[10px] text-on-surface/30 flex-shrink-0">
                {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        )
      })}
    </Panel>
  )
}

// ─── FLASH TOURNAMENT BANNER ───────────────────────────────────────────────────

function FlashTournamentBanner({ tournament, onView }) {
  if (!tournament) return null

  return (
    <Panel accent="teal" className="cursor-pointer hover:bg-surface-container transition-colors" onClick={onView}>
      <div className="flex items-center gap-3">
        <Icon name="bolt" fill size={18} className="text-tertiary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-tertiary mb-0.5">Flash Tournament</div>
          <div className="font-bold text-sm text-on-surface truncate">{tournament.name}</div>
        </div>
        <Btn variant="primary" size="sm">Register</Btn>
      </div>
    </Panel>
  )
}

// ─── ANNOUNCEMENT STRIP ────────────────────────────────────────────────────────

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

// ─── SEASON NARRATIVE ──────────────────────────────────────────────────────────

function SeasonNarrativeBar({ text }) {
  if (!text) return null
  return (
    <div
      className="flex items-center gap-2 rounded-sm px-4 py-2.5 mb-4"
      style={{
        background: 'rgba(155,114,207,.04)',
        border: '1px solid rgba(155,114,207,.08)'
      }}
    >
      <Icon name="trending_up" size={14} className="text-secondary flex-shrink-0" />
      <span className="text-xs text-on-surface/60 font-medium">{text}</span>
    </div>
  )
}

// ─── QUICK ACTIONS ─────────────────────────────────────────────────────────────

function QuickActions({ onStandings, onProfile, onHof, linkedPlayer }) {
  return (
    <div className="flex gap-2 flex-wrap mb-4">
      <Btn variant="secondary" size="sm" onClick={onStandings}>
        <span className="flex items-center gap-1.5">
          <Icon name="format_list_numbered" size={13} />
          Standings
        </span>
      </Btn>
      {linkedPlayer && (
        <Btn variant="secondary" size="sm" onClick={onProfile}>
          <span className="flex items-center gap-1.5">
            <Icon name="person" size={13} />
            Profile
          </span>
        </Btn>
      )}
      <Btn variant="secondary" size="sm" onClick={onHof}>
        <span className="flex items-center gap-1.5">
          <Icon name="crown" size={13} />
          Hall of Fame
        </span>
      </Btn>
      <button
        onClick={function () { window.open('https://discord.gg/tftclash', '_blank') }}
        className="rounded-full font-sans font-bold uppercase tracking-widest transition-all duration-300 py-2 px-4 text-xs"
        style={{
          background: 'rgba(88,101,242,.06)',
          border: '1px solid rgba(88,101,242,.2)',
          color: '#818CF8'
        }}
      >
        <span className="flex items-center gap-1.5">
          <Icon name="forum" size={13} />
          Discord
        </span>
      </button>
    </div>
  )
}

// ─── MAIN DASHBOARD ────────────────────────────────────────────────────────────

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

  var seasonNarrative = generateSeasonNarrative(players, sortedPts)

  var tPhase = (tournamentState && tournamentState.phase) || 'registration'
  var tRound = (tournamentState && tournamentState.round) || 1
  var registeredCount = ((tournamentState && tournamentState.registeredIds) || []).length
  var checkedInCount = players.filter(function (p) { return p.checkedIn }).length
  var isMyRegistered = linkedPlayer && ((tournamentState.registeredIds || []).includes(String(linkedPlayer.id)))
  var isMyWaitlisted = linkedPlayer && ((tournamentState.waitlistIds || []).includes(String(linkedPlayer.id)))
  var myWaitlistPos = isMyWaitlisted ? (tournamentState.waitlistIds || []).indexOf(String(linkedPlayer.id)) + 1 : 0
  var myCheckedIn = linkedPlayer && linkedPlayer.checkedIn

  // Featured event
  var _fe = featuredEvents || []
  var _liveEv = _fe.filter(function (e) { return e.status === 'live' })[0]
  var _upEv = _fe.filter(function (e) { return e.status === 'upcoming' })[0]
  var heroEv = _liveEv || _upEv || null

  // Ticker items
  var tickerItems = (tickerOverrides || []).filter(function (t) { return t && (typeof t === 'string' ? t.trim() : t.text) })

  // ─── Action handlers ─────────────────────────────────────────────────────────

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

  return (
    <PageLayout maxWidth="max-w-[880px]">
      {/* Announcements */}
      {announcement && <AnnouncementStrip text={announcement} />}
      {hostAnnouncements && hostAnnouncements.length > 0 && (
        <AnnouncementStrip text={hostAnnouncements[0].msg} variant="host" />
      )}

      {/* The Pulse header */}
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
      />

      {/* Flash tournament banner */}
      <FlashTournamentBanner
        tournament={upcomingTournament}
        onView={function () { setScreen('flash-' + upcomingTournament.id) }}
      />

      {/* Two-column layout: Season stats + Standings + Activity */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
        {/* Left col - Season trajectory */}
        <div className="md:col-span-3 flex flex-col gap-4">
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
          {heroEv && (
            <Panel
              accent={heroEv.status === 'live' ? null : 'purple'}
              className="cursor-pointer hover:bg-surface-container transition-colors p-0 overflow-hidden"
              onClick={function () { setScreen('events/featured') }}
            >
              <div
                className="flex items-center gap-2 px-4 py-2.5 border-b border-outline-variant/10 bg-surface-container-highest/30"
              >
                <Icon name="tournament" size={12} className={heroEv.status === 'live' ? 'text-success' : 'text-secondary'} />
                <span className={'font-sans text-[10px] font-bold uppercase tracking-[0.12em] ' + (heroEv.status === 'live' ? 'text-success' : 'text-secondary')}>
                  {heroEv.status === 'live' ? 'Live Event' : 'Upcoming Event'}
                </span>
                {heroEv.status === 'live' ? (
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-success font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" style={{ animation: 'pulse 2s infinite' }} />
                    LIVE NOW
                  </span>
                ) : (
                  <span className="ml-auto text-[10px] text-on-surface/40">{heroEv.date || ''}</span>
                )}
                <Icon name="chevron_right" size={14} className="text-on-surface/40 ml-1" />
              </div>
              <div className="flex gap-3 items-center px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-on-surface truncate mb-0.5">{heroEv.name}</div>
                  <div className="text-xs text-on-surface/40 mb-1.5">
                    {'Hosted by ' + (heroEv.host || 'TFT Clash') + (heroEv.sponsor ? ', presented by ' + heroEv.sponsor : '')}
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <span className="font-sans text-[10px] font-bold text-primary tracking-[0.06em]">
                      {(heroEv.registered || 0) + '/' + (heroEv.size || 8) + ' PLAYERS'}
                    </span>
                    {heroEv.prizePool && (
                      <span className="font-sans text-[10px] font-bold text-tertiary tracking-[0.06em]">{heroEv.prizePool}</span>
                    )}
                    {heroEv.format && (
                      <span className="font-sans text-[10px] text-on-surface/40">{heroEv.format}</span>
                    )}
                  </div>
                </div>
              </div>
            </Panel>
          )}
        </div>

        {/* Right col - Standings + Activity */}
        <div className="md:col-span-2 flex flex-col gap-4">
          <StandingsMini
            top5={top5}
            linkedPlayer={linkedPlayer}
            onViewPlayer={handleViewPlayer}
            onViewAll={function () { setScreen('leaderboard') }}
          />
          <ActivityFeed items={activityFeed} />
        </div>
      </div>

      {/* Season narrative */}
      <SeasonNarrativeBar text={seasonNarrative} />

      {/* Quick actions */}
      <QuickActions
        onStandings={function () { setScreen('leaderboard') }}
        onProfile={handleViewProfile}
        onHof={function () { setScreen('hof') }}
        linkedPlayer={linkedPlayer}
      />

      {/* Ticker */}
      {tickerItems.length > 0 && (
        <div
          className="overflow-hidden rounded-sm mb-4"
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
