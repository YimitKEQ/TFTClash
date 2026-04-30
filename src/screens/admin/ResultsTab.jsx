import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase.js'
import { PTS } from '../../lib/constants.js'
import { Panel, Btn, Icon, Sel } from '../../components/ui'

export default function ResultsTab() {
  var ctx = useApp()
  var players = ctx.players
  var setPlayers = ctx.setPlayers
  var tournamentState = ctx.tournamentState
  var setAuditLog = ctx.setAuditLog
  var currentUser = ctx.currentUser
  var toast = ctx.toast

  var _lobby = useState(1)
  var lobby = _lobby[0]
  var setLobby = _lobby[1]

  var _placements = useState({})
  var placements = _placements[0]
  var setPlacements = _placements[1]

  var _published = useState([])
  var published = _published[0]
  var setPublished = _published[1]

  var _publishing = useState(false)
  var publishing = _publishing[0]
  var setPublishing = _publishing[1]

  function addAudit(type, msg) {
    var entry = { ts: Date.now(), type: type, msg: msg }
    setAuditLog(function(l) { return [entry].concat(l.slice(0, 199)) })
    if (supabase.from && currentUser) {
      supabase.from('audit_log').insert({
        action: type, actor_id: currentUser.auth_user_id || null,
        actor_name: currentUser.username || currentUser.email || 'Admin',
        target_type: 'admin_action', details: { message: msg, timestamp: entry.ts }
      }).then(function(r) { }).catch(function(e) { console.error('[ResultsTab] DB op failed:', e); })
    }
  }

  var ts = tournamentState || {}
  var checkedInIds = ts.checkedInIds || []
  var checkedIn = (players || []).filter(function(p) {
    return checkedInIds.indexOf(p.id) !== -1 || checkedInIds.indexOf(String(p.id)) !== -1
  })

  var lobbySize = 8
  var numLobbies = Math.max(1, Math.ceil(checkedIn.length / lobbySize))
  var lobbyPlayers = checkedIn.slice((lobby - 1) * lobbySize, lobby * lobbySize)
  var lobbyKey = 'lobby' + lobby
  var isPublished = published.indexOf(lobbyKey) !== -1

  // Load existing game_results for the active lobby so a per-row correction
  // doesn't require re-entering all 8 placements. Also marks lobby as published
  // when results already exist (so "Override" CTA shows correctly across reloads).
  useEffect(function() {
    var tId = ts.activeTournamentId || null
    if (!tId || !lobbyPlayers || lobbyPlayers.length === 0) return
    var pids = lobbyPlayers.map(function(p) { return p.id })
    supabase.from('game_results')
      .select('player_id, placement, game_number')
      .eq('tournament_id', tId)
      .eq('game_number', lobby)
      .in('player_id', pids)
      .then(function(r) {
        if (r.error || !r.data || r.data.length === 0) return
        setPlacements(function(prev) {
          var next = Object.assign({}, prev)
          r.data.forEach(function(row) {
            next[lobbyKey + '_' + row.player_id] = String(row.placement)
          })
          return next
        })
        setPublished(function(pub) {
          return pub.indexOf(lobbyKey) === -1 ? pub.concat([lobbyKey]) : pub
        })
      }).catch(function(e) { console.error('[ResultsTab] DB op failed:', e) })
  }, [lobby, ts.activeTournamentId, lobbyPlayers.length])

  function setPlace(playerId, place) {
    var key = lobbyKey + '_' + playerId
    setPlacements(function(p) {
      var next = Object.assign({}, p)
      next[key] = place
      return next
    })
  }

  function getPlace(playerId) {
    return placements[lobbyKey + '_' + playerId] || ''
  }

  function validate() {
    if (lobbyPlayers.length === 0) { toast('No checked-in players in this lobby', 'error'); return false }
    var placed = lobbyPlayers.map(function(p) { return getPlace(p.id) }).filter(function(v) { return v !== '' })
    if (placed.length !== lobbyPlayers.length) { toast('All slots must be filled', 'error'); return false }
    var uniqueCheck = {}
    for (var i = 0; i < placed.length; i++) {
      if (uniqueCheck[placed[i]]) { toast('Duplicate placements found', 'error'); return false }
      uniqueCheck[placed[i]] = true
    }
    return true
  }

  function publishResults() {
    if (publishing) return
    if (isPublished) {
      if (!window.confirm('This lobby is already published. Override?')) return
    }
    if (!validate()) return
    setPublishing(true)
    var tId = ts.activeTournamentId || null
    var rows = lobbyPlayers.map(function(p) {
      var place = parseInt(getPlace(p.id))
      return { player_id: p.id, placement: place, points: PTS[place] || 0, game_number: lobby, round_number: 1, tournament_id: tId }
    })

    function reloadFromDb() {
      supabase.from('players').select('id, season_pts, wins, top4, games, avg_placement').then(function(freshRes) {
        if (freshRes.error || !freshRes.data) return
        setPlayers(function(ps) {
          return ps.map(function(p) {
            var fresh = freshRes.data.find(function(f) { return f.id === p.id })
            if (!fresh) return p
            return Object.assign({}, p, { pts: fresh.season_pts || 0, wins: fresh.wins || 0, top4: fresh.top4 || 0, games: fresh.games || 0 })
          })
        })
      }).catch(function(e) { console.error('[ResultsTab] DB op failed:', e) })
    }

    // Atomic upsert on (tournament_id, game_number, player_id). The previous
    // delete-then-insert pair could orphan a lobby if insert failed after delete
    // succeeded (refresh_player_stats trigger then recalculates with a hole).
    supabase.from('game_results')
      .upsert(rows, { onConflict: 'tournament_id,game_number,player_id' })
      .then(function(r) {
        if (r.error) { toast('Publish failed: ' + r.error.message, 'error'); setPublishing(false); return }
        if (isPublished) {
          // Override path: trigger recalculated, just reload from DB.
          reloadFromDb()
        } else {
          // Fresh publish: optimistic local update, then reconcile with DB.
          setPlayers(function(ps) {
            return ps.map(function(p) {
              var row = rows.find(function(rw) { return rw.player_id === p.id })
              if (!row) return p
              return Object.assign({}, p, {
                pts: (p.pts || 0) + row.points,
                games: (p.games || 0) + 1,
                wins: row.placement === 1 ? (p.wins || 0) + 1 : (p.wins || 0),
                top4: row.placement <= 4 ? (p.top4 || 0) + 1 : (p.top4 || 0)
              })
            })
          })
          setTimeout(reloadFromDb, 1500)
        }
        setPublished(function(pub) { return pub.indexOf(lobbyKey) === -1 ? pub.concat([lobbyKey]) : pub })
        addAudit('ACTION', 'Results ' + (isPublished ? 'overridden' : 'published') + ': Lobby ' + lobby + ', ' + rows.length + ' players')
        toast('Results ' + (isPublished ? 'updated' : 'published') + ' for Lobby ' + lobby + '!', 'success')
        setPublishing(false)
      })
      .catch(function() { toast('Publish failed', 'error'); setPublishing(false) })
  }

  if (checkedIn.length === 0) {
    return (
      <div className="p-4 md:p-6">
        <Panel>
          <div className="text-center py-10 text-on-surface/40">
            <Icon name="how_to_reg" size={36} className="block mx-auto mb-3" />
            <div className="text-sm font-semibold mb-1">No checked-in players</div>
            <div className="text-xs">Use Check In All from the Overview tab first.</div>
          </div>
        </Panel>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Panel>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon name="leaderboard" size={16} className="text-primary" />
            <span className="font-bold text-sm text-on-surface">Enter Results</span>
            <span className="text-xs text-on-surface/40">{checkedIn.length} checked in, {numLobbies} lobby{numLobbies > 1 ? 'ies' : ''}</span>
          </div>
          {numLobbies > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-on-surface/50">Lobby:</span>
              {Array.from({ length: numLobbies }, function(_, i) { return i + 1 }).map(function(n) {
                return (
                  <button key={n} type="button" onClick={function() { setLobby(n) }} className={'px-2.5 py-1 text-xs font-bold rounded border ' + (lobby === n ? 'bg-primary/10 border-primary text-primary' : 'border-outline-variant/20 text-on-surface/50 hover:bg-white/5')}>
                    {n}
                    {published.indexOf('lobby' + n) !== -1 && ' ✓'}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {isPublished && (
          <div className="mb-4 px-3 py-2 bg-success/10 border border-success/30 rounded text-xs text-success font-bold">
            Published. Click Publish again to override.
          </div>
        )}

        <div className="space-y-2 mb-4">
          {lobbyPlayers.map(function(p) {
            var place = getPlace(p.id)
            var pts = place ? (PTS[parseInt(place)] || 0) : null
            return (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2 bg-surface-container border border-outline-variant/5 rounded">
                <div className="flex-1 font-semibold text-on-surface text-sm">{p.name}</div>
                <div className="text-xs text-on-surface/40">{p.rank}</div>
                {pts !== null && <div className="text-sm font-bold text-primary min-w-[3.5rem] text-right">+{pts} pts</div>}
                <div className="w-20 flex-shrink-0">
                  <Sel value={place} onChange={function(v) { setPlace(p.id, v) }}>
                    <option value="">Place</option>
                    {[1,2,3,4,5,6,7,8].map(function(n) { return <option key={n} value={String(n)}>{n}</option> })}
                  </Sel>
                </div>
              </div>
            )
          })}
        </div>

        <Btn variant="primary" onClick={publishResults} disabled={publishing}>
          {publishing ? 'Publishing...' : isPublished ? 'Override Published Results' : 'Publish Results'}
        </Btn>
      </Panel>
    </div>
  )
}
