import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getStats } from '../lib/stats.js'
import { MEDAL_COLORS, REGIONS } from '../lib/constants.js'
import PageLayout from '../components/layout/PageLayout'
import { Btn, Icon, Panel, Skeleton } from '../components/ui'
import AdBanner from '../components/shared/AdBanner'
import SponsorShowcase from '../components/shared/SponsorShowcase'
import WatchButton from '../components/shared/WatchButton'

var TIERS_OPTIONS = ['All', 'Challenger', 'Grandmaster', 'Master', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze']

var TIER_DIVIDERS = [
  { key: 'Challenger',   label: 'CHALLENGER DIVISION',   sub: 'TOP 10 PLAYERS',    color: 'text-primary',   bg: 'bg-gradient-to-r from-primary/10 via-primary/5 to-transparent',   border: '' },
  { key: 'Grandmaster',  label: 'GRANDMASTER DIVISION',  sub: 'TOP 200 PLAYERS',   color: 'text-error',     bg: 'bg-gradient-to-r from-error/10 via-error/5 to-transparent',         border: 'border-t border-outline-variant/10' },
  { key: 'Master',       label: 'MASTER DIVISION',       sub: 'TOP 500 PLAYERS',   color: 'text-secondary', bg: 'bg-gradient-to-r from-secondary/10 via-secondary/5 to-transparent', border: 'border-t border-outline-variant/10' },
  { key: 'Diamond',      label: 'DIAMOND DIVISION',      sub: 'OPEN COMPETITION',  color: 'text-tertiary',  bg: 'bg-gradient-to-r from-tertiary/10 via-tertiary/5 to-transparent',   border: 'border-t border-outline-variant/10' },
  { key: 'Other',        label: 'RANKED PLAYERS',        sub: 'ALL RANKS',         color: 'text-on-surface-variant', bg: 'bg-gradient-to-r from-outline/10 via-outline/5 to-transparent', border: 'border-t border-outline-variant/10' }
]

function getTierKey(rank) {
  if (!rank) return 'Other'
  var r = rank.toLowerCase()
  if (r === 'challenger') return 'Challenger'
  if (r === 'grandmaster') return 'Grandmaster'
  if (r === 'master') return 'Master'
  if (r === 'diamond') return 'Diamond'
  return 'Other'
}

function getTrendIcon(avgPlacement) {
  if (!avgPlacement || avgPlacement === '-') return 'horizontal_rule'
  var n = parseFloat(avgPlacement)
  if (n <= 3.0) return 'trending_up'
  if (n <= 5.0) return 'horizontal_rule'
  return 'trending_down'
}

function getTrendColor(avgPlacement) {
  if (!avgPlacement || avgPlacement === '-') return 'text-secondary'
  var n = parseFloat(avgPlacement)
  if (n <= 3.0) return 'text-tertiary'
  if (n <= 5.0) return 'text-secondary'
  return 'text-error'
}

function PodiumCard({ player, rank, onClick }) {
  var isFirst = rank === 1
  var medalColor = MEDAL_COLORS[rank - 1]
  var medalLabel = rank === 1 ? '1ST' : rank === 2 ? '2ND' : '3RD'
  var initial = (player.name || '?').charAt(0).toUpperCase()

  if (isFirst) {
    return (
      <div className="order-1 md:order-2 flex flex-col items-center pt-12 md:-translate-y-2">
        <div className="relative group cursor-pointer mb-6" onClick={onClick}>
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-20">
            <Icon name="emoji_events" fill size={48} className="text-primary drop-shadow-[0_2px_8px_rgba(255,206,120,0.6)]" />
          </div>
          <div className="w-36 h-36 rounded-full border-4 border-primary overflow-hidden bg-surface-container-high transition-transform duration-300 group-hover:scale-105 flex items-center justify-center gold-glow-boss">
            <span className="font-display text-5xl font-bold text-primary">{initial}</span>
          </div>
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed font-label font-bold px-6 py-2 rounded text-sm shadow-xl uppercase tracking-widest whitespace-nowrap">
            {player.name.toUpperCase()}
          </div>
        </div>
        <h3 className="font-display text-2xl mb-1 mt-4">{player.name}</h3>
        <p className="font-mono text-primary text-lg font-bold">{(player.pts || 0) + ' pts'}</p>
        <div className="mt-6 h-36 w-full bg-gradient-to-b from-primary/10 to-surface-container-low rounded-t-xl"></div>
      </div>
    )
  }

  var borderClass = rank === 2 ? 'border-medal-silver/30' : 'border-medal-bronze/30'
  var labelBg = rank === 2 ? 'bg-medal-silver' : 'bg-medal-bronze'
  var imgFilter = rank === 2 ? 'grayscale opacity-80' : 'sepia-[.3]'
  var glowClass = rank === 2 ? 'silver-glow-boss' : 'bronze-glow-boss'
  var heightClass = rank === 2 ? 'h-24' : 'h-20'
  var orderClass = rank === 2 ? 'order-2 md:order-1' : 'order-3'

  return (
    <div className={orderClass + ' flex flex-col items-center'}>
      <div className="relative group cursor-pointer mb-6" onClick={onClick}>
        <div className={'w-24 h-24 rounded-full border-4 ' + borderClass + ' ' + glowClass + ' overflow-hidden bg-surface-container-high transition-transform duration-300 group-hover:scale-105 flex items-center justify-center'}>
          <span className={'font-display text-3xl font-bold ' + imgFilter} style={{ color: medalColor }}>{initial}</span>
        </div>
        <div className={'absolute -bottom-2 left-1/2 -translate-x-1/2 ' + labelBg + ' text-surface font-label font-bold px-3 py-1 rounded text-xs uppercase tracking-widest'}>
          {medalLabel}
        </div>
      </div>
      <h3 className="font-display text-xl mb-1">{player.name}</h3>
      <p className="font-mono text-tertiary text-sm">{(player.pts || 0) + ' pts'}</p>
      <div className={'mt-4 ' + heightClass + ' w-full bg-surface-container-low rounded-t-xl opacity-40'}></div>
    </div>
  )
}

function TableRow({ player, rank, isMe, onClick }) {
  var stats = getStats(player)
  var trendIcon = getTrendIcon(stats.avgPlacement)
  var trendColor = getTrendColor(stats.avgPlacement)
  var rankLabel = '#' + (rank < 10 ? '0' + rank : rank)

  var rowClass = isMe
    ? 'relative group cursor-pointer bg-secondary/5 shadow-[inset_0_0_15px_rgba(217,185,255,0.15)]'
    : 'hover:bg-white/5 transition-colors group cursor-pointer'
  var rowId = isMe ? 'lb-me-row' : undefined
  var rankColor = isMe ? 'text-secondary font-bold' : 'text-on-surface'
  var nameColor = isMe ? 'text-secondary' : 'text-on-surface'
  var ptsColor = isMe ? 'text-secondary font-bold' : 'text-tertiary font-bold'
  var avgColor = isMe ? 'text-secondary' : 'text-on-surface-variant'
  var initialClass = isMe
    ? 'w-8 h-8 bg-secondary-container rounded-full border border-secondary/50 flex items-center justify-center flex-shrink-0'
    : 'w-8 h-8 bg-surface-container-high rounded-full flex items-center justify-center flex-shrink-0'
  var initialTextClass = isMe ? 'font-bold text-secondary text-sm' : 'font-bold text-on-surface/60 text-sm'

  return (
    <tr id={rowId} className={rowClass} onClick={onClick}>
      <td className={'px-4 sm:px-8 py-4 sm:py-5 font-mono text-sm ' + rankColor}>{rankLabel}</td>
      <td className="px-4 sm:px-8 py-4 sm:py-5">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className={initialClass}>
            <span className={initialTextClass}>{(player.name || '?').charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className={'font-bold truncate ' + nameColor}>{player.name}</span>
            {isMe && (
              <span className="bg-secondary/20 text-secondary text-[10px] px-2 py-0.5 font-label tracking-tighter rounded-full uppercase flex-shrink-0">You</span>
            )}
          </div>
        </div>
      </td>
      <td className={'px-4 sm:px-8 py-4 sm:py-5 font-mono text-sm whitespace-nowrap ' + ptsColor}>{(player.pts || 0) + ' pts'}</td>
      <td className={'hidden sm:table-cell px-8 py-5 font-mono text-sm ' + avgColor}>{stats.avgPlacement}</td>
      <td className="hidden md:table-cell px-4 py-4 text-right">
        <WatchButton name={player.name} size="sm" />
      </td>
      <td className="px-4 sm:px-8 py-4 sm:py-5 text-right">
        <Icon name={trendIcon} size={18} className={'align-middle ' + trendColor} />
      </td>
    </tr>
  )
}

function TierDividerRow({ divider }) {
  return (
    <tr className={divider.bg + ' ' + divider.border}>
      <td colSpan={6} className="px-4 sm:px-8 py-3">
        <div className="flex items-center justify-between">
          <span className={'font-label text-sm tracking-[0.3em] font-bold ' + divider.color}>{divider.label}</span>
          <span className="font-mono text-xs text-current opacity-40">{divider.sub}</span>
        </div>
      </td>
    </tr>
  )
}

export default function LeaderboardScreen(props) {
  var embedded = props.embedded || false
  var ctx = useApp()
  var players = ctx.players || []
  var isLoadingData = ctx.isLoadingData
  var currentUser = ctx.currentUser
  var setProfilePlayer = ctx.setProfilePlayer
  var setScreen = ctx.setScreen
  var navigate = useNavigate()

  var _search = useState('')
  var search = _search[0]
  var setSearch = _search[1]

  var _regionFilter = useState('All')
  var regionFilter = _regionFilter[0]
  var setRegionFilter = _regionFilter[1]

  var _tierFilter = useState('All')
  var tierFilter = _tierFilter[0]
  var setTierFilter = _tierFilter[1]

  var sorted = useMemo(function() {
    var f = players.filter(function(p) {
      var matchName = !search || (p.name||'').toLowerCase().indexOf(search.toLowerCase()) !== -1
      var matchRegion = regionFilter === 'All' || p.region === regionFilter
      var matchTier = tierFilter === 'All' || p.rank === tierFilter
      return matchName && matchRegion && matchTier
    })
    return f.slice().sort(function(a, b) { return (b.pts || 0) - (a.pts || 0) })
  }, [players, search, regionFilter, tierFilter])

  var top3 = sorted.slice(0, 3)

  var myIdx = currentUser
    ? sorted.findIndex(function(p) { return p.name === currentUser.username })
    : -1

  var ranksMap = useMemo(function() {
    var map = {}
    sorted.forEach(function(p, i) { map[p.name] = i + 1 })
    return map
  }, [sorted])

  var tierGroups = useMemo(function() {
    var groups = {}
    TIER_DIVIDERS.forEach(function(d) { groups[d.key] = [] })
    sorted.forEach(function(p) {
      var key = getTierKey(p.rank)
      groups[key].push(p)
    })
    return groups
  }, [sorted])

  function openPlayer(p) {
    setProfilePlayer(p)
    setScreen('profile')
    navigate('/player/' + p.name)
  }

  function handleMyPosition() {
    var el = document.getElementById('lb-me-row')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  var content = (
    <div className="pb-20">

        {/* Header */}
        <header className="mb-16 text-center relative">
          <div aria-hidden="true" className="tactical-grid absolute inset-0 -z-10 pointer-events-none"></div>
          <div className="flex justify-center mb-4">
            <span className="brand-eyebrow">Global Competition</span>
          </div>
          <h1 className="font-editorial text-5xl md:text-7xl font-bold text-on-surface mb-4">Ranked Standings</h1>
          <p className="text-on-surface-variant max-w-2xl mx-auto font-body opacity-80 leading-relaxed">
            Every placement earns points. Every week is a chance to climb. One season, one ladder, every region.
          </p>
        </header>

        {/* Leaderboard Sponsors */}
        <div className="mb-12">
          <SponsorShowcase placement="leaderboard" variant="strip" />
        </div>

        {/* Podium */}
        {top3.length >= 3 && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end mb-20 px-4 pt-4">
            <PodiumCard player={top3[1]} rank={2} onClick={function() { openPlayer(top3[1]) }} />
            <PodiumCard player={top3[0]} rank={1} onClick={function() { openPlayer(top3[0]) }} />
            <PodiumCard player={top3[2]} rank={3} onClick={function() { openPlayer(top3[2]) }} />
          </section>
        )}

        {/* Ad Banner (standalone only — StandingsScreen injects its own when embedded) */}
        {!embedded && <AdBanner size="banner" className="w-full mb-8" />}

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 mb-8 items-stretch md:items-center justify-between">
          <div className="flex gap-4 overflow-x-auto pb-1">
            <div className="relative">
              <select
                value={regionFilter}
                onChange={function(e) { setRegionFilter(e.target.value) }}
                className="appearance-none bg-surface-container-lowest border-b border-outline-variant/30 font-label uppercase tracking-widest text-xs py-3 pl-4 pr-10 focus:border-primary focus:ring-0 outline-none text-on-surface"
              >
                <option value="All">Global (All Regions)</option>
                {REGIONS.map(function(r) {
                  return <option key={r} value={r}>{r}</option>
                })}
              </select>
              <Icon name="expand_more" size={18} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-outline" />
            </div>
            <div className="relative">
              <select
                value={tierFilter}
                onChange={function(e) { setTierFilter(e.target.value) }}
                className="appearance-none bg-surface-container-lowest border-b border-outline-variant/30 font-label uppercase tracking-widest text-xs py-3 pl-4 pr-10 focus:border-primary focus:ring-0 outline-none text-on-surface"
              >
                {TIERS_OPTIONS.map(function(t) {
                  return <option key={t} value={t}>{t === 'All' ? 'All Tiers' : t}</option>
                })}
              </select>
              <Icon name="expand_more" size={18} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-outline" />
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-96 group">
              <Icon name="search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                value={search}
                onChange={function(e) { setSearch(e.target.value) }}
                placeholder="SEARCH PLAYER..."
                className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant/30 py-4 pl-12 pr-4 font-label uppercase tracking-widest text-sm focus:ring-0 focus:border-primary placeholder:text-outline/50 transition-all outline-none text-on-surface"
              />
            </div>

            {currentUser && myIdx >= 0 && (
              <Btn
                variant="primary"
                size="sm"
                icon="my_location"
                onClick={handleMyPosition}
                className="flex-shrink-0 whitespace-nowrap"
              >
                {'#' + (myIdx + 1)}
              </Btn>
            )}
          </div>
        </div>

        {/* Table Container */}
        {isLoadingData && players.length === 0 && (
          <Panel padding="none" className="overflow-hidden">
            <div className="divide-y divide-outline-variant/10">
              {[1,2,3,4,5,6,7,8,9,10].map(function(k) {
                return (
                  <div key={k} className="flex items-center gap-4 px-5 py-3.5">
                    <Skeleton className="w-8 h-5" />
                    <Skeleton className="w-9 h-9 rounded-full" />
                    <Skeleton className="h-4 flex-1 max-w-[180px]" />
                    <Skeleton className="h-4 w-16 hidden sm:block" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                )
              })}
            </div>
          </Panel>
        )}
        {!isLoadingData && sorted.length === 0 && (
          <Panel padding="none" className="px-8 py-16 text-center">
            <Icon name="leaderboard" size={48} className="text-on-surface/20 block mb-4 mx-auto" />
            <div className="font-display text-xl text-on-surface mb-2">No players found</div>
            <div className="text-sm text-on-surface-variant">
              {search || regionFilter !== 'All' || tierFilter !== 'All'
                ? 'Try adjusting your filters.'
                : 'Standings appear once clashes have been played and results submitted.'}
            </div>
          </Panel>
        )}

        {sorted.length > 0 && (
          <Panel padding="none" className="overflow-hidden">
            <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none]">
              <table className="w-full text-left border-collapse table-fixed">
                <colgroup>
                  <col className="w-20 sm:w-28" />
                  <col />
                  <col className="w-28 sm:w-40" />
                  <col className="hidden sm:table-column w-32" />
                  <col className="hidden md:table-column w-32" />
                  <col className="w-16 sm:w-24" />
                </colgroup>
                <thead className="bg-surface-container-lowest/50">
                  <tr>
                    <th className="px-4 sm:px-8 py-4 sm:py-5 font-label text-outline text-xs tracking-widest uppercase">Rank</th>
                    <th className="px-4 sm:px-8 py-4 sm:py-5 font-label text-outline text-xs tracking-widest uppercase">Player</th>
                    <th className="px-4 sm:px-8 py-4 sm:py-5 font-label text-outline text-xs tracking-widest uppercase">Points</th>
                    <th className="hidden sm:table-cell px-8 py-5 font-label text-outline text-xs tracking-widest uppercase">Avg Place</th>
                    <th className="hidden md:table-cell px-4 py-4 font-label text-outline text-xs tracking-widest uppercase text-right">Watch</th>
                    <th className="px-4 sm:px-8 py-4 sm:py-5 font-label text-outline text-xs tracking-widest uppercase text-right">Trend</th>
                  </tr>
                </thead>
                {TIER_DIVIDERS.map(function(divider) {
                  var tierPlayers = tierGroups[divider.key] || []
                  if (tierPlayers.length === 0) return null
                  return (
                    <tbody key={divider.key} className="divide-y divide-outline-variant/5">
                      <TierDividerRow divider={divider} />
                      {tierPlayers.map(function(player) {
                        var rank = ranksMap[player.name]
                        var isMe = currentUser && player.name === currentUser.username
                        return (
                          <TableRow
                            key={player.id || player.name}
                            player={player}
                            rank={rank}
                            isMe={isMe}
                            onClick={function() { openPlayer(player) }}
                          />
                        )
                      })}
                    </tbody>
                  )
                })}
              </table>
            </div>

            <div className="bg-surface-container-lowest py-6 px-8 border-t border-outline-variant/10">
              <span className="text-xs font-label text-outline tracking-widest uppercase">
                {'Showing ' + sorted.length + ' of ' + players.length + ' Players'}
              </span>
            </div>
          </Panel>
        )}

      </div>
  )
  return embedded ? content : <PageLayout>{content}</PageLayout>
}
