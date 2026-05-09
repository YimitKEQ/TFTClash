import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PTS } from '../lib/constants'

// Broadcaster-only overlay. Use as a Browser Source in OBS at:
//   https://tftclash.com/obs/<tournamentId>?lobby=A
// Optional query: ?lobby=A (single lobby) ?theme=light
// Background is transparent so it can sit on top of TFT gameplay.

function lobbyLetter(num) {
  var n = parseInt(num, 10)
  if (!n || n < 1) return '?'
  return String.fromCharCode(64 + n)
}

function letterToNum(letter) {
  if (!letter) return 0
  var c = String(letter).toUpperCase().charCodeAt(0)
  return c >= 65 && c <= 90 ? (c - 64) : 0
}

export default function ObsOverlayScreen() {
  var location = useLocation()
  var pathSegs = (location.pathname || '').replace(/^\//, '').split('/')
  var tid = pathSegs[0] === 'obs' ? pathSegs[1] : ''
  var search = new URLSearchParams(location.search || '')
  var lobbyFilter = search.get('lobby') || ''
  var theme = search.get('theme') || 'dark'

  var _tournament = useState(null)
  var tournament = _tournament[0]; var setTournament = _tournament[1]

  var _lobbies = useState([])
  var lobbies = _lobbies[0]; var setLobbies = _lobbies[1]

  var _results = useState([])
  var results = _results[0]; var setResults = _results[1]

  var _reports = useState([])
  var reports = _reports[0]; var setReports = _reports[1]

  var _players = useState({})
  var players = _players[0]; var setPlayers = _players[1]

  var _err = useState('')
  var err = _err[0]; var setErr = _err[1]

  useEffect(function () {
    document.body.classList.add('obs-overlay-body')
    return function () { document.body.classList.remove('obs-overlay-body') }
  }, [])

  useEffect(function () {
    if (!tid) return
    var alive = true

    function loadTournament() {
      return supabase.from('tournaments')
        .select('id, name, phase, current_round, round_count, max_rounds')
        .eq('id', tid).single()
        .then(function (res) {
          if (!alive) return
          if (res.error) { setErr(res.error.message); return }
          setTournament(res.data)
        })
    }

    function loadLobbies(gameNum) {
      return supabase.from('lobbies')
        .select('id, lobby_number, player_ids, game_number')
        .eq('tournament_id', tid)
        .eq('game_number', gameNum)
        .order('lobby_number', { ascending: true })
        .then(function (res) {
          if (!alive) return
          var data = res.data || []
          setLobbies(data)
          var pids = []
          data.forEach(function (l) {
            (l.player_ids || []).forEach(function (pid) {
              if (pid && pids.indexOf(pid) === -1) pids.push(pid)
            })
          })
          if (pids.length === 0) { setPlayers({}); return }
          supabase.from('players').select('id, username').in('id', pids).then(function (pr) {
            if (!alive) return
            var map = {}
            ;(pr.data || []).forEach(function (p) { map[p.id] = p.username })
            setPlayers(map)
          })
        })
    }

    function loadResults(gameNum) {
      return supabase.from('game_results')
        .select('player_id, placement, points, lobby_id, game_number')
        .eq('tournament_id', tid)
        .eq('game_number', gameNum)
        .then(function (res) {
          if (!alive) return
          setResults(res.data || [])
        })
    }

    function loadReports(gameNum) {
      return supabase.from('player_reports')
        .select('player_id, reported_placement, lobby_id, game_number')
        .eq('tournament_id', tid)
        .eq('game_number', gameNum)
        .then(function (res) {
          if (!alive) return
          setReports(res.data || [])
        })
    }

    function loadAll() {
      loadTournament().then(function () {
        if (!alive) return
        // Re-read tournament to get the latest round number for downstream loads.
        supabase.from('tournaments').select('current_round').eq('id', tid).single().then(function (r) {
          if (!alive) return
          var gameNum = (r.data && r.data.current_round) || 1
          loadLobbies(gameNum)
          loadResults(gameNum)
          loadReports(gameNum)
        })
      }).catch(function (e) { setErr(String(e && e.message || e)) })
    }

    loadAll()

    var sub = supabase
      .channel('obs-' + tid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments', filter: 'id=eq.' + tid }, function () { loadAll() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobbies', filter: 'tournament_id=eq.' + tid }, function () { loadAll() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_results', filter: 'tournament_id=eq.' + tid }, function () { loadAll() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_reports', filter: 'tournament_id=eq.' + tid }, function () { loadAll() })
      .subscribe()

    return function () { alive = false; supabase.removeChannel(sub) }
  }, [tid])

  if (!tid) {
    return <div style={{ color: '#ff7a7a', padding: 24, fontFamily: 'monospace' }}>OBS overlay: missing tournament id. URL should be /obs/&lt;tournamentId&gt;</div>
  }
  if (err) {
    return <div style={{ color: '#ff7a7a', padding: 24, fontFamily: 'monospace' }}>OBS overlay error: {err}</div>
  }
  if (!tournament) {
    return <div style={{ color: '#888', padding: 24, fontFamily: 'monospace' }}>Connecting...</div>
  }

  var isLight = theme === 'light'
  var fg = isLight ? '#101015' : '#FFFFFF'
  var subColor = isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)'
  var card = isLight ? 'rgba(255,255,255,0.92)' : 'rgba(15,15,22,0.85)'
  var border = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'
  var divider = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'
  var accent = '#E8A838'

  var totalGames = tournament.round_count || tournament.max_rounds || 4
  var currentRound = tournament.current_round || 1
  var phaseLive = tournament.phase === 'in_progress' || tournament.phase === 'live'

  // Index locked + reported placements per (lobby_id, player_id)
  var lockedByLobby = {}
  results.forEach(function (r) {
    if (!lockedByLobby[r.lobby_id]) lockedByLobby[r.lobby_id] = {}
    lockedByLobby[r.lobby_id][r.player_id] = r.placement
  })
  var reportedByLobby = {}
  reports.forEach(function (r) {
    if (!reportedByLobby[r.lobby_id]) reportedByLobby[r.lobby_id] = {}
    reportedByLobby[r.lobby_id][r.player_id] = r.reported_placement
  })

  var filterNum = lobbyFilter ? letterToNum(lobbyFilter) : 0
  var visible = filterNum
    ? lobbies.filter(function (l) { return l.lobby_number === filterNum })
    : lobbies

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'transparent', color: fg, fontFamily: 'system-ui, -apple-system, sans-serif', padding: 24 }}>
      <div style={{ background: card, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: 14, padding: 18, border: '1px solid ' + border, maxWidth: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: phaseLive ? '#FF5050' : '#666' }} />
          <span style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: subColor }}>{tournament.phase || 'idle'}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: subColor }}>Game {currentRound} / {totalGames}</span>
        </div>
        <div style={{ fontSize: 22, letterSpacing: '-0.02em', textTransform: 'uppercase', color: accent, marginBottom: 6, fontWeight: 700 }}>{tournament.name || 'TFT Clash'}</div>
        {visible.length === 0 && <div style={{ fontSize: 13, color: subColor }}>No lobbies for game {currentRound} yet.</div>}
        {visible.map(function (lobby) {
          var locked = lockedByLobby[lobby.id] || {}
          var reported = reportedByLobby[lobby.id] || {}
          var rows = (lobby.player_ids || []).map(function (pid) {
            return { id: pid, name: players[pid] || '...' , locked: locked[pid] || 0, reported: reported[pid] || 0 }
          })
          rows.sort(function (a, b) {
            var pa = a.locked || a.reported || 99
            var pb = b.locked || b.reported || 99
            return pa - pb
          })
          return (
            <div key={lobby.id} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid ' + divider }}>
              <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: subColor, marginBottom: 6 }}>Lobby {lobbyLetter(lobby.lobby_number)}</div>
              {rows.map(function (p) {
                var pl = p.locked || p.reported
                var pts = pl ? (PTS[pl] || 0) : 0
                var faded = !p.locked && p.reported
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, opacity: faded ? 0.6 : 1 }}>
                    <span style={{ width: 22, fontFamily: 'monospace', fontSize: 12, color: pl === 1 ? accent : subColor }}>{pl ? '#' + pl : '\u00b7'}</span>
                    <span style={{ flex: 1, color: fg, fontWeight: 600 }}>{p.name}</span>
                    {pl ? <span style={{ fontFamily: 'monospace', fontSize: 12, color: accent }}>+{pts}</span> : null}
                  </div>
                )
              })}
            </div>
          )
        })}
        <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid ' + divider, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: subColor }}>tftclash.com</span>
          <span style={{ fontSize: 10, color: subColor }}>Live</span>
        </div>
      </div>
    </div>
  )
}
