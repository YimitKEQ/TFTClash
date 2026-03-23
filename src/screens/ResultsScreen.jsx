import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import PageLayout from '../components/layout/PageLayout'
import Panel from '../components/ui/Panel'
import Btn from '../components/ui/Btn'
import Icon from '../components/ui/Icon'
import Tag from '../components/ui/Tag'
import { getStats } from '../lib/stats.js'
import { isHotStreak, isComebackEligible, computeClashAwards } from '../lib/stats.js'
import { HOMIES_IDS, PAST_CLASHES } from '../lib/constants.js'
import { avgCol, shareToTwitter, buildShareText } from '../lib/utils.js'
import ClashReportScreen from './ClashReportScreen'

var PODIUM_COLORS = ['#E8A838', '#C0C0C0', '#CD7F32']
var REWARDS = ['Clash Crown', 'Icon', 'Frame', 'Loot Orb', 'Loot Orb', '', '', '']

function PlacementColor(i) {
  if (i === 0) return '#E8A838'
  if (i === 1) return '#C0C0C0'
  if (i === 2) return '#CD7F32'
  return 'rgba(242,237,228,0.4)'
}

function AwardCard({ award, onClick }) {
  var _hover = useState(false)
  var hovered = _hover[0]
  var setHovered = _hover[1]

  return (
    <div
      onClick={onClick}
      onMouseEnter={function() { if (onClick) setHovered(true) }}
      onMouseLeave={function() { setHovered(false) }}
      className="rounded-xl p-4 cursor-pointer transition-all duration-200"
      style={{
        background: hovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        border: '1px solid ' + (hovered ? award.color + '66' : 'rgba(242,237,228,0.08)'),
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: award.color + '18',
            border: '1px solid ' + award.color + '44',
          }}
        >
          <Icon name={award.icon} size={20} style={{ color: award.color }} />
        </div>
        <div>
          <div className="font-bold text-sm text-on-surface">{award.title}</div>
          <div className="text-[11px] text-on-surface/40 mt-0.5">{award.desc}</div>
        </div>
      </div>

      {award.winner && (
        <div
          className="flex items-center gap-3 px-3 py-2 rounded-lg"
          style={{ background: '#0F1520', border: '1px solid rgba(242,237,228,0.06)' }}
        >
          <div className="flex-1 min-w-0">
            <div
              className="font-bold text-sm truncate"
              style={{ color: award.color }}
            >
              {award.winner.name}
            </div>
            <div className="text-[11px] text-on-surface/40">
              {award.winner.rank + ' - ' + award.winner.region}
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="font-mono text-sm font-bold" style={{ color: award.color }}>
              {award.stat}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ResultsScreen() {
  var ctx = useApp()
  var players = ctx.players || []
  var setProfilePlayer = ctx.setProfilePlayer
  var setScreen = ctx.setScreen
  var tournamentState = ctx.tournamentState
  var toast = ctx.toast || function() {}
  var navigate = useNavigate()

  var sorted = players.slice().sort(function(a, b) { return (b.pts || 0) - (a.pts || 0) })
  var champ = sorted[0]

  var _tab = useState('results')
  var tab = _tab[0]
  var setTab = _tab[1]

  if (!champ) {
    return (
      <PageLayout>
        <div className="text-center py-20 text-on-surface/40">
          Complete a clash first!
        </div>
      </PageLayout>
    )
  }

  var awards = computeClashAwards(players.length > 0 ? players : sorted)
  var clashName = (tournamentState && tournamentState.clashName) || 'Recent Clash'
  var clashDate = (tournamentState && tournamentState.clashDate) || ''

  // Podium: 2nd, 1st, 3rd display order
  var top3 = [sorted[1], sorted[0], sorted[2]].filter(Boolean)

  var clashIds = PAST_CLASHES.map(function(c) { return 'c' + c.id })

  function openProfile(p) {
    setProfilePlayer(p)
    setScreen('profile')
    navigate('/player/' + p.name)
  }

  function shareDiscord() {
    var lines = [
      '**TFT Clash S1 - ' + clashName + ' Results**',
      '```',
    ]
    sorted.slice(0, 8).forEach(function(p, i) {
      var st = getStats(p)
      lines.push('#' + (i + 1) + ' ' + p.name.padEnd(16) + ' ' + String(p.pts).padStart(4) + 'pts  avg ' + st.avgPlacement)
    })
    lines.push('```')
    lines.push('Champion: **' + champ.name + '**    ' + champ.pts + 'pts')
    navigator.clipboard && navigator.clipboard.writeText(lines.join('\n')).then(function() {
      toast('Copied for Discord', 'success')
    })
  }

  function copyResults() {
    var text = 'TFT Clash Results\n' + clashName + ' - ' + clashDate + '\n\n'
    sorted.slice(0, 8).forEach(function(p, i) {
      var st = getStats(p)
      text += (i + 1) + '. ' + p.name + ' - ' + p.pts + 'pts (avg: ' + st.avgPlacement + ')\n'
    })
    text += '\n#TFTClash tftclash.gg'
    navigator.clipboard.writeText(text).then(function() {
      toast('Results copied!', 'success')
    }).catch(function() {
      toast('Copy failed', 'error')
    })
  }

  function downloadCard() {
    var canvas = document.createElement('canvas')
    canvas.width = 900
    canvas.height = 520
    var ctx2 = canvas.getContext('2d')
    var bg = ctx2.createLinearGradient(0, 0, 900, 520)
    bg.addColorStop(0, '#0A0F1A')
    bg.addColorStop(1, '#08080F')
    ctx2.fillStyle = bg
    ctx2.fillRect(0, 0, 900, 520)
    var gold = ctx2.createLinearGradient(0, 0, 900, 0)
    gold.addColorStop(0, '#E8A838')
    gold.addColorStop(0.5, '#FFD700')
    gold.addColorStop(1, '#E8A838')
    ctx2.fillStyle = gold
    ctx2.fillRect(0, 0, 900, 3)
    ctx2.font = 'bold 13px monospace'
    ctx2.fillStyle = '#E8A838'
    ctx2.fillText('TFT CLASH S1 - FINAL RESULTS', 40, 44)
    ctx2.font = '11px monospace'
    ctx2.fillStyle = '#BECBD9'
    ctx2.fillText(clashDate + '  -  ' + sorted.length + ' players', 40, 64)
    ctx2.fillStyle = 'rgba(232,168,56,0.1)'
    ctx2.beginPath()
    ctx2.roundRect(40, 85, 820, 100, 8)
    ctx2.fill()
    ctx2.strokeStyle = 'rgba(232,168,56,0.4)'
    ctx2.lineWidth = 1
    ctx2.stroke()
    ctx2.font = 'bold 40px serif'
    ctx2.fillStyle = '#E8A838'
    ctx2.fillText('W', 55, 152)
    ctx2.font = 'bold 28px serif'
    ctx2.fillStyle = '#F2EDE4'
    ctx2.fillText(champ.name, 110, 150)
    ctx2.font = 'bold 22px monospace'
    ctx2.fillStyle = '#E8A838'
    ctx2.fillText(champ.pts + ' pts', 110, 174)
    ctx2.font = '11px monospace'
    ctx2.fillStyle = '#BECBD9'
    ctx2.fillText('Champion - AVP: ' + getStats(champ).avgPlacement, 110, 194)
    sorted.slice(0, 8).forEach(function(p, i) {
      var x = 40 + (i > 3 ? 440 : 0)
      var iy = i > 3 ? i - 4 : i
      var c2 = i === 0 ? '#E8A838' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#BECBD9'
      ctx2.font = 'bold 14px monospace'
      ctx2.fillStyle = c2
      ctx2.fillText('#' + (i + 1), x, 210 + iy * 36)
      ctx2.font = '14px sans-serif'
      ctx2.fillStyle = i < 3 ? '#F2EDE4' : '#C8D4E0'
      ctx2.fillText(p.name, x + 36, 210 + iy * 36)
      ctx2.font = 'bold 14px monospace'
      ctx2.fillStyle = '#E8A838'
      ctx2.fillText(p.pts + 'pts', x + 200, 210 + iy * 36)
      var av = getStats(p).avgPlacement
      ctx2.font = '12px monospace'
      ctx2.fillStyle = parseFloat(av) < 3 ? '#4ade80' : parseFloat(av) < 5 ? '#facc15' : '#f87171'
      ctx2.fillText('avg:' + av, x + 280, 210 + iy * 36)
    })
    ctx2.fillStyle = 'rgba(232,168,56,0.15)'
    ctx2.fillRect(0, 488, 900, 32)
    ctx2.font = 'bold 11px monospace'
    ctx2.fillStyle = '#E8A838'
    ctx2.fillText('TFT CLASH  -  tftclash.gg', 40, 508)
    ctx2.font = '11px monospace'
    ctx2.fillStyle = '#BECBD9'
    ctx2.fillText('#TFTClash  #TFT', 700, 508)
    var a = document.createElement('a')
    a.download = 'TFTClash-Results.png'
    a.href = canvas.toDataURL('image/png')
    a.click()
    toast('Results card downloaded', 'success')
  }

  var champStats = getStats(champ)

  return (
    <PageLayout>
      <div className="space-y-6 pb-8">

        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={function() { setScreen('home'); navigate('/') }}
            className="flex items-center gap-1.5 text-sm text-on-surface/50 hover:text-on-surface transition-colors"
          >
            <Icon name="arrow_back" size={16} />
            Back
          </button>

          <div className="flex-1 min-w-0">
            <div className="font-sans text-[11px] font-bold text-secondary uppercase tracking-widest mb-1">
              Season 1
            </div>
            <h1 className="font-serif text-3xl md:text-4xl font-black text-on-surface leading-none">
              {clashName + ' - Final Results'}
            </h1>
            <div className="text-xs text-on-surface/40 mt-1">
              {clashDate + (clashDate ? ' - ' : '') + sorted.length + ' players - ' + Math.ceil(sorted.length / 8) + ' lobbies'}
            </div>
          </div>

          <div className="flex gap-2 flex-shrink-0 flex-wrap">
            <Btn variant="secondary" size="sm" onClick={shareDiscord}>
              Discord
            </Btn>
            <Btn variant="secondary" size="sm" onClick={function() {
              shareToTwitter(buildShareText('recap', { winner: champ.name, clashName: clashName }))
            }}>
              <Icon name="share" size={12} className="mr-1" />
              Share
            </Btn>
            <Btn variant="ghost" size="sm" onClick={downloadCard}>
              <Icon name="download" size={12} className="mr-1" />
              PNG
            </Btn>
            <Btn variant="secondary" size="sm" onClick={copyResults}>
              <Icon name="content_copy" size={12} className="mr-1" />
              Copy
            </Btn>
          </div>
        </div>

        {/* Champion banner */}
        <div
          className="relative overflow-hidden rounded-2xl p-6 md:p-8 flex items-center gap-6 flex-wrap"
          style={{
            background: 'linear-gradient(135deg,rgba(232,168,56,.22),rgba(155,114,207,.08),rgba(8,8,15,1))',
            border: '1px solid rgba(232,168,56,.55)',
            boxShadow: '0 0 60px rgba(232,168,56,.18)',
          }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />

          <div
            className="w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg,rgba(232,168,56,.25),rgba(232,168,56,.06))',
              border: '2px solid rgba(232,168,56,.7)',
              boxShadow: '0 0 24px rgba(232,168,56,.35)',
            }}
          >
            <Icon name="trophy" fill size={40} className="text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-sans text-[11px] font-bold text-primary uppercase tracking-widest mb-1">
              Clash Champion
            </div>
            <div className="font-serif text-4xl md:text-5xl font-black text-on-surface leading-none mb-3">
              {champ.name}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Tag color="#E8A838">{champ.rank}</Tag>
              <Tag color="#4ECDC4">{champ.region}</Tag>
              {isHotStreak(champ) && (
                <Tag color="#F97316">
                  <Icon name="local_fire_department" size={11} className="text-orange-400 mr-0.5" />
                  {(champ.currentStreak || '') + '-streak'}
                </Tag>
              )}
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            {[
              ['Season Pts', champ.pts, '#E8A838'],
              ['Wins', champ.wins, '#6EE7B7'],
              ['Avg', champStats.avgPlacement, avgCol(champStats.avgPlacement)],
              ['Top4%', champStats.top4Rate + '%', '#C4B5FD'],
            ].map(function(item) {
              return (
                <div
                  key={item[0]}
                  className="text-center px-4 py-2.5 rounded-xl min-w-[64px]"
                  style={{ background: 'rgba(0,0,0,.3)' }}
                >
                  <div className="font-mono text-xl font-bold leading-none" style={{ color: item[2] }}>
                    {item[1]}
                  </div>
                  <div className="font-sans text-[10px] text-on-surface/40 uppercase tracking-wider mt-1">
                    {item[0]}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Podium - top 3 */}
        {sorted.length >= 3 && (
          <div className="grid grid-cols-3 gap-2.5 items-end">
            {top3.map(function(p, idx) {
              var actualRank = idx === 0 ? 1 : idx === 1 ? 0 : 2
              var col = PODIUM_COLORS[actualRank]
              var isGold = actualRank === 0
              var pStats = getStats(p)

              return (
                <div
                  key={p.id || p.name}
                  onClick={function() { openProfile(p) }}
                  className="rounded-2xl p-4 text-center cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                  style={{
                    background: isGold ? 'rgba(232,168,56,.08)' : 'rgba(255,255,255,.02)',
                    border: '1px solid ' + (isGold ? 'rgba(232,168,56,.3)' : 'rgba(255,255,255,.07)'),
                    borderTop: '3px solid ' + col,
                    paddingTop: isGold ? 28 : 20,
                  }}
                >
                  <div className="text-3xl mb-2" style={{ color: col }}>
                    <Icon name="emoji_events" fill size={28} style={{ color: col }} />
                  </div>
                  <div
                    className="font-serif font-bold truncate mb-1"
                    style={{ fontSize: isGold ? 17 : 14, color: '#F2EDE4' }}
                  >
                    {p.name}
                  </div>
                  <div className="text-[11px] text-on-surface/40 mb-2.5">
                    {p.rank + ' - ' + p.region}
                  </div>
                  <div
                    className="font-mono font-extrabold leading-none"
                    style={{ fontSize: isGold ? 28 : 20, color: col }}
                  >
                    {p.pts}
                  </div>
                  <div className="font-sans text-[10px] text-on-surface/30 uppercase tracking-widest mt-1">
                    Season Pts
                  </div>
                  <div className="flex justify-center gap-4 mt-3">
                    {[
                      ['W', pStats.wins, '#6EE7B7'],
                      ['Avg', pStats.avgPlacement, avgCol(pStats.avgPlacement)],
                    ].map(function(item) {
                      return (
                        <div key={item[0]} className="text-center">
                          <div className="font-mono text-sm font-bold" style={{ color: item[2] }}>{item[1]}</div>
                          <div className="font-sans text-[10px] text-on-surface/30 uppercase">{item[0]}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Tab nav */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {[
            ['results', 'Full Standings'],
            ['awards', 'Awards'],
            ['report', 'Clash Report'],
          ].map(function(item) {
            return (
              <Btn
                key={item[0]}
                variant={tab === item[0] ? 'primary' : 'secondary'}
                size="sm"
                onClick={function() { setTab(item[0]) }}
                className="flex-shrink-0"
              >
                {item[1]}
              </Btn>
            )
          })}
        </div>

        {/* Full Standings */}
        {tab === 'results' && (
          <Panel className="overflow-hidden p-0">
            {/* Header row */}
            <div
              className="grid px-4 py-2.5 border-b border-outline-variant/10 bg-surface-container-highest/20"
              style={{ gridTemplateColumns: '36px 1fr 80px 80px 70px 80px 110px' }}
            >
              {['#', 'Player', 'Pts', 'Avg', 'Wins', 'T4%', 'Reward'].map(function(h) {
                return (
                  <span key={h} className="font-sans text-[10px] font-bold uppercase tracking-widest text-on-surface/40">
                    {h}
                  </span>
                )
              })}
            </div>

            <div className="divide-y divide-outline-variant/10">
              {sorted.map(function(p, i) {
                var st = getStats(p)
                var isTop3 = i < 3
                var col = PlacementColor(i)
                var isComeback = isComebackEligible(p, clashIds)
                var attStreak = p.attendanceStreak || 0
                var isHomie = HOMIES_IDS.includes(p.id)

                return (
                  <div
                    key={p.id || p.name}
                    onClick={function() { openProfile(p) }}
                    className="grid px-4 py-3 items-center cursor-pointer transition-colors hover:bg-white/[0.03]"
                    style={{
                      gridTemplateColumns: '36px 1fr 80px 80px 70px 80px 110px',
                      background: i === 0
                        ? 'rgba(232,168,56,0.05)'
                        : i < 3
                          ? 'rgba(255,255,255,0.015)'
                          : 'transparent',
                    }}
                  >
                    <div className="font-mono text-sm font-extrabold" style={{ color: col }}>
                      {i + 1}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="text-sm truncate"
                          style={{ fontWeight: isTop3 ? 700 : 600, color: isTop3 ? '#F2EDE4' : '#C8BFB0' }}
                        >
                          {p.name}
                        </span>
                        {isHomie && (
                          <Icon name="favorite" fill size={10} className="text-secondary flex-shrink-0" />
                        )}
                        {isHotStreak(p) && (
                          <Icon name="local_fire_department" size={10} className="text-orange-400 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="text-[11px] text-on-surface/40">
                          {p.rank + ' - ' + p.region}
                        </span>
                        {attStreak >= 3 && <Tag color="#E8A838">{attStreak + '-streak'}</Tag>}
                        {isComeback && <Tag color="#4ECDC4">Comeback</Tag>}
                      </div>
                    </div>

                    <div
                      className="font-mono text-base font-bold"
                      style={{ color: isTop3 ? col : '#C8BFB0' }}
                    >
                      {p.pts}
                    </div>

                    <div
                      className="font-mono text-sm"
                      style={{ color: avgCol(st.avgPlacement) }}
                    >
                      {st.avgPlacement}
                    </div>

                    <div className="font-mono text-sm text-emerald-400">{st.wins}</div>

                    <div className="font-mono text-sm text-teal-400">{st.top4Rate + '%'}</div>

                    <div className="text-xs">
                      {REWARDS[i]
                        ? <Tag color={col}>{REWARDS[i]}</Tag>
                        : <span className="text-on-surface/25">-</span>
                      }
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>
        )}

        {/* Awards */}
        {tab === 'awards' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {awards.filter(function(a) { return a.winner }).map(function(a) {
                return (
                  <AwardCard
                    key={a.id}
                    award={a}
                    onClick={function() {
                      if (setProfilePlayer && a.winner) {
                        setProfilePlayer(a.winner)
                        setScreen('profile')
                        navigate('/player/' + a.winner.name)
                      }
                    }}
                  />
                )
              })}
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl flex-wrap" style={{ background: 'rgba(155,114,207,.06)', border: '1px solid rgba(155,114,207,.2)' }}>
              <Icon name="redeem" size={24} className="text-secondary flex-shrink-0" />
              <div className="flex-1">
                <div className="font-bold text-sm text-secondary mb-0.5">Milestone Rewards Unlocked</div>
                <div className="text-sm text-on-surface/60">Some players earned new milestones this clash.</div>
              </div>
              <Btn variant="secondary" size="sm" onClick={function() { setScreen('milestones'); navigate('/milestones') }}>
                View
              </Btn>
            </div>
          </div>
        )}

        {/* Clash Report */}
        {tab === 'report' && (
          <Panel>
            <h3 className="font-serif text-lg font-bold text-on-surface mb-1">
              {clashName + ' - Round by Round'}
            </h3>
            <p className="text-sm text-on-surface/50 mb-5">
              {clashDate + (clashDate ? ' - ' : '') + sorted.length + ' players'}
            </p>
            <ClashReportScreen
              clashData={{
                id: 'latest',
                name: clashName,
                date: clashDate,
                season: 'S1',
                champion: champ.name,
                top3: sorted.slice(0, 3).map(function(p) { return p.name }),
                players: sorted.length,
                lobbies: Math.ceil(sorted.length / 8),
                report: {
                  mostImproved: sorted[3] ? sorted[3].name : null,
                  biggestUpset: (sorted[4] ? sorted[4].name : '') + ' beat ' + (sorted[0] ? sorted[0].name : ''),
                },
              }}
              players={players}
            />
          </Panel>
        )}

      </div>
    </PageLayout>
  )
}
