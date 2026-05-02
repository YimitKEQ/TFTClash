import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { Btn, Icon, PillTab, PillTabGroup } from '../components/ui'
import { supabase } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'
import PrizePoolCard from '../components/shared/PrizePoolCard'
import Podium from '../components/shared/Podium'
import RegionBadge from '../components/shared/RegionBadge'
import LiveOdds from '../components/shared/LiveOdds'
import PredictionGame from '../components/shared/PredictionGame'
import AiMatchRecap from '../components/shared/AiMatchRecap'
import SocialShareBar from '../components/shared/SocialShareBar'
import AddToCalendarBtn from '../components/shared/AddToCalendarBtn'
import { canRegisterInRegion, regionMismatchMessage, normalizeRegion } from '../lib/regions.js'
import { resolveLinkedPlayer } from '../lib/linkedPlayer.js'
import { isPinned, togglePinned, PINNED_EVENT } from '../lib/pinnedTournaments.js'
import { notifyTeamMembers, registerTeamWithRosterRsvps, listTeamRingers, inviteTeamRinger } from '../lib/teams.js'
import { createNotification } from '../lib/notifications.js'

var PLACE_POINTS = [
  { place: '1st', pts: '8 PTS', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
  { place: '2nd', pts: '7 PTS', color: 'text-on-surface/70', bg: 'bg-surface-container-high', border: 'border-outline-variant/10' },
  { place: '3rd', pts: '6 PTS', color: 'text-on-surface/70', bg: 'bg-surface-container-high', border: 'border-outline-variant/10' },
  { place: '4th', pts: '5 PTS', color: 'text-on-surface/70', bg: 'bg-surface-container-high', border: 'border-outline-variant/10' },
]

var TIEBREAKERS = [
  { n: '01', title: 'Total Tournament Points', desc: 'Sum of all placement points across games.' },
  { n: '02', title: 'Wins + Top 4s', desc: 'Wins count twice toward the tiebreaker score.' },
  { n: '03', title: 'Most of Each Placement', desc: 'Compare 1st counts, then 2nd, then 3rd...' },
  { n: '04', title: 'Most Recent Game Finish', desc: 'Higher placement in the most recent game wins.' },
]

var DETAIL_TABS = [
  { id: 'overview', label: 'Overview', icon: 'info' },
  { id: 'bracket', label: 'Bracket', icon: 'groups' },
  { id: 'standings', label: 'Standings', icon: 'bar_chart' },
  { id: 'rules', label: 'Rules', icon: 'gavel' },
]

var PLACE_CLASSES = ['text-primary', 'text-on-surface-variant', 'text-on-surface-variant/70', 'text-tertiary', 'text-secondary', 'text-tertiary/70', 'text-on-surface-variant/50', 'text-on-surface-variant/40']

export default function TournamentDetailScreen() {
  var navigate = useNavigate()
  var ctx = useApp()
  var featuredEvents = ctx.featuredEvents
  var setFeaturedEvents = ctx.setFeaturedEvents
  var currentUser = ctx.currentUser
  var setAuthScreen = ctx.setAuthScreen
  var toast = ctx.toast
  var players = ctx.players
  var screen = ctx.screen
  var setScreen = ctx.setScreen

  var eventId = screen && screen.indexOf('tournament-') === 0 ? screen.replace('tournament-', '') : null
  var contextEvent = (featuredEvents || []).find(function(e) { return String(e.id) === eventId || e.screen === screen; })

  var _fallbackEvent = useState(null)
  var fallbackEvent = _fallbackEvent[0]
  var setFallbackEvent = _fallbackEvent[1]
  var _detailTab = useState('overview')
  var detailTab = _detailTab[0]
  var setDetailTab = _detailTab[1]
  var _tournamentResults = useState([])
  var tournamentResults = _tournamentResults[0]
  var setTournamentResults = _tournamentResults[1]
  var _loadingResults = useState(false)
  var loadingResults = _loadingResults[0]
  var setLoadingResults = _loadingResults[1]
  var _liveReg = useState({loaded:false, isRegistered:false, count:0, busy:false})
  var liveReg = _liveReg[0]
  var setLiveReg = _liveReg[1]

  var _myCaptainTeam = useState(null)
  var myCaptainTeam = _myCaptainTeam[0]
  var setMyCaptainTeam = _myCaptainTeam[1]

  var _teamRoster = useState([])
  var teamRoster = _teamRoster[0]
  var setTeamRoster = _teamRoster[1]
  var _eventRingers = useState([])
  var eventRingers = _eventRingers[0]
  var setEventRingers = _eventRingers[1]
  var _ringerInviteName = useState('')
  var ringerInviteName = _ringerInviteName[0]
  var setRingerInviteName = _ringerInviteName[1]
  var _ringerBusy = useState(false)
  var ringerBusy = _ringerBusy[0]
  var setRingerBusy = _ringerBusy[1]
  var _ringerReload = useState(0)
  var ringerReload = _ringerReload[0]
  var setRingerReload = _ringerReload[1]
  var _myTeamReg = useState(null)
  var myTeamReg = _myTeamReg[0]
  var setMyTeamReg = _myTeamReg[1]
  var _lineupSel = useState([])
  var lineupSel = _lineupSel[0]
  var setLineupSel = _lineupSel[1]
  var _checkInBusy = useState(false)
  var checkInBusy = _checkInBusy[0]
  var setCheckInBusy = _checkInBusy[1]

  var _eventTeams = useState({})
  var eventTeams = _eventTeams[0]
  var setEventTeams = _eventTeams[1]

  var _pinned = useState(false)
  var pinned = _pinned[0]
  var setPinned = _pinned[1]

  useEffect(function() {
    if (!contextEvent && eventId && supabase.from) {
      supabase.from('tournaments').select('*').eq('id', eventId).single()
        .then(function(res) {
          if (res.data) setFallbackEvent(res.data)
        }).catch(function() {})
    }
  }, [contextEvent, eventId])

  var event = contextEvent || fallbackEvent
  var dbTournamentId = event && (event.dbTournamentId || (typeof event.id === 'string' && event.id.length > 20 ? event.id : null))

  var pinTargetId = dbTournamentId || (event && event.id) || eventId

  useEffect(function () {
    if (!pinTargetId) return
    setPinned(isPinned(pinTargetId))
    function onChange() { setPinned(isPinned(pinTargetId)) }
    if (typeof window !== 'undefined') {
      window.addEventListener(PINNED_EVENT, onChange)
      window.addEventListener('storage', onChange)
    }
    return function () {
      if (typeof window !== 'undefined') {
        window.removeEventListener(PINNED_EVENT, onChange)
        window.removeEventListener('storage', onChange)
      }
    }
  }, [pinTargetId])

  useEffect(function() {
    if (!dbTournamentId || !supabase.from) return
    setLoadingResults(true)
    supabase.from('game_results').select('*').eq('tournament_id', dbTournamentId).order('round_number', { ascending: true }).order('placement', { ascending: true })
      .then(function(res) {
        setLoadingResults(false)
        if (res.error) { toast('Failed to load results', 'error'); return; }
        if (res.data) setTournamentResults(res.data)
      }).catch(function() { setLoadingResults(false); toast('Failed to load results', 'error'); })
  }, [dbTournamentId])

  var linkedPlayer = resolveLinkedPlayer(currentUser, players)
  var linkedPlayerId = linkedPlayer ? linkedPlayer.id : null

  var rawTeamSize = event && event.team_size != null ? parseInt(event.team_size, 10) : 1
  var teamSize = Number.isFinite(rawTeamSize) && rawTeamSize > 0 ? rawTeamSize : 1
  var isTeamEvent = teamSize > 1

  useEffect(function() {
    if (!linkedPlayerId || !supabase.from) { setMyCaptainTeam(null); return; }
    supabase.from('teams')
      .select('id, name, tag, captain_player_id, lineup_2v2, lineup_4v4, archived_at')
      .eq('captain_player_id', linkedPlayerId)
      .is('archived_at', null)
      .maybeSingle()
      .then(function(r) {
        if (r.error || !r.data) { setMyCaptainTeam(null); return; }
        setMyCaptainTeam(r.data)
      })
      .catch(function() { setMyCaptainTeam(null) })
  }, [linkedPlayerId])

  function refreshLiveReg() {
    if (!dbTournamentId || !supabase.from) return
    if (isTeamEvent) {
      supabase.from('registrations').select('team_id,status', { count: 'exact' })
        .eq('tournament_id', dbTournamentId)
        .in('status', ['registered','checked_in'])
        .not('team_id', 'is', null)
        .then(function(res) {
          if (res.error) return
          var rows = res.data || []
          var myTid = myCaptainTeam ? myCaptainTeam.id : null
          var isReg = !!(myTid && rows.some(function(r) { return String(r.team_id) === String(myTid) }))
          setLiveReg({loaded:true, isRegistered:isReg, count: rows.length, busy:false})
        }).catch(function() {})
      return
    }
    supabase.from('registrations').select('player_id,status', { count: 'exact' })
      .eq('tournament_id', dbTournamentId)
      .in('status', ['registered','checked_in'])
      .then(function(res) {
        if (res.error) return
        var isReg = !!(linkedPlayerId && (res.data || []).some(function(r) { return String(r.player_id) === String(linkedPlayerId) }))
        setLiveReg({loaded:true, isRegistered:isReg, count:(res.data || []).length, busy:false})
      }).catch(function() {})
  }

  useEffect(refreshLiveReg, [dbTournamentId, linkedPlayerId, isTeamEvent, myCaptainTeam && myCaptainTeam.id])

  useEffect(function() {
    if (!isTeamEvent || !myCaptainTeam || !dbTournamentId) { setEventRingers([]); return; }
    var cancelled = false;
    listTeamRingers(myCaptainTeam.id, dbTournamentId).then(function(rows){
      if (cancelled) return;
      setEventRingers(rows || []);
    }).catch(function(){ setEventRingers([]); });
    return function(){ cancelled = true; };
  }, [isTeamEvent, myCaptainTeam && myCaptainTeam.id, dbTournamentId, ringerReload])

  useEffect(function() {
    if (!isTeamEvent || !myCaptainTeam || !dbTournamentId || !supabase.from) {
      setTeamRoster([]); setMyTeamReg(null); setLineupSel([]); return;
    }
    var cancelled = false;
    Promise.all([
      supabase.from('team_members')
        .select('id, player_id, role, joined_at')
        .eq('team_id', myCaptainTeam.id)
        .is('removed_at', null),
      supabase.from('registrations')
        .select('id, status, lineup_player_ids, team_id')
        .eq('tournament_id', dbTournamentId)
        .eq('team_id', myCaptainTeam.id)
        .maybeSingle()
    ]).then(function(out) {
      if (cancelled) return;
      var memRes = out[0]; var regRes = out[1];
      var members = (memRes && memRes.data) || [];
      var pids = members.map(function(m){ return m.player_id; });
      if (pids.length === 0) { setTeamRoster([]); setMyTeamReg(regRes && regRes.data); setLineupSel([]); return; }
      supabase.from('players').select('id, username, riot_id, auth_user_id').in('id', pids).then(function(pRes){
        if (cancelled) return;
        var byPid = {};
        ((pRes && pRes.data) || []).forEach(function(p){ byPid[p.id] = p; });
        var roster = members.map(function(m){ return Object.assign({}, m, { player: byPid[m.player_id] || null }); });
        setTeamRoster(roster);
        var reg = regRes && regRes.data;
        setMyTeamReg(reg);
        var existing = (reg && Array.isArray(reg.lineup_player_ids)) ? reg.lineup_player_ids : [];
        if (existing.length > 0) {
          setLineupSel(existing);
        } else {
          var ts = teamSize;
          var presetRaw = ts === 2 ? myCaptainTeam.lineup_2v2 : ts === 4 ? myCaptainTeam.lineup_4v4 : null;
          var preset = Array.isArray(presetRaw) ? presetRaw : [];
          var rosterSet = {};
          pids.forEach(function(id){ rosterSet[id] = true; });
          var filtered = preset.filter(function(pid){ return rosterSet[pid]; }).slice(0, ts);
          setLineupSel(filtered);
        }
      }).catch(function(){});
    }).catch(function(){});
    return function(){ cancelled = true; };
  }, [isTeamEvent, myCaptainTeam && myCaptainTeam.id, dbTournamentId, liveReg.loaded, liveReg.isRegistered])

  function toggleLineupSel(playerId) {
    if (lineupSel.indexOf(playerId) !== -1) {
      setLineupSel(lineupSel.filter(function(x){ return x !== playerId; }));
    } else {
      if (lineupSel.length >= teamSize) {
        toast('Lineup is full (' + teamSize + ' starters). Deselect to swap.', 'info');
        return;
      }
      setLineupSel(lineupSel.concat([playerId]));
    }
  }

  function submitTeamCheckIn() {
    if (!myCaptainTeam || !myTeamReg || checkInBusy) return;
    if (myTeamReg.team_id && String(myTeamReg.team_id) !== String(myCaptainTeam.id)) {
      toast('Registration mismatch - refresh and try again.', 'error');
      return;
    }
    if (lineupSel.length !== teamSize) {
      toast('Pick exactly ' + teamSize + ' starters before checking in.', 'error');
      return;
    }
    setCheckInBusy(true);
    supabase.from('registrations')
      .update({ status: 'checked_in', lineup_player_ids: lineupSel, checked_in_at: new Date().toISOString() })
      .eq('id', myTeamReg.id)
      .then(function(r){
        setCheckInBusy(false);
        if (r && r.error) { toast('Check-in failed: ' + r.error.message, 'error'); return; }
        toast(myCaptainTeam.name + ' checked in.', 'success');
        setMyTeamReg(Object.assign({}, myTeamReg, { status: 'checked_in', lineup_player_ids: lineupSel }));
        try {
          var startersSet = {};
          lineupSel.forEach(function(pid){ startersSet[String(pid)] = true; });
          (teamRoster || []).forEach(function(m){
            if (!m || !m.player) return;
            if (linkedPlayer && String(m.player_id) === String(linkedPlayer.id)) return;
            var auth = m.player && m.player.auth_user_id;
            if (!auth) return;
            var isStarter = !!startersSet[String(m.player_id)];
            var title = isStarter ? 'Starting in ' + event.name : 'On bench for ' + event.name;
            var body = isStarter
              ? myCaptainTeam.name + ' is checked in. You are starting.'
              : myCaptainTeam.name + ' is checked in. You are on bench.';
            try { createNotification(auth, title, body, isStarter ? 'sports_esports' : 'event_seat'); } catch (e) {}
          });
        } catch (e) {}
        refreshLiveReg();
      })
      .catch(function(){ setCheckInBusy(false); toast('Check-in failed', 'error'); });
  }

  useEffect(function() {
    if (!isTeamEvent || !supabase.from || tournamentResults.length === 0) { setEventTeams({}); return; }
    var ids = {}
    tournamentResults.forEach(function(r) { if (r.team_id) ids[r.team_id] = true })
    var idList = Object.keys(ids)
    if (idList.length === 0) { setEventTeams({}); return; }
    var cancelled = false
    supabase.from('teams').select('id, name, tag').in('id', idList)
      .then(function(res) {
        if (cancelled || !res || res.error || !res.data) return
        var map = {}
        res.data.forEach(function(t) { map[t.id] = t })
        setEventTeams(map)
      }).catch(function() {})
    return function() { cancelled = true }
  }, [isTeamEvent, tournamentResults])

  useEffect(function() {
    if (!dbTournamentId || !supabase.channel) return
    var ch = supabase.channel('tournament_detail_regs_' + dbTournamentId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations', filter: 'tournament_id=eq.' + dbTournamentId }, function() {
        refreshLiveReg()
      })
      .subscribe()
    return function() { supabase.removeChannel(ch) }
  }, [dbTournamentId])

  if (!event) {
    return (
      <PageLayout>
        <div className="max-w-5xl mx-auto text-center py-20">
          <Icon name="error_outline" size={48} className="text-on-surface-variant/20 mx-auto mb-4" />
          <h2 className="text-on-surface text-xl font-bold mb-2">Tournament Not Found</h2>
          <p className="text-on-surface-variant text-sm mb-6">This tournament may have been removed or the link is invalid.</p>
          <Btn variant="primary" size="sm" onClick={function() { navigate('/events'); }}>
            Back to Events
          </Btn>
        </div>
      </PageLayout>
    )
  }

  var blobIsRegistered = currentUser && event.registeredIds && event.registeredIds.indexOf(currentUser.username) !== -1
  var isRegistered = liveReg.loaded ? liveReg.isRegistered : blobIsRegistered
  var liveCount = liveReg.loaded ? liveReg.count : (event.registered || 0)
  var size = event.size || event.max_players || 0
  var capacityUnits = isTeamEvent && size > 0 ? Math.floor(size / teamSize) : size
  var isFull = capacityUnits > 0 && liveCount >= capacityUnits
  var isCompleted = event.status === 'complete' || event.phase === 'complete' || event.phase === 'completed'
  var canRegister = !isCompleted && !isFull && !isRegistered
  var regPercent = capacityUnits > 0 ? Math.round((liveCount / capacityUnits) * 100) : 0
  var phaseRaw = String(event.phase || '').toLowerCase()
  var isCheckInPhase = phaseRaw === 'checkin' || phaseRaw === 'check_in' || phaseRaw === 'check-in'
  var isInProgressPhase = phaseRaw === 'inprogress' || phaseRaw === 'in_progress' || phaseRaw === 'between_rounds'
  var isAlreadyCheckedIn = !!(myTeamReg && myTeamReg.status === 'checked_in')

  function handleRegister() {
    if (!currentUser) { setAuthScreen('login'); return; }
    if (!currentUser.auth_user_id) { toast('Sign in required to register', 'error'); return; }
    if (!dbTournamentId) { toast('Tournament unavailable', 'error'); return; }
    if (liveReg.busy) return
    if (!linkedPlayer) { toast('Link your player profile before registering', 'error'); navigate('/account'); return; }
    if (!isRegistered && linkedPlayer.banned) { toast('Your account is banned from registering', 'error'); return; }
    if (!isRegistered && event.region && !canRegisterInRegion(linkedPlayer.region, event.region)) {
      var regMsg = regionMismatchMessage(linkedPlayer.region, event.region)
      toast(regMsg || 'Region mismatch. Check your account region.', 'error')
      if (!linkedPlayer.region) navigate('/account')
      return
    }

    if (isTeamEvent) {
      if (!myCaptainTeam) {
        toast('Only team captains can register a team for this event.', 'error')
        navigate('/teams')
        return
      }
      setLiveReg(function(s) { return Object.assign({}, s, {busy:true}) })
      if (isRegistered) {
        supabase.from('registrations').delete()
          .eq('tournament_id', dbTournamentId)
          .eq('team_id', myCaptainTeam.id)
          .then(function(r) {
            if (r && r.error) {
              setLiveReg(function(s) { return Object.assign({}, s, {busy:false}) })
              toast('Withdraw failed: ' + r.error.message, 'error')
              return
            }
            toast('Withdrew ' + myCaptainTeam.name + ' from ' + event.name, 'info')
            try {
              notifyTeamMembers(
                myCaptainTeam.id,
                'Team Withdrew',
                myCaptainTeam.name + ' was withdrawn from ' + event.name + '.',
                'logout',
                { excludePlayerIds: linkedPlayer ? [linkedPlayer.id] : [] }
              );
            } catch (e) {}
            refreshLiveReg()
          })
          .catch(function() {
            setLiveReg(function(s) { return Object.assign({}, s, {busy:false}) })
            toast('Withdraw failed', 'error')
          })
        return
      }
      if (isFull) {
        setLiveReg(function(s) { return Object.assign({}, s, {busy:false}) })
        toast('Tournament is full', 'error'); return
      }
      registerTeamWithRosterRsvps(
        myCaptainTeam.id,
        dbTournamentId,
        event.name,
        myCaptainTeam.name
      )
        .then(function() {
          toast(myCaptainTeam.name + ' registered. Roster has been asked to confirm.', 'success')
          refreshLiveReg()
        })
        .catch(function(err) {
          setLiveReg(function(s) { return Object.assign({}, s, {busy:false}) })
          var msg = err && err.message ? err.message : 'Registration failed'
          toast('Registration failed: ' + msg, 'error')
        })
      return
    }

    setLiveReg(function(s) { return Object.assign({}, s, {busy:true}) })

    if (isRegistered) {
      var prevFeatured = null
      setFeaturedEvents(function(evts) {
        prevFeatured = evts
        return evts.map(function(ev) {
          if (ev.id !== event.id) return ev
          var newIds = (ev.registeredIds || []).filter(function(u) { return u !== currentUser.username; })
          return Object.assign({}, ev, { registeredIds: newIds, registered: Math.max(0, (ev.registered || 0) - 1) })
        })
      })
      supabase.from('registrations').delete()
        .eq('tournament_id', dbTournamentId)
        .eq('player_id', linkedPlayer.id)
        .then(function(r) {
          if (r.error) {
            if (prevFeatured) setFeaturedEvents(prevFeatured)
            setLiveReg(function(s) { return Object.assign({}, s, {busy:false}) })
            toast('Unregister failed: ' + r.error.message, 'error')
            return
          }
          toast('Unregistered from ' + event.name, 'info')
          refreshLiveReg()
        })
        .catch(function() {
          if (prevFeatured) setFeaturedEvents(prevFeatured)
          setLiveReg(function(s) { return Object.assign({}, s, {busy:false}) })
          toast('Unregister failed', 'error')
        })
      return
    }

    if (isFull) {
      setLiveReg(function(s) { return Object.assign({}, s, {busy:false}) })
      toast('Tournament is full', 'error'); return
    }

    var prevFeatured2 = null
    setFeaturedEvents(function(evts) {
      prevFeatured2 = evts
      return evts.map(function(ev) {
        if (ev.id !== event.id) return ev
        var newIds = (ev.registeredIds || []).concat([currentUser.username])
        return Object.assign({}, ev, { registeredIds: newIds, registered: (ev.registered || 0) + 1 })
      })
    })
    supabase.from('registrations').upsert(
      { tournament_id: dbTournamentId, player_id: linkedPlayer.id, status: 'registered' },
      { onConflict: 'tournament_id,player_id' }
    )
      .then(function(r) {
        if (r && r.error) {
          if (prevFeatured2) setFeaturedEvents(prevFeatured2)
          setLiveReg(function(s) { return Object.assign({}, s, {busy:false}) })
          toast('Registration failed: ' + r.error.message, 'error')
          return
        }
        toast('Registered for ' + event.name + '!', 'success')
        refreshLiveReg()
      })
      .catch(function() {
        if (prevFeatured2) setFeaturedEvents(prevFeatured2)
        setLiveReg(function(s) { return Object.assign({}, s, {busy:false}) })
        toast('Registration failed', 'error')
      })
  }

  var playerNameMap = {}
  ;(players || []).forEach(function(p) { playerNameMap[p.id] = p.username || p.name; })

  var standings = []
  if (tournamentResults.length > 0) {
    var playerMap = {}
    tournamentResults.forEach(function(r) {
      if (!playerMap[r.player_id]) playerMap[r.player_id] = { player_id: r.player_id, playerName: playerNameMap[r.player_id] || 'Unknown Player', total: 0, games: [], wins: 0, top4: 0, lastRound: -1, lastPlacement: 9 }
      var pm = playerMap[r.player_id]
      var place = r.placement || 0
      pm.total += r.points || 0
      pm.games.push({ round: r.round_number, placement: place, points: r.points })
      if (place === 1) pm.wins += 1
      if (place > 0 && place <= 4) pm.top4 += 1
      var rnd = r.round_number || 0
      if (rnd > pm.lastRound) { pm.lastRound = rnd; pm.lastPlacement = place || 9 }
    })
    // Tiebreaker chain mirrors the canonical solo chain used at finalize:
    // total -> wins*2 + top4 (top-cut weight) -> wins -> top4 -> last placement.
    standings = Object.values(playerMap).sort(function(a, b) {
      if (b.total !== a.total) return b.total - a.total
      var aWeight = (a.wins * 2) + a.top4
      var bWeight = (b.wins * 2) + b.top4
      if (bWeight !== aWeight) return bWeight - aWeight
      if (b.wins !== a.wins) return b.wins - a.wins
      if (b.top4 !== a.top4) return b.top4 - a.top4
      return (a.lastPlacement || 9) - (b.lastPlacement || 9)
    })
  }

  var teamStandings = []
  if (isTeamEvent && tournamentResults.length > 0) {
    var teamMap = {}
    tournamentResults.forEach(function(r) {
      if (!r.team_id) return
      if (!teamMap[r.team_id]) {
        teamMap[r.team_id] = { team_id: r.team_id, total: 0, top4: 0, top2: 0, fourths: 0, firsts: 0, wins: 0, rounds: {}, bestPlacement: 99, lastRound: -1, lastPlacement: 9 }
      }
      var t = teamMap[r.team_id]
      var place = r.placement || 0
      t.total += r.points || 0
      t.rounds[r.round_number] = true
      if (place === 1) { t.wins += 1; t.firsts += 1; t.top2 += 1 }
      else if (place === 2) { t.top2 += 1 }
      else if (place === 4) { t.fourths += 1 }
      if (place > 0 && place <= 4) t.top4 += 1
      if (place > 0 && place < t.bestPlacement) t.bestPlacement = place
      var rnd = r.round_number || 0
      if (rnd > t.lastRound) { t.lastRound = rnd; t.lastPlacement = place || 9 }
    })
    teamStandings = Object.values(teamMap).map(function(t) {
      var meta = eventTeams[t.team_id] || {}
      return Object.assign({}, t, {
        games: Object.keys(t.rounds).length,
        teamName: meta.name || 'Team',
        teamTag: meta.tag || null
      })
    }).sort(function(a, b) {
      if (b.total !== a.total) return b.total - a.total
      if (b.top2 !== a.top2) return b.top2 - a.top2
      if (a.fourths !== b.fourths) return a.fourths - b.fourths
      if (b.firsts !== a.firsts) return b.firsts - a.firsts
      return (a.lastPlacement || 9) - (b.lastPlacement || 9)
    })
  }

  var bracketRounds = {}
  var bracketRoundKeys = []
  if (tournamentResults.length > 0) {
    tournamentResults.forEach(function(r) {
      var rk = 'Round ' + r.round_number
      if (!bracketRounds[rk]) bracketRounds[rk] = []
      bracketRounds[rk].push(r)
    })
    bracketRoundKeys = Object.keys(bracketRounds).sort()
  }

  var registeredIds = event.registeredIds || []
  var prizes = Array.isArray(event.prize_pool_json) ? event.prize_pool_json : []

  var champRow = standings[0] || null
  var champName = (champRow && champRow.playerName) || event.champion || ''
  var champPts = champRow ? champRow.total : null
  var champWins = champRow ? champRow.wins : 0
  var champGames = champRow && champRow.games ? champRow.games.length : 0
  var champTop4 = champRow ? champRow.top4 : 0
  var champTop4Pct = champGames > 0 ? Math.round((champTop4 / champGames) * 100) : null
  var podiumPlayers = standings.slice(0, 3).map(function(s) { return { name: s.playerName, pts: s.total } })

  return (
    <PageLayout>
      <div className="max-w-5xl mx-auto">

        {/* Back nav */}
        <button
          onClick={function() { navigate('/events'); }}
          className="flex items-center gap-1.5 text-on-surface-variant/50 hover:text-primary text-xs font-label font-bold tracking-wider uppercase mb-6 bg-transparent border-0 cursor-pointer transition-colors"
        >
          <Icon name="arrow_back" size={14} />
          {"Back to Events"}
        </button>

        {/* Page hero */}
        <div className="mb-8">
          <div className="font-label text-[11px] font-bold text-secondary tracking-[.18em] uppercase mb-1.5">
            {event.host ? "Hosted by " + event.host : "Custom Tournament"}
          </div>
          <h1 className="font-editorial text-on-background font-extrabold leading-none mb-3" style={{ fontSize: "clamp(28px,4.2vw,46px)" }}>
            {event.logo && <span className="mr-3 not-italic">{event.logo}</span>}
            {event.name}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={"px-3 py-1 rounded font-label text-xs tracking-wider font-bold border " + (isCompleted ? "bg-primary/10 text-primary border-primary/20" : event.status === 'live' ? "bg-tertiary/10 text-tertiary border-tertiary/20" : "bg-secondary/10 text-secondary border-secondary/20")}>
              {isCompleted ? 'COMPLETED' : event.status === 'live' ? 'LIVE' : 'UPCOMING'}
            </span>
            {event.date && (
              <div className="flex items-center gap-2 text-on-surface-variant/50 font-mono text-xs">
                <Icon name="calendar_today" size={13} />
                {event.date}
              </div>
            )}
            {event.format && (
              <div className="flex items-center gap-2 text-on-surface-variant/50 font-mono text-xs">
                <Icon name="sports_esports" size={13} />
                {event.format}
              </div>
            )}
            {event.region && <RegionBadge region={event.region} size="md" />}
          </div>
          {(event.tags || []).length > 0 && (
            <div className="flex gap-2 flex-wrap mt-3">
              {(event.tags || []).map(function(t) {
                return (
                  <span key={t} className="bg-secondary/10 border border-secondary/20 text-secondary text-[10px] font-label px-2 py-0.5 rounded uppercase tracking-wider">
                    {t}
                  </span>
                )
              })}
            </div>
          )}
          <div className="flex gap-2 flex-wrap mt-4">
            <button
              type="button"
              onClick={function() {
                var url = '/api/share-card?v=tournament' +
                  '&name=' + encodeURIComponent(event.name || '') +
                  (event.host ? '&host=' + encodeURIComponent(String(event.host).slice(0, 60)) : '') +
                  (event.starts_at ? '&start=' + encodeURIComponent(event.starts_at) : '') +
                  (event.region ? '&region=' + encodeURIComponent(event.region) : '');
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
              className="text-[10px] font-label uppercase tracking-widest text-tertiary hover:text-tertiary/80 flex items-center gap-1 border border-tertiary/30 bg-tertiary/10 px-2.5 py-1 rounded"
            >
              <Icon name="image" size={12} />
              Share card
            </button>
            <button
              type="button"
              onClick={function() {
                try {
                  var url = window.location.href;
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(url);
                    toast && toast('Link copied', 'success');
                  } else {
                    toast && toast('Copy not supported', 'error');
                  }
                } catch (e) { toast && toast('Copy failed', 'error') }
              }}
              className="text-[10px] font-label uppercase tracking-widest text-on-surface/60 hover:text-on-surface flex items-center gap-1 border border-outline-variant/20 bg-surface-container-high px-2.5 py-1 rounded"
            >
              <Icon name="link" size={12} />
              Copy link
            </button>
            <button
              type="button"
              onClick={function () {
                if (!pinTargetId) return
                var nowPinned = togglePinned(pinTargetId)
                setPinned(nowPinned)
                if (toast) toast(nowPinned ? 'Pinned' : 'Unpinned', 'success')
              }}
              disabled={!pinTargetId}
              className={'text-[10px] font-label uppercase tracking-widest flex items-center gap-1 border px-2.5 py-1 rounded ' + (pinned ? 'text-primary border-primary/40 bg-primary/10' : 'text-on-surface/60 hover:text-on-surface border-outline-variant/20 bg-surface-container-high')}
              title={pinned ? 'Unpin tournament' : 'Pin tournament'}
              aria-pressed={pinned}
            >
              <Icon name={pinned ? 'push_pin' : 'keep'} size={12} />
              {pinned ? 'Pinned' : 'Pin'}
            </button>
            {event.starts_at && (
              <AddToCalendarBtn
                start={event.starts_at}
                end={event.ends_at}
                durationMinutes={180}
                title={event.name || 'TFT Clash'}
                description={event.description || 'TFT Clash tournament on tftclash.com'}
                url={typeof window !== 'undefined' ? window.location.href : 'https://tftclash.com'}
                uid={'tftclash-' + (eventId || 'unknown')}
                filename={'tft-clash-' + (eventId || 'event') + '.ics'}
                variant="ghost"
              />
            )}
          </div>
        </div>

        {prizes.length > 0 && (
          <div className="mb-6">
            <PrizePoolCard prizes={prizes} sponsors={ctx.orgSponsors} />
          </div>
        )}

        {/* Registration bar */}
        <div className="bg-surface-container-low rounded border border-outline-variant/15 p-5 mb-6">
          {isTeamEvent && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded bg-tertiary/[0.08] border border-tertiary/25 text-[11px] text-tertiary">
              <Icon name="groups" size={14} />
              <span>{teamSize}v{teamSize} squads event - only team captains can register their team. <button type="button" onClick={function(){ navigate('/teams') }} className="underline font-bold bg-transparent border-0 text-tertiary cursor-pointer p-0">Manage teams</button></span>
            </div>
          )}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-on-surface">{liveCount}</span>
                <span className="text-on-surface-variant/50 font-mono text-sm">{"/ " + (isTeamEvent && size ? Math.floor(size / teamSize) : size)}</span>
              </div>
              <div className="text-[10px] font-label text-on-surface-variant/50 uppercase tracking-wider mt-0.5">
                {(isTeamEvent ? 'teams registered (' : 'players registered (') + regPercent + '%)'}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              {!isCompleted && currentUser && isRegistered && (
                <button
                  onClick={handleRegister}
                  disabled={liveReg.busy}
                  className={"px-5 py-2.5 font-label font-bold text-xs tracking-widest uppercase rounded transition-all border border-success/30 text-success bg-success/10 hover:bg-success/20 " + (liveReg.busy ? "opacity-50 cursor-not-allowed" : "")}>
                  {liveReg.busy ? 'Updating...' : (isTeamEvent ? (myCaptainTeam ? myCaptainTeam.name + ' - Withdraw' : 'Team registered - Withdraw') : 'Registered - Withdraw')}
                </button>
              )}
              {!isCompleted && currentUser && canRegister && isTeamEvent && !myCaptainTeam && (
                <Btn variant="secondary" size="sm" onClick={function(){ navigate('/teams') }}>
                  Captain a team to register
                </Btn>
              )}
              {!isCompleted && currentUser && canRegister && (!isTeamEvent || myCaptainTeam) && (
                <Btn variant="primary" size="sm" onClick={handleRegister} disabled={liveReg.busy}>
                  {liveReg.busy ? 'Registering...' : (isTeamEvent ? 'Register ' + (myCaptainTeam ? myCaptainTeam.name : 'Team') : 'Register Now')}
                </Btn>
              )}
              {!isCompleted && currentUser && isFull && !isRegistered && (
                <Btn variant="secondary" size="sm" disabled>
                  Tournament Full
                </Btn>
              )}
              {!isCompleted && !currentUser && (
                <Btn variant="primary" size="sm" onClick={function() { setAuthScreen('login'); }}>
                  Sign In to Register
                </Btn>
              )}
            </div>
          </div>
          <div className="w-full bg-surface-container-lowest rounded-full h-1.5 overflow-hidden mt-3">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{width: Math.min(100, regPercent) + '%'}} />
          </div>
        </div>

        {/* Captain check-in panel - team events, check-in phase, captain registered */}
        {isTeamEvent && isRegistered && myCaptainTeam && (isCheckInPhase || isAlreadyCheckedIn) && !isCompleted && (
          <div className={"rounded border p-5 mb-6 " + (isAlreadyCheckedIn ? "bg-success/[0.06] border-success/30" : "bg-tertiary/[0.06] border-tertiary/30")}>
            <div className="flex items-center gap-2 mb-3">
              <Icon name={isAlreadyCheckedIn ? 'check_circle' : 'how_to_reg'} size={16} className={isAlreadyCheckedIn ? 'text-success' : 'text-tertiary'} />
              <span className={"font-label text-[11px] font-bold tracking-[.18em] uppercase " + (isAlreadyCheckedIn ? 'text-success' : 'text-tertiary')}>
                {isAlreadyCheckedIn ? 'Team Checked In' : 'Captain Check-In'}
              </span>
            </div>
            <div className="font-display text-on-surface text-lg font-bold mb-1">
              {myCaptainTeam.name} {myCaptainTeam.tag ? <span className="text-on-surface/40 font-mono text-sm">[{myCaptainTeam.tag}]</span> : null}
            </div>
            <div className="text-[11px] text-on-surface-variant/60 mb-4">
              {isAlreadyCheckedIn
                ? ('Lineup locked. ' + lineupSel.length + ' starters confirmed.')
                : ('Pick exactly ' + teamSize + ' starters from your active roster, then check in. Subs cannot be swapped in mid-event.')}
            </div>
            <div className="space-y-1.5 mb-4">
              {teamRoster.length === 0 ? (
                <div className="text-sm text-on-surface/50">Loading roster...</div>
              ) : teamRoster.map(function(m) {
                var p = m.player || {};
                var selected = lineupSel.indexOf(m.player_id) !== -1;
                var locked = isAlreadyCheckedIn;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={locked}
                    onClick={locked ? undefined : function(){ toggleLineupSel(m.player_id); }}
                    className={'w-full flex items-center justify-between gap-2 px-3 py-2 rounded border text-sm transition-colors ' +
                      (selected
                        ? 'bg-primary/15 border-primary/50 text-on-surface'
                        : locked
                          ? 'bg-surface-container/40 border-outline-variant/10 text-on-surface/40 cursor-not-allowed'
                          : 'bg-surface-container/40 border-outline-variant/15 text-on-surface hover:border-outline-variant/40 cursor-pointer')}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Icon name={selected ? 'check_box' : 'check_box_outline_blank'} size={16} className={selected ? 'text-primary' : 'text-on-surface/40'} />
                      <span className="font-bold truncate">{p.username || 'Unknown'}</span>
                      {p.riot_id ? <span className="text-[11px] font-mono text-on-surface/50 truncate">{p.riot_id}</span> : null}
                      <span className={'text-[9px] font-label font-black uppercase tracking-widest px-1.5 py-0.5 rounded ' +
                        (m.role === 'captain' ? 'bg-primary/15 text-primary' : m.role === 'sub' ? 'bg-tertiary/15 text-tertiary' : 'bg-secondary/15 text-secondary')}>
                        {m.role}
                      </span>
                    </span>
                  </button>
                );
              })}
              {(eventRingers || []).filter(function(r){ return r.status === 'accepted'; }).map(function(r) {
                var p = r.players || {};
                var selected = lineupSel.indexOf(r.player_id) !== -1;
                var locked = isAlreadyCheckedIn;
                return (
                  <button
                    key={'ringer-' + r.id}
                    type="button"
                    disabled={locked}
                    onClick={locked ? undefined : function(){ toggleLineupSel(r.player_id); }}
                    className={'w-full flex items-center justify-between gap-2 px-3 py-2 rounded border text-sm transition-colors ' +
                      (selected
                        ? 'bg-primary/15 border-primary/50 text-on-surface'
                        : locked
                          ? 'bg-surface-container/40 border-outline-variant/10 text-on-surface/40 cursor-not-allowed'
                          : 'bg-surface-container/40 border-outline-variant/15 text-on-surface hover:border-outline-variant/40 cursor-pointer')}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Icon name={selected ? 'check_box' : 'check_box_outline_blank'} size={16} className={selected ? 'text-primary' : 'text-on-surface/40'} />
                      <span className="font-bold truncate">{p.username || 'Ringer'}</span>
                      {p.riot_id ? <span className="text-[11px] font-mono text-on-surface/50 truncate">{p.riot_id}</span> : null}
                      <span className="text-[9px] font-label font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-secondary/15 text-secondary">RINGER</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {!isAlreadyCheckedIn && (
              <div className="bg-surface-container-low/40 border border-outline-variant/15 rounded p-3 mb-4">
                <div className="text-[10px] uppercase tracking-widest font-label text-on-surface/60 mb-2">Invite a ringer for this event</div>
                <form
                  onSubmit={function(e){
                    e.preventDefault();
                    var name = (ringerInviteName || '').trim();
                    if (!name) { toast('Enter a username.', 'error'); return; }
                    setRingerBusy(true);
                    supabase.from('players').select('id, username').ilike('username', name).limit(1).maybeSingle().then(function(pRes){
                      if (pRes.error || !pRes.data) { setRingerBusy(false); toast('Player not found.', 'error'); return; }
                      inviteTeamRinger(myCaptainTeam.id, dbTournamentId, pRes.data.id, '').then(function(){
                        setRingerBusy(false); setRingerInviteName(''); setRingerReload(function(n){ return n + 1; });
                        toast('Ringer invite sent to ' + pRes.data.username + '.', 'success');
                      }).catch(function(err){ setRingerBusy(false); toast('Invite failed: ' + (err.message || 'unknown error'), 'error'); });
                    }).catch(function(){ setRingerBusy(false); toast('Lookup failed.', 'error'); });
                  }}
                  className="flex gap-2"
                >
                  <input type="text" value={ringerInviteName} onChange={function(e){ setRingerInviteName(e.target.value); }} placeholder="Riot ID or username" className="flex-1 bg-surface-container border border-outline-variant/20 rounded px-3 py-1.5 text-sm text-on-surface" />
                  <Btn type="submit" size="sm" disabled={ringerBusy} icon="person_add">{ringerBusy ? '...' : 'Invite'}</Btn>
                </form>
                {(eventRingers || []).filter(function(r){ return r.status === 'pending'; }).length > 0 && (
                  <div className="mt-2 text-[11px] text-on-surface/55">
                    {(eventRingers || []).filter(function(r){ return r.status === 'pending'; }).length + ' ringer invite(s) pending response.'}
                  </div>
                )}
              </div>
            )}
            {!isAlreadyCheckedIn && (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-[11px] text-on-surface/60">
                  Selected <span className="font-bold text-on-surface">{lineupSel.length}</span> / {teamSize}
                </div>
                <Btn
                  variant="primary"
                  size="sm"
                  onClick={submitTeamCheckIn}
                  disabled={checkInBusy || lineupSel.length !== teamSize}
                >
                  {checkInBusy ? 'Checking in...' : 'Check In Team'}
                </Btn>
              </div>
            )}
          </div>
        )}

        {/* What's next - shown to registered players on upcoming tournaments */}
        {!isCompleted && currentUser && isRegistered && (
          <div className="bg-success/5 border border-success/25 rounded p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="check_circle" size={16} className="text-success" />
              <span className="font-label text-[11px] font-bold text-success tracking-[.18em] uppercase">You're In</span>
            </div>
            <div className="font-display text-on-surface text-lg font-bold mb-3">What happens next</div>
            <ol className="space-y-2 text-sm text-on-surface-variant">
              <li className="flex items-start gap-3">
                <span className="font-mono text-xs font-bold text-success bg-success/10 border border-success/30 rounded w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span><span className="text-on-surface font-semibold">Check in</span> opens shortly before start time. Watch for the alert in the top strip and on the homepage.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="font-mono text-xs font-bold text-success bg-success/10 border border-success/30 rounded w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span><span className="text-on-surface font-semibold">Lobbies and bracket</span> appear in the live dashboard once check-in closes. You'll be assigned automatically.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="font-mono text-xs font-bold text-success bg-success/10 border border-success/30 rounded w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">3</span>
                <span><span className="text-on-surface font-semibold">Play your games</span> on the {event.region ? normalizeRegion(event.region) : ''} server using the Riot ID linked to your account. Admins post results after each round.</span>
              </li>
              {prizes.length > 0 && (
                <li className="flex items-start gap-3">
                  <span className="font-mono text-xs font-bold text-success bg-success/10 border border-success/30 rounded w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">4</span>
                  <span><span className="text-on-surface font-semibold">Claim your prize</span> from your account page if you finish in the money. We'll notify you when claims open.</span>
                </li>
              )}
            </ol>
            <div className="mt-4 pt-3 border-t border-success/15 text-[11px] font-label text-on-surface-variant/60 uppercase tracking-wider">
              Need to drop? Use the Withdraw button above before check-in opens.
            </div>
          </div>
        )}

        {/* Champion banner - clash-style for completed tournaments */}
        {isCompleted && champName && (
          <div className="relative overflow-hidden rounded-xl px-6 md:px-8 py-6 md:py-7 mb-6 flex items-center gap-5 md:gap-6 flex-wrap" style={{
            background: "linear-gradient(135deg,rgba(232,168,56,.22),rgba(155,114,207,.08),rgba(8,8,15,1))",
            border: "1px solid rgba(232,168,56,.55)",
            boxShadow: "0 0 60px rgba(232,168,56,.18),inset 0 0 80px rgba(232,168,56,.04)"
          }}>
            <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: "linear-gradient(90deg,transparent,#E8A838,#FFD700,#E8A838,transparent)" }} />
            <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(232,168,56,.3),transparent)" }} />
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center shrink-0" style={{
              background: "linear-gradient(135deg,rgba(232,168,56,.25),rgba(232,168,56,.06))",
              border: "2px solid rgba(232,168,56,.7)",
              boxShadow: "0 0 24px rgba(232,168,56,.35)"
            }}>
              <Icon name="emoji_events" size={36} fill className="text-primary" />
            </div>
            <div className="flex-1 min-w-[180px]">
              <div className="font-label text-[11px] font-bold text-primary tracking-[.16em] uppercase mb-1 flex items-center gap-1">
                <Icon name="emoji_events" size={11} className="text-primary" />
                Tournament Champion
              </div>
              <div className="font-editorial text-on-surface font-extrabold leading-none mb-2" style={{ fontSize: "clamp(24px,3.6vw,40px)" }}>{champName}</div>
              {event.top4 && event.top4.length > 0 && !champRow && (
                <div className="text-on-surface-variant text-xs">{"Top 4: " + event.top4.join(', ')}</div>
              )}
            </div>
            {champPts != null && (
              <div className="flex gap-3 flex-wrap">
                <div className="text-center px-3 md:px-4 py-2 md:py-2.5 bg-black/30 rounded-lg min-w-[60px]">
                  <div className="font-mono text-lg md:text-xl font-bold leading-none text-primary">{champPts}</div>
                  <div className="font-label text-[10px] text-muted font-semibold uppercase tracking-[.06em] mt-1">Pts</div>
                </div>
                <div className="text-center px-3 md:px-4 py-2 md:py-2.5 bg-black/30 rounded-lg min-w-[60px]">
                  <div className="font-mono text-lg md:text-xl font-bold leading-none text-success">{champWins}</div>
                  <div className="font-label text-[10px] text-muted font-semibold uppercase tracking-[.06em] mt-1">Wins</div>
                </div>
                <div className="text-center px-3 md:px-4 py-2 md:py-2.5 bg-black/30 rounded-lg min-w-[60px]">
                  <div className="font-mono text-lg md:text-xl font-bold leading-none text-secondary">{champGames}</div>
                  <div className="font-label text-[10px] text-muted font-semibold uppercase tracking-[.06em] mt-1">Games</div>
                </div>
                {champTop4Pct != null && (
                  <div className="text-center px-3 md:px-4 py-2 md:py-2.5 bg-black/30 rounded-lg min-w-[60px]">
                    <div className="font-mono text-lg md:text-xl font-bold leading-none text-tertiary">{champTop4Pct + '%'}</div>
                    <div className="font-label text-[10px] text-muted font-semibold uppercase tracking-[.06em] mt-1">Top4%</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Podium - top 3 standings (mirrors HoF / Clash layout) */}
        {isCompleted && podiumPlayers.length >= 3 && (
          <Podium players={podiumPlayers} className="mb-2" />
        )}

        {/* Tabs */}
        <PillTabGroup align="start" className="mb-6">
          {DETAIL_TABS.map(function(t) {
            return (
              <PillTab
                key={t.id}
                icon={t.icon}
                active={detailTab === t.id}
                onClick={function() { setDetailTab(t.id); }}
              >
                {t.label}
              </PillTab>
            )
          })}
        </PillTabGroup>

        {/* TAB: OVERVIEW */}
        {detailTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-5">

              {/* Tournament details */}
              <div className="bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <Icon name="tune" size={18} className="text-primary" />
                  <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">Tournament Details</span>
                </div>
                <div className="grid grid-cols-2 gap-px bg-outline-variant/5">
                  {[
                    {label: 'Format', value: event.format || 'Standard', icon: 'shuffle'},
                    {label: 'Players', value: liveCount + ' / ' + size, icon: 'group'},
                    {label: 'Date', value: event.date || 'TBD', icon: 'calendar_today'},
                    {label: 'Region', value: event.region || 'All', icon: 'public'}
                  ].map(function(item) {
                    return (
                      <div key={item.label} className="bg-surface-container-low p-4">
                        <div className="text-[10px] font-label text-on-surface-variant/50 uppercase tracking-wider mb-1">{item.label}</div>
                        <div className="font-mono text-sm font-bold text-on-surface">{item.value}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Description */}
              {event.description && (
                <div className="bg-surface-container-low rounded border border-outline-variant/15 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name="description" size={16} className="text-primary" />
                    <span className="text-xs font-label font-bold text-primary tracking-widest uppercase">About</span>
                  </div>
                  <div className="text-sm text-on-surface leading-relaxed">{event.description}</div>
                </div>
              )}

              {/* Scoring */}
              <div className="bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <Icon name="leaderboard" size={18} className="text-tertiary" />
                  <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">Scoring</span>
                </div>
                <div className="grid grid-cols-4 gap-px bg-outline-variant/5">
                  {PLACE_POINTS.map(function(pp) {
                    return (
                      <div key={pp.place} className={"p-4 text-center " + pp.bg}>
                        <div className="text-[10px] font-label text-on-surface-variant/50 uppercase tracking-wider mb-1">{pp.place}</div>
                        <div className={"font-mono text-lg font-bold " + pp.color}>{"+" + pp.pts.replace(' PTS', '')}</div>
                      </div>
                    )
                  })}
                </div>
                <div className="px-5 py-3 text-xs text-on-surface-variant/50">
                  {"Full scoring: 1st=8, 2nd=7, 3rd=6, 4th=5, 5th=4, 6th=3, 7th=2, 8th=1"}
                </div>
              </div>
            </div>

            {/* Right sidebar */}
            <div className="lg:col-span-5 space-y-5">

              {/* Registered players */}
              <div className="bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <Icon name="group" size={18} className="text-primary" />
                  <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">
                    {"Players (" + registeredIds.length + ")"}
                  </span>
                </div>
                {registeredIds.length === 0 ? (
                  <div className="text-center py-12 px-5">
                    <Icon name="person_add" size={32} className="text-on-surface-variant/20 mx-auto mb-3" />
                    <div className="text-on-surface text-sm font-semibold mb-1">Be the first to register</div>
                    <div className="text-on-surface-variant text-xs">Seats fill fast once the first name drops.</div>
                  </div>
                ) : (
                  <div className="divide-y divide-outline-variant/5">
                    {registeredIds.slice(0, 12).map(function(username, i) {
                      var leadingClass = i === 0 ? ' bg-primary/5' : ''
                      return (
                        <div key={username} className={"flex items-center gap-3 px-5 py-2.5" + leadingClass}>
                          <div className="w-7 h-7 rounded bg-surface-container-high flex items-center justify-center flex-shrink-0">
                            <Icon name="person" size={14} className="text-on-surface-variant/40" />
                          </div>
                          <span className="font-mono text-sm font-bold text-on-surface flex-1">{username}</span>
                          <span className="text-[10px] font-label text-on-surface-variant/40 tracking-wider">{"#" + (i + 1)}</span>
                        </div>
                      )
                    })}
                    {registeredIds.length > 12 && (
                      <div className="text-center py-3">
                        <span className="text-[10px] font-label text-on-surface-variant/40 uppercase tracking-wider">
                          {"+" + (registeredIds.length - 12) + " more"}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Host info */}
              <div className="bg-surface-container-low rounded border border-outline-variant/15 p-5 text-center">
                <div className="text-[10px] font-label text-on-surface-variant/50 uppercase tracking-wider mb-2">Hosted By</div>
                <div className="font-editorial text-xl text-primary">{event.host || 'TFT Clash'}</div>
                {event.sponsor && (
                  <div className="mt-4 pt-4 border-t border-outline-variant/10">
                    <div className="text-[10px] font-label text-on-surface-variant/50 uppercase tracking-wider mb-2">Presented By</div>
                    <div className="font-editorial text-lg text-on-surface/60">{event.sponsor}</div>
                  </div>
                )}
              </div>

              {/* Live odds (computed from registered roster) */}
              {registeredIds.length > 1 && (
                <LiveOdds players={registeredIds.map(function (un) {
                  var p = (players || []).find(function (pl) { return pl.name && pl.name.toLowerCase() === String(un).toLowerCase() })
                  return p || { id: un, name: un, pts: 0, top4: 0, games: 0 }
                })} max={8} />
              )}

              {/* AI match recap - completed events */}
              {isCompleted && standings && standings.length > 0 && (
                <AiMatchRecap
                  threadId={'t-' + (eventId || 'unknown')}
                  eventName={event.name || event.title || ''}
                  podium={standings.slice(0, 3).map(function (s) {
                    var p = (players || []).find(function (pl) { return String(pl.id) === String(s.player_id) })
                    return { id: s.player_id, name: p ? p.name : (s.player_name || 'Unknown') }
                  })}
                />
              )}

              {/* Social share bar - always visible on tournament pages */}
              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container p-4">
                <div className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/60 mb-2">Spread the word</div>
                <SocialShareBar
                  url={typeof window !== 'undefined' ? window.location.href : 'https://tftclash.com'}
                  text={isCompleted
                    ? ((event.name || 'TFT Clash') + ' just wrapped on tftclash.com')
                    : ((event.name || 'TFT Clash tournament') + ' is coming up on tftclash.com')}
                />
              </div>

              {/* Prediction game - fans pick winner + top4 */}
              <PredictionGame
                threadId={'t-' + (eventId || 'unknown')}
                currentUser={currentUser}
                registeredPlayers={registeredIds.map(function (un) {
                  var p = (players || []).find(function (pl) { return pl.name && pl.name.toLowerCase() === String(un).toLowerCase() })
                  return p || { id: un, name: un }
                })}
                startsAt={event.starts_at || event.startTime || event.startsAt}
                isCompleted={isCompleted}
                actualWinnerId={isCompleted && standings[0] ? standings[0].player_id : null}
                actualTop4Ids={isCompleted ? standings.slice(0, 4).map(function (s) { return s.player_id }) : []}
              />

              {/* Host management link */}
              {currentUser && event.dbTournamentId && currentUser.auth_user_id === event.host_id && (
                <button
                  onClick={function() { navigate('/host/dashboard'); }}
                  className="w-full flex items-center justify-center gap-2 bg-secondary/10 border border-secondary/20 text-secondary font-label font-bold text-xs uppercase tracking-widest px-5 py-3 rounded hover:bg-secondary/20 transition-colors"
                >
                  <Icon name="manage_accounts" size={16} />
                  Manage Tournament
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB: BRACKET */}
        {detailTab === 'bracket' && (
          <div>
            {loadingResults && (
              <div className="text-center py-16">
                <Icon name="hourglass_empty" size={32} className="text-on-surface-variant/30 mx-auto mb-3 animate-spin" />
                <span className="font-label uppercase tracking-widest text-sm text-on-surface-variant">Loading bracket...</span>
              </div>
            )}
            {!loadingResults && tournamentResults.length === 0 && (
              <div className="text-center py-16">
                <Icon name="account_tree" size={40} className="text-on-surface-variant/20 mx-auto mb-3" />
                <div className="text-on-surface text-lg font-bold mb-1">No Bracket Data Yet</div>
                <div className="text-on-surface-variant text-sm">Results will appear once games are played.</div>
              </div>
            )}
            {!loadingResults && bracketRoundKeys.length > 0 && (
              <div className="space-y-5">
                {bracketRoundKeys.map(function(rk) {
                  var roundResults = bracketRounds[rk].sort(function(a, b) { return a.placement - b.placement; })
                  var teamScores = []
                  if (isTeamEvent) {
                    var byTeam = {}
                    roundResults.forEach(function(r) {
                      if (!r.team_id) return
                      if (!byTeam[r.team_id]) byTeam[r.team_id] = { team_id: r.team_id, score: 0, top4: 0, top2: 0, fourths: 0, firsts: 0, lastPlacement: 9 }
                      var s = byTeam[r.team_id]
                      var place = r.placement || 0
                      s.score += r.points || 0
                      if (place === 1) { s.firsts += 1; s.top2 += 1 }
                      else if (place === 2) { s.top2 += 1 }
                      else if (place === 4) { s.fourths += 1 }
                      if (place > 0 && place <= 4) s.top4 += 1
                      if (place > 0 && place < s.lastPlacement) s.lastPlacement = place
                    })
                    teamScores = Object.values(byTeam).sort(function(a, b) {
                      if (b.score !== a.score) return b.score - a.score
                      if (b.top2 !== a.top2) return b.top2 - a.top2
                      if (a.fourths !== b.fourths) return a.fourths - b.fourths
                      if (b.firsts !== a.firsts) return b.firsts - a.firsts
                      return (a.lastPlacement || 9) - (b.lastPlacement || 9)
                    })
                  }
                  return (
                    <div key={rk} className="bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
                      <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                        <Icon name="emoji_events" size={18} className="text-tertiary" />
                        <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">{rk}</span>
                      </div>
                      {isTeamEvent && teamScores.length > 0 && (
                        <div className="px-5 py-3 bg-primary/[0.04] border-b border-outline-variant/5">
                          <div className="text-[10px] font-label text-on-surface-variant/50 uppercase tracking-wider mb-2">Team Score</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {teamScores.map(function(ts, idx) {
                              var meta = eventTeams[ts.team_id] || {}
                              var label = (meta.name || 'Team') + (meta.tag ? ' [' + meta.tag + ']' : '')
                              return (
                                <div key={ts.team_id} className={"flex items-center gap-2 px-3 py-2 rounded border " + (idx === 0 ? 'border-primary/30 bg-primary/10' : 'border-outline-variant/15 bg-surface-container/40')}>
                                  <span className={"font-mono text-xs font-bold " + (idx === 0 ? 'text-primary' : 'text-on-surface-variant/60')}>{idx === 0 ? 'W' : '.'}</span>
                                  <span className="flex-1 text-sm font-bold text-on-surface truncate">{label}</span>
                                  <span className="font-mono text-xs text-on-surface-variant/60">{'top4 ' + ts.top4}</span>
                                  <span className={"font-mono text-sm font-bold " + (idx === 0 ? 'text-primary' : 'text-tertiary')}>{ts.score + ' pts'}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      <div className="divide-y divide-outline-variant/5">
                        {roundResults.map(function(r) {
                          var playerName = playerNameMap[r.player_id] || 'Player ' + r.player_id
                          var placeClass = PLACE_CLASSES[Math.min(r.placement - 1, 7)] || 'text-on-surface-variant/40'
                          var teamMeta = isTeamEvent && r.team_id ? (eventTeams[r.team_id] || {}) : null
                          return (
                            <div key={r.player_id} className={"flex items-center gap-3 px-5 py-2.5 " + (r.placement <= 3 ? 'bg-primary/3' : '')}>
                              <span className={"font-mono text-sm font-bold min-w-[22px] text-center " + placeClass}>
                                {r.placement}
                              </span>
                              <span className="flex-1 text-sm text-on-surface flex items-center gap-2 min-w-0">
                                <span className="truncate">{playerName}</span>
                                {teamMeta && teamMeta.tag ? (
                                  <span className="text-[9px] font-label font-bold uppercase tracking-widest text-on-surface-variant/50 bg-surface-container/60 px-1.5 py-0.5 rounded">
                                    {teamMeta.tag}
                                  </span>
                                ) : null}
                              </span>
                              <span className="font-mono text-xs font-bold text-primary">{r.points + " pts"}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: STANDINGS */}
        {detailTab === 'standings' && (
          <div className="space-y-5">
            {loadingResults && (
              <div className="text-center py-16">
                <Icon name="hourglass_empty" size={32} className="text-on-surface-variant/30 mx-auto mb-3 animate-spin" />
                <span className="font-label uppercase tracking-widest text-sm text-on-surface-variant">Loading standings...</span>
              </div>
            )}
            {!loadingResults && standings.length === 0 && (
              <div className="text-center py-16">
                <Icon name="bar_chart" size={40} className="text-on-surface-variant/20 mx-auto mb-3" />
                <div className="text-on-surface text-lg font-bold mb-1">No Standings Yet</div>
                <div className="text-on-surface-variant text-sm">Standings update as games are played.</div>
              </div>
            )}

            {/* Team standings - team events only */}
            {isTeamEvent && teamStandings.length > 0 && (
              <div className="bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <Icon name="groups" size={18} className="text-primary" />
                  <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">
                    {isCompleted ? 'Final Team Standings' : 'Team Standings'}
                  </span>
                  <span className="ml-auto text-[10px] font-label text-on-surface-variant/50 uppercase tracking-wider">
                    {teamSize}v{teamSize} squads
                  </span>
                </div>
                <div className="divide-y divide-outline-variant/5">
                  {teamStandings.map(function(t, i) {
                    var placeClass = PLACE_CLASSES[Math.min(i, 7)] || 'text-on-surface-variant/40'
                    return (
                      <div key={t.team_id} className={"flex items-center gap-3 px-5 py-3 " + (i === 0 ? 'bg-primary/5' : '')}>
                        <span className={"font-mono text-sm font-bold min-w-[22px] text-center " + placeClass}>
                          {i + 1}
                        </span>
                        <span className={"flex-1 min-w-0 text-sm " + (i === 0 ? "text-primary font-bold" : "text-on-surface")}>
                          <span className="font-bold truncate">{t.teamName}</span>
                          {t.teamTag ? <span className="text-on-surface/40 font-mono text-xs ml-2">[{t.teamTag}]</span> : null}
                        </span>
                        <span className="text-[10px] font-label text-on-surface-variant/40 uppercase tracking-wider hidden sm:inline">
                          {t.games + " games"}
                        </span>
                        <span className="text-[10px] font-label text-on-surface-variant/40 uppercase tracking-wider hidden sm:inline">
                          {t.top4 + " top4"}
                        </span>
                        <span className="font-mono text-sm font-bold text-tertiary min-w-[3rem] text-right">
                          {t.total + " pts"}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="px-5 py-3 text-[11px] text-on-surface-variant/50 border-t border-outline-variant/10">
                  Tiebreakers: total points - best individual placement - top 2 finishes - top 4 finishes.
                </div>
              </div>
            )}

            {/* Per-player standings - always shown when results exist */}
            {standings.length > 0 && (
              <div className="bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <Icon name="bar_chart" size={18} className="text-tertiary" />
                  <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">
                    {isTeamEvent ? 'Individual Performance' : (isCompleted ? 'Final Results' : 'Current Standings')}
                  </span>
                </div>
                <div className="divide-y divide-outline-variant/5">
                  {standings.map(function(s, i) {
                    var placeClass = PLACE_CLASSES[Math.min(i, 7)] || 'text-on-surface-variant/40'
                    return (
                      <div key={s.player_id} className={"flex items-center gap-3 px-5 py-3 " + (i === 0 ? 'bg-primary/5' : '')}>
                        <span className={"font-mono text-sm font-bold min-w-[22px] text-center " + placeClass}>
                          {i + 1}
                        </span>
                        <span className={"flex-1 text-sm " + (i === 0 ? "text-primary font-bold" : "text-on-surface")}>
                          {s.playerName}
                        </span>
                        <span className="text-[10px] font-label text-on-surface-variant/40 uppercase tracking-wider">
                          {s.games.length + " games"}
                        </span>
                        <span className="font-mono text-sm font-bold text-tertiary min-w-[3rem] text-right">
                          {s.total + " pts"}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: RULES */}
        {detailTab === 'rules' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-5">

              {/* Points system */}
              <div className="bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <Icon name="leaderboard" size={18} className="text-primary" />
                  <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">Points System</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        {['Place', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].map(function(h) {
                          return (
                            <th key={h} className="py-3 px-2 border-b border-outline-variant/10 text-center font-label font-bold uppercase tracking-wider text-on-surface-variant/50 text-[10px]">{h}</th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-3 px-2 text-center font-label text-[10px] uppercase tracking-wider text-on-surface-variant/50">Pts</td>
                        {[8, 7, 6, 5, 4, 3, 2, 1].map(function(p, i) {
                          return (
                            <td key={p} className={"py-3 px-2 text-center font-mono font-bold " + (i === 0 ? 'text-primary' : 'text-on-surface/70')}>{p}</td>
                          )
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tiebreakers */}
              <div className="bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <Icon name="gavel" size={18} className="text-secondary" />
                  <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">Tiebreaker Rules</span>
                </div>
                <div className="divide-y divide-outline-variant/5">
                  {TIEBREAKERS.map(function(tb) {
                    return (
                      <div key={tb.n} className="flex gap-4 items-start px-5 py-3">
                        <span className="font-mono text-xs font-bold text-secondary flex-shrink-0 mt-0.5">{tb.n}</span>
                        <div>
                          <div className="font-label font-bold text-xs text-on-surface uppercase tracking-wider mb-0.5">{tb.title}</div>
                          <div className="text-xs text-on-surface-variant/60">{tb.desc}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Tournament rules text */}
              <div className="bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <Icon name="description" size={18} className="text-tertiary" />
                  <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">Tournament Rules</span>
                </div>
                <div className="px-5 py-4 text-sm text-on-surface/70 leading-relaxed whitespace-pre-wrap">
                  {event.rulesText || event.rules_text || event.rules || 'Standard TFT Clash ruleset applies. All participants must adhere to the code of conduct and Riot Terms of Service.'}
                </div>
              </div>
            </div>

            {/* Rules sidebar */}
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <Icon name="info" size={18} className="text-primary" />
                  <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">Quick Reference</span>
                </div>
                <div className="divide-y divide-outline-variant/5">
                  {[
                    {label: 'Players', value: event.size || 'TBD'},
                    {label: 'Format', value: event.format || 'Standard'},
                    event.region ? {label: 'Region', value: event.region} : null,
                    event.time ? {label: 'Start Time', value: event.time} : null
                  ].filter(Boolean).map(function(item) {
                    return (
                      <div key={item.label} className="flex justify-between items-center px-5 py-3">
                        <span className="text-[10px] font-label uppercase tracking-wider text-on-surface-variant/50">{item.label}</span>
                        <span className="font-mono text-sm font-bold text-on-surface">{item.value}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </PageLayout>
  )
}
