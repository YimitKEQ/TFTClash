import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase.js'
import { Panel, Btn, Inp, Icon, Sel } from '../../components/ui'
import { TOURNAMENT_FORMATS } from '../../lib/tournament.js'

// Rough duration: ~18 min per TFT game + 5 min lobby/room setup between games.
function estimateDurationMinutes(games) {
  var g = parseInt(games, 10) || 0
  if (g <= 0) return 0
  return g * 18 + Math.max(0, g - 1) * 5
}

function formatDuration(mins) {
  if (!mins) return ''
  var h = Math.floor(mins / 60)
  var m = mins % 60
  if (h <= 0) return m + ' min'
  if (m === 0) return h + 'h'
  return h + 'h ' + m + 'm'
}

var PHASE_STEPS = ['registration', 'checkin', 'inprogress', 'complete']
var PHASE_LABELS = { registration: 'Registration', checkin: 'Check-in', inprogress: 'Live', complete: 'Complete' }
var WEEKLY_CLASH_TYPE = 'season_clash'

// Map app phase names → DB tournaments.phase enum values.
function toDbPhase(phase) {
  if (phase === 'checkin') return 'check_in'
  if (phase === 'inprogress') return 'in_progress'
  return phase
}

export default function TournamentTab() {
  var ctx = useApp()
  var tournamentState = ctx.tournamentState
  var setTournamentState = ctx.setTournamentState
  var scheduledEvents = ctx.scheduledEvents
  var setScheduledEvents = ctx.setScheduledEvents
  var setAuditLog = ctx.setAuditLog
  var currentUser = ctx.currentUser
  var toast = ctx.toast

  // Convert an ISO timestamp to the value format datetime-local expects (YYYY-MM-DDTHH:mm in local time)
  function isoToLocalInput(iso) {
    if (!iso) return ''
    var d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    var pad = function(n) { return n < 10 ? '0' + n : '' + n }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  }

  var initialClashLocal = isoToLocalInput((tournamentState && tournamentState.clashTimestamp) || '')
  var initialPrizePool = (tournamentState && Array.isArray(tournamentState.prizePool) && tournamentState.prizePool.length > 0)
    ? tournamentState.prizePool.map(function(r) { return { placement: String(r.placement || ''), prize: String(r.prize || ''), image: String(r.image || '') } })
    : [{ placement: '1', prize: '', image: '' }, { placement: '2', prize: '', image: '' }, { placement: '3', prize: '', image: '' }]
  var _clashForm = useState({
    name: (tournamentState && tournamentState.clashName) || 'Weekly Clash',
    clashLocal: initialClashLocal,
    server: (tournamentState && tournamentState.server) || 'EU',
    isFinale: !!(tournamentState && tournamentState.isFinale),
    rulesOverride: (tournamentState && tournamentState.rulesOverride) || '',
    prizeRows: initialPrizePool
  })
  var clashForm = _clashForm[0]
  var setClashForm = _clashForm[1]
  var _clashSaving = useState(false)
  var clashSaving = _clashSaving[0]
  var setClashSaving = _clashSaving[1]

  var _clashNumberInput = useState('')
  var clashNumberInput = _clashNumberInput[0]
  var setClashNumberInput = _clashNumberInput[1]

  var _opening = useState(false)
  var opening = _opening[0]
  var setOpening = _opening[1]

  var _roundConfig = useState({ maxPlayers: '24', roundCount: '3', checkinWindowMins: '30', cutLine: '0', cutAfterGame: '0' })
  var roundConfig = _roundConfig[0]
  var setRoundConfig = _roundConfig[1]

  var _formatPreset = useState('weekly')
  var formatPreset = _formatPreset[0]
  var setFormatPreset = _formatPreset[1]

  var _seedAlgo = useState('rank-based')
  var seedAlgo = _seedAlgo[0]
  var setSeedAlgo = _seedAlgo[1]

  function applyFormatPreset(key) {
    setFormatPreset(key)
    if (key === 'custom') return
    var f = TOURNAMENT_FORMATS[key]
    if (!f) return
    setRoundConfig(function(c) {
      return Object.assign({}, c, {
        maxPlayers: String(f.maxPlayers),
        roundCount: String(f.games),
        cutLine: String(f.cutLine || 0),
        cutAfterGame: String(f.cutAfterGame || 0)
      })
    })
    if (f.seeding) setSeedAlgo(f.seeding)
  }

  var _newEvent = useState({ name: '', type: 'SCHEDULED', whenLocal: '', cap: '8', format: 'Swiss' })
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

  function buildPrizePool(rows) {
    if (!rows || !rows.length) return []
    return rows
      .filter(function(r) { return r && ((r.prize && r.prize.trim()) || (r.image && r.image.trim())) })
      .map(function(r) {
        var place = parseInt(r.placement, 10)
        var entry = { placement: Number.isFinite(place) && place > 0 ? place : 1, prize: (r.prize || '').trim() }
        if (r.image && r.image.trim()) entry.image = r.image.trim()
        return entry
      })
      .sort(function(a, b) { return a.placement - b.placement })
  }

  var _prizeSaving = useState(false)
  var prizeSaving = _prizeSaving[0]
  var setPrizeSaving = _prizeSaving[1]
  var _uploadingIdx = useState(-1)
  var uploadingIdx = _uploadingIdx[0]
  var setUploadingIdx = _uploadingIdx[1]

  function uploadPrizeImage(file, idx) {
    if (!file || !supabase.storage) { toast('Image upload unavailable', 'error'); return }
    if (!file.type || file.type.indexOf('image/') !== 0) { toast('File must be an image', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return }
    setUploadingIdx(idx)
    var ext = (file.name.split('.').pop() || 'png').toLowerCase()
    var tId = (tournamentState && (tournamentState.activeTournamentId || tournamentState.dbTournamentId)) || 'draft'
    var place = (clashForm.prizeRows[idx] && clashForm.prizeRows[idx].placement) || (idx + 1)
    var path = 'prizes/' + tId + '/' + place + '-' + Date.now() + '.' + ext
    supabase.storage.from('host-assets').upload(path, file, { cacheControl: '3600', upsert: true }).then(function(res) {
      if (res.error) { setUploadingIdx(-1); toast('Upload failed: ' + res.error.message, 'error'); return }
      var url = supabase.storage.from('host-assets').getPublicUrl(path).data.publicUrl
      setClashForm(function(f) {
        var updated = f.prizeRows.map(function(r, i) { return i === idx ? Object.assign({}, r, { image: url }) : r })
        return Object.assign({}, f, { prizeRows: updated })
      })
      setUploadingIdx(-1)
      toast('Image uploaded - remember to Save Prizes', 'success')
    }).catch(function() { setUploadingIdx(-1); toast('Upload failed', 'error') })
  }

  function savePrizesOnly() {
    if (prizeSaving) return
    setPrizeSaving(true)
    var prizePool = buildPrizePool(clashForm.prizeRows)
    setTournamentState(function(s) { return Object.assign({}, s, { prizePool: prizePool }) })
    var tId = (tournamentState && (tournamentState.activeTournamentId || tournamentState.dbTournamentId)) || null
    if (tId && supabase.from) {
      supabase.from('tournaments').update({
        prize_pool_json: prizePool.length > 0 ? prizePool : null
      }).eq('id', tId).then(function(r) {
        setPrizeSaving(false)
        if (r.error) { toast('DB update failed: ' + r.error.message, 'error'); return }
        addAudit('ACTION', 'Prize pool saved (' + prizePool.length + ' tier' + (prizePool.length === 1 ? '' : 's') + ')')
        toast('Prizes saved', 'success')
      }).catch(function() { setPrizeSaving(false); toast('DB update failed', 'error') })
    } else {
      setPrizeSaving(false)
      addAudit('ACTION', 'Prize pool saved to state (no active clash)')
      toast(tId ? 'Prizes saved' : 'Prizes saved to draft (open a clash to persist)', 'success')
    }
  }

  function saveClashSchedule() {
    if (clashSaving) return
    if (!clashForm.clashLocal) { toast('Pick a date and time first', 'error'); return }
    var d = new Date(clashForm.clashLocal)
    if (isNaN(d.getTime())) { toast('Invalid date/time', 'error'); return }
    setClashSaving(true)
    var iso = d.toISOString()
    var prizePool = buildPrizePool(clashForm.prizeRows)
    var rulesText = (clashForm.rulesOverride || '').trim()
    setTournamentState(function(s) {
      return Object.assign({}, s, {
        clashTimestamp: iso,
        clashName: clashForm.name || 'Weekly Clash',
        server: clashForm.server || 'EU',
        isFinale: !!clashForm.isFinale,
        rulesOverride: rulesText,
        prizePool: prizePool
      })
    })
    var tId = (tournamentState && (tournamentState.activeTournamentId || tournamentState.dbTournamentId)) || null
    if (tId) {
      supabase.from('tournaments').update({
        date: iso.split('T')[0],
        name: clashForm.name || 'Weekly Clash',
        prize_pool_json: prizePool.length > 0 ? prizePool : null,
        rules_text: rulesText || null,
        is_finale: !!clashForm.isFinale,
        region: clashForm.server === 'NA' ? 'NA' : 'EUW'
      }).eq('id', tId).then(function(r) {
        if (r.error) toast('DB update failed: ' + r.error.message, 'error')
      }).catch(function() {})
    }
    addAudit('ACTION', 'Clash schedule set: ' + d.toLocaleString() + (prizePool.length ? ' (prize pool: ' + prizePool.length + ' tiers)' : '') + (clashForm.isFinale ? ' [FINALE]' : ''))
    toast('Clash schedule saved', 'success')
    setClashSaving(false)
  }

  function clashPreview() {
    if (!clashForm.clashLocal) return ''
    var d = new Date(clashForm.clashLocal)
    if (isNaN(d.getTime())) return ''
    var dateStr = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    var timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    return dateStr + ' at ' + timeStr
  }

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
      supabase.from('tournaments').update({ phase: toDbPhase(phase) }).eq('id', tId).then(function(r) {
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

  function openRegistration() {
    if (opening) return
    setOpening(true)
    supabase.from('tournaments').select('id', { count: 'exact', head: true }).eq('type', WEEKLY_CLASH_TYPE).then(function(countRes) {
      var existing = (countRes && countRes.count) || 0
      var override = parseInt(clashNumberInput, 10)
      var nextNum = (Number.isFinite(override) && override > 0) ? override : (existing + 1)
      var name = 'Clash Week ' + nextNum
      if (!window.confirm('Open registration for ' + name + '? This will create a new clash and clear any existing registrations.')) {
        setOpening(false); return
      }
      var maxP = parseInt(roundConfig.maxPlayers) || ts.maxPlayers || 24
      var rounds = parseInt(roundConfig.roundCount) || ts.roundCount || 3
      var cutLine = parseInt(roundConfig.cutLine) || 0
      var cutAfterGame = parseInt(roundConfig.cutAfterGame) || 0
      var checkinMins = parseInt(roundConfig.checkinWindowMins) || 30
      var prizePool = buildPrizePool(clashForm.prizeRows)
      var rulesText = (clashForm.rulesOverride || '').trim()
      supabase.from('tournaments').insert({
        name: name,
        date: new Date().toISOString().split('T')[0],
        phase: 'registration',
        type: WEEKLY_CLASH_TYPE,
        max_players: maxP,
        round_count: rounds,
        seeding_method: seedAlgo || 'rank-based',
        registration_open: true,
        registration_open_at: new Date().toISOString(),
        prize_pool_json: prizePool.length > 0 ? prizePool : null,
        rules_text: rulesText || null,
        is_finale: !!clashForm.isFinale
      }).select().single().then(function(res) {
        if (res.error || !res.data) {
          toast('Failed to open: ' + (res.error && res.error.message ? res.error.message : 'unknown error'), 'error')
          setOpening(false); return
        }
        var newId = res.data.id
        setTournamentState(function(s) {
          return Object.assign({}, s, {
            phase: 'registration',
            dbTournamentId: newId,
            activeTournamentId: newId,
            clashNumber: nextNum,
            clashName: name,
            registeredIds: [],
            checkedInIds: [],
            waitlistIds: [],
            lobbies: [],
            lockedLobbies: [],
            round: 1,
            maxPlayers: maxP,
            roundCount: rounds,
            totalGames: rounds,
            cutLine: cutLine,
            cutAfterGame: cutAfterGame,
            checkinWindowMins: checkinMins,
            formatPreset: formatPreset,
            seedingMethod: seedAlgo || 'rank-based',
            prizePool: prizePool,
            isFinale: !!clashForm.isFinale,
            rulesOverride: rulesText
          })
        })
        supabase.from('players').update({ checked_in: false }).then(function() {}).catch(function() {})
        addAudit('ACTION', 'Opened registration for ' + name)
        toast('Registration open: ' + name, 'success')
        setClashNumberInput('')
        setOpening(false)
      }).catch(function(e) {
        toast('Failed to open registration', 'error')
        setOpening(false)
      })
    }).catch(function() {
      toast('Failed to count past clashes', 'error')
      setOpening(false)
    })
  }

  function resetToRegistration() {
    if (!window.confirm('Reset tournament back to Registration phase? This keeps the same clash row but clears check-ins.')) return
    setTournamentState(function(s) { return Object.assign({}, s, { phase: 'registration', checkedInIds: [], round: 1 }) })
    var tId = ts.activeTournamentId || ts.dbTournamentId
    if (tId) {
      supabase.from('tournaments').update({ phase: toDbPhase('registration') }).eq('id', tId).then(function(r) {
        if (r.error) toast('DB phase update failed: ' + r.error.message, 'error')
      }).catch(function() {})
    }
    supabase.from('players').update({ checked_in: false }).then(function(r) { }).catch(function() {})
    addAudit('WARN', 'Tournament reset to Registration')
    toast('Reset to Registration', 'success')
  }

  function addScheduledEvent() {
    if (!newEvent.name.trim()) { toast('Event name required', 'error'); return }
    if (!newEvent.whenLocal) { toast('Pick a date and time', 'error'); return }
    var d = new Date(newEvent.whenLocal)
    if (isNaN(d.getTime())) { toast('Invalid date/time', 'error'); return }
    var ev = {
      id: Date.now(),
      name: newEvent.name.trim(),
      type: newEvent.type,
      iso: d.toISOString(),
      date: d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }),
      time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
      cap: parseInt(newEvent.cap) || 8,
      format: newEvent.format || 'Swiss'
    }
    setScheduledEvents(function(evs) { return (evs || []).concat([ev]) })
    addAudit('ACTION', 'Scheduled event added: ' + ev.name)
    toast('Event scheduled!', 'success')
    setNewEvent({ name: '', type: 'SCHEDULED', whenLocal: '', cap: '8', format: 'Swiss' })
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Name</label>
            <Inp value={clashForm.name} onChange={function(v) { setClashForm(Object.assign({}, clashForm, { name: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Clash Date & Time</label>
            <Inp type="datetime-local" value={clashForm.clashLocal} onChange={function(v) { setClashForm(Object.assign({}, clashForm, { clashLocal: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Server</label>
            <Sel value={clashForm.server} onChange={function(v) { setClashForm(Object.assign({}, clashForm, { server: v })) }}>
              <option value="EU">EU</option>
              <option value="NA">NA</option>
            </Sel>
          </div>
          <div className="flex items-end">
            <Btn variant="primary" size="sm" onClick={saveClashSchedule} disabled={clashSaving || !clashForm.clashLocal}>
              {clashSaving ? 'Saving...' : 'Save Schedule'}
            </Btn>
          </div>
        </div>
        {clashPreview() && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-primary/[0.08] border border-primary/20 text-[11px] font-bold text-primary">
            <Icon name="schedule" size={12} className="inline-block mr-1 -mt-0.5" />
            Next clash: {clashPreview()}
          </div>
        )}

        <div className="mb-4 p-3 rounded-lg bg-secondary/[0.05] border border-secondary/20">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] text-secondary font-bold uppercase tracking-wider flex items-center gap-1">
              <Icon name="redeem" size={12} className="inline-block" />
              Prize Pool (optional)
            </label>
            <Btn variant="secondary" size="sm" onClick={function() { setClashForm(Object.assign({}, clashForm, { prizeRows: (clashForm.prizeRows || []).concat([{ placement: String((clashForm.prizeRows || []).length + 1), prize: '', image: '' }]) })) }}>+ Add</Btn>
          </div>
          {(clashForm.prizeRows || []).map(function(row, idx) {
            var uploading = uploadingIdx === idx
            return (
              <div key={idx} className="mb-2 p-2 rounded bg-surface-container/60 border border-outline-variant/10">
                <div className="flex gap-2 items-center">
                  <div className="text-xs text-secondary font-bold w-10 text-center">#{row.placement || (idx + 1)}</div>
                  <div className="flex-1">
                    <Inp
                      value={row.prize}
                      onChange={function(v) {
                        var val = typeof v === 'string' ? v : v.target.value
                        var updated = clashForm.prizeRows.map(function(r, i) { return i === idx ? Object.assign({}, r, { prize: val }) : r })
                        setClashForm(Object.assign({}, clashForm, { prizeRows: updated }))
                      }}
                      placeholder="e.g. €50, RP code, Pro tier"
                    />
                  </div>
                  {clashForm.prizeRows.length > 1 && (
                    <Btn variant="ghost" size="sm" onClick={function() {
                      setClashForm(Object.assign({}, clashForm, { prizeRows: clashForm.prizeRows.filter(function(_, i) { return i !== idx }) }))
                    }}>X</Btn>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2 pl-12">
                  {row.image ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <img src={row.image} alt="" className="w-10 h-10 rounded object-cover border border-outline-variant/20 flex-shrink-0" />
                      <div className="text-[10px] text-on-surface/50 truncate flex-1">{row.image.split('/').pop()}</div>
                      <Btn variant="ghost" size="sm" onClick={function() {
                        var updated = clashForm.prizeRows.map(function(r, i) { return i === idx ? Object.assign({}, r, { image: '' }) : r })
                        setClashForm(Object.assign({}, clashForm, { prizeRows: updated }))
                      }}>Remove</Btn>
                    </div>
                  ) : (
                    <label className={'inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded border cursor-pointer transition-colors ' + (uploading ? 'border-on-surface/10 text-on-surface/40' : 'border-secondary/30 text-secondary hover:bg-secondary/10')}>
                      <Icon name="add_photo_alternate" size={12} />
                      {uploading ? 'Uploading...' : 'Add image'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={function(e) {
                          var f = e.target.files && e.target.files[0]
                          if (f) uploadPrizeImage(f, idx)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            )
          })}
          <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
            <div className="text-[10px] text-on-surface/40 flex-1 min-w-[180px]">Shown on Home, Clash and tournament detail pages. Leave blank for pride-only clashes.</div>
            <Btn variant="primary" size="sm" onClick={savePrizesOnly} disabled={prizeSaving}>
              {prizeSaving ? 'Saving...' : 'Save Prizes'}
            </Btn>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/[0.04] border border-primary/20 cursor-pointer">
            <input
              type="checkbox"
              checked={!!clashForm.isFinale}
              onChange={function(e) { setClashForm(Object.assign({}, clashForm, { isFinale: e.target.checked })) }}
              className="accent-primary"
            />
            <div>
              <div className="text-[11px] font-bold text-on-surface uppercase tracking-wider">Season Finale</div>
              <div className="text-[10px] text-on-surface/50">Marks this clash as the end-of-season championship</div>
            </div>
          </label>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Rules Override (optional)</label>
            <Inp
              value={clashForm.rulesOverride}
              onChange={function(v) { setClashForm(Object.assign({}, clashForm, { rulesOverride: typeof v === 'string' ? v : v.target.value })) }}
              placeholder="e.g. Set 14 only, top 8 advance"
            />
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

        <div className="mb-3 px-3 py-3 rounded-lg bg-surface-container border border-outline-variant/10">
          <div className="text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-2">New Clash</div>
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[10px] text-on-surface/50 font-bold uppercase tracking-wider mb-1">Clash Number (optional)</label>
              <Inp type="number" value={clashNumberInput} onChange={function(v) { setClashNumberInput(typeof v === 'string' ? v : v.target.value) }} placeholder="auto" />
            </div>
            <Btn variant="primary" size="sm" onClick={openRegistration} disabled={opening}>{opening ? 'Opening...' : 'Open Registration'}</Btn>
          </div>
          <div className="text-[10px] text-on-surface/40 mt-2">Creates a fresh clash row in the database. Leave blank to auto-number.</div>
          {ts.dbTournamentId && (
            <div className="text-[10px] text-success mt-2 font-bold">Active: {ts.clashName || 'Clash'} ({ts.clashNumber ? '#' + ts.clashNumber : 'no number'})</div>
          )}
          {!ts.dbTournamentId && (
            <div className="text-[10px] text-error mt-2 font-bold">No active clash. Click Open Registration to create one.</div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Btn variant="primary" size="sm" onClick={openCheckin} disabled={currentPhase !== 'registration'}>Open Check-in</Btn>
          <Btn variant="primary" size="sm" onClick={startTournament} disabled={currentPhase !== 'checkin'}>Start Tournament</Btn>
          <Btn variant="ghost" size="sm" onClick={function() { setPhase('complete') }} disabled={currentPhase !== 'inprogress'}>Mark Complete</Btn>
          <Btn variant="secondary" size="sm" onClick={resetToRegistration}>Reset Phase</Btn>
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="tune" size={16} className="text-secondary" />
          <span className="font-bold text-sm text-on-surface">Round Config</span>
        </div>

        <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <label className="block text-[11px] text-primary font-bold uppercase tracking-wider mb-2">Clash Format</label>
          <Sel value={formatPreset} onChange={applyFormatPreset}>
            {Object.keys(TOURNAMENT_FORMATS).map(function(k) {
              var f = TOURNAMENT_FORMATS[k]
              return <option key={k} value={k}>{f.name + ' — ' + f.games + ' games, ' + f.maxPlayers + 'p'}</option>
            })}
            <option value="custom">Custom</option>
          </Sel>
          {formatPreset !== 'custom' && TOURNAMENT_FORMATS[formatPreset] && (
            <div className="text-[10px] text-on-surface/60 mt-2">{TOURNAMENT_FORMATS[formatPreset].description}</div>
          )}
          <div className="text-[10px] text-tertiary font-bold mt-2">
            {'Estimated duration: ~' + formatDuration(estimateDurationMinutes(roundConfig.roundCount)) + ' for ' + (parseInt(roundConfig.roundCount) || 0) + ' games'}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Max Players</label>
            <Inp type="number" value={roundConfig.maxPlayers} onChange={function(v) { setRoundConfig(Object.assign({}, roundConfig, { maxPlayers: typeof v === 'string' ? v : v.target.value })); setFormatPreset('custom') }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Games per Clash</label>
            <Inp type="number" value={roundConfig.roundCount} onChange={function(v) { setRoundConfig(Object.assign({}, roundConfig, { roundCount: typeof v === 'string' ? v : v.target.value })); setFormatPreset('custom') }} />
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
          <div className="md:col-span-2">
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Date & Time</label>
            <Inp type="datetime-local" value={newEvent.whenLocal} onChange={function(v) { setNewEvent(Object.assign({}, newEvent, { whenLocal: typeof v === 'string' ? v : v.target.value })) }} />
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
                <div key={ev.id} className="flex items-center gap-2 px-3 py-2 bg-surface-container border border-outline-variant/10 rounded">
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
                <div key={t.id} className="flex items-center gap-2 px-3 py-2 bg-surface-container border border-outline-variant/10 rounded">
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
