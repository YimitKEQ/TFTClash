import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase.js'
import { timeAgo, addAudit as sharedAddAudit } from '../../lib/utils.js'
import { Panel, Btn, Inp, Icon, Sel } from '../../components/ui'

var PHASE_STEPS = ['draft', 'registration', 'checkin', 'inprogress', 'complete']
var PHASE_LABELS = { draft: 'Draft', registration: 'Registration', checkin: 'Check-in', inprogress: 'Live', complete: 'Complete' }
var PHASE_COLORS = { draft: 'bg-on-surface/10 text-on-surface/40', registration: 'bg-tertiary/20 text-tertiary', checkin: 'bg-secondary/20 text-secondary', inprogress: 'bg-error/20 text-error', complete: 'bg-success/20 text-success' }

// Map app phase names → DB tournaments.phase enum values.
function toDbPhase(phase) {
  if (phase === 'checkin') return 'check_in'
  if (phase === 'inprogress') return 'in_progress'
  return phase
}

// Map DB phase names → app phase names (for reading rows back from DB).
function fromDbPhase(phase) {
  if (phase === 'check_in') return 'checkin'
  if (phase === 'in_progress') return 'inprogress'
  return phase
}

export default function OpsTournaments(props) {
  var tournaments = props.tournaments || []
  var regCounts = props.regCounts || {}
  var navigate = props.navigate
  var onRefresh = props.onRefresh

  var ctx = useApp()
  var tournamentState = ctx.tournamentState
  var setTournamentState = ctx.setTournamentState
  var tournamentStateNa = ctx.tournamentStateNa
  var setTournamentStateNa = ctx.setTournamentStateNa
  var currentUser = ctx.currentUser
  var toast = ctx.toast

  var _view = useState('list')
  var view = _view[0]
  var setView = _view[1]

  var _editTournament = useState(null)
  var editTournament = _editTournament[0]
  var setEditTournament = _editTournament[1]

  var _addPlayer = useState('')
  var addPlayerName = _addPlayer[0]
  var setAddPlayerName = _addPlayer[1]

  var _createForm = useState({ name: '', date: '', maxPlayers: '24', roundCount: '3', type: 'season_clash', seedingMethod: 'rank-based' })
  var createForm = _createForm[0]
  var setCreateForm = _createForm[1]

  var _registrations = useState([])
  var registrations = _registrations[0]
  var setRegistrations = _registrations[1]

  var _regLoading = useState(false)
  var regLoading = _regLoading[0]
  var setRegLoading = _regLoading[1]

  var _showArchived = useState(false)
  var showArchived = _showArchived[0]
  var setShowArchived = _showArchived[1]

  // Broadcast composer modal. `target` is the tournament row we're sending to.
  var _broadcast = useState({ target: null, message: '', sending: false })
  var broadcast = _broadcast[0]
  var setBroadcast = _broadcast[1]

  // Weekly clash phase control - region toggle so NA isn't silently routed to EU.
  var _region = useState('EU')
  var region = _region[0]
  var setRegion = _region[1]

  var ts = (region === 'NA' ? (tournamentStateNa || {}) : (tournamentState || {}))
  var currentPhase = ts.phase || 'idle'
  var currentPhaseIdx = PHASE_STEPS.indexOf(currentPhase)

  var visibleTournaments = (tournaments || []).filter(function(t) { return showArchived || !t.archived_at })
  var archivedCount = (tournaments || []).filter(function(t) { return !!t.archived_at }).length

  function addAudit(type, msg) { sharedAddAudit(supabase, currentUser, type, msg) }

  function setWeeklyPhase(phase) {
    var siteKey = region === 'NA' ? 'tournament_state_na' : 'tournament_state'
    var setter = region === 'NA' ? setTournamentStateNa : setTournamentState
    var nextValue = Object.assign({}, ts, { phase: phase })

    // Capacity trigger and player views read tournaments.phase directly. Keep
    // both site_settings and the tournaments row in sync when we know which
    // tournament is the active weekly clash. Local context state is only
    // updated after both writes succeed, so a partial failure cannot leave
    // the UI showing a phase the DB doesn't agree with.
    var tId = ts && (ts.activeTournamentId || ts.dbTournamentId)
    var siteWrite = supabase.from('site_settings').upsert({ key: siteKey, value: JSON.stringify(nextValue) }, { onConflict: 'key' })
    var tournamentWrite = tId
      ? supabase.from('tournaments').update({ phase: toDbPhase(phase) }).eq('id', tId)
      : Promise.resolve({ error: null })

    Promise.all([siteWrite, tournamentWrite])
      .then(function(results) {
        var siteRes = results[0]
        var tournamentRes = results[1]
        if (siteRes && siteRes.error) { toast('Phase save failed: ' + siteRes.error.message, 'error'); return }
        if (tournamentRes && tournamentRes.error) { toast('Tournament phase save failed: ' + tournamentRes.error.message, 'error'); return }
        if (setter) setter(function(s) { return Object.assign({}, s, { phase: phase }) })
        addAudit('ACTION', region + ' weekly phase set to: ' + phase)
        toast(region + ' phase: ' + (PHASE_LABELS[phase] || phase), 'success')
      })
      .catch(function(e) { console.error('[OpsTournaments] setWeeklyPhase failed:', e); toast('Phase save failed', 'error') })
  }

  function createTournament() {
    if (!createForm.name.trim()) { toast('Tournament name required', 'error'); return }
    supabase.from('tournaments').insert({
      name: createForm.name.trim(),
      date: createForm.date || null,
      phase: 'draft',
      type: createForm.type,
      max_players: parseInt(createForm.maxPlayers) || 24,
      round_count: parseInt(createForm.roundCount) || 3,
      seeding_method: createForm.seedingMethod || 'rank-based'
    }).select().single().then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return }
      addAudit('ACTION', 'Tournament created: ' + createForm.name.trim())
      toast('Tournament created!', 'success')
      setCreateForm({ name: '', date: '', maxPlayers: '24', roundCount: '3', type: 'season_clash', seedingMethod: 'rank-based' })
      setView('list')
      if (onRefresh) onRefresh()
    }).catch(function() { toast('Failed to create', 'error') })
  }

  function advancePhase(tId, currentP) {
    var appPhase = fromDbPhase(currentP)
    var idx = PHASE_STEPS.indexOf(appPhase)
    if (idx < 0 || idx >= PHASE_STEPS.length - 1) return
    var nextPhase = PHASE_STEPS[idx + 1]
    supabase.from('tournaments').update({ phase: toDbPhase(nextPhase) }).eq('id', tId).then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return }
      addAudit('ACTION', 'Tournament phase advanced to: ' + nextPhase)
      toast('Phase: ' + (PHASE_LABELS[nextPhase] || nextPhase), 'success')
      if (onRefresh) onRefresh()
    }).catch(function() { toast('Phase advance failed', 'error') })
  }

  function archiveTournament(t) {
    if (!t || !t.id) return
    var stillLive = t.phase !== 'complete' && t.phase !== 'cancelled'
    var msg = stillLive
      ? 'Archive ' + t.name + '?\n\nForces phase to complete and stamps archived_at so it falls out of upcoming/live feeds. Registrations and results are preserved.'
      : 'Archive ' + t.name + '?\n\nMarks archived_at so it is hidden from upcoming/live feeds. Registrations and results are preserved.'
    if (!window.confirm(msg)) return
    var nowIso = new Date().toISOString()
    var patch = stillLive ? { phase: 'complete', archived_at: nowIso } : { archived_at: nowIso }
    supabase.from('tournaments').update(patch).eq('id', t.id).then(function(res) {
      if (res.error) { toast('Archive failed: ' + res.error.message, 'error'); return }
      if (tournamentState && tournamentState.dbTournamentId === t.id && setTournamentState) {
        setTournamentState(function(s) { return Object.assign({}, s, { dbTournamentId: null, activeTournamentId: null, phase: 'idle', registeredIds: [], checkedInIds: [], waitlistIds: [], lobbies: [], lockedLobbies: [] }) })
      }
      if (tournamentStateNa && tournamentStateNa.dbTournamentId === t.id && setTournamentStateNa) {
        setTournamentStateNa(function(s) { return Object.assign({}, s, { dbTournamentId: null, activeTournamentId: null, phase: 'idle', registeredIds: [], checkedInIds: [], waitlistIds: [], lobbies: [], lockedLobbies: [] }) })
      }
      addAudit('ACTION', (stillLive ? 'Tournament archived (force complete): ' : 'Tournament archived: ') + t.name)
      toast('Archived', 'success')
      if (onRefresh) onRefresh()
    }).catch(function() { toast('Archive failed', 'error') })
  }

  function unarchiveTournament(t) {
    if (!t || !t.id) return
    if (!window.confirm('Restore ' + t.name + ' from archive?\n\nThis clears archived_at. Phase is left at "complete" - move it back manually if you want it live again.')) return
    supabase.from('tournaments').update({ archived_at: null }).eq('id', t.id).then(function(res) {
      if (res.error) { toast('Unarchive failed: ' + res.error.message, 'error'); return }
      addAudit('ACTION', 'Tournament unarchived: ' + t.name)
      toast('Restored', 'success')
      if (onRefresh) onRefresh()
    }).catch(function() { toast('Unarchive failed', 'error') })
  }

  function openBroadcast(t) {
    setBroadcast({ target: t, message: '', sending: false })
  }

  function closeBroadcast() {
    setBroadcast({ target: null, message: '', sending: false })
  }

  function sendBroadcast() {
    if (!broadcast.target) return
    var msg = String(broadcast.message || '').replace(/[<>]/g, '').slice(0, 200).trim()
    if (!msg) { toast('Message is empty', 'error'); return }
    setBroadcast(Object.assign({}, broadcast, { sending: true }))
    var t = broadcast.target
    var title = (t.name || 'Tournament') + ' - Announcement'
    supabase.rpc('notify_tournament_players', {
      p_tournament_id: t.id,
      p_title: title,
      p_body: msg,
      p_icon: 'bell',
      p_statuses: ['checked_in', 'registered']
    }).then(function(res) {
      if (res && res.error) {
        toast('Broadcast failed: ' + res.error.message, 'error')
        setBroadcast(Object.assign({}, broadcast, { sending: false }))
        return
      }
      addAudit('ACTION', 'Broadcast sent to ' + t.name + ': ' + msg)
      toast('Announcement sent to registered + checked-in players', 'success')
      setBroadcast({ target: null, message: '', sending: false })
    }).catch(function() {
      toast('Broadcast failed', 'error')
      setBroadcast(Object.assign({}, broadcast, { sending: false }))
    })
  }

  function deleteTournament(tId, name) {
    if (!window.confirm('Delete tournament "' + name + '"? This removes all results and registrations.')) return
    Promise.all([
      supabase.from('game_results').delete().eq('tournament_id', tId),
      supabase.from('point_adjustments').delete().eq('tournament_id', tId),
      supabase.from('registrations').delete().eq('tournament_id', tId),
    ]).then(function() {
      supabase.from('tournaments').delete().eq('id', tId).then(function(res) {
        if (res.error) { toast('Delete failed: ' + res.error.message, 'error'); return }
        // Clear any active region pointer to this tournament so subsequent
        // registration attempts do not crash on a dangling FK.
        if (tournamentState && tournamentState.dbTournamentId === tId && setTournamentState) {
          setTournamentState(function(s) { return Object.assign({}, s, { dbTournamentId: null, activeTournamentId: null, phase: 'idle', registeredIds: [], checkedInIds: [], waitlistIds: [], lobbies: [], lockedLobbies: [] }) })
        }
        if (tournamentStateNa && tournamentStateNa.dbTournamentId === tId && setTournamentStateNa) {
          setTournamentStateNa(function(s) { return Object.assign({}, s, { dbTournamentId: null, activeTournamentId: null, phase: 'idle', registeredIds: [], checkedInIds: [], waitlistIds: [], lobbies: [], lockedLobbies: [] }) })
        }
        addAudit('ACTION', 'Tournament deleted: ' + name)
        toast('Deleted: ' + name, 'success')
        if (onRefresh) onRefresh()
      })
    }).catch(function() { toast('Delete failed', 'error') })
  }

  function loadRegistrations(tId) {
    setRegLoading(true)
    supabase.from('registrations').select('id, player_id, status, created_at, players(username, rank, region)')
      .eq('tournament_id', tId).order('created_at', { ascending: true })
      .then(function(res) {
        setRegLoading(false)
        setRegistrations(res.data || [])
      }).catch(function() { setRegLoading(false) })
  }

  function removeRegistration(regId) {
    supabase.from('registrations').delete().eq('id', regId).then(function(res) {
      if (res.error) { toast('Remove failed', 'error'); return }
      setRegistrations(function(rs) { return rs.filter(function(r) { return r.id !== regId }) })
      toast('Registration removed', 'success')
    }).catch(function() { toast('Remove failed', 'error') })
  }

  function forceAddPlayer(tId, username) {
    var name = (username || '').trim()
    if (!name) { toast('Enter a username', 'error'); return }
    supabase.from('players').select('id, username, banned').ilike('username', name).limit(1).then(function(pRes) {
      if (pRes.error) { toast('Lookup failed: ' + pRes.error.message, 'error'); return }
      var found = (pRes.data || [])[0]
      if (!found) { toast('No player matched "' + name + '"', 'error'); return }
      if (found.banned) { toast(found.username + ' is banned', 'error'); return }
      supabase.from('registrations').upsert({
        tournament_id: tId,
        player_id: found.id,
        status: 'registered'
      }, { onConflict: 'tournament_id,player_id' }).then(function(rRes) {
        if (rRes.error) { toast('Add failed: ' + rRes.error.message, 'error'); return }
        addAudit('ACTION', 'Force-added ' + found.username + ' to tournament #' + tId)
        toast('Added ' + found.username, 'success')
        loadRegistrations(tId)
      }).catch(function() { toast('Add failed', 'error') })
    }).catch(function() { toast('Lookup failed', 'error') })
  }

  function saveTournamentEdit() {
    if (!editTournament) return
    var updates = {
      name: editTournament.name,
      date: editTournament.date || null,
      max_players: parseInt(editTournament.max_players) || 24,
      round_count: parseInt(editTournament.round_count) || 3,
      seeding_method: editTournament.seeding_method || 'rank-based',
      region: editTournament.region || null
    }
    supabase.from('tournaments').update(updates).eq('id', editTournament.id).then(function(res) {
      if (res.error) { toast('Save failed: ' + res.error.message, 'error'); return }
      addAudit('ACTION', 'Tournament edited: ' + editTournament.name)
      toast('Saved!', 'success')
      setEditTournament(null)
      if (onRefresh) onRefresh()
    }).catch(function() { toast('Save failed', 'error') })
  }

  // Edit view
  if (editTournament) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Btn v="ghost" s="sm" onClick={function() { setEditTournament(null) }}>
            <Icon name="arrow_back" size={16} /> Back
          </Btn>
          <h2 className="font-display text-lg font-bold text-on-surface">Edit: {editTournament.name}</h2>
        </div>
        <Panel className="max-w-2xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Name</label>
              <Inp value={editTournament.name || ''} onChange={function(v) { setEditTournament(Object.assign({}, editTournament, { name: typeof v === 'string' ? v : v.target.value })) }} />
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Date</label>
              <Inp type="datetime-local" value={editTournament.date || ''} onChange={function(v) { setEditTournament(Object.assign({}, editTournament, { date: typeof v === 'string' ? v : v.target.value })) }} />
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Max Players</label>
              <Inp type="number" value={editTournament.max_players || ''} onChange={function(v) { setEditTournament(Object.assign({}, editTournament, { max_players: typeof v === 'string' ? v : v.target.value })) }} />
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Round Count</label>
              <Inp type="number" value={editTournament.round_count || ''} onChange={function(v) { setEditTournament(Object.assign({}, editTournament, { round_count: typeof v === 'string' ? v : v.target.value })) }} />
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Region</label>
              <Inp value={editTournament.region || ''} onChange={function(v) { setEditTournament(Object.assign({}, editTournament, { region: typeof v === 'string' ? v : v.target.value })) }} placeholder="EU / NA" />
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Seeding</label>
              <Sel value={editTournament.seeding_method || 'rank-based'} onChange={function(v) { setEditTournament(Object.assign({}, editTournament, { seeding_method: v })) }}>
                <option value="random">Random</option>
                <option value="rank-based">Rank-Based</option>
                <option value="snake">Snake</option>
              </Sel>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Btn v="primary" onClick={saveTournamentEdit}>Save Changes</Btn>
            <Btn v="dark" onClick={function() { setEditTournament(null) }}>Cancel</Btn>
          </div>
        </Panel>

        {/* Registrations for this tournament */}
        <Panel className="!p-0 overflow-hidden max-w-2xl">
          <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="how_to_reg" size={16} className="text-tertiary" />
              <span className="font-label text-xs font-bold uppercase tracking-widest text-on-surface/60">
                Registrations ({registrations.length})
              </span>
            </div>
            <Btn v="dark" s="sm" onClick={function() { loadRegistrations(editTournament.id) }}>
              <Icon name="refresh" size={14} /> Load
            </Btn>
          </div>
          <div className="px-5 py-3 border-b border-outline-variant/10 flex items-center gap-2">
            <Inp value={addPlayerName} onChange={function(v) { setAddPlayerName(typeof v === 'string' ? v : v.target.value) }} placeholder="Add player by username..." />
            <Btn v="primary" s="sm" onClick={function() {
              forceAddPlayer(editTournament.id, addPlayerName)
              setAddPlayerName('')
            }}>
              <Icon name="person_add" size={14} /> Add
            </Btn>
          </div>
          {regLoading ? (
            <div className="py-6 text-center text-on-surface/30 text-xs">Loading...</div>
          ) : registrations.length === 0 ? (
            <div className="py-6 text-center text-on-surface/20 text-xs font-label uppercase tracking-widest">No registrations</div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto">
              {registrations.map(function(r) {
                var p = r.players || {}
                return (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-outline-variant/5 last:border-0">
                    <div className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center text-[10px] font-bold text-on-surface/50">
                      {(p.username || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-on-surface truncate">{p.username || 'Unknown'}</div>
                      <div className="font-label text-[10px] text-on-surface/25 uppercase">{p.rank || '?'} / {p.region || '?'}</div>
                    </div>
                    <span className="font-mono text-[10px] text-on-surface/30">{timeAgo(r.created_at)}</span>
                    <Btn v="ghost" s="sm" onClick={function() { removeRegistration(r.id) }}>
                      <Icon name="person_remove" size={14} className="text-error" />
                    </Btn>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </div>
    )
  }

  // Create view
  if (view === 'create') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Btn v="ghost" s="sm" onClick={function() { setView('list') }}>
            <Icon name="arrow_back" size={16} /> Back
          </Btn>
          <h2 className="font-display text-lg font-bold text-on-surface">Create Tournament</h2>
        </div>
        <Panel className="max-w-2xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Name</label>
              <Inp value={createForm.name} onChange={function(v) { setCreateForm(Object.assign({}, createForm, { name: typeof v === 'string' ? v : v.target.value })) }} placeholder="Weekly Clash #1" />
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Date & Time</label>
              <Inp type="datetime-local" value={createForm.date} onChange={function(v) { setCreateForm(Object.assign({}, createForm, { date: typeof v === 'string' ? v : v.target.value })) }} />
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Max Players</label>
              <Inp type="number" value={createForm.maxPlayers} onChange={function(v) { setCreateForm(Object.assign({}, createForm, { maxPlayers: typeof v === 'string' ? v : v.target.value })) }} />
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Round Count</label>
              <Inp type="number" value={createForm.roundCount} onChange={function(v) { setCreateForm(Object.assign({}, createForm, { roundCount: typeof v === 'string' ? v : v.target.value })) }} />
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Type</label>
              <Sel value={createForm.type} onChange={function(v) { setCreateForm(Object.assign({}, createForm, { type: v })) }}>
                <option value="season_clash">Season Clash</option>
                <option value="flash_tournament">Flash Tournament</option>
              </Sel>
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Seeding</label>
              <Sel value={createForm.seedingMethod} onChange={function(v) { setCreateForm(Object.assign({}, createForm, { seedingMethod: v })) }}>
                <option value="random">Random</option>
                <option value="rank-based">Rank-Based</option>
                <option value="snake">Snake</option>
              </Sel>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Btn v="primary" onClick={createTournament}>Create Tournament</Btn>
            <Btn v="dark" onClick={function() { setView('list') }}>Cancel</Btn>
          </div>
        </Panel>
      </div>
    )
  }

  // List view (default)
  return (
    <div className="space-y-5">
      {/* Weekly Clash Phase Control */}
      <Panel>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Icon name="calendar_month" size={16} className="text-primary" />
            <span className="font-bold text-sm text-on-surface">Weekly Clash Phase Control</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border border-outline-variant/20 rounded overflow-hidden">
              {['EU', 'NA'].map(function(r) {
                var active = region === r
                return (
                  <button key={r} type="button" onClick={function() { setRegion(r) }}
                    className={'px-3 py-1 text-[11px] font-bold uppercase tracking-wider ' + (active ? 'bg-primary/10 text-primary' : 'text-on-surface/40 hover:bg-white/5')}>
                    {r}
                  </button>
                )
              })}
            </div>
            <span className={'px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded ' + (PHASE_COLORS[currentPhase] || 'bg-on-surface/10 text-on-surface/40')}>
              {PHASE_LABELS[currentPhase] || currentPhase || 'IDLE'}
            </span>
          </div>
        </div>
        <div className="mb-4">
          <div className="flex items-center gap-0">
            {PHASE_STEPS.map(function(phase, i) {
              var isActive = phase === currentPhase
              var isDone = currentPhaseIdx > i
              return (
                <div key={phase} className="flex items-center flex-1">
                  <div className={'flex-1 text-center text-[10px] font-bold uppercase tracking-wider py-2 border ' + (isActive ? 'bg-primary/10 border-primary text-primary' : isDone ? 'bg-success/10 border-success/30 text-success' : 'bg-surface-container border-outline-variant/10 text-on-surface/40')}>
                    {PHASE_LABELS[phase]}
                  </div>
                  {i < PHASE_STEPS.length - 1 && <div className="w-3 h-px bg-outline-variant/20 flex-shrink-0" />}
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn v="primary" s="sm" onClick={function() { setWeeklyPhase('registration') }}>Open Registration</Btn>
          <Btn v="primary" s="sm" onClick={function() { setWeeklyPhase('checkin') }}>Open Check-in</Btn>
          <Btn v="primary" s="sm" onClick={function() { setWeeklyPhase('inprogress') }}>Go Live</Btn>
          <Btn v="dark" s="sm" onClick={function() { setWeeklyPhase('complete') }}>Mark Complete</Btn>
          <Btn v="dark" s="sm" onClick={function() {
            if (!window.confirm('Reset to idle? This clears all check-ins.')) return
            setWeeklyPhase('idle')
          }}>Reset to Idle</Btn>
        </div>
      </Panel>

      {/* Tournament List */}
      <Panel className="!p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Icon name="emoji_events" size={18} className="text-primary" />
            <span className="font-label text-xs font-bold uppercase tracking-widest text-on-surface/60">
              All Tournaments ({visibleTournaments.length}{archivedCount > 0 ? ' / ' + tournaments.length : ''})
            </span>
          </div>
          <div className="flex items-center gap-2">
            {archivedCount > 0 && (
              <button type="button" onClick={function() { setShowArchived(!showArchived) }} className={'inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-label font-bold uppercase tracking-widest rounded border transition-colors ' + (showArchived ? 'border-on-surface/30 text-on-surface bg-on-surface/5' : 'border-outline-variant/20 text-on-surface/50 hover:text-on-surface hover:border-outline-variant/40')}>
                <Icon name={showArchived ? 'visibility_off' : 'visibility'} size={12} />
                {showArchived ? 'Hide archived' : 'Show archived (' + archivedCount + ')'}
              </button>
            )}
            <Btn v="primary" s="sm" onClick={function() { setView('create') }}>
              <Icon name="add" size={14} /> New Tournament
            </Btn>
          </div>
        </div>
        {visibleTournaments.length === 0 ? (
          <div className="py-12 text-center text-on-surface/20 text-xs font-label uppercase tracking-widest">
            {tournaments.length === 0 ? 'No tournaments yet. Create your first one!' : 'No tournaments match the current filter.'}
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            {visibleTournaments.map(function(t) {
              var appPhase = fromDbPhase(t.phase)
              var badge = PHASE_COLORS[appPhase] || 'bg-on-surface/10 text-on-surface/40'
              var regCount = regCounts[t.id] || 0
              var hasCut = t.cut_line && t.cut_line > 0
              var isArchived = !!t.archived_at
              var canBroadcast = appPhase === 'registration' || appPhase === 'checkin' || appPhase === 'inprogress'
              return (
                <div key={t.id} className={'flex items-center gap-3 py-3 px-5 border-b border-outline-variant/5 last:border-0 transition-colors ' + (isArchived ? 'opacity-60 hover:bg-white/[0.01]' : 'hover:bg-white/[0.02]')}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-on-surface truncate flex items-center gap-1.5 flex-wrap">
                      <span>{t.name || 'Unnamed'}</span>
                      {isArchived && (
                        <span className="text-[9px] font-label font-black uppercase tracking-widest text-on-surface/50 bg-on-surface/5 border border-outline-variant/20 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                          <Icon name="inventory_2" size={9} />Archived
                        </span>
                      )}
                      {hasCut && (
                        <span className="text-[9px] font-label font-black uppercase tracking-widest text-primary bg-primary/10 border border-primary/30 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                          <Icon name="content_cut" size={9} />cut {t.cut_line} after R{t.cut_after_game}
                        </span>
                      )}
                    </div>
                    <div className="font-label text-[10px] text-on-surface/30 uppercase tracking-wider mt-0.5">
                      {t.date ? new Date(t.date).toLocaleDateString() : 'TBD'} {t.region ? '/ ' + t.region : ''} / {t.type || 'season_clash'}{t.round_count ? ' / ' + t.round_count + 'g' : ''}
                    </div>
                  </div>
                  <div className="font-mono text-xs text-on-surface/50">{regCount}/{t.max_players || '?'}</div>
                  <span className={'px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded ' + badge}>
                    {PHASE_LABELS[appPhase] || (appPhase || 'draft').toUpperCase()}
                  </span>
                  <div className="flex items-center gap-1">
                    {appPhase && appPhase !== 'complete' && !isArchived && (
                      <Btn v="ghost" s="sm" onClick={function() { advancePhase(t.id, t.phase) }} title="Advance phase">
                        <Icon name="skip_next" size={14} className="text-tertiary" />
                      </Btn>
                    )}
                    {canBroadcast && !isArchived && (
                      <Btn v="ghost" s="sm" onClick={function() { openBroadcast(t) }} title="Broadcast announcement">
                        <Icon name="campaign" size={14} className="text-secondary" />
                      </Btn>
                    )}
                    <Btn v="ghost" s="sm" onClick={function() { setEditTournament(Object.assign({}, t)); loadRegistrations(t.id) }} title="Edit">
                      <Icon name="edit" size={14} />
                    </Btn>
                    <Btn v="ghost" s="sm" onClick={function() { navigate('/tournament/' + t.id) }} title="View">
                      <Icon name="open_in_new" size={14} />
                    </Btn>
                    {isArchived ? (
                      <Btn v="ghost" s="sm" onClick={function() { unarchiveTournament(t) }} title="Restore from archive">
                        <Icon name="unarchive" size={14} className="text-tertiary" />
                      </Btn>
                    ) : (
                      <Btn v="ghost" s="sm" onClick={function() { archiveTournament(t) }} title="Archive (hide from feeds)">
                        <Icon name="inventory_2" size={14} className="text-on-surface/60" />
                      </Btn>
                    )}
                    <Btn v="ghost" s="sm" onClick={function() { deleteTournament(t.id, t.name) }} title="Delete">
                      <Icon name="delete" size={14} className="text-error" />
                    </Btn>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      {broadcast.target && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={function(e) { if (e.target === e.currentTarget) closeBroadcast() }}>
          <div className="bg-surface-container border border-outline-variant/30 rounded-xl shadow-2xl max-w-lg w-full p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-secondary/20 border border-secondary/30 flex items-center justify-center flex-shrink-0">
                  <Icon name="campaign" size={16} className="text-secondary" />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-sm font-black uppercase tracking-tight text-on-surface truncate">Broadcast</div>
                  <div className="text-[11px] text-on-surface/60 truncate">to {broadcast.target.name}</div>
                </div>
              </div>
              <button type="button" onClick={closeBroadcast} className="w-8 h-8 rounded flex items-center justify-center text-on-surface/40 hover:text-on-surface hover:bg-surface-container-highest transition-colors">
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="text-[11px] text-on-surface/50 mb-2">Sends a push notification to all registered + checked-in players for this tournament. Max 200 chars.</div>
            <textarea
              value={broadcast.message}
              onChange={function(e) { setBroadcast(Object.assign({}, broadcast, { message: e.target.value })) }}
              maxLength={200}
              rows={4}
              autoFocus
              placeholder="e.g. Lobby 3, please move to the new server. Apologies for the delay!"
              className="w-full bg-surface border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface placeholder-on-surface/30 focus:outline-none focus:border-secondary/60 resize-none"
            />
            <div className="flex items-center justify-between mt-3 gap-2">
              <span className="text-[10px] font-mono text-on-surface/40">{broadcast.message.length}/200</span>
              <div className="flex items-center gap-2">
                <Btn v="dark" s="sm" onClick={closeBroadcast} disabled={broadcast.sending}>Cancel</Btn>
                <Btn v="primary" s="sm" onClick={sendBroadcast} disabled={broadcast.sending || !broadcast.message.trim()}>
                  {broadcast.sending ? 'Sending...' : 'Send Announcement'}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
