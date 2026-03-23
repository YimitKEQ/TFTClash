import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import {
  getStats,
  estimateXp,
  getClashRank,
  getXpProgress,
  computeClashAwards,
} from '../lib/stats.js'
import { ordinal, avgCol, shareToTwitter, buildShareText } from '../lib/utils.js'
import PageLayout from '../components/layout/PageLayout'
import PageHeader from '../components/shared/PageHeader'
import { Panel, Btn } from '../components/ui'

// ── Inline ClashRankBadge (not yet extracted to components) ──────────────────

function ClashRankBadge({ xp, size }) {
  var prog = getXpProgress(xp || 0)
  var rank = prog.rank
  var sm = size === 'sm'
  return (
    <div
      className="inline-flex items-center gap-1"
      style={{
        background: rank.color + '18',
        border: '1px solid ' + rank.color + '44',
        borderRadius: sm ? 6 : 8,
        padding: sm ? '2px 7px' : '4px 10px',
      }}
    >
      <i
        className={'ti ti-' + rank.icon}
        style={{ fontSize: sm ? 12 : 15, color: rank.color }}
      />
      <span
        style={{
          fontSize: sm ? 10 : 12,
          fontWeight: 700,
          color: rank.color,
          letterSpacing: '.04em',
        }}
      >
        {rank.name}
      </span>
    </div>
  )
}

// ── Inline PlacementDistribution (not yet extracted to components) ────────────

function PlacementDistribution({ history }) {
  var h = history || []
  if (h.length === 0) return null
  var counts = [0, 0, 0, 0, 0, 0, 0, 0]
  h.forEach(function(entry) {
    var games = entry.games || []
    games.forEach(function(g) {
      if (g.placement >= 1 && g.placement <= 8) counts[g.placement - 1]++
    })
  })
  var total = counts.reduce(function(s, c) { return s + c }, 0)
  if (total === 0) return null
  var colors = ['#E8A838', '#C0C0C0', '#CD7F32', '#9B72CF', '#4ECDC4', '#6B7B8F', '#4A5568', '#2D3748']
  return (
    <div>
      <div
        className="text-[10px] font-bold uppercase tracking-widest mb-2"
        style={{ color: '#9AAABF' }}
      >
        Placement Distribution
      </div>
      <div className="flex h-5 rounded overflow-hidden" style={{ background: 'rgba(255,255,255,.04)' }}>
        {counts.map(function(c, i) {
          var pct = total > 0 ? (c / total * 100) : 0
          if (pct === 0) return null
          return (
            <div
              key={i}
              title={ordinal(i + 1) + ': ' + c + ' (' + Math.round(pct) + '%)'}
              style={{ width: pct + '%', background: colors[i], transition: 'width .5s ease' }}
            />
          )
        })}
      </div>
      <div className="flex justify-between mt-1">
        {counts.map(function(c, i) {
          return (
            <div
              key={i}
              className="text-center flex-1 text-[10px] font-semibold"
              style={{ color: c > 0 ? colors[i] : '#4A5568' }}
            >
              {ordinal(i + 1)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SeasonRecapScreen() {
  var navigate = useNavigate()
  var ctx = useApp()
  var players = ctx.players || []
  var profilePlayer = ctx.profilePlayer
  var toast = ctx.toast

  // Use profilePlayer if set, otherwise first player
  var player = profilePlayer || players[0] || null

  if (!player) {
    return (
      <PageLayout>
        <div className="pt-16 text-center text-on-surface/50">
          <i className="ti ti-user text-4xl block mb-3 text-on-surface/20" />
          <div className="text-sm">No player data available.</div>
        </div>
      </PageLayout>
    )
  }

  var s = getStats(player)
  var awards = computeClashAwards(players).filter(function(a) {
    return a.winner && a.winner.id === player.id
  })
  var sorted = players.slice().sort(function(a, b) { return b.pts - a.pts })
  var position = sorted.findIndex(function(p) { return p.id === player.id }) + 1
  var history = player.clashHistory || []

  var bestMoment = null
  history.forEach(function(h) {
    var p = h.place || h.placement
    if (p && (!bestMoment || p < (bestMoment.place || bestMoment.placement))) {
      bestMoment = h
    }
  })
  var bestPlace = bestMoment ? (bestMoment.place || bestMoment.placement) : null
  var top4Rate = s.games > 0 ? Math.round(s.top4 / s.games * 100) : 0

  function downloadRecap() {
    var canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 1000
    var ctx2 = canvas.getContext('2d')

    var bg = ctx2.createLinearGradient(0, 0, 800, 1000)
    bg.addColorStop(0, '#0A0F1A')
    bg.addColorStop(0.5, '#0D1225')
    bg.addColorStop(1, '#08080F')
    ctx2.fillStyle = bg
    ctx2.fillRect(0, 0, 800, 1000)

    var gold = ctx2.createLinearGradient(0, 0, 800, 0)
    gold.addColorStop(0, 'transparent')
    gold.addColorStop(0.3, '#E8A838')
    gold.addColorStop(0.7, '#FFD700')
    gold.addColorStop(1, 'transparent')
    ctx2.fillStyle = gold
    ctx2.fillRect(0, 0, 800, 3)

    ctx2.font = 'bold 11px monospace'
    ctx2.fillStyle = '#E8A838'
    ctx2.fillText('TFT CLASH - SEASON 1 RECAP', 40, 50)

    ctx2.font = 'bold 52px serif'
    ctx2.fillStyle = '#F2EDE4'
    ctx2.fillText(player.name, 40, 120)

    var clashRank = getClashRank(estimateXp(player))
    ctx2.font = 'bold 14px monospace'
    ctx2.fillStyle = clashRank.color
    ctx2.fillText(clashRank.name.toUpperCase(), 40, 150)

    ctx2.font = 'bold 80px monospace'
    ctx2.fillStyle = '#E8A838'
    ctx2.fillText('#' + position, 40, 290)

    ctx2.font = 'bold 14px sans-serif'
    ctx2.fillStyle = '#C8D4E0'
    ctx2.fillText('of ' + players.length + ' players', 40, 315)

    var stats = [
      ['PTS', player.pts, '#E8A838'],
      ['WINS', s.wins, '#6EE7B7'],
      ['AVP', s.avgPlacement, s.avgPlacement < 3 ? '#6EE7B7' : s.avgPlacement < 5 ? '#EAB308' : '#F87171'],
      ['TOP4', s.top4, '#C4B5FD'],
      ['GAMES', s.games, '#C8D4E0'],
      ['STREAK', player.bestStreak || 0, '#F97316'],
    ]
    stats.forEach(function(row, i) {
      var x = 40 + (i % 3) * 250
      var y = 380 + Math.floor(i / 3) * 100
      ctx2.fillStyle = 'rgba(255,255,255,0.03)'
      ctx2.beginPath()
      if (ctx2.roundRect) ctx2.roundRect(x, y, 220, 80, 8)
      else ctx2.rect(x, y, 220, 80)
      ctx2.fill()
      ctx2.font = 'bold 28px monospace'
      ctx2.fillStyle = row[2]
      ctx2.fillText(String(row[1]), x + 16, y + 46)
      ctx2.font = 'bold 10px monospace'
      ctx2.fillStyle = '#BECBD9'
      ctx2.fillText(row[0], x + 16, y + 66)
    })

    if (awards.length > 0) {
      ctx2.font = 'bold 11px monospace'
      ctx2.fillStyle = '#9B72CF'
      ctx2.fillText('AWARDS WON', 40, 610)
      awards.slice(0, 3).forEach(function(a, i) {
        ctx2.font = '16px sans-serif'
        ctx2.fillStyle = '#F2EDE4'
        ctx2.fillText(a.title, 40, 640 + i * 30)
      })
    }

    var stmts = [
      player.name + ' dominated Season 1 with ' + s.top1Rate + '% win rate.',
      'Consistent performer - AVP of ' + s.avgPlacement + ' across ' + s.games + ' games.',
      player.name + ' showed up every week. ' + s.wins + ' victories speak for themselves.',
    ]
    var stmt = stmts[player.id % stmts.length]
    ctx2.font = 'italic 15px serif'
    ctx2.fillStyle = '#C8D4E0'
    ctx2.fillText(stmt.length > 60 ? stmt.slice(0, 60) + '...' : stmt, 40, 800)

    ctx2.fillStyle = 'rgba(232,168,56,0.1)'
    ctx2.fillRect(0, 940, 800, 60)
    ctx2.font = 'bold 11px monospace'
    ctx2.fillStyle = '#E8A838'
    ctx2.fillText('TFTCLASH.GG', 40, 975)
    ctx2.font = '11px monospace'
    ctx2.fillStyle = '#BECBD9'
    ctx2.fillText('Season 1 - ' + new Date().toLocaleDateString(), 200, 975)
    ctx2.fillText('#TFTClash  #TFT  #Season1', 500, 975)

    var a = document.createElement('a')
    a.download = player.name + '-S1-Recap.png'
    a.href = canvas.toDataURL('image/png')
    a.click()
    if (toast) toast('Season recap downloaded!', 'success')
  }

  function handleDiscordShare() {
    var text = '[TFT Clash Season 1 Recap] ' + player.name + ' - #' + position + ' overall (' + player.pts + ' pts) | ' + s.wins + ' wins | AVP ' + s.avgPlacement + ' | ' + awards.length + ' awards | #TFTClash'
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function() {
        if (toast) toast('Copied for Discord!', 'success')
      })
    }
  }

  return (
    <PageLayout>
      <div className="pt-8 pb-16">
        <PageHeader title="Season 1" goldWord="Recap" />

        <div className="mb-5">
          <Btn variant="ghost" size="sm" onClick={function() { navigate(-1) }}>
            Back
          </Btn>
        </div>

        {/* Preview card */}
        <div
          className="rounded-2xl mb-6 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg,rgba(10,15,26,1),rgba(13,18,37,1),rgba(8,8,15,1))',
            border: '1px solid rgba(232,168,56,.3)',
            padding: 'clamp(20px,4vw,40px)',
            maxWidth: 700,
          }}
        >
          {/* Gold top bar */}
          <div
            className="absolute top-0 left-0 right-0 h-0.5"
            style={{ background: 'linear-gradient(90deg,transparent,#E8A838,#FFD700,#E8A838,transparent)' }}
          />

          <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
            <div>
              <div
                className="text-[10px] font-bold uppercase tracking-[.22em] mb-1.5"
                style={{ color: '#E8A838', fontFamily: "'Barlow Condensed',sans-serif" }}
              >
                TFT Clash - Season 1 Recap
              </div>
              <div
                className="font-black leading-none"
                style={{ fontSize: 'clamp(24px,5vw,44px)', color: '#F2EDE4' }}
              >
                {player.name}
              </div>
              <div className="mt-2">
                <ClashRankBadge xp={estimateXp(player)} size="sm" />
              </div>
            </div>
            <div className="text-right">
              <div
                className="font-bold leading-none"
                style={{
                  fontSize: 'clamp(32px,6vw,60px)',
                  color: '#E8A838',
                  fontFamily: 'monospace',
                }}
              >
                {'#' + position}
              </div>
              <div className="text-xs text-on-surface/50 mt-1">{'of ' + players.length + ' players'}</div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2.5 mb-5">
            {[
              ['Season Pts', player.pts, '#E8A838'],
              ['Wins', s.wins, '#6EE7B7'],
              ['AVP', s.avgPlacement, avgCol(s.avgPlacement)],
              ['Top 4', s.top4, '#C4B5FD'],
              ['Games', s.games, '#C8D4E0'],
              ['Best Streak', player.bestStreak || 0, '#F97316'],
            ].map(function(row) {
              return (
                <div
                  key={row[0]}
                  className="rounded-xl px-3 py-3"
                  style={{
                    background: 'rgba(255,255,255,.03)',
                    border: '1px solid rgba(242,237,228,.06)',
                  }}
                >
                  <div
                    className="font-bold leading-none"
                    style={{
                      fontSize: 'clamp(18px,3vw,26px)',
                      color: row[2],
                      fontFamily: 'monospace',
                    }}
                  >
                    {row[1]}
                  </div>
                  <div
                    className="text-[10px] font-bold uppercase mt-1"
                    style={{
                      color: '#BECBD9',
                      letterSpacing: '.08em',
                      fontFamily: "'Barlow Condensed',sans-serif",
                    }}
                  >
                    {row[0]}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Awards */}
          {awards.length > 0 && (
            <div className="mb-4">
              <div
                className="text-[10px] font-bold uppercase tracking-[.14em] mb-2"
                style={{ color: '#9B72CF', fontFamily: "'Barlow Condensed',sans-serif" }}
              >
                Awards This Season
              </div>
              <div className="flex gap-2 flex-wrap">
                {awards.map(function(a) {
                  return (
                    <span
                      key={a.id}
                      className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                      style={{
                        background: (a.color || '#9B72CF') + '1A',
                        border: '1px solid ' + (a.color || '#9B72CF') + '40',
                        color: a.color || '#9B72CF',
                      }}
                    >
                      {a.title}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          <div
            className="flex justify-between items-center pt-3"
            style={{ borderTop: '1px solid rgba(242,237,228,.06)' }}
          >
            <span className="text-[10px] text-on-surface/30" style={{ fontFamily: 'monospace' }}>
              {'tftclash.gg/p/' + player.name.toLowerCase()}
            </span>
            <span className="text-[10px] text-on-surface/30">#TFTClash</span>
          </div>
        </div>

        {/* Best Moment + Stats Summary */}
        <div
          className="grid gap-4 mb-6"
          style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', maxWidth: 700 }}
        >
          {bestPlace && (
            <div
              className="rounded-2xl px-5 py-5"
              style={{
                background: '#111827',
                border: '1px solid rgba(155,114,207,.2)',
              }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-[.14em] mb-3"
                style={{ color: '#9B72CF', fontFamily: "'Barlow Condensed',sans-serif" }}
              >
                Best Finish
              </div>
              <div className="flex items-center gap-4">
                <div
                  className="font-extrabold leading-none"
                  style={{
                    fontSize: 48,
                    color: bestPlace === 1 ? '#E8A838' : bestPlace <= 3 ? '#C0C0C0' : '#9B72CF',
                    fontFamily: 'monospace',
                  }}
                >
                  {ordinal(bestPlace)}
                </div>
                <div>
                  <div className="font-semibold text-sm text-on-surface mb-1">
                    {bestPlace === 1 ? 'Champion' : 'Top Finish'}
                  </div>
                  {bestMoment && bestMoment.clashId && (
                    <div className="text-[11px] text-on-surface/40">{'Clash ' + bestMoment.clashId}</div>
                  )}
                  <div className="text-[11px] text-on-surface/40">
                    {s.wins + ' total win' + (s.wins !== 1 ? 's' : '') + ' this season'}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div
            className="rounded-2xl px-5 py-5"
            style={{
              background: '#111827',
              border: '1px solid rgba(155,114,207,.2)',
            }}
          >
            <div
              className="text-[10px] font-bold uppercase tracking-[.14em] mb-3"
              style={{ color: '#9B72CF', fontFamily: "'Barlow Condensed',sans-serif" }}
            >
              Stats Summary
            </div>
            {[
              ['Top 4 Rate', top4Rate + '%', top4Rate >= 50 ? '#6EE7B7' : '#E8A838'],
              ['Win Rate', s.top1Rate + '%', parseFloat(s.top1Rate) >= 20 ? '#6EE7B7' : '#C4B5FD'],
              ['Avg Placement', s.avgPlacement, avgCol(s.avgPlacement)],
              ['Games Played', s.games, '#C8D4E0'],
            ].map(function(row) {
              return (
                <div
                  key={row[0]}
                  className="flex justify-between items-center py-1.5"
                  style={{ borderBottom: '1px solid rgba(242,237,228,.05)' }}
                >
                  <span className="text-xs text-on-surface/50">{row[0]}</span>
                  <span className="text-sm font-bold" style={{ color: row[2], fontFamily: 'monospace' }}>
                    {row[1]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Placement distribution */}
        {history.length > 0 && (
          <div
            className="rounded-2xl px-5 py-5 mb-6"
            style={{
              background: '#111827',
              border: '1px solid rgba(155,114,207,.2)',
              maxWidth: 700,
            }}
          >
            <PlacementDistribution history={history} />
          </div>
        )}

        {/* Share buttons */}
        <div className="flex gap-3 flex-wrap">
          <Btn variant="primary" size="lg" onClick={downloadRecap}>
            <i className="ti ti-download text-sm mr-1" />
            Download PNG
          </Btn>
          <Btn
            variant="secondary"
            onClick={function() {
              shareToTwitter(buildShareText('recap', { name: player.name, rank: position, pts: player.pts }))
            }}
          >
            <i className="ti ti-brand-x text-sm mr-1" />
            Share on X
          </Btn>
          <Btn variant="ghost" onClick={handleDiscordShare}>
            Discord Share
          </Btn>
        </div>
      </div>
    </PageLayout>
  )
}
