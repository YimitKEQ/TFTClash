import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toPng } from 'html-to-image'
import { supabase } from '../lib/supabase'
import { computeFlashStandings } from '../lib/tournament.js'

// Recap card -- shareable on-brand image at /recap/<tournamentId>.
// Mirrors the rest of the site (Subtle font, gold-on-near-black, sharp
// chevron rule, no gradients, no AI-generic flourishes). Top 3 + Top 10
// + prize labels. Download PNG / Copy / X share.

function pickPlayerName(p) {
  if (!p) return 'Unknown'
  return p.username || p.name || 'Unknown'
}

function PodiumColumn(props) {
  var place = props.place
  var entry = props.entry
  var prize = props.prize
  var isGold = place === 1
  var label = place === 1 ? '1st' : (place === 2 ? '2nd' : '3rd')
  var height = place === 1 ? 132 : (place === 2 ? 96 : 72)
  var name = entry ? entry.name : ''
  var pts = entry ? entry.totalPts : 0
  var ranks = entry ? (entry.wins + ' wins · ' + entry.top4 + ' top4') : ''

  var chipColor = isGold ? '#FFC66B' : 'rgba(255,255,255,0.55)'
  var chipBorder = isGold ? '#FFC66B' : 'rgba(255,255,255,0.18)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 132 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: 3,
          textTransform: 'uppercase',
          fontWeight: 700,
          color: chipColor,
          padding: '4px 10px',
          border: '1px solid ' + chipBorder,
          marginBottom: 12
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: isGold ? 22 : 17,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          textTransform: 'uppercase',
          color: '#FFFFFF',
          textAlign: 'center',
          maxWidth: 168,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1.1
        }}
        title={name}
      >
        {name || '--'}
      </div>
      <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
        {ranks}
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 13,
          fontWeight: 700,
          color: isGold ? '#FFC66B' : '#FFFFFF',
          letterSpacing: 0.5
        }}
      >
        {pts}<span style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>PTS</span>
      </div>
      {prize && (
        <div
          style={{
            marginTop: 8,
            fontSize: 9,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.6)',
            textAlign: 'center',
            maxWidth: 168,
            padding: '5px 8px',
            border: '1px dashed rgba(255,198,107,0.25)'
          }}
        >
          {prize}
        </div>
      )}
      <div
        style={{
          width: 110,
          height: height,
          marginTop: 14,
          background: isGold ? 'rgba(255,198,107,0.10)' : 'rgba(255,255,255,0.04)',
          borderTop: '2px solid ' + (isGold ? '#FFC66B' : 'rgba(255,255,255,0.22)'),
          borderLeft: '1px solid rgba(255,255,255,0.04)',
          borderRight: '1px solid rgba(255,255,255,0.04)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: 8
        }}
      >
        <span
          style={{
            fontSize: isGold ? 32 : 24,
            fontWeight: 700,
            color: isGold ? '#FFC66B' : 'rgba(255,255,255,0.4)',
            letterSpacing: '-0.02em'
          }}
        >
          0{place}
        </span>
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

  function exportPng(then) {
    if (!cardRef.current) return Promise.reject(new Error('No card'))
    return toPng(cardRef.current, {
      pixelRatio: 2,
      backgroundColor: '#06060A',
      cacheBust: true
    })
  }

  function downloadPng() {
    setBusy(true)
    exportPng().then(function(dataUrl) {
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
    if (typeof window.ClipboardItem !== 'function') {
      flash('Browser does not support image clipboard')
      return
    }
    setBusy(true)
    exportPng().then(function(dataUrl) {
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
      <div style={{ minHeight: '100vh', background: '#06060A', color: '#FFFFFF', padding: 32 }}>
        Missing tournament id. URL should be /recap/&lt;tournamentId&gt;
      </div>
    )
  }
  if (err) {
    return (
      <div style={{ minHeight: '100vh', background: '#06060A', color: '#ff7a7a', padding: 32 }}>
        Recap error: {err}
      </div>
    )
  }
  if (!tournament) {
    return (
      <div style={{ minHeight: '100vh', background: '#06060A', color: '#888', padding: 32 }}>
        Loading recap...
      </div>
    )
  }

  var dateLabel = tournament.date ? new Date(tournament.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
  var top3 = standings.slice(0, 3)
  var top10 = standings.slice(0, 10)
  var prizeByPlace = {}
  prizes.forEach(function(p) { prizeByPlace[p.placement] = p.label })
  var idShort = tournament.id ? tournament.id.slice(0, 8) : ''

  return (
    <div className="min-h-screen w-full bg-background text-on-background" style={{ background: '#06060A', padding: '32px 16px' }}>
      <div className="max-w-3xl mx-auto">

        {/* Toolbar (excluded from screenshot) */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <button
            onClick={function() { navigate('/tournament/' + tournament.id) }}
            className="text-xs uppercase tracking-widest text-on-surface-variant hover:text-on-surface"
            style={{ letterSpacing: 2 }}
          >
            ← Back to tournament
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={downloadPng}
              disabled={busy}
              className="px-4 py-2 uppercase tracking-widest text-xs font-bold disabled:opacity-50"
              style={{ background: '#FFC66B', color: '#1a1a1a', letterSpacing: 2 }}
            >
              {busy ? 'Working...' : 'Download PNG'}
            </button>
            <button
              onClick={copyImage}
              disabled={busy}
              className="px-4 py-2 uppercase tracking-widest text-xs font-bold disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.12)', letterSpacing: 2 }}
            >
              Copy Image
            </button>
            <button
              onClick={shareTwitter}
              className="px-4 py-2 uppercase tracking-widest text-xs font-bold"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.12)', letterSpacing: 2 }}
            >
              Share on X
            </button>
          </div>
        </div>

        {toastMsg && (
          <div
            className="mb-4 px-4 py-2 text-xs uppercase"
            style={{ background: 'rgba(255,198,107,0.08)', color: '#FFC66B', border: '1px solid rgba(255,198,107,0.3)', letterSpacing: 2 }}
          >
            {toastMsg}
          </div>
        )}

        {/* Card -- this is what gets exported. Uses Subtle font + brand palette. */}
        <div
          ref={cardRef}
          style={{
            background: '#0A0A10',
            color: '#FFFFFF',
            padding: 36,
            border: '1px solid rgba(255,255,255,0.06)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Subtle grid texture (drawn inline so it always survives PNG export). */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'linear-gradient(rgba(255,198,107,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,198,107,0.025) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              pointerEvents: 'none'
            }}
          />
          {/* Top accent bar */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: '#FFC66B' }} />

          <div style={{ position: 'relative' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: '#FFC66B', marginBottom: 8, fontWeight: 700 }}>
                  Final Results {dateLabel ? '· ' + dateLabel : ''}
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.05, textTransform: 'uppercase', color: '#FFFFFF' }}>
                  {tournament.name}
                </div>
                {tournament.region && (
                  <div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginTop: 8 }}>
                    Region · {tournament.region}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1.5, color: '#FFC66B', textTransform: 'uppercase' }}>TFT Clash</div>
                <div style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>tftclash.com</div>
              </div>
            </div>

            {/* Chevron rule */}
            <div style={{ position: 'relative', height: 1, background: 'linear-gradient(90deg, transparent 0%, rgba(255,198,107,0.4) 8%, rgba(255,198,107,0.1) 60%, transparent 100%)', marginBottom: 28 }}>
              <div style={{ position: 'absolute', left: 0, top: '50%', width: 12, height: 12, transform: 'translateY(-50%) rotate(45deg)', borderTop: '2px solid #FFC66B', borderRight: '2px solid #FFC66B' }} />
            </div>

            {/* Podium */}
            {top3.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 20, marginBottom: 36, flexWrap: 'wrap' }}>
                {top3[1] ? <PodiumColumn place={2} entry={top3[1]} prize={prizeByPlace[2]} /> : null}
                {top3[0] ? <PodiumColumn place={1} entry={top3[0]} prize={prizeByPlace[1]} /> : null}
                {top3[2] ? <PodiumColumn place={3} entry={top3[2]} prize={prizeByPlace[3]} /> : null}
              </div>
            )}

            {/* Top 10 leaderboard */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>
                  Top {Math.min(10, top10.length)}
                </div>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
              </div>

              {top10.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
                  No game results recorded.
                </div>
              )}

              <div>
                {top10.map(function(s, i) {
                  var place = i + 1
                  var isGold = place === 1
                  var placeColor = isGold ? '#FFC66B' : 'rgba(255,255,255,0.5)'
                  return (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '11px 14px',
                        background: isGold ? 'rgba(255,198,107,0.05)' : 'rgba(255,255,255,0.015)',
                        borderLeft: '2px solid ' + (isGold ? '#FFC66B' : 'rgba(255,255,255,0.06)'),
                        marginBottom: 4
                      }}
                    >
                      <span style={{ width: 28, fontSize: 14, fontWeight: 700, color: placeColor, letterSpacing: '-0.01em' }}>
                        {place < 10 ? '0' + place : place}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.005em' }}>
                          {s.name}
                        </div>
                        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                          {(s.rank || '')}{s.rank ? ' · ' : ''}{s.wins} wins · {s.top4} top4
                        </div>
                      </div>
                      <span style={{ fontSize: 16, fontWeight: 700, color: isGold ? '#FFC66B' : '#FFFFFF', letterSpacing: '-0.01em' }}>
                        {s.totalPts}
                      </span>
                      <span style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', width: 24 }}>
                        pts
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: 28, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
              <span>Free to play · Built for the community</span>
              <span>tftclash.com/tournament/{idShort}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
