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

  var _createForm = useState({ name: '', date: '', maxPlayers: '24', roundCount: '3', type: 'season_clash', seedingMethod: 'rank-based' })
  var createForm = _createForm[0]
  var setCreateForm = _createForm[1]

  var _registrations = useState([])
  var registrations = _registrations[0]
  var setRegistrations = _registrations[1]

  var _regLoading = useState(false)
  var regLoading = _regLoading[0]
  var setRegLoading = _regLoading[1]

  // Weekly clash phase control
  var ts = tournamentState || {}
  var currentPhase = ts.phase || 'idle'
  var currentPhaseIdx = PHASE_STEPS.indexOf(currentPhase)

  function addAudit(type, msg) { sharedAddAudit(supabase, currentUser, type, msg) }

  function setWeeklyPhase(phase) {
    setTournamentState(function(s) { return Object.assign({}, s, { phase: phase }) })
    supabase.from('site_settings').upsert({ key: 'tournament_state', value: JSON.stringify(Object.assign({}, ts, { phase: phase })) }, { onConflict: 'key' })
      .then(function() {}).catch(function() {})
    addAudit('ACTION', 'Weekly clash phase set to: ' + phase)
    toast('Phase: ' + (PHASE_LABELS[phase] || phase), 'success')
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon name="calendar_month" size={16} className="text-primary" />
            <span className="font-bold text-sm text-on-surface">Weekly Clash Phase Control</span>
          </div>
          <span className={'px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded ' + (PHASE_COLORS[currentPhase] || 'bg-on-surface/10 text-on-surface/40')}>
            {PHASE_LABELS[currentPhase] || currentPhase || 'IDLE'}
          </span>
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
        <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="emoji_events" size={18} className="text-primary" />
            <span className="font-label text-xs font-bold uppercase tracking-widest text-on-surface/60">
              All Tournaments ({tournaments.length})
            </span>
          </div>
          <Btn v="primary" s="sm" onClick={function() { setView('create') }}>
            <Icon name="add" size={14} /> New Tournament
          </Btn>
        </div>
        {tournaments.length === 0 ? (
          <div className="py-12 text-center text-on-surface/20 text-xs font-label uppercase tracking-widest">
            No tournaments yet. Create your first one!
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            {tournaments.map(function(t) {
              var appPhase = fromDbPhase(t.phase)
              var badge = PHASE_COLORS[appPhase] || 'bg-on-surface/10 text-on-surface/40'
              var regCount = regCounts[t.id] || 0
              return (
                <div key={t.id} className="flex items-center gap-3 py-3 px-5 border-b border-outline-variant/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-on-surface truncate">{t.name || 'Unnamed'}</div>
                    <div className="font-label text-[10px] text-on-surface/30 uppercase tracking-wider mt-0.5">
                      {t.date ? new Date(t.date).toLocaleDateString() : 'TBD'} {t.region ? '/ ' + t.region : ''} / {t.type || 'season_clash'}
                    </div>
                  </div>
                  <div className="font-mono text-xs text-on-surface/50">{regCount}/{t.max_players || '?'}</div>
                  <span className={'px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded ' + badge}>
                    {PHASE_LABELS[appPhase] || (appPhase || 'draft').toUpperCase()}
                  </span>
                  <div className="flex items-center gap-1">
                    {appPhase && appPhase !== 'complete' && (
                      <Btn v="ghost" s="sm" onClick={function() { advancePhase(t.id, t.phase) }} title="Advance phase">
                        <Icon name="skip_next" size={14} className="text-tertiary" />
                      </Btn>
                    )}
                    <Btn v="ghost" s="sm" onClick={function() { setEditTournament(Object.assign({}, t)); loadRegistrations(t.id) }} title="Edit">
                      <Icon name="edit" size={14} />
                    </Btn>
                    <Btn v="ghost" s="sm" onClick={function() { navigate('/tournament/' + t.id) }} title="View">
                      <Icon name="open_in_new" size={14} />
                    </Btn>
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
    </div>
  )
}
