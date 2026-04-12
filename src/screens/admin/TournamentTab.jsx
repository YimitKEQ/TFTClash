import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase.js'
import { Panel, Btn, Inp, Icon, Sel } from '../../components/ui'

var PHASE_STEPS = ['registration', 'checkin', 'inprogress', 'complete']
var PHASE_LABELS = { registration: 'Registration', checkin: 'Check-in', inprogress: 'Live', complete: 'Complete' }

export default function TournamentTab() {
  var ctx = useApp()
  var tournamentState = ctx.tournamentState
  var setTournamentState = ctx.setTournamentState
  var scheduledEvents = ctx.scheduledEvents
  var setScheduledEvents = ctx.setScheduledEvents
  var setAuditLog = ctx.setAuditLog
  var currentUser = ctx.currentUser
  var toast = ctx.toast

  var _clashForm = useState({ name: 'Weekly Clash', date: '', time: '', countdownIso: '', server: 'EU' })
  var clashForm = _clashForm[0]
  var setClashForm = _clashForm[1]

  var _roundConfig = useState({ maxPlayers: '24', roundCount: '3', checkinWindowMins: '30', cutLine: '0', cutAfterGame: '0' })
  var roundConfig = _roundConfig[0]
  var setRoundConfig = _roundConfig[1]

  var _seedAlgo = useState('rank-based')
  var seedAlgo = _seedAlgo[0]
  var setSeedAlgo = _seedAlgo[1]

  var _newEvent = useState({ name: '', type: 'SCHEDULED', date: '', time: '', cap: '8', format: 'Swiss' })
  var newEvent = _newEvent[0]
  var setNewEvent = _newEvent[1]

  var _flashForm = useState({ name: 'Flash Tournament', date: '', maxPlayers: '128', gameCount: '3', formatPreset: 'standard', seedingMethod: 'snake', prizeRows: [{ placement: '1', prize: '' }] })
  var flashForm = _flashForm[0]
  var setFlashForm = _flashForm[1]

  var _flashTournaments = useState([])
  var flashTournaments = _flashTournaments[0]
  var setFlashTournaments = _flashTournaments[1]

  useEffect(function() {
    supabase.from('tournaments').select('id, name, date, phase, type').eq('type', 'flash_tournament').order('date', { ascending: false }).limit(20).then(function(res) {
      if (res.data) setFlashTournaments(res.data)
    }).catch(function() {})
  }, [])

  function addAudit(type, msg) {
    var entry = { ts: Date.now(), type: type, msg: msg }
    setAuditLog(function(l) { return [entry].concat(l.slice(0, 199)) })
    if (supabase.from && currentUser) {
      supabase.from('audit_log').insert({
        action: type, actor_id: currentUser.id || null,
        actor_name: currentUser.username || currentUser.email || 'Admin',
        target_type: 'admin_action', details: { message: msg, timestamp: entry.ts }
      }).then(function(r) { }).catch(function() {})
    }
  }

  var ts = tournamentState || {}
  var currentPhase = ts.phase || 'registration'
  var currentPhaseIdx = PHASE_STEPS.indexOf(currentPhase)

  function setPhase(phase) {
    setTournamentState(function(s) { return Object.assign({}, s, { phase: phase }) })
    var tId = ts.activeTournamentId || ts.dbTournamentId
    if (tId) {
      supabase.from('tournaments').update({ phase: phase }).eq('id', tId).then(function(r) {
        if (r.error) toast('DB phase update failed: ' + r.error.message, 'error')
      }).catch(function() { toast('DB phase update failed', 'error') })
    }
    addAudit('ACTION', 'Phase set to: ' + phase)
    toast('Phase: ' + PHASE_LABELS[phase], 'success')
  }

  function openCheckin() {
    if (currentPhase !== 'registration') { toast('Must be in Registration phase first', 'error'); return }
    if (!window.confirm('Open check-in? Players will be notified to confirm attendance.')) return
    setPhase('checkin')
  }

  function startTournament() {
    if (currentPhase !== 'checkin') { toast('Must be in Check-in phase first', 'error'); return }
    if (!window.confirm('Start the tournament? This will lock registrations and begin the first round.')) return
    setPhase('inprogress')
  }

  function resetToRegistration() {
    if (!window.confirm('Reset tournament to Registration? This will clear check-ins.')) return
    setTournamentState(function(s) { return Object.assign({}, s, { phase: 'registration', checkedInIds: [], round: 1 }) })
    supabase.from('players').update({ checked_in: false }).then(function(r) { }).catch(function() {})
    addAudit('WARN', 'Tournament reset to Registration')
    toast('Reset to Registration', 'success')
  }

  function addScheduledEvent() {
    if (!newEvent.name.trim() || !newEvent.date.trim()) { toast('Name and date required', 'error'); return }
    var ev = {
      id: Date.now(),
      name: newEvent.name.trim(), type: newEvent.type, date: newEvent.date,
      time: newEvent.time, cap: parseInt(newEvent.cap) || 8, format: newEvent.format || 'Swiss'
    }
    setScheduledEvents(function(evs) { return (evs || []).concat([ev]) })
    addAudit('ACTION', 'Scheduled event added: ' + ev.name)
    toast('Event scheduled!', 'success')
    setNewEvent({ name: '', type: 'SCHEDULED', date: '', time: '', cap: '8', format: 'Swiss' })
  }

  function cancelScheduledEvent(id) {
    if (!window.confirm('Cancel this event?')) return
    setScheduledEvents(function(evs) { return (evs || []).filter(function(e) { return e.id !== id }) })
    addAudit('ACTION', 'Scheduled event cancelled: #' + id)
    toast('Event cancelled', 'success')
  }

  function createFlashTournament() {
    if (!flashForm.name.trim()) { toast('Tournament name required', 'error'); return }
    if (!flashForm.date) { toast('Date/time required', 'error'); return }
    var prizePool = flashForm.prizeRows.filter(function(r) { return r.prize.trim() }).map(function(r) { return { placement: parseInt(r.placement), prize: r.prize.trim() } })
    supabase.from('tournaments').insert({
      name: flashForm.name.trim(), date: flashForm.date, phase: 'draft', type: 'flash_tournament',
      max_players: parseInt(flashForm.maxPlayers) || 128, round_count: parseInt(flashForm.gameCount) || 3,
      seeding_method: flashForm.seedingMethod || 'snake', prize_pool_json: prizePool.length > 0 ? prizePool : null,
      lobby_host_method: 'random'
    }).select().single().then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return }
      setFlashTournaments(function(ts) { return (ts || []).concat([res.data]) })
      addAudit('ACTION', 'Flash tournament created: ' + flashForm.name.trim())
      toast('Flash tournament created!', 'success')
      setFlashForm({ name: 'Flash Tournament', date: '', maxPlayers: '128', gameCount: '3', formatPreset: 'standard', seedingMethod: 'snake', prizeRows: [{ placement: '1', prize: '' }] })
    }).catch(function() { toast('Failed to create tournament', 'error') })
  }

  return (
    <div className="p-4 md:p-6 space-y-6">

      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="calendar_month" size={16} className="text-primary" />
          <span className="font-bold text-sm text-on-surface">Weekly Clash</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Name</label>
            <Inp value={clashForm.name} onChange={function(v) { setClashForm(Object.assign({}, clashForm, { name: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Date (display)</label>
            <Inp value={clashForm.date} onChange={function(v) { setClashForm(Object.assign({}, clashForm, { date: typeof v === 'string' ? v : v.target.value })) }} placeholder="Saturday, March 29" />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Time (display)</label>
            <Inp value={clashForm.time} onChange={function(v) { setClashForm(Object.assign({}, clashForm, { time: typeof v === 'string' ? v : v.target.value })) }} placeholder="8:00 PM CET" />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Countdown ISO</label>
            <Inp type="datetime-local" value={clashForm.countdownIso} onChange={function(v) { setClashForm(Object.assign({}, clashForm, { countdownIso: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Server</label>
            <Sel value={clashForm.server} onChange={function(v) { setClashForm(Object.assign({}, clashForm, { server: v })) }}>
              <option value="EU">EU</option>
              <option value="NA">NA</option>
            </Sel>
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
          <Btn variant="primary" size="sm" onClick={openCheckin} disabled={currentPhase !== 'registration'}>Open Check-in</Btn>
          <Btn variant="primary" size="sm" onClick={startTournament} disabled={currentPhase !== 'checkin'}>Start Tournament</Btn>
          <Btn variant="ghost" size="sm" onClick={function() { setPhase('complete') }} disabled={currentPhase !== 'inprogress'}>Mark Complete</Btn>
          <Btn variant="secondary" size="sm" onClick={resetToRegistration}>Reset to Registration</Btn>
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="tune" size={16} className="text-secondary" />
          <span className="font-bold text-sm text-on-surface">Round Config</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Max Players</label>
            <Inp type="number" value={roundConfig.maxPlayers} onChange={function(v) { setRoundConfig(Object.assign({}, roundConfig, { maxPlayers: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Round Count</label>
            <Inp type="number" value={roundConfig.roundCount} onChange={function(v) { setRoundConfig(Object.assign({}, roundConfig, { roundCount: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Check-in Window (min)</label>
            <Inp type="number" value={roundConfig.checkinWindowMins} onChange={function(v) { setRoundConfig(Object.assign({}, roundConfig, { checkinWindowMins: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Cut Line</label>
            <Inp type="number" value={roundConfig.cutLine} onChange={function(v) { setRoundConfig(Object.assign({}, roundConfig, { cutLine: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Cut After Game</label>
            <Inp type="number" value={roundConfig.cutAfterGame} onChange={function(v) { setRoundConfig(Object.assign({}, roundConfig, { cutAfterGame: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Seeding</label>
            <Sel value={seedAlgo} onChange={setSeedAlgo}>
              <option value="random">Random</option>
              <option value="rank-based">Rank-Based</option>
              <option value="snake">Snake</option>
              <option value="anti-stack">Anti-Stack</option>
            </Sel>
          </div>
        </div>
        <Btn variant="secondary" size="sm" onClick={function() {
          setTournamentState(function(s) { return Object.assign({}, s, { maxPlayers: parseInt(roundConfig.maxPlayers) || 24, roundCount: parseInt(roundConfig.roundCount) || 3, seedingMethod: seedAlgo }) })
          addAudit('ACTION', 'Round config updated')
          toast('Round config saved', 'success')
        }}>Save Config</Btn>
      </Panel>

      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="event_available" size={16} className="text-tertiary" />
          <span className="font-bold text-sm text-on-surface">Schedule Events</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Name</label>
            <Inp value={newEvent.name} onChange={function(v) { setNewEvent(Object.assign({}, newEvent, { name: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Date</label>
            <Inp value={newEvent.date} onChange={function(v) { setNewEvent(Object.assign({}, newEvent, { date: typeof v === 'string' ? v : v.target.value })) }} placeholder="March 29" />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Time</label>
            <Inp value={newEvent.time} onChange={function(v) { setNewEvent(Object.assign({}, newEvent, { time: typeof v === 'string' ? v : v.target.value })) }} placeholder="8:00 PM" />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Cap</label>
            <Inp type="number" value={newEvent.cap} onChange={function(v) { setNewEvent(Object.assign({}, newEvent, { cap: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Format</label>
            <Inp value={newEvent.format} onChange={function(v) { setNewEvent(Object.assign({}, newEvent, { format: typeof v === 'string' ? v : v.target.value })) }} placeholder="Swiss" />
          </div>
        </div>
        <Btn variant="primary" size="sm" onClick={addScheduledEvent}>Schedule Event</Btn>
        {(scheduledEvents || []).length > 0 && (
          <div className="mt-4 space-y-1.5">
            {(scheduledEvents || []).map(function(ev) {
              return (
                <div key={ev.id} className="flex items-center gap-2 px-3 py-2 bg-surface-container border border-outline-variant/10 rounded-sm">
                  <Icon name="event" size={14} className="text-on-surface/40 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-on-surface">{ev.name}</div>
                    <div className="text-[11px] text-on-surface/40">{ev.date + (ev.time ? ' - ' + ev.time : '')}</div>
                  </div>
                  <Btn variant="ghost" size="sm" onClick={function() { cancelScheduledEvent(ev.id) }}>Cancel</Btn>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="emoji_events" size={16} className="text-primary" />
          <span className="font-bold text-sm text-on-surface">Custom Tournaments</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Name</label>
            <Inp value={flashForm.name} onChange={function(v) { setFlashForm(Object.assign({}, flashForm, { name: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Date & Time</label>
            <Inp type="datetime-local" value={flashForm.date} onChange={function(v) { setFlashForm(Object.assign({}, flashForm, { date: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Max Players</label>
            <Inp type="number" value={flashForm.maxPlayers} onChange={function(v) { setFlashForm(Object.assign({}, flashForm, { maxPlayers: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Game Count</label>
            <Inp type="number" value={flashForm.gameCount} onChange={function(v) { setFlashForm(Object.assign({}, flashForm, { gameCount: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Format</label>
            <Sel value={flashForm.formatPreset} onChange={function(v) { setFlashForm(Object.assign({}, flashForm, { formatPreset: v })) }}>
              <option value="casual">Casual</option>
              <option value="standard">Standard</option>
              <option value="competitive">Competitive</option>
            </Sel>
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Seeding</label>
            <Sel value={flashForm.seedingMethod} onChange={function(v) { setFlashForm(Object.assign({}, flashForm, { seedingMethod: v })) }}>
              <option value="snake">Snake</option>
              <option value="random">Random</option>
              <option value="rank-based">Rank-Based</option>
            </Sel>
          </div>
        </div>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] text-on-surface/60 font-bold uppercase tracking-wider">Prize Pool</label>
            <Btn variant="secondary" size="sm" onClick={function() { setFlashForm(Object.assign({}, flashForm, { prizeRows: flashForm.prizeRows.concat([{ placement: String(flashForm.prizeRows.length + 1), prize: '' }]) })) }}>+ Add</Btn>
          </div>
          {flashForm.prizeRows.map(function(row, idx) {
            return (
              <div key={row.placement} className="flex gap-2 mb-1.5 items-center">
                <div className="text-xs text-secondary font-bold w-7 text-center">#{row.placement}</div>
                <div className="flex-1">
                  <Inp value={row.prize} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; var updated = flashForm.prizeRows.map(function(r, i) { return i === idx ? Object.assign({}, r, { prize: val }) : r }); setFlashForm(Object.assign({}, flashForm, { prizeRows: updated })) }} placeholder="e.g. $50, RP, Skin code" />
                </div>
                {flashForm.prizeRows.length > 1 && <Btn variant="ghost" size="sm" onClick={function() { setFlashForm(Object.assign({}, flashForm, { prizeRows: flashForm.prizeRows.filter(function(_, i) { return i !== idx }) })) }}>X</Btn>}
              </div>
            )
          })}
        </div>
        <Btn variant="primary" onClick={createFlashTournament}>Create Tournament</Btn>
        {flashTournaments.length > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="text-[11px] text-on-surface/40 font-bold uppercase tracking-wider mb-2">Existing ({flashTournaments.length})</div>
            {flashTournaments.map(function(t) {
              return (
                <div key={t.id} className="flex items-center gap-2 px-3 py-2 bg-surface-container border border-outline-variant/10 rounded-sm">
                  <Icon name="bolt" size={14} className="text-on-surface/40 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-on-surface">{t.name}</div>
                    <div className="text-[11px] text-on-surface/40">{t.date ? new Date(t.date).toLocaleDateString() : 'TBD'} - <span className="uppercase font-bold">{t.phase || 'draft'}</span></div>
                  </div>
                  {t.phase === 'draft' && (
                    <Btn variant="ghost" size="sm" onClick={function() {
                      supabase.from('tournaments').update({ phase: 'registration' }).eq('id', t.id).then(function(r) {
                        if (r.error) { toast('Failed: ' + r.error.message, 'error'); return }
                        setFlashTournaments(function(ts) { return ts.map(function(x) { return x.id === t.id ? Object.assign({}, x, { phase: 'registration' }) : x }) })
                        addAudit('ACTION', 'Flash tournament registration opened: ' + t.name)
                        toast('Registration opened!', 'success')
                      }).catch(function() { toast('Failed to open registration', 'error') })
                    }}>Open Reg</Btn>
                  )}
                  <Btn variant="ghost" size="sm" onClick={function() {
                    if (!window.confirm('Delete ' + t.name + '?')) return
                    supabase.from('tournaments').delete().eq('id', t.id).then(function(r) {
                      if (r.error) { toast('Failed: ' + r.error.message, 'error'); return }
                      setFlashTournaments(function(ts) { return ts.filter(function(x) { return x.id !== t.id }) })
                      addAudit('ACTION', 'Tournament deleted: ' + t.name)
                      toast('Deleted', 'success')
                    }).catch(function() { toast('Delete failed', 'error') })
                  }}>Del</Btn>
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}
