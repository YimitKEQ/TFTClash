import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import PageLayout from '../components/layout/PageLayout'
import PageHeader from '../components/shared/PageHeader'
import { Panel, Icon, Skeleton, PillTab, PillTabGroup } from '../components/ui'
import LeaderboardScreen from './LeaderboardScreen'
import HofScreen from './HofScreen'
import { rc } from '../lib/utils.js'
import { RANKS } from '../lib/constants.js'
import AdBanner from '../components/shared/AdBanner'

var TABS = [
  { id: '', label: 'Leaderboard', icon: 'emoji_events' },
  { id: 'hof', label: 'Hall of Fame', icon: 'workspace_premium' },
  { id: 'roster', label: 'Player Directory', icon: 'groups' },
]

var SORT_OPTIONS = [
  { value: 'pts', label: 'Points' },
  { value: 'wins', label: 'Wins' },
  { value: 'rank', label: 'Rank' },
  { value: 'name', label: 'Name' },
]

function TierDistributionCard(props) {
  var players = props.players || []
  if (players.length === 0) return null

  var counts = {}
  for (var i = 0; i < RANKS.length; i++) counts[RANKS[i]] = 0
  var unranked = 0

  for (var j = 0; j < players.length; j++) {
    var p = players[j]
    if (!p || p.banned) continue
    var r = p.rank
    if (r && counts[r] !== undefined) {
      counts[r] += 1
    } else {
      unranked += 1
    }
  }

  var total = 0
  for (var k = 0; k < RANKS.length; k++) total += counts[RANKS[k]]
  total += unranked
  if (total === 0) return null

  var maxCount = unranked
  for (var m = 0; m < RANKS.length; m++) {
    if (counts[RANKS[m]] > maxCount) maxCount = counts[RANKS[m]]
  }
  if (maxCount === 0) maxCount = 1

  var rows = []
  for (var n = 0; n < RANKS.length; n++) {
    var rank = RANKS[n]
    var c = counts[rank]
    if (c === 0) continue
    rows.push({ rank: rank, count: c, color: rc(rank), pct: Math.round((c / total) * 100) })
  }
  if (unranked > 0) {
    rows.push({ rank: 'Unranked', count: unranked, color: rc('Unranked'), pct: Math.round((unranked / total) * 100) })
  }

  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container/40 backdrop-blur p-4 sm:p-5 mb-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Icon name="signal_cellular_alt" className="text-tertiary" />
          <h3 className="font-display text-base tracking-wide">TIER DISTRIBUTION</h3>
        </div>
        <span className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/40">
          {total} active players
        </span>
      </div>
      <div className="space-y-2">
        {rows.map(function (row) {
          var widthPct = Math.max(2, Math.round((row.count / maxCount) * 100))
          return (
            <div
              key={row.rank}
              className="flex items-center gap-3"
              role="img"
              aria-label={row.rank + ': ' + row.count + ' players, ' + row.pct + ' percent'}
            >
              <div className="w-20 sm:w-24 flex-shrink-0 text-right">
                <span
                  className="font-label text-[10px] sm:text-xs font-bold uppercase tracking-wide"
                  style={{ color: row.color }}
                >
                  {row.rank}
                </span>
              </div>
              <div className="flex-1 h-4 sm:h-5 rounded-full bg-surface-container-high overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: widthPct + '%', background: row.color, boxShadow: '0 0 8px ' + row.color + '40' }}
                ></div>
              </div>
              <div className="w-16 sm:w-20 flex-shrink-0 text-right font-mono text-xs">
                <span className="text-on-surface font-bold">{row.count}</span>
                <span className="text-on-surface-variant/40 ml-1">{row.pct + '%'}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function StandingsScreen() {
  var ctx = useApp()
  var players = ctx.players || []
  var isLoadingData = ctx.isLoadingData
  var { subRoute } = ctx
  var tab = subRoute || ''
  var navigate = useNavigate()

  var _rosterSearch = useState('')
  var rosterSearch = _rosterSearch[0]
  var setRosterSearch = _rosterSearch[1]

  var _rosterSort = useState('pts')
  var rosterSort = _rosterSort[0]
  var setRosterSort = _rosterSort[1]

  function handleTabClick(tabId) {
    var path = tabId ? '/standings/' + tabId : '/standings'
    navigate(path)
  }

  function getRankOrder(rank) {
    var idx = RANKS.indexOf(rank)
    return idx === -1 ? 0 : idx
  }

  var filteredPlayers = players.filter(function(p) {
    if (!rosterSearch.trim()) return true
    var q = rosterSearch.trim().toLowerCase()
    var name = (p.name || p.username || '').toLowerCase()
    return name.indexOf(q) > -1
  })

  var sortedPlayers = filteredPlayers.slice().sort(function(a, b) {
    if (rosterSort === 'pts') return (b.pts || 0) - (a.pts || 0)
    if (rosterSort === 'wins') return (b.wins || 0) - (a.wins || 0)
    if (rosterSort === 'rank') return getRankOrder(b.rank) - getRankOrder(a.rank)
    if (rosterSort === 'name') {
      var na = (a.name || a.username || '').toLowerCase()
      var nb = (b.name || b.username || '').toLowerCase()
      if (na < nb) return -1
      if (na > nb) return 1
      return 0
    }
    return 0
  })

  return (
    <PageLayout>
      <PageHeader
        title="Standings"
        description="Season rankings, legends, and the full player roster"
      />

      <PillTabGroup className="mb-8">
        {TABS.map(function(t) {
          return (
            <PillTab
              key={t.id}
              icon={t.icon}
              active={tab === t.id}
              onClick={function() { handleTabClick(t.id) }}
            >
              {t.label}
            </PillTab>
          )
        })}
      </PillTabGroup>

      <AdBanner size="banner" className="w-full mb-6" />

      <TierDistributionCard players={players} />

      {tab === '' && <LeaderboardScreen embedded={true} />}

      {tab === 'hof' && <HofScreen embedded={true} />}

      {tab === 'roster' && (
        <div className="space-y-4">
          {/* Search + Sort controls */}
          <Panel padding="tight">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface/40" />
                <input
                  type="text"
                  placeholder="Search players..."
                  value={rosterSearch}
                  onChange={function(e) { setRosterSearch(e.target.value) }}
                  className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded pl-9 pr-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-label text-xs uppercase tracking-widest text-on-surface/40 whitespace-nowrap">Sort by</span>
                <select
                  value={rosterSort}
                  onChange={function(e) { setRosterSort(e.target.value) }}
                  className="bg-surface-container-lowest border border-outline-variant/20 rounded px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary/50 transition-colors cursor-pointer"
                >
                  {SORT_OPTIONS.map(function(opt) {
                    return <option key={opt.value} value={opt.value}>{opt.label}</option>
                  })}
                </select>
              </div>
            </div>
            <div className="mt-2 font-label text-xs text-on-surface/40 uppercase tracking-widest">
              {sortedPlayers.length} player{sortedPlayers.length !== 1 ? 's' : ''} found
            </div>
          </Panel>

          {/* Player table */}
          <Panel padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-outline-variant/10">
                    <th className="text-left px-6 py-3 font-label text-[10px] uppercase tracking-widest text-on-surface/40">#</th>
                    <th className="text-left px-4 py-3 font-label text-[10px] uppercase tracking-widest text-on-surface/40">Player</th>
                    <th className="text-left px-4 py-3 font-label text-[10px] uppercase tracking-widest text-on-surface/40">Rank</th>
                    <th className="text-right px-4 py-3 font-label text-[10px] uppercase tracking-widest text-on-surface/40">Pts</th>
                    <th className="text-right px-4 py-3 font-label text-[10px] uppercase tracking-widest text-on-surface/40">Wins</th>
                    <th className="text-right px-6 py-3 font-label text-[10px] uppercase tracking-widest text-on-surface/40">Region</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.length === 0 && isLoadingData && (
                    [1,2,3,4,5,6,7,8].map(function(k) {
                      return (
                        <tr key={'skel-' + k} className="border-b border-outline-variant/5">
                          <td className="px-6 py-3"><Skeleton className="h-4 w-8" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-10 ml-auto" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-8 ml-auto" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-6 ml-auto" /></td>
                          <td className="px-6 py-3"><Skeleton className="h-4 w-12 ml-auto" /></td>
                        </tr>
                      )
                    })
                  )}
                  {sortedPlayers.length === 0 && !isLoadingData && (
                    <tr>
                      <td colSpan={6} className="text-center py-14">
                        <Icon name="leaderboard" size={36} className="text-on-surface/20 mx-auto mb-3 block" />
                        <div className="text-sm text-on-surface/60 mb-1">No standings in this region yet</div>
                        <div className="text-[11px] text-on-surface/40">Once the first clash wraps, points land here.</div>
                      </td>
                    </tr>
                  )}
                  {sortedPlayers.map(function(p, idx) {
                    var rankColor = rc(p.rank)
                    var displayName = p.name || p.username || 'Unknown'
                    return (
                      <tr
                        key={p.id || p.name || p.username}
                        onClick={function() { navigate('/player/' + encodeURIComponent(displayName)) }}
                        className="border-b border-outline-variant/5 hover:bg-surface-container-low/60 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-3 font-mono text-xs text-on-surface/40">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded flex items-center justify-center text-xs font-black flex-shrink-0"
                              style={{ background: rankColor + '22', color: rankColor }}
                            >
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-body text-sm text-on-surface font-semibold">{displayName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="font-label text-xs font-bold uppercase tracking-wide"
                            style={{ color: rankColor }}
                          >
                            {p.rank || 'Unranked'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-on-surface font-bold">{p.pts || 0}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-on-surface/70">{p.wins || 0}</td>
                        <td className="px-6 py-3 text-right font-label text-xs uppercase tracking-widest text-on-surface/50">{p.region || 'EUW'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </PageLayout>
  )
}
