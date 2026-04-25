import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PTS } from '../lib/constants'

// Broadcaster-only overlay. Use as a Browser Source in OBS at:
//   https://tftclash.com/obs/<tournamentId>?lobby=A
// Background is transparent so it can sit on top of TFT gameplay.

function fetchTournamentSnapshot(tid) {
  return supabase.from('tournaments').select('id,name,phase,round_number,total_games,locked_placements,lobby_assignments').eq('id', tid).single()
}

function lobbyLetter(i) { return String.fromCharCode(65 + i) }

export default function ObsOverlayScreen() {
  var location = useLocation()
  var pathSegs = (location.pathname || '').replace(/^\//, '').split('/')
  var tid = pathSegs[0] === 'obs' ? pathSegs[1] : ''
  var search = new URLSearchParams(location.search || '')
  var lobbyFilter = search.get('lobby') || ''
  var theme = search.get('theme') || 'dark'

  var _state = useState(null)
  var state = _state[0]; var setState = _state[1]

  var _err = useState('')
  var err = _err[0]; var setErr = _err[1]

  useEffect(function () {
    document.body.classList.add('obs-overlay-body')
    return function () { document.body.classList.remove('obs-overlay-body') }
  }, [])

  useEffect(function () {
    if (!tid) return
    var alive = true
    function load() {
      fetchTournamentSnapshot(tid).then(function (res) {
        if (!alive) return
        if (res.error) { setErr(res.error.message); return }
        setState(res.data)
      }).catch(function (e) { setErr(String(e && e.message || e)) })
    }
    load()
    var sub = supabase
      .channel('obs-' + tid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments', filter: 'id=eq.' + tid }, function () { load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_results', filter: 'tournament_id=eq.' + tid }, function () { load() })
      .subscribe()
    return function () { alive = false; supabase.removeChannel(sub) }
  }, [tid])

  if (err) {
    return <div style={{ color: '#ff7a7a', padding: 24, fontFamily: 'monospace' }}>OBS overlay error: {err}</div>
  }
  if (!state) {
    return <div style={{ color: '#888', padding: 24, fontFamily: 'monospace' }}>Connecting...</div>
  }

  var isLight = theme === 'light'
  var fg = isLight ? '#101015' : '#FFFFFF'
  var sub = isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)'
  var card = isLight ? 'rgba(255,255,255,0.92)' : 'rgba(15,15,22,0.85)'
  var accent = '#E8A838'

  var lobbies = state.lobby_assignments || {}
  var lockedAll = state.locked_placements || {}
  var lobbyKeys = Object.keys(lobbies).sort()
  var filtered = lobbyFilter
    ? lobbyKeys.filter(function (k) { return String(k).toLowerCase() === lobbyFilter.toLowerCase() })
    : lobbyKeys

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'transparent', color: fg, fontFamily: '"Inter", system-ui, sans-serif', padding: 24 }}>
      <div style={{ background: card, backdropFilter: 'blur(12px)', borderRadius: 14, padding: 18, border: '1px solid ' + (isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'), maxWidth: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: state.phase === 'live' || state.phase === 'inprogress' ? '#FF5050' : '#666' }} />
          <span style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: sub }}>{state.phase || 'idle'}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: sub }}>Round {state.round_number || 1} / {state.total_games || 4}</span>
        </div>
        <div style={{ fontFamily: '"Russo One", sans-serif', fontSize: 22, letterSpacing: '-0.02em', textTransform: 'uppercase', color: accent, marginBottom: 6 }}>{state.name || 'TFT Clash'}</div>
        {filtered.length === 0 && <div style={{ fontSize: 13, color: sub }}>No lobbies assigned yet.</div>}
        {filtered.map(function (k, i) {
          var rows = lobbies[k] || []
          var locked = (lockedAll[k] || lockedAll[i] || {})
          return (
            <div key={k} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid ' + (isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)') }}>
              <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: sub, marginBottom: 6 }}>Lobby {lobbyLetter(parseInt(k, 10) || i)}</div>
              {rows.slice().sort(function (a, b) {
                var pa = locked[a.id] || 99
                var pb = locked[b.id] || 99
                return pa - pb
              }).map(function (p) {
                var pl = locked[p.id]
                var pts = pl ? (PTS[pl] || 0) : 0
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 }}>
                    <span style={{ width: 22, fontFamily: 'monospace', fontSize: 12, color: pl === 1 ? accent : sub }}>{pl ? '#' + pl : '·'}</span>
                    <span style={{ flex: 1, color: fg, fontWeight: 600 }}>{p.name}</span>
                    {pl && <span style={{ fontFamily: 'monospace', fontSize: 12, color: accent }}>+{pts}</span>}
                  </div>
                )
              })}
            </div>
          )
        })}
        <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid ' + (isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'), display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: sub }}>tftclash.com</span>
          <span style={{ fontSize: 10, color: sub }}>Live</span>
        </div>
      </div>
    </div>
  )
}
