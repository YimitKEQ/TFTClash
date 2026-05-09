import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toPng } from 'html-to-image'
import { supabase } from '../lib/supabase'
import { computeFlashStandings } from '../lib/tournament.js'

// Beautiful, screenshot-ready recap card.
//   /recap/<tournamentId>
// Renders podium (top 3 with prizes) + top 10 leaderboard + brand mark.
// Includes a Download PNG button and a Copy Image button so hosts can post
// a clean result image straight to socials.

function ordinalSuffix(n) {
  var s = ['th', 'st', 'nd', 'rd']
  var v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function pickPlayerName(p) {
  if (!p) return 'Unknown'
  return p.username || p.name || 'Unknown'
}

function PodiumStep(props) {
  var place = props.place
  var entry = props.entry
  var prize = props.prize
  var heightClass = place === 1 ? 'h-44' : (place === 2 ? 'h-32' : 'h-24')
  var medal = place === 1 ? '🥇' : (place === 2 ? '🥈' : '🥉')
  var accentColor = place === 1 ? '#E8A838' : (place === 2 ? '#C0C0C0' : '#CD7F32')
  var name = entry ? entry.name : 'TBD'
  var pts = entry ? entry.totalPts : 0
  return (
    <div className="flex flex-col items-center justify-end">
      <div className="text-3xl mb-2">{medal}</div>
      <div className="font-display text-xl text-white text-center max-w-[10rem] truncate uppercase tracking-tight" title={name}>{name}</div>
      <div className="font-mono text-xs uppercase tracking-widest mt-1" style={{ color: accentColor }}>{pts} pts</div>
      {prize && (
        <div className="font-label uppercase tracking-widest text-[10px] text-white/70 mt-1 px-3 py-1 rounded border max-w-[14rem] text-center" style={{ borderColor: accentColor + '66' }}>
          {prize}
        </div>
      )}
      <div
        className={'w-32 mt-3 rounded-t-lg flex items-start justify-center pt-2 ' + heightClass}
        style={{
          background: 'linear-gradient(180deg, ' + accentColor + 'B0 0%, ' + accentColor + '40 100%)',
          border: '1px solid ' + accentColor + '66',
          borderBottom: 'none'
        }}
      >
        <span className="font-display text-3xl font-bold text-black/60">{place}</span>
      </div>
    </div>
  )
}

export default function TournamentRecapScreen() {
  var location = useLocation()
  var navigate = useNavigate()
  var cardRef = useRef(null)
  var pathSegs = (location.pathname || '').replace(/^\//, '').split('/')
  var tid = pathSegs[0] === 'recap' ? pathSegs[1] : ''

  var _tournament = useState(null)
  var tournament = _tournament[0]
  var setTournament = _tournament[1]
  var _standings = useState([])
  var standings = _standings[0]
  var setStandings = _standings[1]
  var _prizes = useState([])
  var prizes = _prizes[0]
  var setPrizes = _prizes[1]
  var _err = useState('')
  var err = _err[0]
  var setErr = _err[1]
  var _busy = useState(false)
  var busy = _busy[0]
  var setBusy = _busy[1]
  var _toast = useState('')
  var toastMsg = _toast[0]
  var setToast = _toast[1]

  function flash(msg) {
    setToast(msg)
    setTimeout(function() { setToast('') }, 2200)
  }

  useEffect(function() {
    if (!tid) return
    var alive = true

    Promise.all([
      supabase.from('tournaments').select('id, name, date, region, type, team_size, format, prize_pool_json').eq('id', tid).single(),
      supabase.from('game_results').select('player_id, placement, points, game_number').eq('tournament_id', tid),
      supabase.from('prize_claims').select('placement, prize_label').eq('tournament_id', tid)
    ]).then(function(results) {
      if (!alive) return
      var tRes = results[0]
      var grRes = results[1]
      var pcRes = results[2]
      if (tRes.error) { setErr(tRes.error.message); return }
      var t = tRes.data
      setTournament(t)
      var prizePool = Array.isArray(t.prize_pool_json) ? t.prize_pool_json : []
      var pcByPlace = {}
      ;(pcRes.data || []).forEach(function(c) { pcByPlace[c.placement] = c.prize_label })
      var combined = prizePool.map(function(p) {
        var plc = parseInt(p.placement, 10) || 0
        return {
          placement: plc,
          label: pcByPlace[plc] || p.prize || ''
        }
      }).sort(function(a, b) { return a.placement - b.placement })
      setPrizes(combined)

      var rows = grRes.data || []
      if (rows.length === 0) { setStandings([]); return }
      var pids = []
      rows.forEach(function(r) { if (r.player_id && pids.indexOf(r.player_id) === -1) pids.push(r.player_id) })
      supabase.from('players').select('id, username, rank').in('id', pids).then(function(pr) {
        if (!alive) return
        var lookup = {}
        ;(pr.data || []).forEach(function(p) { lookup[p.id] = p })
        var isDoubleUp = (t && t.team_size === 2) || (t && String(t.format || '').toLowerCase().indexOf('double') !== -1)
        var s = computeFlashStandings(rows, {
          doubleUp: isDoubleUp,
          playerLookup: function(id) { return lookup[id] || null }
        })
        setStandings(s)
      })
    })

    return function() { alive = false }
  }, [tid])

  function downloadPng() {
    if (!cardRef.current) return
    setBusy(true)
    toPng(cardRef.current, { pixelRatio: 2, backgroundColor: '#0B0B12', cacheBust: true }).then(function(dataUrl) {
      var link = document.createElement('a')
      var safeName = ((tournament && tournament.name) || 'recap').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
      link.download = 'tftclash-' + safeName + '-recap.png'
      link.href = dataUrl
      link.click()
      setBusy(false)
      flash('Image downloaded')
    }).catch(function(e) {
      setBusy(false)
      flash('Export failed: ' + (e && e.message || 'unknown'))
    })
  }

  function copyImage() {
    if (!cardRef.current) return
    if (typeof window.ClipboardItem !== 'function') {
      flash('Browser does not support image clipboard')
      return
    }
    setBusy(true)
    toPng(cardRef.current, { pixelRatio: 2, backgroundColor: '#0B0B12', cacheBust: true }).then(function(dataUrl) {
      return fetch(dataUrl).then(function(r) { return r.blob() })
    }).then(function(blob) {
      var item = new window.ClipboardItem({ 'image/png': blob })
      return navigator.clipboard.write([item])
    }).then(function() {
      setBusy(false)
      flash('Image copied to clipboard')
    }).catch(function() {
      setBusy(false)
      flash('Clipboard copy failed')
    })
  }

  function shareTwitter() {
    if (!tournament) return
    var url = 'https://tftclash.com/tournament/' + tournament.id
    var winner = standings[0] ? standings[0].name : 'TBD'
    var msg = tournament.name + ' - winner ' + winner + '. Full results at ' + url
    var href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(msg)
    window.open(href, '_blank', 'noopener')
  }

  if (!tid) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B0B12', color: '#FFFFFF', padding: 32, fontFamily: 'system-ui' }}>
        Missing tournament id. URL should be /recap/&lt;tournamentId&gt;
      </div>
    )
  }
  if (err) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B0B12', color: '#ff7a7a', padding: 32, fontFamily: 'system-ui' }}>
        Recap error: {err}
      </div>
    )
  }
  if (!tournament) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B0B12', color: '#888', padding: 32, fontFamily: 'system-ui' }}>
        Loading recap...
      </div>
    )
  }

  var dateLabel = tournament.date ? new Date(tournament.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
  var top3 = standings.slice(0, 3)
  var top10 = standings.slice(0, 10)
  var prizeByPlace = {}
  prizes.forEach(function(p) { prizeByPlace[p.placement] = p.label })

  return (
    <div className="min-h-screen w-full" style={{ background: '#06060A', padding: '32px 16px' }}>
      <div className="max-w-3xl mx-auto">

        {/* Toolbar (excluded from screenshot) */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <button
            onClick={function() { navigate('/tournament/' + tournament.id) }}
            className="text-xs uppercase tracking-widest font-label text-white/60 hover:text-white"
          >
            ← Back to tournament
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={downloadPng}
              disabled={busy}
              className="px-4 py-2 rounded bg-primary text-on-primary font-label uppercase tracking-widest text-xs disabled:opacity-50"
              style={{ background: '#E8A838', color: '#1a1a1a' }}
            >
              {busy ? 'Working...' : 'Download PNG'}
            </button>
            <button
              onClick={copyImage}
              disabled={busy}
              className="px-4 py-2 rounded bg-surface-container-high font-label uppercase tracking-widest text-xs disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF' }}
            >
              Copy Image
            </button>
            <button
              onClick={shareTwitter}
              className="px-4 py-2 rounded font-label uppercase tracking-widest text-xs"
              style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF' }}
            >
              Share on X
            </button>
          </div>
        </div>

        {toastMsg && (
          <div className="mb-4 px-4 py-2 rounded text-xs uppercase tracking-widest font-label" style={{ background: 'rgba(232,168,56,0.12)', color: '#E8A838', border: '1px solid rgba(232,168,56,0.4)' }}>
            {toastMsg}
          </div>
        )}

        {/* Card (this is what gets exported) */}
        <div
          ref={cardRef}
          style={{
            background: 'linear-gradient(160deg, #0F0F1A 0%, #14132A 60%, #1A1430 100%)',
            border: '1px solid rgba(232,168,56,0.25)',
            borderRadius: 20,
            padding: 36,
            color: '#FFFFFF',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#E8A838', marginBottom: 6, fontWeight: 600 }}>
                Final Results {dateLabel ? '· ' + dateLabel : ''}
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, textTransform: 'uppercase' }}>
                {tournament.name}
              </div>
              {tournament.region && (
                <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>
                  Region · {tournament.region}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em', color: '#E8A838', textTransform: 'uppercase' }}>TFT Clash</div>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>tftclash.com</div>
            </div>
          </div>

          {/* Podium */}
          {top3.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 14, padding: '20px 12px', marginBottom: 24, border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 24, minHeight: 240 }}>
                {top3[1] ? <PodiumStep place={2} entry={top3[1]} prize={prizeByPlace[2]} /> : <div style={{ width: 128 }} />}
                {top3[0] ? <PodiumStep place={1} entry={top3[0]} prize={prizeByPlace[1]} /> : <div style={{ width: 128 }} />}
                {top3[2] ? <PodiumStep place={3} entry={top3[2]} prize={prizeByPlace[3]} /> : <div style={{ width: 128 }} />}
              </div>
            </div>
          )}

          {/* Top 10 leaderboard */}
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 12, fontWeight: 600 }}>
              Top 10
            </div>
            {top10.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
                No game results recorded.
              </div>
            )}
            <div>
              {top10.map(function(s, i) {
                var place = i + 1
                var rowBg = place <= 3 ? 'rgba(232,168,56,0.06)' : 'rgba(255,255,255,0.02)'
                var placeColor = place === 1 ? '#E8A838' : (place === 2 ? '#C0C0C0' : (place === 3 ? '#CD7F32' : 'rgba(255,255,255,0.45)'))
                return (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '12px 16px',
                      background: rowBg,
                      borderRadius: 8,
                      marginBottom: 6,
                      border: '1px solid rgba(255,255,255,0.04)'
                    }}
                  >
                    <span style={{ width: 36, fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: placeColor }}>
                      {ordinalSuffix(place)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
                        {s.rank || ''} · {s.wins} wins · {s.top4} top4
                      </div>
                    </div>
                    <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: '#E8A838' }}>
                      {s.totalPts}
                    </span>
                    <span style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
                      pts
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
            <span>Free to play. Built for the community.</span>
            <span>tftclash.com/tournament/{tournament.id.slice(0, 8)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
