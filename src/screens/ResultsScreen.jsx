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
      className="flex items-start gap-4 p-4 rounded-[20px] cursor-pointer transition-all duration-200"
      style={{
        background: hovered ? 'rgba(255,255,255,0.04)' : 'rgba(52,52,60,0.3)',
        border: '1px solid ' + (hovered ? award.color + '66' : 'rgba(80,67,53,0.3)'),
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: award.color + '18',
          border: '1px solid ' + award.color + '44',
        }}
      >
        <Icon name={award.icon} size={20} style={{ color: award.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="font-technical text-xs uppercase tracking-wider mb-0.5"
          style={{ color: award.color }}
        >
          {award.title}
        </div>
        {award.winner && (
          <div className="font-bold text-sm text-on-surface truncate">{award.winner.name}</div>
        )}
        <div className="text-[10px] text-on-surface/50 mt-0.5">{award.desc}</div>
        {award.winner && award.stat && (
          <div className="font-mono text-xs mt-1" style={{ color: award.color }}>{award.stat}</div>
        )}
      </div>
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
        <div className="flex flex-col items-center justify-center py-24 text-center px-6">
          <Icon name="emoji_events" size={64} className="text-primary/20 mb-6" />
          <h2 className="font-serif text-2xl text-on-surface mb-3">No clash results yet</h2>
          <p className="text-on-surface/40 text-sm max-w-xs">
            The first clash is coming soon! Results will appear here after the opening tournament.
          </p>
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
            <div className="font-technical text-[11px] font-bold text-secondary uppercase tracking-widest mb-1">
              Season 1
            </div>
            <h1 className="font-editorial italic text-3xl md:text-4xl font-black text-on-surface leading-none">
              {clashName + ' - Final Results'}
            </h1>
            <div className="text-xs text-on-surface/40 mt-1 font-mono">
              {clashDate + (clashDate ? ' - ' : '') + sorted.length + ' players - ' + Math.ceil(sorted.length / 8) + ' lobbies'}
            </div>
          </div>
        </div>

        {/* Hero Champion Banner */}
        <section
          className="relative overflow-hidden rounded-[20px] bg-surface-container-low min-h-[280px] flex items-center justify-center border border-outline-variant/10"
          style={{ boxShadow: '0 0 60px rgba(232,168,56,.12)' }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, #E8A838, transparent)' }}
          />

          <div className="relative z-10 text-center px-6 py-10">
            <div className="flex justify-center mb-4">
              <Icon name="emoji_events" fill size={72} className="text-primary" />
            </div>
            <div className="font-technical text-primary text-lg tracking-[0.25em] uppercase mb-2">
              Tournament Champion
            </div>
            <div
              className="font-display text-primary uppercase leading-none mb-4"
              style={{
                fontSize: 'clamp(2.5rem, 8vw, 5rem)',
                textShadow: '0 0 40px rgba(255,198,107,0.35)',
                letterSpacing: '-0.02em',
              }}
            >
              {champ.name}
            </div>

            <div className="flex justify-center flex-wrap gap-2 mb-6">
              <Tag color="#E8A838">{champ.rank}</Tag>
              <Tag color="#4ECDC4">{champ.region}</Tag>
              {isHotStreak(champ) && (
                <Tag color="#F97316">
                  <Icon name="local_fire_department" size={11} className="text-orange-400 mr-0.5" />
                  {(champ.currentStreak || '') + '-streak'}
                </Tag>
              )}
            </div>

            <div className="flex justify-center gap-3 flex-wrap">
              {[
                ['Season Pts', champ.pts, '#E8A838'],
                ['Wins', champStats.wins, '#6EE7B7'],
                ['Avg Place', champStats.avgPlacement, avgCol(champStats.avgPlacement)],
                ['Top4%', champStats.top4Rate + '%', '#C4B5FD'],
              ].map(function(item) {
                return (
                  <div
                    key={item[0]}
                    className="bg-surface-container-high px-5 py-2 rounded-full border border-outline-variant/20 flex items-center gap-2"
                  >
                    <span className="font-mono font-bold text-sm" style={{ color: item[2] }}>{item[1]}</span>
                    <span className="font-technical text-[10px] uppercase tracking-wider text-on-surface/50">{item[0]}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* 12-col grid: left 8 cols = podium + standings, right 4 cols = awards + share */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left column: Podium + Tab content */}
          <div className="lg:col-span-8 space-y-6">

            {/* Podium Section */}
            {sorted.length >= 3 && (
              <div
                className="relative overflow-hidden rounded-[20px] p-6 md:p-8 border border-outline-variant/10 bg-surface-container-low"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

                <div className="grid grid-cols-3 items-end gap-3 md:gap-5">
                  {top3.map(function(p, idx) {
                    var actualRank = idx === 0 ? 1 : idx === 1 ? 0 : 2
                    var isGold = actualRank === 0
                    var isSilver = actualRank === 1
                    var pStats = getStats(p)

                    var barHeight = isGold ? 'h-44 md:h-56' : isSilver ? 'h-32 md:h-40' : 'h-24 md:h-32'
                    var avatarSize = isGold ? 'w-20 h-20 md:w-28 md:h-28' : 'w-14 h-14 md:w-20 md:h-20'
                    var avatarBorder = isGold ? 'border-4 border-primary shadow-[0_0_24px_rgba(255,198,107,0.4)]' : isSilver ? 'border-4 border-on-surface/20' : 'border-4 border-on-surface/15'

                    var barStyle = isGold
                      ? { background: 'linear-gradient(135deg, #FFC66B 0%, #E8A838 100%)' }
                      : isSilver
                        ? { background: 'linear-gradient(135deg, #E4E1EC 0%, #9D8E7C 100%)' }
                        : { background: 'linear-gradient(135deg, #9D8E7C 0%, #504535 100%)' }

                    var numColor = isGold ? 'text-on-primary' : 'text-on-surface'
                    var nameColor = isGold ? 'text-on-primary' : 'text-on-surface'

                    return (
                      <div
                        key={p.id || p.name}
                        onClick={function() { openProfile(p) }}
                        className={'flex flex-col items-center cursor-pointer transition-all duration-200 hover:scale-[1.02]' + (isGold ? ' scale-105 z-10' : '')}
                      >
                        {isGold && (
                          <div className="relative mb-1 flex justify-center">
                            <Icon name="workspace_premium" fill size={24} className="text-primary" />
                          </div>
                        )}
                        <div
                          className={'rounded-full mb-3 object-cover flex items-center justify-center bg-surface-container-highest shrink-0 ' + avatarSize + ' ' + avatarBorder}
                        >
                          <span
                            className="font-display font-bold opacity-60"
                            style={{ fontSize: isGold ? '1.5rem' : '1.1rem', color: isGold ? '#E8A838' : '#C0C0C0' }}
                          >
                            {p.name ? p.name[0].toUpperCase() : '?'}
                          </span>
                        </div>

                        <div
                          className={'w-full rounded-t-xl flex flex-col items-center justify-between pt-4 pb-4 shadow-2xl ' + barHeight}
                          style={barStyle}
                        >
                          <span
                            className={'font-display opacity-40 ' + numColor}
                            style={{ fontSize: isGold ? '3rem' : '2rem', lineHeight: 1 }}
                          >
                            {actualRank + 1}
                          </span>
                          <div className="text-center px-2">
                            <p className={'font-technical font-bold uppercase truncate w-full ' + (isGold ? 'text-sm md:text-base' : 'text-xs md:text-sm') + ' ' + nameColor}>
                              {p.name}
                            </p>
                            <div className="flex justify-center gap-2 mt-1">
                              <span className={'font-mono font-bold text-xs opacity-80 ' + numColor}>
                                {p.pts + ' pts'}
                              </span>
                            </div>
                            <div className={'font-mono text-[10px] mt-0.5 opacity-60 ' + numColor}>
                              {'avg ' + pStats.avgPlacement}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
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
              <div className="rounded-[20px] overflow-hidden border border-outline-variant/10 bg-surface-container-low">
                {/* Table header label row */}
                <div className="px-6 py-4 flex justify-between items-center border-b border-outline-variant/10">
                  <h3 className="font-technical text-on-surface-variant tracking-[0.1em] uppercase text-sm">
                    Final Tournament Standings
                  </h3>
                  <span className="font-mono text-xs text-primary/50">
                    {sorted.length + ' players'}
                  </span>
                </div>

                {/* Column headers */}
                <div
                  className="grid px-6 py-2.5 bg-surface-container-lowest/50 border-b border-outline-variant/5 [grid-template-columns:52px_1fr_80px_70px_60px_70px_110px]"
                >
                  {['Rank', 'Player', 'Points', 'Avg', 'Wins', 'T4%', 'Reward'].map(function(h) {
                    return (
                      <span key={h} className="font-technical text-[10px] font-bold uppercase tracking-widest text-on-surface/40">
                        {h}
                      </span>
                    )
                  })}
                </div>

                <div className="divide-y divide-outline-variant/5">
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
                        className="grid px-6 py-4 items-center cursor-pointer transition-colors hover:bg-white/[0.03] [grid-template-columns:52px_1fr_80px_70px_60px_70px_110px]"
                        style={{
                          background: i === 0
                            ? 'rgba(255,198,107,0.05)'
                            : i < 3
                              ? 'rgba(255,255,255,0.015)'
                              : 'transparent',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {i === 0 && (
                            <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_#FFC66B] flex-shrink-0" />
                          )}
                          {i > 0 && (
                            <div className="w-2 h-2 rounded-full bg-on-surface/20 flex-shrink-0" />
                          )}
                          <span className="font-mono text-sm font-bold" style={{ color: col }}>
                            {'#' + String(i + 1).padStart(2, '0')}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="text-sm truncate"
                              style={{ fontWeight: isTop3 ? 700 : 600, color: isTop3 ? '#E4E1EC' : '#C8BFB0' }}
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
                          className="font-mono text-sm font-bold"
                          style={{ color: isTop3 ? col : '#C8BFB0' }}
                        >
                          {p.pts + ' pts'}
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
              </div>
            )}

            {/* Awards tab */}
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

                <div
                  className="flex items-center gap-4 p-4 rounded-[20px] flex-wrap border border-outline-variant/10 bg-secondary/[0.06]"
                >
                  <Icon name="redeem" size={24} className="text-secondary flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-technical text-sm text-secondary mb-0.5 uppercase tracking-wider">Milestone Rewards Unlocked</div>
                    <div className="text-sm text-on-surface/60">Some players earned new milestones this clash.</div>
                  </div>
                  <Btn variant="secondary" size="sm" onClick={function() { setScreen('milestones'); navigate('/milestones') }}>
                    View
                  </Btn>
                </div>
              </div>
            )}

            {/* Clash Report tab */}
            {tab === 'report' && (
              <Panel>
                <h3 className="font-editorial italic text-lg font-bold text-on-surface mb-1">
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
                  embedded={true}
                />
              </Panel>
            )}
          </div>

          {/* Right column: Awards summary + AI recap + Social share */}
          <div className="lg:col-span-4 space-y-6">

            {/* Tournament Honors sidebar card */}
            <div className="rounded-[20px] bg-surface-container-low border border-outline-variant/10 p-6">
              <h3 className="font-technical text-on-surface-variant tracking-[0.1em] uppercase text-sm mb-5">
                Tournament Honors
              </h3>
              <div className="space-y-3">
                {awards.filter(function(a) { return a.winner }).slice(0, 4).map(function(a) {
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
            </div>

            {/* AI Narrative Recap */}
            <div className="rounded-[20px] bg-surface-container-low border border-outline-variant/10 p-6 relative">
              <div className="flex items-center gap-3 mb-5">
                <Icon name="psychology" fill size={20} className="text-tertiary" />
                <h3 className="font-technical text-tertiary tracking-[0.1em] uppercase text-sm">
                  Clash Narrative
                </h3>
              </div>
              <div className="space-y-3">
                <p className="italic text-on-surface/70 leading-relaxed text-sm">
                  {'The ' + clashName + ' delivered high-level competition from start to finish. '}
                  <span className="text-on-surface font-bold">{champ.name}</span>
                  {' dominated the field, finishing with ' + champ.pts + ' points and setting the pace all night.'}
                </p>
                {sorted[3] && (
                  <p className="italic text-on-surface/70 leading-relaxed text-sm">
                    {'An honorable mention goes to '}
                    <span className="text-secondary font-bold">{sorted[3].name}</span>
                    {', who held firm in 4th place and kept the top spots under pressure in the final lobbies.'}
                  </p>
                )}
              </div>
              <div className="mt-5 pt-4 border-t border-outline-variant/10">
                <span className="font-technical text-[10px] text-on-surface/40 uppercase tracking-wider">
                  {'Season 1 - ' + sorted.length + ' players - ' + Math.ceil(sorted.length / 8) + ' lobbies'}
                </span>
              </div>
            </div>

            {/* Social Share */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={function() {
                    shareToTwitter(buildShareText('recap', { winner: champ.name, clashName: clashName }))
                  }}
                  className="flex items-center justify-center gap-2 bg-surface-container-high hover:bg-surface-container-highest transition-colors py-3 rounded-full border border-outline-variant/10"
                >
                  <Icon name="share" size={14} className="text-primary" />
                  <span className="font-technical font-bold text-xs uppercase text-on-surface">Share</span>
                </button>
                <button
                  onClick={downloadCard}
                  className="flex items-center justify-center gap-2 bg-primary text-on-primary py-3 rounded-full font-technical font-bold text-xs uppercase transition-transform hover:scale-[1.02]"
                >
                  <Icon name="download" size={14} />
                  <span>Save Card</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={shareDiscord}
                  className="flex items-center justify-center gap-2 bg-surface-container-high hover:bg-surface-container-highest transition-colors py-3 rounded-full border border-outline-variant/10"
                >
                  <Icon name="forum" size={14} className="text-secondary" />
                  <span className="font-technical font-bold text-xs uppercase text-on-surface">Discord</span>
                </button>
                <button
                  onClick={copyResults}
                  className="flex items-center justify-center gap-2 bg-surface-container-high hover:bg-surface-container-highest transition-colors py-3 rounded-full border border-outline-variant/10"
                >
                  <Icon name="content_copy" size={14} className="text-on-surface/60" />
                  <span className="font-technical font-bold text-xs uppercase text-on-surface">Copy</span>
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </PageLayout>
  )
}
