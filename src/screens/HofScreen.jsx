import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getStats } from '../lib/stats.js'
import PageHeader from '../components/shared/PageHeader'
import RankBadge from '../components/shared/RankBadge'
import { Panel, Icon } from '../components/ui'

var MEDAL_COLORS = ['#E8A838', '#C0C0C0', '#CD7F32']
var MEDAL_LABELS = ['2nd', '3rd']

function avgPlacementColor(avg) {
  if (!avg || avg === '-') return '#9AAABF'
  var n = parseFloat(avg)
  if (n <= 2.5) return '#6EE7B7'
  if (n <= 4.0) return '#9B72CF'
  if (n <= 5.5) return '#EAB308'
  return '#F87171'
}

function SectionHeader({ label, color }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-6 h-0.5 rounded flex-shrink-0" style={{ background: color || '#E8A838' }} />
      <h2 className="font-sans text-xs font-bold uppercase tracking-widest text-on-surface whitespace-nowrap">
        {label}
      </h2>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg,rgba(232,168,56,.3),transparent)' }} />
    </div>
  )
}

function MiniBar({ val, max, color }) {
  var pct = max > 0 ? Math.min(100, (val / max) * 100) : 0
  return (
    <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: pct + '%', background: color || '#4ECDC4' }} />
    </div>
  )
}

export default function HofScreen() {
  var ctx = useApp()
  var players = ctx.players || []
  var pastClashes = ctx.pastClashes || []
  var setProfilePlayer = ctx.setProfilePlayer
  var setScreen = ctx.setScreen
  var navigate = useNavigate()

  var _expandRecord = useState(null)
  var expandRecord = _expandRecord[0]
  var setExpandRecord = _expandRecord[1]

  var sorted = players.slice().sort(function(a, b) { return (b.pts || 0) - (a.pts || 0) })
  var king = sorted[0] || null
  var kingStats = king ? getStats(king) : null
  var challengers = sorted.slice(1, 4)
  var kingGap = challengers[0] ? (king.pts || 0) - (challengers[0].pts || 0) : 0

  function openProfile(name) {
    var p = players.find(function(pl) { return pl.name === name })
    if (p) {
      setProfilePlayer(p)
      setScreen('profile')
      navigate('/player/' + p.name)
    }
  }

  var pastChamps = pastClashes.map(function(c) {
    return {
      season: c.season || ('S' + (c.id || '?')),
      champion: c.champion || 'Unknown',
      pts: c.pts || 0,
      rank: c.rank || '',
      wins: c.wins || 0,
      status: 'past',
    }
  })

  var SEASON_CHAMPS = king
    ? pastChamps.concat([{ season: 'S1', champion: king.name, pts: king.pts, rank: king.rank, wins: king.wins, status: 'active' }])
    : pastChamps

  var wp = players.filter(function(p) { return (p.games || 0) > 0 })

  var hofRecs = []

  if (wp.length > 0) {
    var byPts = wp.slice().sort(function(a, b) { return (b.pts || 0) - (a.pts || 0) })
    var byWins = wp.slice().sort(function(a, b) { return (b.wins || 0) - (a.wins || 0) })
    var byAvg = wp.slice().filter(function(p) { return p.avg }).sort(function(a, b) { return parseFloat(a.avg) - parseFloat(b.avg) })
    var byStreak = wp.slice().sort(function(a, b) { return (b.bestStreak || 0) - (a.bestStreak || 0) })
    var byGames = wp.slice().sort(function(a, b) { return (b.games || 0) - (a.games || 0) })
    var byTop4 = wp.slice().sort(function(a, b) {
      var aRate = b.games > 0 ? (b.top4 || 0) / b.games : 0
      var bRate = a.games > 0 ? (a.top4 || 0) / a.games : 0
      return aRate - bRate
    })

    hofRecs = [
      byPts[0] ? {
        id: 'pts', icon: 'trophy', title: 'Season Points Leader',
        value: byPts[0].pts + ' pts', holder: byPts[0].name, rank: byPts[0].rank,
        runner: [byPts[1] && byPts[1].name, byPts[2] && byPts[2].name].filter(Boolean),
        history: [],
      } : null,
      byWins[0] && (byWins[0].wins || 0) > 0 ? {
        id: 'wins', icon: 'bolt', title: 'Win Machine',
        value: (byWins[0].wins || 0) + ' wins', holder: byWins[0].name, rank: byWins[0].rank,
        runner: [byWins[1] && byWins[1].name, byWins[2] && byWins[2].name].filter(Boolean),
        history: [],
      } : null,
      byAvg[0] ? {
        id: 'avg', icon: 'target', title: 'Consistency King',
        value: 'AVP ' + byAvg[0].avg, holder: byAvg[0].name, rank: byAvg[0].rank,
        runner: [byAvg[1] && byAvg[1].name, byAvg[2] && byAvg[2].name].filter(Boolean),
        history: [],
      } : null,
      byStreak[0] && (byStreak[0].bestStreak || 0) > 1 ? {
        id: 'streak', icon: 'local_fire_department', title: 'Hot Streak',
        value: (byStreak[0].bestStreak || 0) + ' consecutive top 4s', holder: byStreak[0].name, rank: byStreak[0].rank,
        runner: [byStreak[1] && byStreak[1].name, byStreak[2] && byStreak[2].name].filter(Boolean),
        history: [],
      } : null,
      byGames[0] ? {
        id: 'games', icon: 'sports_esports', title: 'Iron Presence',
        value: (byGames[0].games || 0) + ' games', holder: byGames[0].name, rank: byGames[0].rank,
        runner: [byGames[1] && byGames[1].name, byGames[2] && byGames[2].name].filter(Boolean),
        history: [],
      } : null,
      byTop4[0] && (byTop4[0].games || 0) > 0 ? {
        id: 'top4r', icon: 'star', title: 'Top 4 Machine',
        value: Math.round(((byTop4[0].top4 || 0) / byTop4[0].games) * 100) + '%',
        holder: byTop4[0].name, rank: byTop4[0].rank,
        runner: [byTop4[1] && byTop4[1].name, byTop4[2] && byTop4[2].name].filter(Boolean),
        history: [],
      } : null,
    ].filter(Boolean)
  }

  return (
    <div className="space-y-8 pb-8">
      <PageHeader
        title="Hall of"
        goldWord="Fame"
        subtitle="TFT Clash - Season 1"
        description="These records are permanent. Every name here earned their place."
      />

      {/* Reigning champion hero */}
      {king && kingStats && (
        <Panel accent="gold" className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,#E8A838,#FFD700,#E8A838,transparent)' }} />
          <div className="flex flex-wrap items-start gap-8">

            {/* Identity */}
            <div className="text-center flex-shrink-0 min-w-[120px]">
              <div className="text-4xl mb-2">
                <Icon name="trophy" fill size={44} className="text-primary" />
              </div>
              <div className="w-20 h-20 rounded-full border-2 border-primary flex items-center justify-center font-serif font-black text-3xl text-primary mx-auto mb-3" style={{ background: 'rgba(232,168,56,0.12)' }}>
                {king.name.charAt(0)}
              </div>
              <div className="font-sans text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Season 1 Leader</div>
              <div className="font-serif text-xl font-black text-on-surface mb-2">{king.name}</div>
              <div className="flex flex-wrap gap-1 justify-center mb-3">
                <RankBadge rank={king.rank} />
                {king.region && (
                  <span className="font-sans text-[10px] uppercase tracking-widest px-2 py-1 rounded-sm border text-tertiary" style={{ borderColor: 'rgba(78,205,196,0.3)', background: 'rgba(78,205,196,0.08)' }}>
                    {king.region}
                  </span>
                )}
              </div>
              <button
                onClick={function() { openProfile(king.name) }}
                className="font-sans text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-sm border border-outline-variant/20 text-on-surface/60 hover:text-on-surface hover:border-primary/30 transition-colors"
              >
                Profile
              </button>
            </div>

            {/* Stats grid */}
            <div className="flex-1 min-w-[200px]">
              <div className="mb-4">
                <div className="font-mono text-5xl font-bold text-primary leading-none">{king.pts}</div>
                <div className="font-sans text-[10px] font-bold uppercase tracking-widest text-on-surface/50 mt-1">Season Points</div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  ['Avg', kingStats.avgPlacement, avgPlacementColor(kingStats.avgPlacement)],
                  ['Win Rate', kingStats.top1Rate + '%', '#6EE7B7'],
                  ['Top 4', kingStats.top4Rate + '%', '#C4B5FD'],
                  ['PPG', kingStats.ppg, '#EAB308'],
                  ['Streak', (king.bestStreak || 0) + ' W', '#F97316'],
                  ['Clutch', kingStats.clutchRate + '%', '#9B72CF'],
                ].map(function(item) {
                  var l = item[0]; var v = item[1]; var c = item[2]
                  return (
                    <div key={l} className="rounded-sm border border-white/5 bg-black/20 px-2 py-2 text-center">
                      <div className="font-mono text-sm font-bold leading-none" style={{ color: c }}>{v}</div>
                      <div className="font-sans text-[9px] uppercase tracking-widest text-on-surface/40 mt-1">{l}</div>
                    </div>
                  )
                })}
              </div>

              <div className="rounded-sm border border-white/5 bg-black/20 px-3 py-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-sans text-xs text-on-surface/60">Lead over {challengers[0] ? challengers[0].name : '2nd place'}</span>
                  <span className="font-mono text-sm font-bold" style={{ color: kingGap > 50 ? '#6EE7B7' : kingGap > 20 ? '#EAB308' : '#F87171' }}>
                    +{kingGap} pts
                  </span>
                </div>
                <MiniBar val={king.pts} max={king.pts + Math.max(kingGap, 1)} color={kingGap > 50 ? '#6EE7B7' : kingGap > 20 ? '#EAB308' : '#F87171'} />
              </div>
            </div>

            {/* Challengers */}
            {challengers.length > 0 && (
              <div className="flex-shrink-0 min-w-[150px]">
                <div className="font-sans text-[10px] font-bold uppercase tracking-widest text-on-surface/50 mb-3 text-center">Challengers</div>
                {challengers.map(function(p, i) {
                  var diff = (king.pts || 0) - (p.pts || 0)
                  var medalCol = MEDAL_COLORS[i + 1]
                  return (
                    <div
                      key={p.id || p.name}
                      onClick={function() { openProfile(p.name) }}
                      className="px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-sm mb-2 cursor-pointer transition-colors hover:border-primary/20"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-mono text-xs font-bold flex-shrink-0" style={{ color: medalCol }}>
                          {i + 2}
                        </span>
                        <span className="font-semibold text-sm text-on-surface flex-1 truncate">{p.name}</span>
                        <span className="font-mono text-xs font-bold text-primary flex-shrink-0">{p.pts}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-rose-400 flex-shrink-0 min-w-[28px]">-{diff}</span>
                        <MiniBar val={p.pts || 0} max={king.pts || 1} color="#4ECDC4" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Season Champions Wall */}
      <div>
        <SectionHeader label="Season Champions" />

        {SEASON_CHAMPS.length === 0 && (
          <Panel className="text-center py-12">
            <Icon name="trophy" size={40} className="text-primary/30 mx-auto mb-3" />
            <div className="font-serif text-lg font-bold text-primary mb-2">A champion yet to be crowned</div>
            <p className="text-sm text-on-surface/50 max-w-sm mx-auto leading-relaxed">
              The throne is empty. Compete in the first clash and write your name into history.
            </p>
          </Panel>
        )}

        {SEASON_CHAMPS.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {SEASON_CHAMPS.map(function(s) {
              var isActive = s.status === 'active'
              return (
                <div
                  key={s.season}
                  onClick={function() { if (!isActive) openProfile(s.champion) }}
                  className={'relative overflow-hidden rounded-sm border p-4 transition-all duration-200' + (isActive ? ' cursor-default' : ' cursor-pointer hover:-translate-y-1')}
                  style={{
                    background: isActive ? 'linear-gradient(135deg,#16100A,#0E0C06)' : 'linear-gradient(135deg,#0D1019,#080B12)',
                    borderColor: isActive ? 'rgba(232,168,56,0.5)' : 'rgba(242,237,228,0.09)',
                    boxShadow: isActive ? '0 0 40px rgba(232,168,56,0.09)' : 'none',
                  }}
                >
                  {isActive && (
                    <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,#E8A838,transparent)' }} />
                  )}
                  {!isActive && (
                    <div className="absolute top-2 right-2 font-sans text-[9px] font-bold uppercase tracking-widest text-on-surface/30 bg-white/5 rounded-sm px-1.5 py-0.5">
                      Retired
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 mb-3">
                    <div
                      className="font-mono text-[10px] font-bold rounded-sm px-2 py-0.5 border"
                      style={{
                        color: isActive ? '#E8A838' : '#BECBD9',
                        borderColor: isActive ? 'rgba(232,168,56,0.35)' : 'rgba(242,237,228,0.1)',
                        background: isActive ? 'rgba(232,168,56,0.15)' : 'rgba(255,255,255,0.05)',
                      }}
                    >
                      {s.season}
                    </div>
                    {isActive && (
                      <div className="font-sans text-[9px] font-bold uppercase tracking-widest rounded-full px-1.5 py-0.5" style={{ background: 'rgba(82,196,124,0.1)', border: '1px solid rgba(82,196,124,0.25)', color: '#6EE7B7' }}>
                        Live
                      </div>
                    )}
                  </div>
                  <Icon name="trophy" fill={isActive} size={28} className="mb-2" style={{ color: isActive ? '#E8A838' : 'rgba(242,237,228,0.5)' }} />
                  <div className="font-serif text-sm font-bold leading-tight mb-1" style={{ color: isActive ? '#E8A838' : '#F2EDE4' }}>
                    {s.champion}
                  </div>
                  <div className="font-mono text-lg font-bold" style={{ color: isActive ? '#E8A838' : '#C8BFB0' }}>
                    {s.pts}
                    <span className="font-sans text-[10px] text-on-surface/40 font-normal ml-1">pts</span>
                  </div>
                  <div className="font-sans text-[11px] text-on-surface/40 mt-0.5">{s.wins} wins</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Trophy Cabinet */}
      <div>
        <SectionHeader label="Trophy Cabinet" />

        {hofRecs.length === 0 && (
          <Panel className="text-center py-16">
            <Icon name="workspace_premium" size={48} className="text-on-surface/20 mx-auto mb-4" />
            <div className="font-serif text-xl font-bold text-on-surface/50 mb-2">Hall of Fame loading...</div>
            <p className="text-sm text-on-surface/40">Season champions will be enshrined here.</p>
          </Panel>
        )}

        {hofRecs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {hofRecs.map(function(r) {
              var isOpen = expandRecord === r.id
              return (
                <div
                  key={r.id}
                  onClick={function() { setExpandRecord(isOpen ? null : r.id) }}
                  className="rounded-sm border overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(135deg,#0D1321,#080B14)',
                    borderColor: isOpen ? 'rgba(232,168,56,0.4)' : 'rgba(242,237,228,0.08)',
                    boxShadow: isOpen ? '0 0 40px rgba(232,168,56,0.12)' : 'none',
                  }}
                >
                  {/* Header row */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ background: 'linear-gradient(90deg,rgba(232,168,56,0.08),rgba(232,168,56,0.02))', borderColor: 'rgba(232,168,56,0.1)' }}>
                    <div className="w-10 h-10 rounded-sm flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(232,168,56,0.1)', border: '1px solid rgba(232,168,56,0.22)' }}>
                      <Icon name={r.icon} fill size={20} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-sans text-[10px] font-bold uppercase tracking-widest text-on-surface/50 mb-0.5">{r.title}</div>
                      <div className="font-mono text-xl font-bold text-primary leading-none">{r.value}</div>
                    </div>
                    <span className="font-sans text-[10px] text-on-surface/40 flex-shrink-0 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      &#9660;
                    </span>
                  </div>

                  {/* Holder row */}
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center font-serif text-xs font-black text-primary flex-shrink-0"
                          style={{ background: 'rgba(232,168,56,0.1)', border: '1px solid rgba(232,168,56,0.22)' }}
                        >
                          {r.holder.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-on-surface">{r.holder}</div>
                          {r.rank && <RankBadge rank={r.rank} />}
                        </div>
                      </div>
                      <button
                        onClick={function(e) { e.stopPropagation(); openProfile(r.holder) }}
                        className="font-sans text-[11px] font-semibold px-2.5 py-1 rounded-sm border border-outline-variant/10 text-on-surface/50 hover:text-on-surface hover:border-primary/30 transition-colors flex-shrink-0"
                      >
                        Profile
                      </button>
                    </div>

                    {r.runner.map(function(ru, i) {
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs text-on-surface/60 mt-1">
                          <span className="font-bold min-w-[28px]" style={{ color: i === 0 ? '#C0C0C0' : '#CD7F32' }}>
                            {MEDAL_LABELS[i]}
                          </span>
                          <span>{ru}</span>
                        </div>
                      )
                    })}
                  </div>

                  {/* History (expanded) */}
                  {isOpen && r.history.length > 0 && (
                    <div className="px-4 pb-3 border-t" style={{ borderColor: 'rgba(232,168,56,0.12)' }}>
                      <div className="font-sans text-[10px] font-bold uppercase tracking-widest text-on-surface/40 mt-3 mb-2">Previous Holders</div>
                      {r.history.map(function(h, i) {
                        return (
                          <div key={i} className="flex items-center gap-2.5 px-2.5 py-2 bg-black/30 rounded-sm mb-1">
                            <span className="font-mono text-[10px] text-secondary min-w-[28px]">{h.season}</span>
                            <span className="font-semibold text-sm text-on-surface/70 flex-1">{h.holder}</span>
                            <span className="font-mono text-xs text-primary">{h.value}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Rivalries placeholder */}
      {players.length >= 4 && (
        <div>
          <SectionHeader label="Top Rivalries" color="#9B72CF" />
          <Panel className="text-center py-8">
            <Icon name="swords" size={32} className="text-secondary/30 mx-auto mb-3" />
            <p className="text-sm text-on-surface/50 max-w-sm mx-auto leading-relaxed">
              Rivalries will emerge once players have competed in multiple clashes together. Check back after a few events.
            </p>
          </Panel>
        </div>
      )}
    </div>
  )
}
