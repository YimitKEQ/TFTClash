import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getStats } from '../lib/stats.js'
import { REGIONS } from '../lib/constants.js'
import PageHeader from '../components/shared/PageHeader'
import Podium from '../components/shared/Podium'
import RankBadge from '../components/shared/RankBadge'
import { Panel, Icon, Inp } from '../components/ui'

var MEDAL_COLORS = ['#E8A838', '#C0C0C0', '#CD7F32']
var TIERS_OPTIONS = ['All', 'Challenger', 'Grandmaster', 'Master', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze']

function avgPlacementColor(avg) {
  if (!avg || avg === '-') return 'text-on-surface/40'
  var n = parseFloat(avg)
  if (n <= 2.5) return 'text-emerald-400'
  if (n <= 4.0) return 'text-primary'
  if (n <= 5.5) return 'text-yellow-400'
  return 'text-rose-400'
}

function RankRow({ player, rank, isMe, onClick }) {
  var stats = getStats(player)
  var isTop3 = rank <= 3
  var medalColor = isTop3 ? MEDAL_COLORS[rank - 1] : null

  return (
    <div
      className={'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-surface-container-high/60' + (isMe ? ' bg-primary/5 border-l-2 border-primary' : '') + (rank === 1 ? ' border-l-2 border-[#E8A838]' : '')}
      onClick={onClick}
    >
      <div className="w-8 text-center flex-shrink-0">
        {isTop3
          ? <span className="font-mono text-sm font-bold" style={{ color: medalColor }}>{'#' + rank}</span>
          : <span className="font-mono text-sm text-on-surface/40">{'#' + rank}</span>
        }
      </div>

      <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm border-2" style={isTop3 ? { borderColor: medalColor + '66', backgroundColor: medalColor + '1a', color: medalColor } : { borderColor: 'rgba(242,237,228,0.1)', backgroundColor: 'rgba(242,237,228,0.05)', color: 'rgba(242,237,228,0.5)' }}>
        {(player.name || '?').charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={'font-bold text-sm truncate' + (isMe ? ' text-primary' : ' text-on-surface')}>
            {player.name}
          </span>
          {isMe && (
            <span className="font-sans text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-sm flex-shrink-0">
              You
            </span>
          )}
          {player.plan === 'pro' && (
            <span className="font-sans text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-sm flex-shrink-0">
              Pro
            </span>
          )}
          {player.rank && <RankBadge rank={player.rank} className="hidden sm:inline-flex" />}
        </div>
        <div className="text-[11px] text-on-surface/40 mt-0.5">
          {player.region || 'EUW'}
          {stats.games > 0 ? (' - ' + stats.games + ' games') : ''}
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-6 flex-shrink-0 text-right">
        <div>
          <div className={'font-mono text-sm font-bold ' + avgPlacementColor(stats.avgPlacement)}>{stats.avgPlacement}</div>
          <div className="font-sans text-[9px] uppercase tracking-widest text-on-surface/30">Avg</div>
        </div>
        <div>
          <div className="font-mono text-sm font-bold text-emerald-400">{stats.top4Rate + '%'}</div>
          <div className="font-sans text-[9px] uppercase tracking-widest text-on-surface/30">Top4</div>
        </div>
        <div>
          <div className="font-mono text-sm font-bold text-secondary">{stats.wins}</div>
          <div className="font-sans text-[9px] uppercase tracking-widest text-on-surface/30">Wins</div>
        </div>
      </div>

      <div className="flex-shrink-0 text-right min-w-[56px]">
        <div className={'font-mono font-bold' + (isTop3 ? ' text-base' : ' text-sm')} style={isTop3 ? { color: medalColor } : { color: 'rgba(242,237,228,0.7)' }}>
          {player.pts || 0}
        </div>
        <div className="font-sans text-[9px] uppercase tracking-widest text-on-surface/30">pts</div>
      </div>

      <Icon name="chevron_right" size={14} className="text-on-surface/20 flex-shrink-0" />
    </div>
  )
}

export default function LeaderboardScreen() {
  var ctx = useApp()
  var players = ctx.players
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
      var matchName = !search || p.name.toLowerCase().indexOf(search.toLowerCase()) !== -1
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

  function openPlayer(p) {
    setProfilePlayer(p)
    setScreen('profile')
    navigate('/player/' + p.name)
  }

  function handleMyPosition() {
    var el = document.getElementById('lb-me-row')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="space-y-8 pb-8">
      <PageHeader
        title="Ranked"
        goldWord="Standings"
        subtitle="Global Competition"
        description="Season rankings across all TFT Clash players. Compete weekly to climb the board."
      />

      {top3.length >= 3 && (
        <Podium players={top3} />
      )}

      {top3.length < 3 && top3.length > 0 && (
        <Panel className="text-center py-8">
          <Icon name="trophy" fill size={28} className="text-primary mx-auto mb-3" />
          <div className="font-bold text-on-surface mb-1">Season in progress</div>
          <div className="text-sm text-on-surface/50">Podium appears after 3+ players have competed.</div>
        </Panel>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface/40 pointer-events-none" />
          <Inp
            value={search}
            onChange={setSearch}
            placeholder="Search players..."
            className="pl-9"
          />
        </div>

        <select
          value={regionFilter}
          onChange={function(e) { setRegionFilter(e.target.value) }}
          className="bg-surface-container border border-outline-variant/20 text-on-surface text-sm rounded-sm px-3 py-2 focus:outline-none focus:border-primary/40"
        >
          <option value="All">All Regions</option>
          {REGIONS.map(function(r) {
            return <option key={r} value={r}>{r}</option>
          })}
        </select>

        <select
          value={tierFilter}
          onChange={function(e) { setTierFilter(e.target.value) }}
          className="bg-surface-container border border-outline-variant/20 text-on-surface text-sm rounded-sm px-3 py-2 focus:outline-none focus:border-primary/40"
        >
          {TIERS_OPTIONS.map(function(t) {
            return <option key={t} value={t}>{t === 'All' ? 'All Tiers' : t}</option>
          })}
        </select>

        {currentUser && myIdx >= 0 && (
          <button
            onClick={handleMyPosition}
            className="flex-shrink-0 px-3 py-2 text-sm font-sans font-semibold text-primary bg-primary/10 border border-primary/20 rounded-sm hover:bg-primary/15 transition-colors"
          >
            {'My Position #' + (myIdx + 1)}
          </button>
        )}
      </div>

      {sorted.length === 0 && (
        <Panel className="text-center py-16">
          <Icon name="trophy" fill size={32} className="text-on-surface/20 mx-auto mb-4" />
          <div className="font-bold text-on-surface mb-2">No players found</div>
          <div className="text-sm text-on-surface/50">
            {search || regionFilter !== 'All' || tierFilter !== 'All'
              ? 'Try adjusting your filters.'
              : 'Standings appear once clashes have been played and results submitted.'}
          </div>
        </Panel>
      )}

      {sorted.length > 0 && (
        <Panel className="overflow-hidden p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/10 bg-surface-container-highest/20">
            <div className="flex items-center gap-4">
              <div className="font-sans text-[10px] uppercase tracking-widest text-on-surface/50">Rank</div>
              <div className="font-sans text-[10px] uppercase tracking-widest text-on-surface/50">Player</div>
            </div>
            <div className="hidden sm:flex items-center gap-6 pr-10">
              <div className="font-sans text-[10px] uppercase tracking-widest text-on-surface/50 w-8 text-right">Avg</div>
              <div className="font-sans text-[10px] uppercase tracking-widest text-on-surface/50 w-10 text-right">Top4</div>
              <div className="font-sans text-[10px] uppercase tracking-widest text-on-surface/50 w-8 text-right">Wins</div>
              <div className="font-sans text-[10px] uppercase tracking-widest text-on-surface/50 w-14 text-right">Pts</div>
            </div>
          </div>

          <div className="divide-y divide-outline-variant/10">
            {sorted.map(function(player, i) {
              var rank = i + 1
              var isMe = currentUser && player.name === currentUser.username
              var rowId = isMe ? 'lb-me-row' : undefined

              return (
                <div key={player.id || player.name} id={rowId}>
                  <RankRow
                    player={player}
                    rank={rank}
                    isMe={isMe}
                    onClick={function() { openPlayer(player) }}
                  />
                </div>
              )
            })}
          </div>

          <div className="px-4 py-3 border-t border-outline-variant/10 bg-surface-container-highest/10 text-center">
            <span className="font-sans text-[10px] uppercase tracking-widest text-on-surface/30">
              {sorted.length + ' player' + (sorted.length !== 1 ? 's' : '') + ' ranked this season'}
            </span>
          </div>
        </Panel>
      )}
    </div>
  )
}
