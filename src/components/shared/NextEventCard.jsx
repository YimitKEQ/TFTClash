/**
 * NextEventCard
 *
 * Shows the soonest upcoming tournament the linked player is registered for
 * (season clash + custom/flash combined). Surfaces a single primary action:
 * Check In (when check-in window is open), Watch Live (when in_progress),
 * or Open (otherwise). Returns null if the player has nothing upcoming.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Btn, Icon, Panel } from '../ui'

function fmtDateTime(iso) {
  if (!iso) return 'TBD'
  var d = new Date(iso)
  if (isNaN(d.getTime())) return 'TBD'
  return d.toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit'
  })
}

function fmtCountdown(targetIso) {
  if (!targetIso) return ''
  var diff = new Date(targetIso).getTime() - Date.now()
  if (isNaN(diff) || diff <= 0) return ''
  var days = Math.floor(diff / 86400000)
  var hours = Math.floor((diff % 86400000) / 3600000)
  var mins = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return days + 'd ' + hours + 'h'
  if (hours > 0) return hours + 'h ' + mins + 'm'
  return mins + 'm'
}

function startIso(t) {
  return t.checkin_close_at || t.started_at || t.checkin_open_at || (t.date ? t.date + 'T20:00:00Z' : null)
}

function phaseMeta(phase) {
  if (phase === 'in_progress') return { label: 'LIVE', tone: 'bg-error/15 text-error border-error/30', dot: true }
  if (phase === 'check_in') return { label: 'CHECK-IN OPEN', tone: 'bg-secondary/15 text-secondary border-secondary/30', dot: false }
  if (phase === 'registration') return { label: 'REGISTERED', tone: 'bg-tertiary/15 text-tertiary border-tertiary/30', dot: false }
  return { label: 'UPCOMING', tone: 'bg-surface-variant/40 text-on-surface-variant border-outline-variant/30', dot: false }
}

export default function NextEventCard(props) {
  var linkedPlayer = props.linkedPlayer
  // Set true on screens that already render a season-clash widget (Dashboard's
  // ClashCard) so this card only surfaces the player's *other* registrations.
  var excludeSeasonClash = !!props.excludeSeasonClash
  var navigate = useNavigate()
  var _state = useState({ loading: true, tournament: null, registration: null })
  var state = _state[0]
  var setState = _state[1]
  var _tick = useState(0)
  var setTick = _tick[1]

  useEffect(function() {
    var iv = setInterval(function() { setTick(function(n) { return n + 1 }) }, 30000)
    return function() { clearInterval(iv) }
  }, [])

  useEffect(function() {
    if (!linkedPlayer || !linkedPlayer.id) {
      setState({ loading: false, tournament: null, registration: null })
      return
    }
    setState({ loading: true, tournament: null, registration: null })
    supabase
      .from('registrations')
      .select('id, status, tournament_id, lineup_player_ids, tournaments(id, name, type, phase, date, checkin_open_at, checkin_close_at, started_at, region, max_players, team_size)')
      .eq('player_id', linkedPlayer.id)
      .in('status', ['registered', 'checked_in'])
      .then(function(res) {
        if (res.error || !res.data) { setState({ loading: false, tournament: null, registration: null }); return }
        var rows = res.data.filter(function(r) {
          var t = r.tournaments
          if (!t) return false
          if (t.phase === 'complete' || t.phase === 'cancelled') return false
          if (excludeSeasonClash && t.type === 'season_clash') return false
          return true
        })
        if (rows.length === 0) { setState({ loading: false, tournament: null, registration: null }); return }
        rows.sort(function(a, b) {
          var aIso = startIso(a.tournaments)
          var bIso = startIso(b.tournaments)
          var aT = aIso ? new Date(aIso).getTime() : Infinity
          var bT = bIso ? new Date(bIso).getTime() : Infinity
          return aT - bT
        })
        var top = rows[0]
        setState({ loading: false, tournament: top.tournaments, registration: { id: top.id, status: top.status } })
      })
      .catch(function() { setState({ loading: false, tournament: null, registration: null }) })
  }, [linkedPlayer ? linkedPlayer.id : null, excludeSeasonClash])

  if (state.loading) return null
  if (!state.tournament) return null

  var t = state.tournament
  var reg = state.registration
  var meta = phaseMeta(t.phase)
  var startStr = fmtDateTime(startIso(t))
  var countdown = fmtCountdown(startIso(t))
  var alreadyCheckedIn = reg && reg.status === 'checked_in'
  var isTeam = t.team_size && t.team_size > 1

  function openTournament() {
    navigate('/tournament/' + t.id)
  }

  function quickCheckIn() {
    // Team events need lineup pick — bounce to the tournament page where the
    // captain UI lives. Solo events can self-check-in inline.
    if (isTeam) { openTournament(); return }
    if (!reg || !reg.id) { openTournament(); return }
    if (!linkedPlayer || !linkedPlayer.id) { openTournament(); return }
    // Defense in depth: scope by both registration id AND player_id so a stale
    // reg reference cannot accidentally check in another player.
    supabase.from('registrations')
      .update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
      .eq('id', reg.id)
      .eq('player_id', linkedPlayer.id)
      .then(function(res) {
        if (res && res.error) { openTournament(); return }
        setState(function(s) { return Object.assign({}, s, { registration: Object.assign({}, s.registration, { status: 'checked_in' }) }) })
      })
      .catch(function() { openTournament() })
  }

  var primaryAction
  if (t.phase === 'in_progress') {
    primaryAction = <Btn variant="secondary" size="sm" onClick={openTournament}><Icon name="visibility" size={14} className="mr-1" />Watch Live</Btn>
  } else if (t.phase === 'check_in' && !alreadyCheckedIn) {
    primaryAction = <Btn variant="primary" size="sm" onClick={quickCheckIn}><Icon name="check_circle" size={14} className="mr-1" />Check In Now</Btn>
  } else if (t.phase === 'check_in' && alreadyCheckedIn) {
    primaryAction = <Btn variant="secondary" size="sm" onClick={openTournament}>Open Lobby</Btn>
  } else {
    primaryAction = <Btn variant="secondary" size="sm" onClick={openTournament}>Open Event</Btn>
  }

  return (
    <Panel padding="none" className="p-5 mb-6 border-primary/30">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0">
          <Icon name={t.type === 'season_clash' ? 'shield' : 'bolt'} size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Your Next Event</span>
            <span className={'inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-label font-bold uppercase tracking-widest ' + meta.tone}>
              {meta.dot && <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse"></span>}
              {meta.label}
            </span>
            {alreadyCheckedIn && t.phase !== 'in_progress' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded border border-success/30 bg-success/10 text-success text-[10px] font-label font-bold uppercase tracking-widest">
                <Icon name="check" size={11} className="mr-0.5" />Checked In
              </span>
            )}
            {t.region && (
              <span className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant/60">{t.region}</span>
            )}
          </div>
          <div className="font-display text-lg font-bold text-on-surface mb-1">{t.name}</div>
          <div className="flex items-center gap-3 text-[11px] text-on-surface-variant flex-wrap">
            <span className="inline-flex items-center gap-1"><Icon name="event" size={12} />{startStr}</span>
            {countdown && (
              <span className="inline-flex items-center gap-1 text-primary font-mono font-bold"><Icon name="schedule" size={12} />in {countdown}</span>
            )}
            {isTeam && (
              <span className="inline-flex items-center gap-1"><Icon name="groups" size={12} />{t.team_size}v{t.team_size}</span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0">{primaryAction}</div>
      </div>
    </Panel>
  )
}
