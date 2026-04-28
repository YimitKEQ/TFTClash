import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase.js'
import { Panel, Btn, Inp, Icon, Sel } from '../../components/ui'
import { TOURNAMENT_FORMATS } from '../../lib/tournament.js'
import { PRIZE_TYPES, PRIZE_CURRENCIES, normalizePrizeRow, computeCashPool, currencySymbol } from '../../lib/prizes.js'

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
  // EU and NA tournament states are stored in separate site_settings rows so they can run concurrently.
  // The admin form below is region-aware: reads/writes route to whichever region the dropdown selects.
  var tournamentStateEu = ctx.tournamentState
  var setTournamentStateEu = ctx.setTournamentState
  var tournamentStateNa = ctx.tournamentStateNa
  var setTournamentStateNa = ctx.setTournamentStateNa
  var _adminRegion = useState(((tournamentStateNa && tournamentStateNa.phase && tournamentStateNa.phase !== 'idle') ? 'NA' : (tournamentStateEu && tournamentStateEu.server)) || 'EU')
  var adminRegion = _adminRegion[0]
  var setAdminRegion = _adminRegion[1]
  var tournamentState = adminRegion === 'NA' ? tournamentStateNa : tournamentStateEu
  var setTournamentState = adminRegion === 'NA' ? setTournamentStateNa : setTournamentStateEu
  var scheduledEvents = ctx.scheduledEvents
  var setScheduledEvents = ctx.setScheduledEvents
  var setAuditLog = ctx.setAuditLog
  var currentUser = ctx.currentUser
  var toast = ctx.toast
  var orgSponsors = ctx.orgSponsors || []

  // Convert an ISO timestamp to the value format datetime-local expects (YYYY-MM-DDTHH:mm in local time)
  function isoToLocalInput(iso) {
    if (!iso) return ''
    var d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    var pad = function(n) { return n < 10 ? '0' + n : '' + n }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  }

  var initialClashLocal = isoToLocalInput((tournamentState && tournamentState.clashTimestamp) || '')
  function emptyPrizeRow(place) {
    return { placement: String(place), prize: '', image: '', type: 'other', amount: '', currency: 'EUR', sponsor_id: '', eligibility: '' }
  }
  var initialPrizePool = (tournamentState && Array.isArray(tournamentState.prizePool) && tournamentState.prizePool.length > 0)
    ? tournamentState.prizePool.map(function(r) { return {
        placement: String(r.placement || ''),
        prize: String(r.prize || ''),
        image: String(r.image || ''),
        type: String(r.type || 'other'),
        amount: r.amount != null ? String(r.amount) : '',
        currency: String(r.currency || 'EUR'),
        sponsor_id: String(r.sponsor_id || ''),
        eligibility: String(r.eligibility || '')
      } })
    : [emptyPrizeRow(1), emptyPrizeRow(2), emptyPrizeRow(3)]
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
    }).catch(function(e) { console.error('[TournamentTab] DB op failed:', e); })
  }, [])

  function buildPrizePool(rows) {
    if (!rows || !rows.length) return []
    return rows
      .filter(function(r) {
        if (!r) return false
        var hasText = r.prize && r.prize.trim()
        var hasImage = r.image && r.image.trim()
        var hasAmount = r.amount && String(r.amount).trim() && parseFloat(r.amount) > 0
        return hasText || hasImage || hasAmount
      })
      .map(normalizePrizeRow)
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
        region: clashForm.server === 'NA' ? 'NA' : 'EU'
      }).eq('id', tId).then(function(r) {
        if (r.error) toast('DB update failed: ' + r.error.message, 'error')
      }).catch(function(e) { console.error('[TournamentTab] DB op failed:', e); })
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
      var actorId = currentUser.auth_user_id || null
      supabase.from('audit_log').insert({
        action: type, actor_id: actorId,
        actor_name: currentUser.username || currentUser.email || 'Admin',
        target_type: 'admin_action', details: { message: msg, timestamp: entry.ts }
      }).then(function(r) { }).catch(function(e) { console.error('[TournamentTab] DB op failed:', e); })
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
    var maxPCheck = parseInt(roundConfig.maxPlayers) || ts.maxPlayers || 24
    var roundsCheck = parseInt(roundConfig.roundCount) || ts.roundCount || 3
    var cutLineCheck = parseInt(roundConfig.cutLine) || 0
    var cutAfterGameCheck = parseInt(roundConfig.cutAfterGame) || 0
    if (maxPCheck < 1 || maxPCheck > 1024) { toast('Max players must be between 1 and 1024', 'error'); return }
    if (roundsCheck < 1 || roundsCheck > 20) { toast('Games per clash must be between 1 and 20', 'error'); return }
    if (cutLineCheck > 0 && cutAfterGameCheck < 1) { toast('Cut line requires a cut-after game', 'error'); return }
    if (cutAfterGameCheck > 0 && cutAfterGameCheck >= roundsCheck) { toast('Cut must happen before the final game', 'error'); return }
    setOpening(true)
    supabase.from('tournaments').select('id', { count: 'exact', head: true }).eq('type', WEEKLY_CLASH_TYPE).then(function(countRes) {
      var existing = (countRes && countRes.count) || 0
      var override = parseInt(clashNumberInput, 10)
      var nextNum = (Number.isFinite(override) && override > 0) ? override : (existing + 1)
      var name = 'Clash Week ' + nextNum
      if (!window.confirm('Open registration for ' + name + '? This will create a new clash and clear any existing registrations.')) {
        setOpening(false); return
      }
      var maxP = maxPCheck
      var rounds = roundsCheck
      var cutLine = cutLineCheck
      var cutAfterGame = cutAfterGameCheck
      var checkinMins = parseInt(roundConfig.checkinWindowMins) || 30
      if (checkinMins < 1 || checkinMins > 1440) { toast('Check-in window must be 1-1440 minutes', 'error'); setOpening(false); return }
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
        is_finale: !!clashForm.isFinale,
        region: clashForm.server === 'NA' ? 'NA' : 'EU'
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
        supabase.from('players').update({ checked_in: false }).eq('checked_in', true).then(function() {}).catch(function(e) { console.error('[TournamentTab] DB op failed:', e); })
        var regLabel = clashForm.server === 'NA' ? 'NA' : 'EU'
        addAudit('ACTION', 'Opened registration for ' + name + ' [' + regLabel + ']')
        toast('Registration open: ' + name + ' (' + regLabel + ')', 'success')
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
      }).catch(function(e) { console.error('[TournamentTab] DB op failed:', e); })
    }
    supabase.from('players').update({ checked_in: false }).eq('checked_in', true).then(function(r) { }).catch(function(e) { console.error('[TournamentTab] DB op failed:', e); })
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

  function finalizePrizeClaims(t) {
    if (!t || !t.id) return
    if (!window.confirm('Generate prize claims from current standings for ' + t.name + '?\n\nThis creates claim rows winners can redeem. Safe to re-run (upserts by placement).')) return
    Promise.all([
      supabase.from('tournaments').select('prize_pool_json, name').eq('id', t.id).single(),
      supabase.from('game_results').select('player_id, placement, points').eq('tournament_id', t.id)
    ]).then(function(results) {
      var tRes = results[0]; var grRes = results[1]
      if (tRes.error) { toast('Tournament fetch failed: ' + tRes.error.message, 'error'); return }
      if (grRes.error) { toast('Results fetch failed: ' + grRes.error.message, 'error'); return }
      var prizePool = Array.isArray(tRes.data && tRes.data.prize_pool_json) ? tRes.data.prize_pool_json : []
      if (prizePool.length === 0) { toast('No prizes configured for this tournament', 'error'); return }
      var gr = grRes.data || []
      if (gr.length === 0) { toast('No game results recorded yet', 'error'); return }
      var agg = {}
      gr.forEach(function(g) {
        var pid = g.player_id; if (!pid) return
        if (!agg[pid]) agg[pid] = { player_id: pid, points: 0, wins: 0, top4: 0 }
        agg[pid].points += (g.points || 0)
        if (g.placement === 1) agg[pid].wins += 1
        if (g.placement >= 1 && g.placement <= 4) agg[pid].top4 += 1
      })
      var ranked = Object.keys(agg).map(function(k) { return agg[k] }).sort(function(a, b) {
        if (b.points !== a.points) return b.points - a.points
        var aS = a.wins * 2 + a.top4; var bS = b.wins * 2 + b.top4
        return bS - aS
      })
      var claims = []
      prizePool.forEach(function(p) {
        var placement = parseInt(p.placement, 10)
        if (!placement || placement < 1 || placement > 8) return
        var winner = ranked[placement - 1]
        if (!winner) return
        var amtRaw = p.amount
        var amt = (amtRaw !== null && amtRaw !== undefined && String(amtRaw).trim() !== '') ? parseFloat(amtRaw) : null
        var safeType = (p.type && ['cash','rp','code','physical','other'].indexOf(p.type) > -1) ? p.type : 'other'
        claims.push({
          tournament_id: t.id,
          player_id: winner.player_id,
          placement: placement,
          prize_label: (p.prize && String(p.prize).trim()) || ('Prize #' + placement),
          prize_type: safeType,
          prize_amount: (Number.isFinite(amt) && amt > 0) ? amt : null,
          prize_currency: p.currency || null,
          prize_image_url: p.image || null,
          sponsor_id: p.sponsor_id || null,
          claim_status: 'unclaimed'
        })
      })
      if (claims.length === 0) { toast('Not enough players in results to fill prize pool', 'error'); return }
      supabase.from('prize_claims').upsert(claims, { onConflict: 'tournament_id,player_id,placement', ignoreDuplicates: false }).then(function(res) {
        if (res.error) { toast('Save failed: ' + res.error.message, 'error'); return }
        addAudit('ACTION', 'Prize claims generated: ' + t.name + ' (' + claims.length + ' rows)')
        toast(claims.length + ' prize claim(s) generated', 'success')
      }).catch(function() { toast('Save failed', 'error') })
    }).catch(function() { toast('Fetch failed', 'error') })
  }

  function createFlashTournament() {
    var trimmedName = flashForm.name.trim()
    if (!trimmedName) { toast('Tournament name required', 'error'); return }
    if (trimmedName.length > 80) { toast('Tournament name too long (max 80)', 'error'); return }
    if (!flashForm.date) { toast('Date/time required', 'error'); return }
    var parsedDate = new Date(flashForm.date)
    if (isNaN(parsedDate.getTime())) { toast('Invalid date/time', 'error'); return }
    if (parsedDate.getTime() < Date.now() - 60 * 1000) { toast('Date/time must be in the future', 'error'); return }
    var flashMaxP = parseInt(flashForm.maxPlayers) || 128
    var flashGames = parseInt(flashForm.gameCount) || 3
    if (flashMaxP < 1 || flashMaxP > 1024) { toast('Max players must be 1-1024', 'error'); return }
    if (flashGames < 1 || flashGames > 20) { toast('Game count must be 1-20', 'error'); return }
    var prizePool = flashForm.prizeRows.filter(function(r) { return r.prize.trim() }).map(function(r) { return { placement: parseInt(r.placement), prize: r.prize.trim() } })
    supabase.from('tournaments').insert({
      name: trimmedName, date: flashForm.date, phase: 'draft', type: 'flash_tournament',
      max_players: flashMaxP, round_count: flashGames,
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
            <Sel value={clashForm.server} onChange={function(v) {
              setAdminRegion(v)
              var nextTs = v === 'NA' ? tournamentStateNa : tournamentStateEu
              setClashForm({
                name: (nextTs && nextTs.clashName) || 'Weekly Clash',
                clashLocal: isoToLocalInput((nextTs && nextTs.clashTimestamp) || ''),
                server: v,
                isFinale: !!(nextTs && nextTs.isFinale),
                rulesOverride: (nextTs && nextTs.rulesOverride) || '',
                prizeRows: (nextTs && Array.isArray(nextTs.prizePool) && nextTs.prizePool.length > 0)
                  ? nextTs.prizePool.map(function(r) { return {
                      placement: String(r.placement || ''),
                      prize: String(r.prize || ''),
                      image: String(r.image || ''),
                      type: String(r.type || 'other'),
                      amount: r.amount != null ? String(r.amount) : '',
                      currency: String(r.currency || 'EUR'),
                      sponsor_id: String(r.sponsor_id || ''),
                      eligibility: String(r.eligibility || '')
                    } })
                  : [emptyPrizeRow(1), emptyPrizeRow(2), emptyPrizeRow(3)]
              })
            }}>
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
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <label className="text-[11px] text-secondary font-bold uppercase tracking-wider flex items-center gap-1">
              <Icon name="redeem" size={12} className="inline-block" />
              Prize Pool (optional)
            </label>
            {(function() {
              var pool = computeCashPool(buildPrizePool(clashForm.prizeRows))
              if (!pool) return null
              return (
                <span className="text-[10px] font-mono font-bold text-tertiary bg-tertiary/10 px-2 py-1 rounded">
                  Total: {currencySymbol(pool.currency)}{pool.total.toLocaleString()}
                </span>
              )
            })()}
            <Btn variant="secondary" size="sm" onClick={function() { setClashForm(Object.assign({}, clashForm, { prizeRows: (clashForm.prizeRows || []).concat([emptyPrizeRow((clashForm.prizeRows || []).length + 1)]) })) }}>+ Add</Btn>
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
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2 pl-12">
                  <div>
                    <label className="block text-[9px] text-on-surface/50 uppercase tracking-wider mb-0.5">Type</label>
                    <Sel value={row.type || 'other'} onChange={function(v) {
                      var val = typeof v === 'string' ? v : v.target.value
                      var updated = clashForm.prizeRows.map(function(r, i) { return i === idx ? Object.assign({}, r, { type: val }) : r })
                      setClashForm(Object.assign({}, clashForm, { prizeRows: updated }))
                    }}>
                      {PRIZE_TYPES.map(function(t) { return <option key={t.key} value={t.key}>{t.label}</option> })}
                    </Sel>
                  </div>
                  {row.type === 'cash' && (
                    <>
                      <div>
                        <label className="block text-[9px] text-on-surface/50 uppercase tracking-wider mb-0.5">Amount</label>
                        <Inp type="number" min="0" step="0.01" value={row.amount || ''} onChange={function(v) {
                          var val = typeof v === 'string' ? v : v.target.value
                          var updated = clashForm.prizeRows.map(function(r, i) { return i === idx ? Object.assign({}, r, { amount: val }) : r })
                          setClashForm(Object.assign({}, clashForm, { prizeRows: updated }))
                        }} placeholder="50" />
                      </div>
                      <div>
                        <label className="block text-[9px] text-on-surface/50 uppercase tracking-wider mb-0.5">Currency</label>
                        <Sel value={row.currency || 'EUR'} onChange={function(v) {
                          var val = typeof v === 'string' ? v : v.target.value
                          var updated = clashForm.prizeRows.map(function(r, i) { return i === idx ? Object.assign({}, r, { currency: val }) : r })
                          setClashForm(Object.assign({}, clashForm, { prizeRows: updated }))
                        }}>
                          {PRIZE_CURRENCIES.map(function(c) { return <option key={c} value={c}>{c}</option> })}
                        </Sel>
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-[9px] text-on-surface/50 uppercase tracking-wider mb-0.5">Sponsor</label>
                    <Sel value={row.sponsor_id || ''} onChange={function(v) {
                      var val = typeof v === 'string' ? v : v.target.value
                      var updated = clashForm.prizeRows.map(function(r, i) { return i === idx ? Object.assign({}, r, { sponsor_id: val }) : r })
                      setClashForm(Object.assign({}, clashForm, { prizeRows: updated }))
                    }}>
                      <option value="">- none -</option>
                      {(orgSponsors || []).map(function(s) { return <option key={s.id} value={s.id}>{s.name}</option> })}
                    </Sel>
                  </div>
                  <div>
                    <label className="block text-[9px] text-on-surface/50 uppercase tracking-wider mb-0.5">Eligibility</label>
                    <Inp value={row.eligibility || ''} onChange={function(v) {
                      var val = typeof v === 'string' ? v : v.target.value
                      var updated = clashForm.prizeRows.map(function(r, i) { return i === idx ? Object.assign({}, r, { eligibility: val }) : r })
                      setClashForm(Object.assign({}, clashForm, { prizeRows: updated }))
                    }} placeholder="e.g. top 4, EU" />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 pl-12">
                  {row.image ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <img src={row.image} alt="Prize image preview" loading="lazy" decoding="async" className="w-10 h-10 rounded object-cover border border-outline-variant/20 flex-shrink-0" />
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
              return <option key={k} value={k}>{f.name + ' - ' + f.games + ' games, ' + f.maxPlayers + 'p'}</option>
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
            <Inp type="number" min="1" step="1" value={roundConfig.maxPlayers} onChange={function(v) { setRoundConfig(Object.assign({}, roundConfig, { maxPlayers: typeof v === 'string' ? v : v.target.value })); setFormatPreset('custom') }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Games per Clash</label>
            <Inp type="number" min="1" step="1" value={roundConfig.roundCount} onChange={function(v) { setRoundConfig(Object.assign({}, roundConfig, { roundCount: typeof v === 'string' ? v : v.target.value })); setFormatPreset('custom') }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Check-in Window (min)</label>
            <Inp type="number" min="1" step="1" value={roundConfig.checkinWindowMins} onChange={function(v) { setRoundConfig(Object.assign({}, roundConfig, { checkinWindowMins: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Cut Line</label>
            <Inp type="number" min="0" step="1" value={roundConfig.cutLine} onChange={function(v) { setRoundConfig(Object.assign({}, roundConfig, { cutLine: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Cut After Game</label>
            <Inp type="number" min="0" step="1" value={roundConfig.cutAfterGame} onChange={function(v) { setRoundConfig(Object.assign({}, roundConfig, { cutAfterGame: typeof v === 'string' ? v : v.target.value })) }} />
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
            <Inp type="number" min="1" step="1" value={newEvent.cap} onChange={function(v) { setNewEvent(Object.assign({}, newEvent, { cap: typeof v === 'string' ? v : v.target.value })) }} />
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
            <Inp type="number" min="2" step="1" value={flashForm.maxPlayers} onChange={function(v) { setFlashForm(Object.assign({}, flashForm, { maxPlayers: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Game Count</label>
            <Inp type="number" min="1" step="1" value={flashForm.gameCount} onChange={function(v) { setFlashForm(Object.assign({}, flashForm, { gameCount: typeof v === 'string' ? v : v.target.value })) }} />
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
                  {(t.phase === 'complete' || t.phase === 'in_progress') && (
                    <Btn variant="ghost" size="sm" onClick={function() { finalizePrizeClaims(t) }}>Claims</Btn>
                  )}
                  <Btn variant="ghost" size="sm" onClick={function() {
                    if (!window.confirm('Delete ' + t.name + '?')) return
                    supabase.from('tournaments').delete().eq('id', t.id).then(function(r) {
                      if (r.error) { toast('Failed: ' + r.error.message, 'error'); return }
                      setFlashTournaments(function(ts) { return ts.filter(function(x) { return x.id !== t.id }) })
                      // Clear active region pointers so future registrations don't FK-crash.
                      if (tournamentStateEu && tournamentStateEu.dbTournamentId === t.id && setTournamentStateEu) {
                        setTournamentStateEu(function(s) { return Object.assign({}, s, { dbTournamentId: null, activeTournamentId: null, phase: 'idle', registeredIds: [], checkedInIds: [], waitlistIds: [], lobbies: [], lockedLobbies: [] }) })
                      }
                      if (tournamentStateNa && tournamentStateNa.dbTournamentId === t.id && setTournamentStateNa) {
                        setTournamentStateNa(function(s) { return Object.assign({}, s, { dbTournamentId: null, activeTournamentId: null, phase: 'idle', registeredIds: [], checkedInIds: [], waitlistIds: [], lobbies: [], lockedLobbies: [] }) })
                      }
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
