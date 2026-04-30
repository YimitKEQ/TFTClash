import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase.js'
import { PTS, RANKS } from '../lib/constants.js'
import { shareToTwitter, buildShareText, ordinal } from '../lib/utils.js'
import { buildFlashLobbies, buildTeamLobbies } from '../lib/tournament.js'
import { createNotification, writeAuditLog } from '../lib/notifications.js'
import { notifyTeamMembers } from '../lib/teams.js'
import PageLayout from '../components/layout/PageLayout'
import Icon from '../components/ui/Icon.jsx'
import { Btn, Sel, PillTab, PillTabGroup } from '../components/ui'
import PrizePoolCard from '../components/shared/PrizePoolCard'
import RegionBadge from '../components/shared/RegionBadge'
import LiveDashboardLayout from '../components/shared/LiveDashboardLayout'
import { canRegisterInRegion, regionMismatchMessage } from '../lib/regions.js'

export default function FlashTournamentScreen(props) {
  var tournamentId = props.tournamentId;

  var ctx = useApp();
  var currentUser = ctx.currentUser;
  var setAuthScreen = ctx.setAuthScreen;
  var toast = ctx.toast;
  var setScreen = ctx.setScreen;
  var players = ctx.players;
  var isAdmin = ctx.isAdmin;
  var navigate = useNavigate();

  var _tournament = useState(null);
  var tournament = _tournament[0];
  var setTournament = _tournament[1];
  var _registrations = useState([]);
  var registrations = _registrations[0];
  var setRegistrations = _registrations[1];
  var _lobbies = useState([]);
  var lobbies = _lobbies[0];
  var setLobbies = _lobbies[1];
  var _lobbyCodeInputs = useState({});
  var lobbyCodeInputs = _lobbyCodeInputs[0];
  var setLobbyCodeInputs = _lobbyCodeInputs[1];
  var _loading = useState(true);
  var loading = _loading[0];
  var setLoading = _loading[1];
  var _activeTab = useState('info');
  var activeTab = _activeTab[0];
  var setActiveTab = _activeTab[1];
  var _actionLoading = useState(false);
  var actionLoading = _actionLoading[0];
  var setActionLoading = _actionLoading[1];
  var _reports = useState([]);
  var reports = _reports[0];
  var setReports = _reports[1];
  var _myPlacement = useState(0);
  var myPlacement = _myPlacement[0];
  var setMyPlacement = _myPlacement[1];
  var _disputeForm = useState({open: false, lobbyId: null, claimed: 0, reason: '', screenshotUrl: ''});
  var disputeForm = _disputeForm[0];
  var setDisputeForm = _disputeForm[1];
  var _disputes = useState([]);
  var disputes = _disputes[0];
  var setDisputes = _disputes[1];
  var _gameResults = useState([]);
  var gameResults = _gameResults[0];
  var setGameResults = _gameResults[1];
  var _adminLineupModal = useState({open: false, regId: null, sel: [], rosterMembers: [], teamName: '', tag: ''});
  var adminLineupModal = _adminLineupModal[0];
  var setAdminLineupModal = _adminLineupModal[1];
  var channelRef = useRef(null);

  function loadTournament() {
    return supabase.from('tournaments').select('*').eq('id', tournamentId).single().then(function(res) {
      if (res.error) { return res; }
      if (res.data) setTournament(res.data);
      return res;
    });
  }

  function loadRegistrations() {
    return supabase.from('registrations')
      .select('*, players(username, riot_id, rank, region), teams!registrations_team_id_fkey(id, name, tag)')
      .eq('tournament_id', tournamentId)
      .then(function(res) {
        if (res.data) setRegistrations(res.data);
        return res;
      });
  }

  function loadLobbies() {
    return supabase.from('lobbies').select('*').eq('tournament_id', tournamentId).order('lobby_number', {ascending: true}).then(function(res) {
      if (res.data) setLobbies(res.data);
      return res;
    });
  }

  function loadReports() {
    var gameNum = tournament ? (tournament.current_round || 1) : 1;
    return supabase.from('player_reports').select('*').eq('tournament_id', tournamentId).eq('game_number', gameNum)
      .then(function(res) {
        if (res.data) setReports(res.data);
        return res;
      });
  }

  function loadDisputes() {
    return supabase.from('disputes').select('*, players(username)').eq('tournament_id', tournamentId)
      .then(function(res) {
        if (res.data) setDisputes(res.data);
        return res;
      });
  }

  function loadResults() {
    return supabase.from('game_results')
      .select('player_id, placement, points, game_number, players(username, rank, riot_id)')
      .eq('tournament_id', tournamentId)
      .order('game_number')
      .then(function(res) {
        if (res.data) setGameResults(res.data);
        return res;
      });
  }

  useEffect(function() {
    Promise.all([loadTournament(), loadRegistrations(), loadLobbies(), loadDisputes(), loadResults()]).then(function() { setLoading(false); }).catch(function() { setLoading(false); });
  }, [tournamentId]);

  useEffect(function() {
    if (tournament) loadReports();
  }, [tournament && tournament.current_round, tournament && tournament.id]);

  useEffect(function() {
    if (!tournamentId) return;
    var channel = supabase.channel('tournament-' + tournamentId);
    channelRef.current = channel;
    channel.on('broadcast', {event: 'update'}, function(payload) {
      var type = payload.payload ? payload.payload.type : '';
      if (type === 'phase_change') loadTournament();
      if (type === 'registration') loadRegistrations();
      if (type === 'lobbies_generated') loadLobbies();
      if (type === 'report_submitted') loadReports();
      if (type === 'lobby_locked') { loadLobbies(); loadResults(); }
      if (type === 'next_game') { loadTournament(); loadLobbies(); loadReports(); }
      if (type === 'finalized') { loadTournament(); loadResults(); }
    });
    channel.on('postgres_changes', {event: '*', schema: 'public', table: 'registrations', filter: 'tournament_id=eq.' + tournamentId}, function() {
      loadRegistrations();
    });
    channel.subscribe();
    return function() { supabase.removeChannel(channel); channelRef.current = null; };
  }, [tournamentId]);

  useEffect(function() {
    if (phase === 'in_progress' && activeTab === 'info') {
      setActiveTab('live');
    }
  }, [phase]);

  function broadcastUpdate(type) {
    if (channelRef.current) {
      channelRef.current.send({type: 'broadcast', event: 'update', payload: {type: type}});
    }
  }

  function getPlayerById(pid) {
    return (players || []).find(function(p) { return p.id === pid; }) || {username: 'Unknown', rank: 'Iron'};
  }

  function submitLobbyCode(lobbyId, code) {
    supabase.from('lobbies').update({lobby_code: code}).eq('id', lobbyId).then(function(res) {
      if (res.error) { toast('Failed to save code', 'error'); return; }
      toast('Lobby code saved!', 'success');
      loadLobbies();
    }).catch(function() { toast('Failed to save code', 'error'); });
  }

  function generateLobbies() {
    var ts = tournament && tournament.team_size != null ? parseInt(tournament.team_size, 10) : 1;
    var teamSize = Number.isFinite(ts) && ts > 0 ? ts : 1;
    var isTeamEvent = teamSize > 1;

    if (isTeamEvent) {
      generateTeamLobbies(teamSize);
      return;
    }

    if (!confirm('Generate lobbies for ' + checkedInCount + ' checked-in players? This will create ' + Math.ceil(checkedInCount / 8) + ' lobbies.')) return;
    setActionLoading(true);
    supabase.from('registrations').select('player_id, players(id, username, rank, riot_id, region)')
      .eq('tournament_id', tournamentId)
      .eq('status', 'checked_in')
      .then(function(res) {
        if (res.error || !res.data) { toast('Failed to load players', 'error'); setActionLoading(false); return; }
        var checkedIn = res.data.map(function(r) { return r.players; }).filter(Boolean);
        var result = buildFlashLobbies(checkedIn, tournament.seeding_method || 'snake');
        var lobbyRows = result.lobbies.map(function(lobbyPlayers, idx) {
          var host = lobbyPlayers.reduce(function(best, p) {
            return RANKS.indexOf(p.rank || 'Iron') > RANKS.indexOf(best.rank || 'Iron') ? p : best;
          }, lobbyPlayers[0]);
          return {
            tournament_id: tournamentId,
            round_number: 1,
            lobby_number: idx + 1,
            player_ids: lobbyPlayers.map(function(p) { return p.id; }),
            host_player_id: host ? host.id : null,
            status: 'pending',
            game_number: 1
          };
        });
        supabase.from('lobbies').insert(lobbyRows).select().then(function(lRes) {
          setActionLoading(false);
          if (lRes.error) { toast('Failed: ' + lRes.error.message, 'error'); return; }
          supabase.from('tournaments').update({phase: 'in_progress', started_at: new Date().toISOString(), current_round: 1})
            .eq('id', tournamentId).then(function(tRes) {
              if (tRes.error) { toast && toast('Error: ' + tRes.error.message, 'error'); return; }
              setTournament(Object.assign({}, tournament, {phase: 'in_progress', current_round: 1}));
            }).catch(function() { toast('Failed to update tournament phase', 'error'); });
          toast(result.lobbies.length + ' lobbies generated!', 'success');
          broadcastUpdate('lobbies_generated');
          loadLobbies();
          supabase.rpc('notify_tournament_players', {p_tournament_id: tournamentId, p_title: 'Lobby Assigned', p_body: 'Your lobby has been assigned for ' + (tournament ? tournament.name : 'the tournament') + '. Check your lobby now!', p_icon: 'trophy', p_statuses: ['checked_in']}).catch(function() {});
        }).catch(function() { setActionLoading(false); toast('Failed to generate lobbies', 'error'); });
      }).catch(function() { setActionLoading(false); toast('Failed to load players', 'error'); });
  }

  function generateTeamLobbies(teamSize) {
    var checkedInTeams = registrations.filter(function(r) { return r.status === 'checked_in' && r.team_id; }).length;
    if (checkedInTeams < 2) { toast('Need at least 2 checked-in teams to generate lobbies', 'error'); return; }
    var paired = Math.floor(checkedInTeams / 2);
    if (!confirm('Generate ' + teamSize + 'v' + teamSize + ' lobbies for ' + checkedInTeams + ' teams? This will create ' + Math.ceil(checkedInTeams / 2) + ' lobbies (' + paired + ' paired).')) return;
    setActionLoading(true);

    supabase.from('registrations')
      .select('id, team_id, lineup_player_ids, teams!registrations_team_id_fkey(id, name, tag)')
      .eq('tournament_id', tournamentId)
      .eq('status', 'checked_in')
      .not('team_id', 'is', null)
      .then(function(regRes) {
        if (regRes.error || !regRes.data) { toast('Failed to load team registrations', 'error'); setActionLoading(false); return; }
        var rows = regRes.data;
        var allPlayerIds = {};
        rows.forEach(function(r) {
          (r.lineup_player_ids || []).forEach(function(pid) { if (pid) allPlayerIds[pid] = true; });
        });
        var idList = Object.keys(allPlayerIds);
        if (idList.length === 0) {
          setActionLoading(false);
          toast('No lineups submitted - captains must check in first', 'error');
          return;
        }
        supabase.from('players').select('id, username, rank, riot_id, region').in('id', idList).then(function(pRes) {
          if (pRes.error || !pRes.data) { toast('Failed to load lineup players', 'error'); setActionLoading(false); return; }
          var byPid = {};
          pRes.data.forEach(function(p) { byPid[p.id] = p; });

          var teams = rows.map(function(r) {
            var lineup = (r.lineup_player_ids || []).map(function(pid) { return byPid[pid]; }).filter(Boolean);
            if (lineup.length !== teamSize) return null;
            var seed = lineup.reduce(function(acc, p) { return acc + RANKS.indexOf(p.rank || 'Iron'); }, 0);
            return {
              id: r.team_id,
              name: r.teams ? r.teams.name : 'Team',
              tag: r.teams ? r.teams.tag : null,
              players: lineup,
              seed: seed
            };
          }).filter(Boolean);

          if (teams.length < 2) {
            setActionLoading(false);
            toast('Not enough teams with valid lineups (need 2+)', 'error');
            return;
          }

          var teamLobbies = buildTeamLobbies(teams, teamSize, tournament.seeding_method || 'snake');
          var lobbyRows = teamLobbies.map(function(lobby, idx) {
            var lobbyPlayers = lobby.players || [];
            var host = lobbyPlayers.reduce(function(best, p) {
              if (!best) return p;
              return RANKS.indexOf(p.rank || 'Iron') > RANKS.indexOf(best.rank || 'Iron') ? p : best;
            }, null);
            return {
              tournament_id: tournamentId,
              round_number: 1,
              lobby_number: idx + 1,
              player_ids: lobbyPlayers.map(function(p) { return p.id; }),
              host_player_id: host ? host.id : null,
              status: 'pending',
              game_number: 1
            };
          });

          supabase.from('lobbies').insert(lobbyRows).select().then(function(lRes) {
            setActionLoading(false);
            if (lRes.error) { toast('Failed: ' + lRes.error.message, 'error'); return; }
            supabase.from('tournaments').update({phase: 'in_progress', started_at: new Date().toISOString(), current_round: 1})
              .eq('id', tournamentId).then(function(tRes) {
                if (tRes.error) { toast && toast('Error: ' + tRes.error.message, 'error'); return; }
                setTournament(Object.assign({}, tournament, {phase: 'in_progress', current_round: 1}));
              }).catch(function() { toast('Failed to update tournament phase', 'error'); });
            toast(teamLobbies.length + ' team lobbies generated!', 'success');
            broadcastUpdate('lobbies_generated');
            loadLobbies();
            // Per-player team-context notifications: tell each starter which lobby letter their team is in.
            try {
              var letters = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P'];
              teamLobbies.forEach(function(lobby, lIdx) {
                var lobbyLabel = 'Lobby ' + (letters[lIdx] || (lIdx + 1));
                (lobby.teams || []).forEach(function(t) {
                  var teamLabel = t.tag ? ('[' + t.tag + '] ' + t.name) : t.name;
                  (t.players || []).forEach(function(p) {
                    if (p && p.id) {
                      createNotification(
                        p.id,
                        lobbyLabel + ' Assigned',
                        'You are starting for ' + teamLabel + ' in ' + lobbyLabel + ' for ' + (tournament ? tournament.name : 'the tournament') + '. Game on!',
                        'trophy'
                      );
                    }
                  });
                });
              });
            } catch (e) {}
          }).catch(function() { setActionLoading(false); toast('Failed to generate lobbies', 'error'); });
        }).catch(function() { setActionLoading(false); toast('Failed to load lineup players', 'error'); });
      }).catch(function() { setActionLoading(false); toast('Failed to load team registrations', 'error'); });
  }

  var myPlayer = currentUser ? (players || []).find(function(p) { return (currentUser.auth_user_id && p.authUserId === currentUser.auth_user_id) || p.id === currentUser.id; }) : null;
  var myReg = myPlayer ? registrations.find(function(r) { return r.player_id === myPlayer.id; }) : null;
  var regCount = registrations.filter(function(r) { return r.status === 'registered' || r.status === 'checked_in'; }).length;
  var currentGameNumber = tournament ? (tournament.current_round || 1) : 1;
  var currentLobbiesForMe = lobbies.filter(function(l) { return l.game_number === currentGameNumber; });
  var myLobby = currentLobbiesForMe.find(function(l) { return l.player_ids && l.player_ids.indexOf(myPlayer ? myPlayer.id : null) !== -1; });
  var myReport = myPlayer ? reports.find(function(r) { return r.player_id === myPlayer.id && r.game_number === currentGameNumber; }) : null;
  var openDisputeCount = disputes.filter(function(d) { return d.status === 'open'; }).length;
  var myDisputes = myPlayer ? disputes.filter(function(d) { return d.player_id === myPlayer.id; }) : [];
  var checkedInCount = registrations.filter(function(r) { return r.status === 'checked_in'; }).length;
  var maxP = tournament ? tournament.max_players || 128 : 128;
  var phase = tournament ? tournament.phase : 'draft';
  var prizes = tournament && Array.isArray(tournament.prize_pool_json) ? tournament.prize_pool_json : [];
  var _teamSizeRaw = tournament && tournament.team_size != null ? parseInt(tournament.team_size, 10) : 1;
  var teamSizeNum = Number.isFinite(_teamSizeRaw) && _teamSizeRaw > 0 ? _teamSizeRaw : 1;
  var isTeamEvent = teamSizeNum > 1;

  function handleRegister() {
    if (!currentUser) { setAuthScreen('login'); return; }
    if (myPlayer && myPlayer.banned) {
      toast('Your account is banned from registering', 'error');
      return;
    }
    if (!myPlayer || (!myPlayer.riotId && !myPlayer.riot_id_eu && !myPlayer.riot_id_na)) {
      toast('Set your Riot ID in your profile before registering', 'error');
      return;
    }
    if (tournament && !canRegisterInRegion(myPlayer.region, tournament.region)) {
      var regMsg = regionMismatchMessage(myPlayer.region, tournament.region);
      toast(regMsg || 'Region mismatch. Check your account region.', 'error');
      if (!myPlayer.region) navigate('/account');
      return;
    }
    setActionLoading(true);
    if (regCount >= maxP) {
      var waitPos = registrations.filter(function(r) { return r.status === 'waitlisted'; }).length + 1;
      supabase.from('registrations').upsert({
        tournament_id: tournamentId,
        player_id: myPlayer.id,
        status: 'waitlisted',
        waitlist_position: waitPos
      }, {onConflict: 'tournament_id,player_id'}).then(function(res) {
        setActionLoading(false);
        if (res.error) { toast('Registration failed: ' + res.error.message, 'error'); return; }
        toast('Added to waitlist (position #' + waitPos + ')!', 'info');
        broadcastUpdate('registration');
        loadRegistrations();
      }).catch(function() { setActionLoading(false); toast('Registration failed', 'error'); });
      return;
    }
    supabase.from('registrations').upsert({
      tournament_id: tournamentId,
      player_id: myPlayer.id,
      status: 'registered'
    }, {onConflict: 'tournament_id,player_id'}).then(function(res) {
      setActionLoading(false);
      if (res.error) { toast('Registration failed: ' + res.error.message, 'error'); return; }
      if (currentUser) { createNotification(currentUser.id, 'Registration Confirmed', 'You are registered for ' + (tournament ? tournament.name : 'the tournament') + '. Check in when the check-in window opens.', 'controller'); }
      toast('Registered!', 'success');
      broadcastUpdate('registration');
      loadRegistrations();
    }).catch(function() { setActionLoading(false); toast('Registration failed', 'error'); });
  }

  function handleUnregister() {
    if (!myReg) return;
    if (!confirm('Are you sure you want to unregister?')) return;
    setActionLoading(true);
    supabase.from('registrations').delete().eq('id', myReg.id).then(function(res) {
      setActionLoading(false);
      if (res.error) { toast('Failed to unregister: ' + res.error.message, 'error'); return; }
      // Promote first waitlisted player if spot opened
      var waitlisted = registrations.filter(function(r) { return r.status === 'waitlisted' && r.id !== myReg.id; }).sort(function(a, b) { return (a.waitlist_position || 999) - (b.waitlist_position || 999); });
      if (waitlisted.length > 0 && myReg.status === 'registered') {
        var next = waitlisted[0];
        supabase.from('registrations').update({status: 'registered', waitlist_position: null}).eq('id', next.id).then(function() {
          if (next.player_id) {
            createNotification(next.player_id, 'Spot Opened!', 'A spot opened in ' + (tournament ? tournament.name : 'the tournament') + ' and you have been promoted from the waitlist!', 'celebration');
          }
          loadRegistrations();
        }).catch(function() { loadRegistrations(); });
      } else {
        loadRegistrations();
      }
      toast('Unregistered', 'success');
      broadcastUpdate('registration');
    }).catch(function() { setActionLoading(false); toast('Failed to unregister', 'error'); });
  }

  function handleCheckIn() {
    if (!myReg) return;
    setActionLoading(true);
    supabase.from('registrations').update({status: 'checked_in', checked_in_at: new Date().toISOString()}).eq('id', myReg.id).then(function(res) {
      setActionLoading(false);
      if (res.error) { toast('Check-in failed: ' + res.error.message, 'error'); return; }
      toast('Checked in!', 'success');
      broadcastUpdate('registration');
      loadRegistrations();
    }).catch(function() { setActionLoading(false); toast('Check-in failed', 'error'); });
  }

  function adminOpenCheckIn() {
    supabase.from('tournaments').update({phase: 'check_in', checkin_open_at: new Date().toISOString()}).eq('id', tournamentId).then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
      setTournament(Object.assign({}, tournament, {phase: 'check_in'}));
      toast('Check-in opened!', 'success');
      broadcastUpdate('phase_change');
      supabase.rpc('notify_tournament_players', {p_tournament_id: tournamentId, p_title: 'Check-in is Open', p_body: 'Check in now to secure your spot in ' + (tournament ? tournament.name : 'the tournament') + '!', p_icon: 'checkmark', p_statuses: ['registered']}).catch(function() {});
      if (isTeamEvent) {
        var registeredTeamIds = registrations.filter(function(r){ return r.status === 'registered' && r.team_id; }).map(function(r){ return r.team_id; });
        var seen = {};
        registeredTeamIds.forEach(function(tid) {
          if (seen[tid]) return;
          seen[tid] = true;
          try {
            notifyTeamMembers(
              tid,
              'Check-in is Open',
              'Captain: lock your lineup and check in for ' + (tournament ? tournament.name : 'the tournament') + '.',
              'checkmark'
            );
          } catch (e) {}
        });
      }
    }).catch(function() { toast('Failed to open check-in', 'error'); });
  }

  function adminCloseCheckIn() {
    var unchecked = registrations.filter(function(r) { return r.status === 'registered'; }).length;
    if (unchecked > 0) {
      if (!window.confirm('This will drop ' + unchecked + ' player' + (unchecked !== 1 ? 's' : '') + ' who haven\'t checked in. Continue?')) return;
    }
    supabase.from('tournaments').update({checkin_close_at: new Date().toISOString()}).eq('id', tournamentId).then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
      var notCheckedIn = registrations.filter(function(r) { return r.status === 'registered'; });
      var dropIds = notCheckedIn.map(function(r) { return r.id; });
      if (dropIds.length > 0) {
        supabase.from('registrations').update({status: 'dropped'}).in('id', dropIds).then(function() {
          var openSpots = maxP - checkedInCount;
          var waitlisted = registrations.filter(function(r) { return r.status === 'waitlisted'; }).sort(function(a, b) { return (a.waitlist_position || 999) - (b.waitlist_position || 999); });
          var toPromote = waitlisted.slice(0, Math.max(0, openSpots));
          if (toPromote.length > 0) {
            var promoteIds = toPromote.map(function(r) { return r.id; });
            supabase.from('registrations').update({status: 'checked_in', checked_in_at: new Date().toISOString()}).in('id', promoteIds).then(function() {
              // Notify promoted players
              toPromote.forEach(function(r) {
                if (r.player_id) {
                  createNotification(r.player_id, 'Spot Opened!', 'A spot opened in ' + (tournament ? tournament.name : 'the tournament') + ' and you have been promoted from the waitlist. You are now checked in!', 'celebration');
                }
              });
              loadRegistrations();
            }).catch(function() { loadRegistrations(); });
          } else {
            loadRegistrations();
          }
        }).catch(function() { loadRegistrations(); });
      } else {
        loadRegistrations();
      }
      toast('Check-in closed. ' + notCheckedIn.length + ' player(s) dropped.', 'success');
      broadcastUpdate('phase_change');
    }).catch(function() { toast('Failed to close check-in', 'error'); });
  }

  function adminOpenRegistration() {
    supabase.from('tournaments').update({phase: 'registration', registration_open_at: new Date().toISOString()}).eq('id', tournamentId).then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
      setTournament(Object.assign({}, tournament, {phase: 'registration'}));
      toast('Registration opened!', 'success');
      broadcastUpdate('phase_change');
    }).catch(function() { toast('Failed to open registration', 'error'); });
  }

  function adminStartTournament() {
    supabase.from('tournaments').update({phase: 'in_progress', started_at: new Date().toISOString(), current_round: 1}).eq('id', tournamentId).then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
      setTournament(Object.assign({}, tournament, {phase: 'in_progress', current_round: 1}));
      toast('Tournament started!', 'success');
      broadcastUpdate('phase_change');
    }).catch(function() { toast('Failed to start tournament', 'error'); });
  }

  function submitReport(placement) {
    if (!myPlayer || !myLobby) return;
    supabase.from('player_reports').upsert({
      tournament_id: tournamentId,
      lobby_id: myLobby.id,
      game_number: currentGameNumber,
      player_id: myPlayer.id,
      reported_placement: placement,
      reported_at: new Date().toISOString()
    }, {onConflict: 'lobby_id,game_number,player_id'})
      .then(function(res) {
        if (res.error) { toast('Failed to submit: ' + res.error.message, 'error'); return; }
        toast('Placement reported!', 'success');
        broadcastUpdate('report_submitted');
        setMyPlacement(0);
        loadReports();
      }).catch(function() { toast('Failed to submit placement', 'error'); });
  }

  function submitDispute() {
    if (!myPlayer) return;
    supabase.from('disputes').insert({
      tournament_id: tournamentId,
      lobby_id: disputeForm.lobbyId,
      game_number: currentGameNumber,
      player_id: myPlayer.id,
      claimed_placement: disputeForm.claimed,
      reported_placement: myReport ? myReport.reported_placement : null,
      reason: disputeForm.reason,
      screenshot_url: disputeForm.screenshotUrl || null,
      status: 'open'
    }).then(function(res) {
      if (res.error) { toast('Dispute failed: ' + res.error.message, 'error'); return; }
      toast('Dispute submitted', 'success');
      setDisputeForm({open: false, lobbyId: null, claimed: 0, reason: '', screenshotUrl: ''});
      loadDisputes();
    }).catch(function() { toast('Dispute submission failed', 'error'); });
  }

  function actorContext() {
    return {
      id: currentUser ? currentUser.auth_user_id : null,
      name: currentUser ? (currentUser.username || currentUser.email || '') : ''
    };
  }

  function lockLobby(lobbyId) {
    var lobbyReports = reports.filter(function(r) { return r.lobby_id === lobbyId; });
    var gameRows = lobbyReports.map(function(r) {
      return {
        tournament_id: tournamentId,
        lobby_id: lobbyId,
        player_id: r.player_id,
        placement: r.reported_placement,
        points: PTS[r.reported_placement] || 0,
        round_number: currentGameNumber,
        game_number: currentGameNumber
      };
    });
    supabase.from('game_results').upsert(gameRows, {onConflict: 'tournament_id,game_number,player_id'}).then(function(res) {
      if (res.error) { toast('Failed to lock: ' + res.error.message, 'error'); return; }
      supabase.from('lobbies').update({status: 'locked', reports_complete: true}).eq('id', lobbyId).then(function(luRes) {
        if (luRes.error) { toast('Error: ' + luRes.error.message, 'error'); return; }
        writeAuditLog('tournament.lock_lobby', actorContext(), { type: 'lobby', id: lobbyId }, { tournament_id: tournamentId, game_number: currentGameNumber, placements: gameRows.length });
        toast('Lobby locked!', 'success');
        broadcastUpdate('lobby_locked');
        loadLobbies();
        loadReports();
        loadResults();
      }).catch(function() { toast('Network error locking lobby', 'error'); });
    }).catch(function() { toast('Network error saving results', 'error'); });
  }

  function adminOverridePlacement(lobbyId, playerId, placement) {
    supabase.from('player_reports').upsert({
      tournament_id: tournamentId,
      lobby_id: lobbyId,
      game_number: currentGameNumber,
      player_id: playerId,
      reported_placement: placement,
      reported_at: new Date().toISOString()
    }, {onConflict: 'lobby_id,game_number,player_id'})
      .then(function(res) {
        if (res.error) { toast('Override failed: ' + res.error.message, 'error'); return; }
        writeAuditLog('tournament.override_placement', actorContext(), { type: 'player_report', id: playerId }, { tournament_id: tournamentId, lobby_id: lobbyId, game_number: currentGameNumber, placement: placement });
        toast('Placement overridden', 'success');
        loadReports();
      }).catch(function() { toast('Override failed', 'error'); });
  }

  function isSafeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    if (url.indexOf('https://') !== 0) return false;
    var allowed = ['imgur.com', 'i.imgur.com', 'gyazo.com', 'i.gyazo.com', 'prnt.sc', 'lightshot.com', 'supabase.co', 'supabase.in', 'cdn.discordapp.com', 'media.discordapp.net'];
    try {
      var u = new URL(url);
      return allowed.some(function(d) { return u.hostname === d || u.hostname.endsWith('.' + d); });
    } catch (e) { return false; }
  }

  function resolveDispute(disputeId, accept) {
    var d = disputes.find(function(x) { return x.id === disputeId; });
    if (!d) return;
    var note = window.prompt((accept ? 'Accepting' : 'Rejecting') + ' dispute - add a resolution note (shown to the player):', '');
    if (note === null) return;
    note = String(note).replace(/[<>]/g, '').slice(0, 500).trim();
    var updates = {
      status: accept ? 'resolved_accepted' : 'resolved_rejected',
      resolved_by: currentUser ? currentUser.auth_user_id : null,
      resolved_at: new Date().toISOString(),
      resolution_note: note || null
    };
    supabase.from('disputes').update(updates).eq('id', disputeId).then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
      if (accept && d.claimed_placement) {
        supabase.from('player_reports').upsert({
          tournament_id: tournamentId,
          lobby_id: d.lobby_id,
          game_number: d.game_number || currentGameNumber,
          player_id: d.player_id,
          reported_placement: d.claimed_placement,
          reported_at: new Date().toISOString()
        }, {onConflict: 'lobby_id,game_number,player_id'}).then(function() {
          loadReports();
        }).catch(function() {});
      }
      writeAuditLog('dispute.resolve', actorContext(), { type: 'dispute', id: disputeId }, { tournament_id: tournamentId, player_id: d.player_id, lobby_id: d.lobby_id, accepted: !!accept, note: note || null, claimed: d.claimed_placement, reported: d.reported_placement });
      toast('Dispute ' + (accept ? 'accepted' : 'rejected'), 'success');
      loadDisputes();
      var disputingPlayer = (players || []).find(function(p) { return p.id === d.player_id; });
      if (disputingPlayer && disputingPlayer.authUserId) {
        var body = accept
          ? 'Your placement dispute has been accepted. Your placement has been updated.'
          : 'Your placement dispute has been rejected. The original result stands.';
        if (note) body = body + '\n\nNote: ' + note;
        createNotification(disputingPlayer.authUserId, 'Dispute ' + (accept ? 'Accepted' : 'Rejected'), body, 'bell');
      }
    }).catch(function() { toast('Failed to resolve dispute', 'error'); });
  }

  function adminForceCheckIn(regId) {
    if (!isAdmin) return;
    var reg = registrations.find(function(r) { return r.id === regId; });
    if (!reg) return;
    if (isTeamEvent) {
      var lineup = Array.isArray(reg.lineup_player_ids) ? reg.lineup_player_ids : [];
      if (lineup.length !== teamSizeNum) {
        toast('Set the team lineup first using Edit Lineup, then check in.', 'error');
        return;
      }
    }
    if (!confirm('Force check-in this ' + (isTeamEvent ? 'team' : 'player') + '?')) return;
    var patch = {status: 'checked_in', checked_in_at: new Date().toISOString()};
    supabase.from('registrations').update(patch).eq('id', regId).then(function(res) {
      if (res.error) { toast('Force check-in failed: ' + res.error.message, 'error'); return; }
      writeAuditLog('tournament.admin_force_checkin', actorContext(), { type: 'registration', id: regId }, { tournament_id: tournamentId, player_id: reg.player_id, team_id: reg.team_id || null });
      if (reg.player_id) {
        createNotification(reg.player_id, 'Checked In by Admin', 'You have been checked in to ' + (tournament ? tournament.name : 'this tournament') + ' by an admin.', 'checkmark');
      }
      if (reg.team_id) {
        var tName = (reg.teams && reg.teams.name) || 'Your team';
        try {
          notifyTeamMembers(
            reg.team_id,
            'Team Checked In',
            tName + ' was checked in to ' + (tournament ? tournament.name : 'the tournament') + ' by an admin.',
            'checkmark'
          );
        } catch (e) {}
      }
      toast('Checked in', 'success');
      broadcastUpdate('admin_force_checkin');
      loadRegistrations();
    }).catch(function() { toast('Network error', 'error'); });
  }

  function adminUnCheckIn(regId) {
    if (!isAdmin) return;
    var reg = registrations.find(function(r) { return r.id === regId; });
    if (!reg) return;
    if (!confirm('Revert this ' + (isTeamEvent ? 'team\'s' : 'player\'s') + ' check-in?')) return;
    supabase.from('registrations').update({status: 'registered', checked_in_at: null}).eq('id', regId).then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
      writeAuditLog('tournament.admin_uncheckin', actorContext(), { type: 'registration', id: regId }, { tournament_id: tournamentId, player_id: reg.player_id, team_id: reg.team_id || null });
      if (reg.team_id) {
        var tName2 = (reg.teams && reg.teams.name) || 'Your team';
        try {
          notifyTeamMembers(
            reg.team_id,
            'Check-in Reverted',
            tName2 + ' was reverted to registered by an admin.',
            'undo'
          );
        } catch (e) {}
      }
      toast('Reverted to registered', 'success');
      broadcastUpdate('admin_uncheckin');
      loadRegistrations();
    }).catch(function() { toast('Network error', 'error'); });
  }

  function adminForceWithdraw(regId) {
    if (!isAdmin) return;
    var reg = registrations.find(function(r) { return r.id === regId; });
    if (!reg) return;
    if (!confirm('Force withdraw this ' + (isTeamEvent ? 'team' : 'player') + '? This deletes the registration.')) return;
    supabase.from('registrations').delete().eq('id', regId).then(function(res) {
      if (res.error) { toast('Force withdraw failed: ' + res.error.message, 'error'); return; }
      writeAuditLog('tournament.admin_force_withdraw', actorContext(), { type: 'registration', id: regId }, { tournament_id: tournamentId, player_id: reg.player_id, team_id: reg.team_id || null });
      if (reg.player_id) {
        createNotification(reg.player_id, 'Removed from Tournament', 'An admin has removed you from ' + (tournament ? tournament.name : 'the tournament') + '.', 'bell');
      }
      if (reg.team_id) {
        var tName3 = (reg.teams && reg.teams.name) || 'Your team';
        try {
          notifyTeamMembers(
            reg.team_id,
            'Team Withdrawn',
            tName3 + ' was removed from ' + (tournament ? tournament.name : 'the tournament') + ' by an admin.',
            'logout'
          );
        } catch (e) {}
      }
      toast('Withdrawn', 'success');
      broadcastUpdate('admin_force_withdraw');
      loadRegistrations();
    }).catch(function() { toast('Network error', 'error'); });
  }

  function adminBroadcastAnnouncement() {
    if (!isAdmin) return;
    var raw = window.prompt('Announcement message (sent to registered + checked-in, max 200 chars):', '');
    if (raw === null) return;
    var msg = String(raw).replace(/[<>]/g, '').slice(0, 200).trim();
    if (!msg) { toast('Message is empty', 'error'); return; }
    var title = (tournament ? tournament.name : 'Tournament') + ' - Announcement';
    supabase.rpc('notify_tournament_players', {
      p_tournament_id: tournamentId,
      p_title: title,
      p_body: msg,
      p_icon: 'bell',
      p_statuses: ['checked_in', 'registered']
    }).then(function(res) {
      if (res && res.error) { toast('Broadcast failed: ' + res.error.message, 'error'); return; }
      writeAuditLog('tournament.admin_broadcast', actorContext(), { type: 'tournament', id: tournamentId }, { tournament_id: tournamentId, message: msg });
      toast('Announcement sent', 'success');
    }).catch(function() { toast('Broadcast failed', 'error'); });
  }

  function openAdminLineupModal(reg) {
    if (!isAdmin || !isTeamEvent || !reg || !reg.team_id) return;
    Promise.all([
      supabase.from('team_members')
        .select('id, player_id, role, players(id, username, riot_id, rank)')
        .eq('team_id', reg.team_id)
        .is('removed_at', null),
      supabase.from('teams').select('name, tag').eq('id', reg.team_id).maybeSingle()
    ]).then(function(out) {
      var memRes = out[0]; var tRes = out[1];
      if (memRes && memRes.error) { toast('Failed to load roster: ' + memRes.error.message, 'error'); return; }
      var members = ((memRes && memRes.data) || []).filter(function(m){ return m.player_id; });
      setAdminLineupModal({
        open: true,
        regId: reg.id,
        sel: Array.isArray(reg.lineup_player_ids) ? reg.lineup_player_ids.slice() : [],
        rosterMembers: members,
        teamName: tRes && tRes.data ? tRes.data.name : 'Team',
        tag: tRes && tRes.data ? (tRes.data.tag || '') : ''
      });
    }).catch(function() { toast('Failed to load roster', 'error'); });
  }

  function toggleAdminLineupSel(playerId) {
    var sel = adminLineupModal.sel || [];
    if (sel.indexOf(playerId) !== -1) {
      setAdminLineupModal(Object.assign({}, adminLineupModal, {sel: sel.filter(function(x){ return x !== playerId; })}));
    } else {
      if (sel.length >= teamSizeNum) {
        toast('Lineup full (' + teamSizeNum + '). Deselect to swap.', 'info');
        return;
      }
      setAdminLineupModal(Object.assign({}, adminLineupModal, {sel: sel.concat([playerId])}));
    }
  }

  function adminSubmitLineupEdit() {
    if (!isAdmin || !adminLineupModal.open || !adminLineupModal.regId) return;
    var newLineup = adminLineupModal.sel || [];
    if (newLineup.length !== teamSizeNum) {
      toast('Lineup must have exactly ' + teamSizeNum + ' players', 'error');
      return;
    }
    var modalSnapshot = adminLineupModal;
    var regForLookup = registrations.find(function(r){ return r.id === modalSnapshot.regId; });
    var teamIdForNotify = regForLookup && regForLookup.team_id;
    supabase.from('registrations').update({lineup_player_ids: newLineup}).eq('id', adminLineupModal.regId).then(function(res) {
      if (res.error) { toast('Lineup update failed: ' + res.error.message, 'error'); return; }
      writeAuditLog('tournament.admin_edit_lineup', actorContext(), { type: 'registration', id: modalSnapshot.regId }, { tournament_id: tournamentId, lineup: newLineup });
      if (teamIdForNotify) {
        try {
          notifyTeamMembers(
            teamIdForNotify,
            'Lineup Updated',
            (modalSnapshot.teamName || 'Your team') + ' lineup was updated by an admin for ' + (tournament ? tournament.name : 'the tournament') + '.',
            'edit'
          );
        } catch (e) {}
      }
      toast('Lineup updated', 'success');
      setAdminLineupModal({open: false, regId: null, sel: [], rosterMembers: [], teamName: '', tag: ''});
      broadcastUpdate('admin_edit_lineup');
      loadRegistrations();
    }).catch(function() { toast('Network error', 'error'); });
  }

  function startNextGame() {
    var nextGame = currentGameNumber + 1;
    supabase.from('tournaments').update({current_round: nextGame}).eq('id', tournamentId)
      .then(function(res) {
        if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
        var seedMethod = tournament.seeding_method || 'snake';
        if (seedMethod === 'snake') {
          var _standMap = {};
          gameResults.forEach(function(g) {
            if (!_standMap[g.player_id]) {
              _standMap[g.player_id] = { id: g.player_id, totalPts: 0 };
            }
            _standMap[g.player_id].totalPts += (g.points || 0);
          });
          var _curStandings = Object.values(_standMap);
          var checkedIn = registrations.filter(function(r) { return r.status === 'checked_in'; });
          var checkedInPlayers = checkedIn.map(function(r) { return r.players || getPlayerById(r.player_id); }).filter(Boolean);
          checkedInPlayers.sort(function(a, b) {
            var aStand = _curStandings.find(function(s) { return s.id === a.id; });
            var bStand = _curStandings.find(function(s) { return s.id === b.id; });
            return ((bStand ? bStand.totalPts : 0) - (aStand ? aStand.totalPts : 0));
          });
          var result = buildFlashLobbies(checkedInPlayers, 'snake');
          var lobbyRows = result.lobbies.map(function(lobbyPlayers, idx) {
            var host = lobbyPlayers.reduce(function(best, p) {
              return RANKS.indexOf(p.rank || 'Iron') > RANKS.indexOf(best.rank || 'Iron') ? p : best;
            }, lobbyPlayers[0]);
            return {
              tournament_id: tournamentId,
              round_number: nextGame,
              lobby_number: idx + 1,
              player_ids: lobbyPlayers.map(function(p) { return p.id; }),
              host_player_id: host ? host.id : null,
              status: 'pending',
              game_number: nextGame
            };
          });
          supabase.from('lobbies').insert(lobbyRows).select().then(function(lRes) {
            if (lRes.error) { toast && toast('Error: ' + lRes.error.message, 'error'); return; }
            setTournament(Object.assign({}, tournament, {current_round: nextGame}));
            loadLobbies();
            loadReports();
            toast('Game ' + nextGame + ' started! New lobbies generated.', 'success');
            broadcastUpdate('next_game');
          }).catch(function() { toast('Failed to create lobbies', 'error'); });
        } else {
          var currentLobbies = lobbies.filter(function(l) { return l.game_number === currentGameNumber; });
          var newLobbies = currentLobbies.map(function(l) {
            return {
              tournament_id: tournamentId,
              round_number: nextGame,
              lobby_number: l.lobby_number,
              player_ids: l.player_ids,
              host_player_id: l.host_player_id,
              status: 'pending',
              game_number: nextGame
            };
          });
          supabase.from('lobbies').insert(newLobbies).select().then(function(lRes) {
            if (lRes.error) { toast && toast('Error: ' + lRes.error.message, 'error'); return; }
            setTournament(Object.assign({}, tournament, {current_round: nextGame}));
            loadLobbies();
            loadReports();
            toast('Game ' + nextGame + ' started!', 'success');
            broadcastUpdate('next_game');
          }).catch(function() { toast('Failed to create lobbies', 'error'); });
        }
      }).catch(function() { toast('Failed to start next game', 'error'); });
  }

  function finalizeTournament() {
    if (tournament && tournament.phase === 'complete') {
      toast('Tournament already finalized', 'info');
      return;
    }
    if (!confirm('Finalize this tournament? This cannot be undone.')) return;
    var isSeasonClash = tournament && tournament.type === 'season_clash';
    supabase.from('tournaments').update({phase: 'complete', completed_at: new Date().toISOString()})
      .eq('id', tournamentId).then(function(res) {
        if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
        setTournament(Object.assign({}, tournament, {phase: 'complete'}));
        toast('Tournament finalized!', 'success');
        broadcastUpdate('finalized');
        supabase.rpc('notify_tournament_players', {p_tournament_id: tournamentId, p_title: 'Results Finalized', p_body: (tournament ? tournament.name : 'The tournament') + ' has been finalized. Check the results screen for your placement and points.', p_icon: 'trophy', p_statuses: ['checked_in', 'registered']}).catch(function() {});
        supabase.from('game_results').select('player_id,placement,points')
          .eq('tournament_id', tournamentId).then(function(grRes) {
            if (grRes.error || !grRes.data || !grRes.data.length) return;
            var playerAgg = {};
            grRes.data.forEach(function(g) {
              if (!playerAgg[g.player_id]) playerAgg[g.player_id] = {pts: 0, wins: 0, top4: 0, games: 0, placeSum: 0};
              var a = playerAgg[g.player_id];
              a.pts += (g.points || 0);
              a.wins += (g.placement === 1 ? 1 : 0);
              a.top4 += (g.placement >= 1 && g.placement <= 4 ? 1 : 0);
              a.games += 1;
              a.placeSum += (g.placement || 0);
            });
            var ranked = Object.keys(playerAgg).map(function(pid) {
              var a = playerAgg[pid];
              return { pid: pid, pts: a.pts, wins: a.wins, top4: a.top4, games: a.games, placeSum: a.placeSum };
            }).sort(function(a, b) {
              if (b.pts !== a.pts) return b.pts - a.pts;
              var aTie = a.wins * 2 + a.top4;
              var bTie = b.wins * 2 + b.top4;
              if (bTie !== aTie) return bTie - aTie;
              return a.placeSum - b.placeSum;
            });
            var tRows = ranked.map(function(r, idx) {
              return { tournament_id: tournamentId, player_id: r.pid, total_points: r.pts, wins: r.wins, top4_count: r.top4, final_placement: idx + 1 };
            });
            if (tRows.length > 0) {
              supabase.from('tournament_results').upsert(tRows, { onConflict: 'tournament_id,player_id' }).then(function() {}).catch(function() {});
            }
            // Custom/flash tournaments NEVER write to players season totals.
            // Only season_clash type contributes to the season leaderboard; the DB trigger
            // refresh_player_stats on game_results already handles those aggregates.
            if (!isSeasonClash) return;
          }).catch(function() {});
      }).catch(function() { toast('Failed to finalize tournament', 'error'); });
  }

  // ── Loading / not found states ──────────────────────────────────────────────
  if (loading) {
    return (
      <PageLayout>
        <div className="max-w-5xl mx-auto text-center py-20">
          <Icon name="hourglass_empty" size={40} className="text-on-surface-variant/30 mx-auto mb-4" />
          <div className="text-on-surface-variant text-sm font-label tracking-wider uppercase">Loading tournament...</div>
        </div>
      </PageLayout>
    );
  }

  if (!tournament) {
    return (
      <PageLayout>
        <div className="max-w-5xl mx-auto text-center py-20">
          <Icon name="error_outline" size={48} className="text-on-surface-variant/30 mx-auto mb-4" />
          <h2 className="text-on-surface text-xl font-bold mb-2">Tournament Not Found</h2>
          <p className="text-on-surface-variant text-sm mb-6">This tournament may have been removed or the link is invalid.</p>
          <Btn variant="primary" size="sm" onClick={function() { navigate('/events'); }}>
            Back to Events
          </Btn>
        </div>
      </PageLayout>
    );
  }

  // ── Derived data ────────────────────────────────────────────────────────────
  var phaseColors = {draft: 'text-on-surface-variant', registration: 'text-secondary', check_in: 'text-primary', in_progress: 'text-tertiary', complete: 'text-tertiary'};
  var phaseBgs = {draft: 'bg-on-surface-variant/10 border-on-surface-variant/20', registration: 'bg-secondary/10 border-secondary/20', check_in: 'bg-primary/10 border-primary/20', in_progress: 'bg-tertiary/10 border-tertiary/20', complete: 'bg-tertiary/10 border-tertiary/20'};
  var phaseLabels = {draft: 'DRAFT', registration: 'REGISTRATION OPEN', check_in: 'CHECK-IN OPEN', in_progress: 'IN PROGRESS', completed: 'COMPLETED', complete: 'COMPLETE'};
  var startTs = tournament.started_at || tournament.checkin_close_at || tournament.checkin_open_at || tournament.registration_close_at || null;
  var dateStr;
  if (startTs) {
    dateStr = new Date(startTs).toLocaleString('en-GB', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'});
  } else if (tournament.date) {
    var _d = new Date(tournament.date + 'T00:00:00');
    dateStr = _d.toLocaleDateString('en-GB', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'});
  } else {
    dateStr = 'TBD';
  }

  var isLive = phase === 'in_progress';
  var isComplete = phase === 'complete';
  var totalGames = tournament.round_count || 3;

  var regBtnLabel = 'Register';
  var regBtnAction = handleRegister;
  var regBtnDisabled = false;
  var regBtnVariant = 'primary';
  var regionBlocked = myPlayer && tournament && !canRegisterInRegion(myPlayer.region, tournament.region);
  if (!myReg && regionBlocked && (phase === 'registration' || phase === 'check_in')) {
    regBtnLabel = (tournament.region || 'Region') + ' Only - Switch Region';
    regBtnVariant = 'destructive';
    regBtnAction = function() { navigate('/account'); };
  }
  if (myReg && myReg.status === 'registered' && phase === 'check_in') {
    regBtnLabel = 'Check In'; regBtnVariant = 'tertiary'; regBtnAction = handleCheckIn;
  } else if (myReg && myReg.status === 'checked_in') {
    regBtnLabel = 'Checked In'; regBtnVariant = 'tertiary'; regBtnDisabled = true;
  } else if (myReg && myReg.status === 'waitlisted') {
    regBtnLabel = 'Waitlisted (#' + (myReg.waitlist_position || '?') + ')'; regBtnVariant = 'secondary'; regBtnDisabled = true;
  } else if (myReg && myReg.status === 'registered') {
    regBtnLabel = 'Registered'; regBtnVariant = 'tertiary'; regBtnDisabled = true;
  } else if (phase !== 'registration' && phase !== 'check_in') {
    regBtnLabel = phase === 'draft' ? 'Registration Not Open' : 'Registration Closed'; regBtnDisabled = true; regBtnVariant = 'secondary';
  }

  var canUnregister = myReg && (phase === 'registration' || phase === 'check_in') && myReg.status !== 'dropped';

  // Compute standings from gameResults
  var standings = [];
  if (gameResults.length > 0) {
    var _playerMap = {};
    gameResults.forEach(function(g) {
      if (!_playerMap[g.player_id]) {
        var pi = g.players || getPlayerById(g.player_id);
        _playerMap[g.player_id] = {
          id: g.player_id,
          name: (pi && (pi.username || pi.name)) || 'Unknown',
          rank: (pi && pi.rank) || 'Iron',
          riotId: (pi && (pi.riot_id || pi.riotId)) || '',
          totalPts: 0, wins: 0, top4: 0, games: 0, avgPlace: 0, placements: [], gameDetails: []
        };
      }
      var _p = _playerMap[g.player_id];
      _p.totalPts += (g.points || 0);
      _p.games += 1;
      if (g.placement === 1) _p.wins += 1;
      if (g.placement <= 4) _p.top4 += 1;
      _p.placements.push(g.placement);
      _p.gameDetails.push({game: g.game_number, placement: g.placement, points: g.points});
    });
    standings = Object.keys(_playerMap).map(function(k) {
      var _p = _playerMap[k];
      _p.avgPlace = _p.games > 0 ? (_p.placements.reduce(function(s, v) { return s + v; }, 0) / _p.games) : 0;
      return _p;
    });
    standings.sort(function(a, b) {
      if (b.totalPts !== a.totalPts) return b.totalPts - a.totalPts;
      var aScore = a.wins * 2 + a.top4;
      var bScore = b.wins * 2 + b.top4;
      if (bScore !== aScore) return bScore - aScore;
      for (var _pl = 1; _pl <= 8; _pl++) {
        var aC = a.placements.filter(function(p) { return p === _pl; }).length;
        var bC = b.placements.filter(function(p) { return p === _pl; }).length;
        if (bC !== aC) return bC - aC;
      }
      return 0;
    });
  }

  var currentGameLobbies = lobbies.filter(function(l) { return l.game_number === currentGameNumber; });
  var allLobbiesLocked = currentGameLobbies.length > 0 && currentGameLobbies.every(function(l) { return l.status === 'locked'; });
  var isLastGame = currentGameNumber >= totalGames;

  var allGameNums = [];
  gameResults.forEach(function(g) { if (allGameNums.indexOf(g.game_number) === -1) allGameNums.push(g.game_number); });
  allGameNums.sort(function(a, b) { return a - b; });

  var tabs = [{id: 'info', label: 'Info', icon: 'info'}, {id: 'players', label: 'Players (' + regCount + ')', icon: 'group'}];
  if (phase === 'in_progress') {
    tabs.push({id: 'live', label: 'Live', icon: 'bolt'});
  }
  if (phase === 'in_progress' || phase === 'complete' || (phase === 'check_in' && isAdmin)) {
    tabs.push({id: 'bracket', label: 'Lobbies' + (lobbies.length > 0 ? ' (' + currentGameLobbies.length + ')' : ''), icon: 'groups'});
  }
  if (phase === 'in_progress' || phase === 'complete') {
    tabs.push({id: 'standings', label: isComplete ? 'Final Results' : 'Standings', icon: 'bar_chart'});
  }

  var sortedRegs = [].concat(registrations).sort(function(a, b) {
    var statusOrder = {checked_in: 0, registered: 1, waitlisted: 2, dropped: 3};
    return (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
  });

  var lobbyLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  // ── Live dashboard tab data ─────────────────────────────────────────────────
  var liveLockedThisRound = currentGameLobbies.filter(function(l) { return l.status === 'locked'; }).length;
  var liveLobbiesThisRound = currentGameLobbies.length;
  var liveStandings = standings.map(function(s) { return { id: s.id, name: s.name, points: s.totalPts, games: s.games }; });
  var liveMyIdx = -1;
  if (myPlayer) {
    for (var _liveI = 0; _liveI < standings.length; _liveI++) {
      if (standings[_liveI].id === myPlayer.id) { liveMyIdx = _liveI; break; }
    }
  }
  var liveMyStatus = null;
  if (liveMyIdx >= 0) {
    var _liveMe = standings[liveMyIdx];
    liveMyStatus = {
      position: liveMyIdx + 1,
      points: _liveMe.totalPts,
      games: _liveMe.games,
      lobbyNumber: myLobby ? (myLobby.lobby_letter || myLobby.lobby_number) : null,
      onJump: function() { setActiveTab('bracket'); },
      jumpLabel: 'Jump to my lobby'
    };
  }
  var liveTicker = [];
  var _liveLocked = currentGameLobbies.filter(function(l) { return l.status === 'locked'; });
  for (var _ti = _liveLocked.length - 1; _ti >= 0 && liveTicker.length < 6; _ti--) {
    var _tL = _liveLocked[_ti];
    liveTicker.push({ icon: 'lock', tone: 'muted', text: 'Lobby ' + (_tL.lobby_letter || _tL.lobby_number) + ' locked' });
  }
  var _liveWinners = gameResults
    .filter(function(g) { return g.placement === 1; })
    .sort(function(a, b) { return (b.game_number || 0) - (a.game_number || 0); })
    .slice(0, 6);
  _liveWinners.forEach(function(g) {
    var pi = g.players || getPlayerById(g.player_id);
    var name = (pi && (pi.username || pi.name)) || 'Player';
    liveTicker.push({ icon: 'star', tone: 'win', text: name + ' won their lobby (R' + g.game_number + ')' });
  });
  var liveTitleParts = (tournament && tournament.name && tournament.name.indexOf(':') !== -1)
    ? { left: tournament.name.split(':')[0].trim(), right: tournament.name.split(':').slice(1).join(':').trim() }
    : { left: (tournament && tournament.name) || 'Flash Tournament', right: '' };

  // ── Render ──────────────────────────────────────────────────────────────────
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

        {/* ── Page hero ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div className="flex-1 min-w-0">
            <div className="font-label text-[11px] font-bold text-secondary tracking-[.18em] uppercase mb-1.5">
              Flash Tournament
            </div>
            <h1 className="font-editorial text-on-background font-extrabold leading-none mb-3" style={{ fontSize: "clamp(28px,4.2vw,46px)" }}>
              {tournament.name}
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={"px-3 py-1 rounded font-label text-xs tracking-wider font-bold border " + (phaseBgs[phase] || 'bg-surface-container-high border-outline-variant/20') + " " + (phaseColors[phase] || 'text-on-surface-variant')}>
                {phaseLabels[phase] || phase}
              </span>
              <div className="flex items-center gap-2 text-on-surface-variant/50 font-mono text-xs">
                <Icon name="calendar_today" size={13} />
                {dateStr}
              </div>
              <div className="flex items-center gap-2 text-on-surface-variant/50 font-mono text-xs">
                <Icon name="sports_esports" size={13} />
                {totalGames + " games - " + (tournament.seeding_method || 'snake') + " seeding"}
              </div>
              {tournament.region && <RegionBadge region={tournament.region} size="md" />}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={function() {
              var url = window.location.origin + '/flash/' + tournamentId;
              navigator.clipboard.writeText(url).then(function() { toast('Tournament link copied!', 'success'); });
            }} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-high border border-outline-variant/20 rounded text-xs font-label font-bold tracking-wider uppercase text-on-surface-variant hover:text-primary transition-colors">
              <Icon name="content_copy" size={14} />
              Copy Link
            </button>
          </div>
        </div>

        {prizes.length > 0 && (
          <div className="mb-6">
            <PrizePoolCard prizes={prizes} sponsors={ctx.orgSponsors} />
          </div>
        )}

        {/* ── Admin quick actions (top of page, only when advancing) ── */}
        {isAdmin && phase !== 'complete' && (
          <div className="mb-6 bg-error/5 border border-error/25 rounded px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Icon name="admin_panel_settings" size={16} className="text-error" />
              <span className="font-label font-bold text-xs tracking-widest uppercase text-error">Admin</span>
              <span className="text-[10px] font-mono text-on-surface-variant/50">
                {"Phase: " + (phaseLabels[phase] || phase)}
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {phase === 'draft' && (
                <Btn variant="secondary" size="sm" onClick={adminOpenRegistration}>
                  Open Registration
                </Btn>
              )}
              {phase === 'registration' && (
                <Btn variant="primary" size="sm" onClick={adminOpenCheckIn}>
                  Open Check-In
                </Btn>
              )}
              {phase === 'check_in' && checkedInCount >= 2 && lobbies.length === 0 && (
                <Btn variant="tertiary" size="sm" onClick={generateLobbies} disabled={actionLoading} loading={actionLoading}>
                  {actionLoading ? 'Generating...' : 'Generate Lobbies'}
                </Btn>
              )}
              {(phase === 'check_in' || phase === 'registration') && (
                <Btn variant="secondary" size="sm" onClick={adminStartTournament}>
                  Start Tournament
                </Btn>
              )}
              {isLive && allLobbiesLocked && !isLastGame && (
                <Btn variant="primary" size="sm" onClick={startNextGame}>
                  {"Start Game " + (currentGameNumber + 1)}
                </Btn>
              )}
              {isLive && allLobbiesLocked && isLastGame && (
                <Btn variant="tertiary" size="sm" onClick={finalizeTournament}>
                  Finalize Tournament
                </Btn>
              )}
            </div>
          </div>
        )}

        {/* ── Registration bar ── */}
        <div className="bg-surface-container-low rounded border border-outline-variant/15 p-5 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-on-surface">{regCount}</span>
                <span className="text-on-surface-variant/50 font-mono text-sm">{"/ " + maxP}</span>
              </div>
              <div className="text-[10px] font-label text-on-surface-variant/50 uppercase tracking-wider mt-0.5">
                {"players registered" + (phase === 'check_in' ? ' - ' + checkedInCount + ' checked in' : '')}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <Btn
                variant={regBtnVariant}
                size="md"
                onClick={regBtnAction}
                disabled={regBtnDisabled || actionLoading}
                loading={actionLoading}
              >
                {actionLoading ? '...' : regBtnLabel}
              </Btn>
              {canUnregister && (
                <Btn
                  variant="secondary"
                  size="sm"
                  onClick={handleUnregister}
                  disabled={actionLoading}
                >
                  Unregister
                </Btn>
              )}
            </div>
          </div>
          <div className="w-full bg-surface-container-lowest rounded-full h-1.5 overflow-hidden mt-3">
            <div className={"h-full rounded-full transition-all duration-500 " + (regCount >= maxP ? "bg-error" : "bg-primary")} style={{width: Math.min(100, Math.round((regCount / maxP) * 100)) + '%'}} />
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-[10px] font-mono text-on-surface-variant/40">{regCount + "/" + maxP + " spots filled"}</span>
            {regCount >= maxP && (
              <span className="text-[10px] font-mono text-error font-bold">{registrations.filter(function(r) { return r.status === 'waitlisted'; }).length + " on waitlist"}</span>
            )}
          </div>
        </div>

        {/* ── All lobbies locked banner ── */}
        {isLive && allLobbiesLocked && (
          <div className="mb-6 bg-tertiary/8 border border-tertiary/25 rounded px-5 py-3 flex items-center gap-3">
            <Icon name="check_circle" size={18} fill className="text-tertiary" />
            <span className="text-tertiary font-label font-bold text-sm tracking-wider flex-1">
              {"All lobbies locked" + (isLastGame ? " - ready to finalize!" : " - ready for next game!")}
            </span>
          </div>
        )}

        {/* ── Complete banner ── */}
        {isComplete && standings.length > 0 && (
          <div className="mb-6 bg-primary/8 border border-primary/30 rounded px-5 py-4 flex items-center gap-4">
            <Icon name="emoji_events" size={24} fill className="text-primary" />
            <div className="flex-1">
              <div className="font-bold text-primary text-base mb-0.5">Tournament Complete!</div>
              <div className="text-on-surface-variant text-sm">{"All " + totalGames + " games finished. Final results are in."}</div>
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        <PillTabGroup align="start" className="mb-6">
          {tabs.map(function(t) {
            return (
              <PillTab
                key={t.id}
                icon={t.icon}
                active={activeTab === t.id}
                onClick={function() { setActiveTab(t.id); }}
              >
                {t.label}
              </PillTab>
            );
          })}
        </PillTabGroup>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: INFO
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'info' && (
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
                    {label: 'Format', value: tournament.seeding_method || 'snake', icon: 'shuffle'},
                    {label: 'Games', value: totalGames, icon: 'videogame_asset'},
                    {label: 'Max Players', value: maxP, icon: 'group'},
                    {label: 'Lobby Host', value: tournament.lobby_host_method || 'highest rank', icon: 'star'}
                  ].map(function(item) {
                    return (
                      <div key={item.label} className="bg-surface-container-low p-4">
                        <div className="text-[10px] font-label text-on-surface-variant/50 uppercase tracking-wider mb-1">{item.label}</div>
                        <div className="font-mono text-sm font-bold text-on-surface">{item.value}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Announcement */}
              {tournament.announcement && (
                <div className="bg-primary/5 rounded border border-primary/15 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="campaign" size={16} className="text-primary" />
                    <span className="text-xs font-label font-bold text-primary tracking-widest uppercase">Announcement</span>
                  </div>
                  <div className="text-sm text-on-surface leading-relaxed">{tournament.announcement}</div>
                </div>
              )}
            </div>

            {/* Right sidebar: Round progress */}
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-surface-container-low rounded border border-outline-variant/15 p-5">
                <h3 className="font-label text-sm font-bold tracking-widest uppercase mb-3 text-on-surface">Round Progress</h3>
                <div className="mb-4">
                  <div className="flex justify-between text-[10px] font-mono text-on-surface-variant/50 mb-1">
                    <span>{"Game " + currentGameNumber + " of " + totalGames}</span>
                    <span>{Math.round(((currentGameNumber - (allLobbiesLocked ? 0 : 1)) / totalGames) * 100) + "%"}</span>
                  </div>
                  <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                    <div className={"h-full rounded-full transition-all duration-500 " + (isComplete ? "bg-tertiary" : "bg-primary")} style={{width: Math.round(((currentGameNumber - (allLobbiesLocked ? 0 : 1)) / totalGames) * 100) + '%'}}></div>
                  </div>
                </div>
                <div className="space-y-2">
                  {Array.from({length: totalGames}, function(_, idx) { return idx + 1; }).map(function(r) {
                    var isGameComplete = r < currentGameNumber || (r === currentGameNumber && allLobbiesLocked);
                    var isCurrent = r === currentGameNumber && !allLobbiesLocked;
                    var isFuture = r > currentGameNumber;
                    return (
                      <div key={r} className={"flex items-center gap-3 px-3 py-2.5 rounded border transition-colors " + (isGameComplete ? "bg-tertiary/5 border-tertiary/20" : isCurrent ? "bg-primary/8 border-primary/30" : "bg-surface-container-lowest/50 border-outline-variant/8")}>
                        <div className={"w-6 h-6 rounded flex items-center justify-center flex-shrink-0 " + (isGameComplete ? "bg-tertiary/20" : isCurrent ? "bg-primary/20" : "bg-surface-container-high")}>
                          {isGameComplete
                            ? <Icon name="check" size={14} className="text-tertiary" />
                            : isCurrent
                              ? <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span></span>
                              : <span className="font-mono text-[10px] text-on-surface-variant/30 font-bold">{r}</span>
                          }
                        </div>
                        <div className="flex-1">
                          <div className={"text-xs font-label font-bold uppercase tracking-widest " + (isGameComplete ? "text-tertiary" : isCurrent ? "text-primary" : "text-on-surface-variant/40")}>
                            {"Game " + r}
                          </div>
                        </div>
                        <div className={"text-[10px] font-mono font-bold " + (isGameComplete ? "text-tertiary" : isCurrent ? "text-primary" : "text-on-surface-variant/30")}>
                          {isGameComplete ? "Done" : isCurrent ? "Active" : "Soon"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live status card */}
              {(isLive || isComplete) && (
                <div className={"bg-surface-container-low rounded p-5 border relative overflow-hidden " + (isLive ? "border-primary/30" : "border-tertiary/30")}>
                  <div className="absolute top-0 right-0 p-3 opacity-5">
                    <Icon name="sensors" size={48} />
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="relative flex h-3 w-3">
                      <span className={"animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 " + (isLive ? "bg-error" : "bg-tertiary")}></span>
                      <span className={"relative inline-flex rounded-full h-3 w-3 " + (isLive ? "bg-error" : "bg-tertiary")}></span>
                    </span>
                    <span className="font-display text-lg tracking-tighter">
                      {isLive ? "LIVE - Game " + currentGameNumber + " of " + totalGames : "COMPLETE"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface-container-lowest p-3 border border-outline-variant/10">
                      <div className="text-[10px] font-label text-on-surface-variant/50 uppercase mb-1">Lobbies</div>
                      <div className="font-mono text-lg font-bold text-primary">{currentGameLobbies.length}</div>
                    </div>
                    <div className="bg-surface-container-lowest p-3 border border-outline-variant/10">
                      <div className="text-[10px] font-label text-on-surface-variant/50 uppercase mb-1">Checked In</div>
                      <div className="font-mono text-lg font-bold text-tertiary">{checkedInCount}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: PLAYERS
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'players' && (
          <div className="space-y-4">
            {isAdmin && phase !== 'complete' && (
              <div className="bg-error/5 rounded border border-error/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="admin_panel_settings" size={16} className="text-error" />
                  <span className="font-label font-bold text-xs tracking-widest uppercase text-error">Admin Tools</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Btn variant="destructive" size="sm" onClick={adminBroadcastAnnouncement}>
                    <Icon name="campaign" size={14} className="mr-1" />Broadcast Announcement
                  </Btn>
                  <span className="text-[10px] text-on-surface-variant/60 self-center">Admin actions appear next to each {isTeamEvent ? 'team' : 'player'} below.</span>
                </div>
              </div>
            )}

            <div className="bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
              <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                <Icon name={isTeamEvent ? "groups" : "group"} size={18} className="text-primary" />
                <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">
                  {isTeamEvent
                    ? ('Registered Teams (' + registrations.filter(function(r){return r.team_id;}).length + ')')
                    : ('Registered Players (' + registrations.length + ')')}
                </span>
              </div>
              {sortedRegs.length === 0 ? (
                <div className="text-center py-16 px-5">
                  <Icon name="person_add" size={40} className="text-on-surface-variant/20 mx-auto mb-3" />
                  <div className="text-on-surface-variant text-sm">No {isTeamEvent ? 'teams' : 'players'} registered yet. Share the tournament link!</div>
                </div>
              ) : isTeamEvent ? (
                <div className="divide-y divide-outline-variant/5">
                  {sortedRegs.filter(function(r){ return r.team_id; }).map(function(r) {
                    var team = r.teams || {};
                    var isCheckedIn = r.status === 'checked_in';
                    var isDropped = r.status === 'dropped';
                    var lineup = Array.isArray(r.lineup_player_ids) ? r.lineup_player_ids : [];
                    var hasLineup = lineup.length === teamSizeNum;
                    return (
                      <div key={r.id} className={"px-5 py-3 " + (isDropped ? "opacity-40" : "")}>
                        <div className="flex items-center gap-3 mb-2">
                          <span className={"font-mono text-xs font-bold min-w-[22px] text-center " + (isCheckedIn ? "text-tertiary" : isDropped ? "text-error" : "text-secondary")}>
                            {isCheckedIn ? '\u2713' : isDropped ? '\u2717' : '\u25CF'}
                          </span>
                          <div className="w-7 h-7 rounded bg-surface-container-high flex items-center justify-center flex-shrink-0">
                            <Icon name="groups" size={14} className="text-on-surface-variant/60" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-on-surface">{team.name || 'Team'}</span>
                              {team.tag && (
                                <span className="text-[10px] font-label font-bold tracking-widest uppercase rounded px-1.5 py-0.5 border border-secondary/30 bg-secondary/10 text-secondary">{team.tag}</span>
                              )}
                            </div>
                            <div className="text-[10px] text-on-surface-variant/50">
                              {hasLineup ? (lineup.length + ' starters set') : 'no lineup yet'}
                            </div>
                          </div>
                          <span className={"text-[10px] font-label font-bold tracking-widest uppercase rounded px-2 py-0.5 border " + (isCheckedIn ? "text-tertiary bg-tertiary/10 border-tertiary/20" : isDropped ? "text-error bg-error/10 border-error/20" : "text-secondary bg-secondary/10 border-secondary/20")}>
                            {r.status === 'checked_in' ? 'Checked In' : r.status}
                          </span>
                        </div>
                        {isAdmin && phase !== 'complete' && (
                          <div className="flex flex-wrap gap-1.5 pl-10">
                            {!isCheckedIn && !isDropped && (
                              <button onClick={function(){ adminForceCheckIn(r.id); }} className="text-[10px] font-label font-bold tracking-wider uppercase rounded px-2 py-1 border border-tertiary/40 text-tertiary bg-tertiary/5 hover:bg-tertiary/10">Force Check-in</button>
                            )}
                            {isCheckedIn && (
                              <button onClick={function(){ adminUnCheckIn(r.id); }} className="text-[10px] font-label font-bold tracking-wider uppercase rounded px-2 py-1 border border-secondary/40 text-secondary bg-secondary/5 hover:bg-secondary/10">Un-Check-in</button>
                            )}
                            <button onClick={function(){ openAdminLineupModal(r); }} className="text-[10px] font-label font-bold tracking-wider uppercase rounded px-2 py-1 border border-primary/40 text-primary bg-primary/5 hover:bg-primary/10">Edit Lineup</button>
                            {!isDropped && (
                              <button onClick={function(){ adminForceWithdraw(r.id); }} className="text-[10px] font-label font-bold tracking-wider uppercase rounded px-2 py-1 border border-error/40 text-error bg-error/5 hover:bg-error/10">Withdraw</button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="divide-y divide-outline-variant/5">
                  {sortedRegs.map(function(r, idx) {
                    var pData = r.players || {};
                    var isCheckedIn = r.status === 'checked_in';
                    var isDropped = r.status === 'dropped';
                    var isWait = r.status === 'waitlisted';
                    var isMe = myPlayer && r.player_id === myPlayer.id;
                    return (
                      <div key={r.id || r.player_id} className={"px-5 py-2.5 " + (isMe ? "bg-secondary/5" : isDropped ? "opacity-40" : "")}>
                        <div className="flex items-center gap-3">
                          <span className={"font-mono text-xs font-bold min-w-[22px] text-center " + (isCheckedIn ? "text-tertiary" : isWait ? "text-primary" : isDropped ? "text-error" : "text-secondary")}>
                            {isCheckedIn ? '\u2713' : isWait ? '\u25CB' : isDropped ? '\u2717' : '\u25CF'}
                          </span>
                          <div className="w-7 h-7 rounded bg-surface-container-high flex items-center justify-center flex-shrink-0">
                            <Icon name="person" size={14} className="text-on-surface-variant/40" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={"text-sm font-semibold " + (isMe ? "text-secondary" : "text-on-surface")}>{pData.username || 'Player'}</div>
                            <div className="text-[10px] text-on-surface-variant/40">{(pData.rank || 'Unranked') + " - " + (pData.region || '')}</div>
                          </div>
                          <span className={"text-[10px] font-label font-bold tracking-widest uppercase rounded px-2 py-0.5 border " + (isCheckedIn ? "text-tertiary bg-tertiary/10 border-tertiary/20" : isWait ? "text-primary bg-primary/10 border-primary/20" : isDropped ? "text-error bg-error/10 border-error/20" : "text-secondary bg-secondary/10 border-secondary/20")}>
                            {r.status === 'checked_in' ? 'Checked In' : r.status}
                          </span>
                        </div>
                        {isAdmin && phase !== 'complete' && (
                          <div className="flex flex-wrap gap-1.5 pl-10 pt-2">
                            {!isCheckedIn && !isDropped && !isWait && (
                              <button onClick={function(){ adminForceCheckIn(r.id); }} className="text-[10px] font-label font-bold tracking-wider uppercase rounded px-2 py-1 border border-tertiary/40 text-tertiary bg-tertiary/5 hover:bg-tertiary/10">Force Check-in</button>
                            )}
                            {isCheckedIn && (
                              <button onClick={function(){ adminUnCheckIn(r.id); }} className="text-[10px] font-label font-bold tracking-wider uppercase rounded px-2 py-1 border border-secondary/40 text-secondary bg-secondary/5 hover:bg-secondary/10">Un-Check-in</button>
                            )}
                            {!isDropped && (
                              <button onClick={function(){ adminForceWithdraw(r.id); }} className="text-[10px] font-label font-bold tracking-wider uppercase rounded px-2 py-1 border border-error/40 text-error bg-error/5 hover:bg-error/10">Withdraw</button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: LIVE (DASHBOARD)
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'live' && (
          <LiveDashboardLayout
            kicker="Flash Tournament"
            titleParts={liveTitleParts}
            pills={[
              { label: 'LIVE', tone: 'live' },
              { label: tournament.region || 'EU', tone: 'neutral' },
              { label: 'CUSTOM', tone: 'muted' }
            ]}
            secondaryMeta={'Round ' + currentGameNumber + ' of ' + totalGames}
            cta={{ label: 'View Lobbies', icon: 'grid_view', onClick: function() { setActiveTab('bracket'); } }}
            kpis={[
              { icon: 'schedule', label: 'Round', value: currentGameNumber + ' / ' + totalGames, sub: currentGameNumber < totalGames ? ((totalGames - currentGameNumber) + ' to go') : 'final round' },
              { icon: 'groups', label: 'Players', value: String(checkedInCount), sub: 'checked in' },
              { icon: 'lock', label: 'Lobbies', value: liveLockedThisRound + ' / ' + liveLobbiesThisRound, sub: 'locked this round' },
              { icon: 'emoji_events', label: 'Prize Pool', value: prizes.length > 0 ? (prizes.length + ' tiers') : 'None', sub: prizes.length > 0 ? 'see standings' : 'no prizes set' }
            ]}
            myStatus={liveMyStatus}
            standings={liveStandings}
            currentRound={currentGameNumber}
            ticker={liveTicker}
            timeline={{ round: currentGameNumber, totalRounds: totalGames, lockedThisRound: liveLockedThisRound, lobbiesThisRound: liveLobbiesThisRound }}
            fullStandingsLink={{ label: 'See full standings', onClick: function() { setActiveTab('standings'); } }}
            footer={null}
          />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: LOBBIES (BRACKET)
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'bracket' && (
          <div className="space-y-5">

            {/* My placement report panel */}
            {isLive && myPlayer && myLobby && (
              <div className="bg-secondary/5 rounded border border-secondary/30 p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-5">
                  <Icon name="edit_note" size={48} />
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="edit_note" size={18} className="text-secondary" />
                  <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">{"Game " + currentGameNumber + " - Report Your Placement"}</span>
                </div>
                {myReport ? (
                  <div>
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="flex items-center gap-1.5 text-tertiary font-bold text-sm">
                        <Icon name="check_circle" size={16} fill className="text-tertiary" />
                        {"You reported: #" + myReport.reported_placement}
                      </span>
                      <button
                        onClick={function() { setMyPlacement(myReport.reported_placement); }}
                        className="bg-transparent text-secondary text-[10px] font-label font-bold tracking-widest uppercase cursor-pointer border border-secondary/30 rounded px-2.5 py-1 hover:bg-secondary/10 transition-colors"
                      >
                        Update
                      </button>
                    </div>
                    {myPlacement > 0 && (
                      <div className="flex gap-2 items-center mt-2">
                        <Sel value={String(myPlacement)} onChange={function(v) { setMyPlacement(parseInt(v) || 0); }}>
                          {(myLobby.player_ids || []).map(function(_, i) {
                            return (<option key={"place-" + (i + 1)} value={i + 1}>{i + 1}</option>);
                          })}
                        </Sel>
                        <Btn variant="primary" size="sm" onClick={function() { submitReport(myPlacement); }}>Submit</Btn>
                        <Btn variant="secondary" size="sm" onClick={function() { setMyPlacement(0); }}>Cancel</Btn>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2 items-center flex-wrap">
                    <Sel value={String(myPlacement)} onChange={function(v) { setMyPlacement(parseInt(v) || 0); }}>
                      <option value="0">{"Select placement..."}</option>
                      {(myLobby.player_ids || []).map(function(_, i) {
                        return (<option key={"place-" + (i + 1)} value={i + 1}>{i + 1}</option>);
                      })}
                    </Sel>
                    <Btn
                      variant="primary"
                      size="sm"
                      onClick={function() { if (myPlacement > 0) submitReport(myPlacement); else toast('Select a placement first', 'error'); }}
                      disabled={myPlacement === 0}
                    >
                      Submit
                    </Btn>
                  </div>
                )}

                {/* Share + Dispute links */}
                {myReport && !disputeForm.open && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button
                      onClick={function() {
                        shareToTwitter(buildShareText('round', {
                          placement: myReport.reported_placement,
                          round: currentGameNumber,
                          clashName: tournament ? tournament.name : 'TFT Clash',
                        }));
                      }}
                      className="bg-transparent text-primary text-[10px] font-label font-bold tracking-widest uppercase cursor-pointer border border-primary/20 rounded px-3 py-1.5 hover:bg-primary/10 transition-colors flex items-center gap-1"
                    >
                      <Icon name="share" size={12} />
                      Share Result
                    </button>
                    <button
                      onClick={function() { setDisputeForm({open: true, lobbyId: myLobby.id, claimed: myReport.reported_placement, reason: '', screenshotUrl: ''}); }}
                      className="bg-transparent text-error text-[10px] font-label font-bold tracking-widest uppercase cursor-pointer border border-error/20 rounded px-3 py-1.5 hover:bg-error/10 transition-colors"
                    >
                      Dispute this result
                    </button>
                  </div>
                )}

                {/* Dispute form */}
                {disputeForm.open && disputeForm.lobbyId === myLobby.id && (
                  <div className="mt-4 p-4 rounded bg-error/5 border border-error/15">
                    <div className="font-label font-bold text-xs text-error tracking-widest uppercase mb-3">Submit Dispute</div>
                    <div className="flex gap-2 mb-2 flex-wrap items-center">
                      <label className="text-xs text-on-surface-variant min-w-[100px]">Actual placement:</label>
                      <Sel value={String(disputeForm.claimed)} onChange={function(v) { setDisputeForm(Object.assign({}, disputeForm, {claimed: parseInt(v) || 0})); }}>
                        <option value="0">Select...</option>
                        {(myLobby.player_ids || []).map(function(_, i) {
                          return (<option key={"d-" + (i + 1)} value={i + 1}>{i + 1}</option>);
                        })}
                      </Sel>
                    </div>
                    <textarea
                      placeholder="Reason for dispute..."
                      value={disputeForm.reason}
                      onChange={function(e) { setDisputeForm(Object.assign({}, disputeForm, {reason: e.target.value})); }}
                      rows={2}
                      className="w-full bg-surface-container-lowest border border-error/15 rounded text-xs text-on-surface px-3 py-2 resize-y mb-2 focus:outline-none focus:ring-1 focus:ring-error box-border"
                    />
                    <input
                      placeholder="Screenshot URL (optional)"
                      value={disputeForm.screenshotUrl}
                      onChange={function(e) { setDisputeForm(Object.assign({}, disputeForm, {screenshotUrl: e.target.value})); }}
                      className="w-full bg-surface-container-lowest border border-error/15 rounded text-xs text-on-surface px-3 py-2 mb-3 focus:outline-none focus:ring-1 focus:ring-error box-border"
                    />
                    <div className="flex gap-2">
                      <Btn variant="destructive" size="sm" onClick={submitDispute} disabled={!disputeForm.claimed || !disputeForm.reason}>Submit Dispute</Btn>
                      <Btn variant="secondary" size="sm" onClick={function() { setDisputeForm({open: false, lobbyId: null, claimed: 0, reason: '', screenshotUrl: ''}); }}>Cancel</Btn>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* My disputes */}
            {isLive && myPlayer && myDisputes.length > 0 && (
              <div className="bg-primary/5 rounded border border-primary/15 p-5">
                <div className="font-label font-bold text-xs text-primary tracking-widest uppercase mb-3">Your Disputes</div>
                <div className="space-y-2">
                  {myDisputes.map(function(d) {
                    var isPending = d.status === 'open';
                    var isAccepted = d.status === 'resolved_accepted';
                    return (
                      <div key={d.id} className="bg-surface-container-lowest rounded px-4 py-2.5 border border-outline-variant/10">
                        <div className="flex items-center gap-2">
                          <div className={"w-2 h-2 rounded-full shrink-0 " + (isPending ? "bg-primary" : isAccepted ? "bg-tertiary" : "bg-error")} />
                          <div className={"text-xs font-label font-bold tracking-wider " + (isPending ? "text-primary" : isAccepted ? "text-tertiary" : "text-error")}>
                            {isPending ? 'Pending review' : isAccepted ? 'Accepted' : 'Rejected'}
                          </div>
                          {d.claimed_placement && (
                            <div className="text-[10px] text-on-surface-variant/40 font-mono ml-auto">{"Claimed: #" + d.claimed_placement}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Lobby grid */}
            {lobbies.length === 0 ? (
              <div className="bg-surface-container-low rounded border border-outline-variant/15 text-center py-16">
                <Icon name="groups" size={40} className="text-on-surface-variant/20 mx-auto mb-3" />
                <div className="font-bold text-base text-on-surface mb-1">Lobbies</div>
                <div className="text-sm text-on-surface-variant">
                  {isAdmin
                    ? 'Use the Admin bar above to open check-in and generate lobbies once players have checked in.'
                    : 'Lobbies will appear once the admin generates them.'}
                </div>
              </div>
            ) : (
              <div>
                {myPlayer && myLobby && (
                  <div className="bg-secondary/8 border border-secondary/25 rounded px-5 py-3 mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon name="my_location" size={18} className="text-secondary" />
                      <span className="font-label font-bold text-sm tracking-wider text-secondary">
                        {"You are in Lobby " + (lobbyLetters[currentGameLobbies.findIndex(function(l) { return l.id === myLobby.id; })] || "?")}
                      </span>
                    </div>
                    <button onClick={function() {
                      var el = document.getElementById('lobby-' + myLobby.id);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }} className="px-3 py-1.5 bg-secondary/20 text-secondary font-label font-bold text-[10px] tracking-widest uppercase rounded hover:bg-secondary/30 transition-colors">
                      Jump to Lobby
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {currentGameLobbies.map(function(lobby, idx) {
                  var lobbyPlayers = (lobby.player_ids || []).map(function(pid) { return getPlayerById(pid); });
                  var hostId = lobby.host_player_id;
                  var isMyLobby = myPlayer && (lobby.player_ids || []).indexOf(myPlayer.id) !== -1;
                  var lobbyLetter = lobbyLetters[idx] || String(idx + 1);
                  var isLocked = lobby.status === 'locked' || lobby.status === 'completed';
                  var codeKey = lobby.id;
                  var codeInput = lobbyCodeInputs[codeKey] || '';
                  var lobbyReports = reports.filter(function(r) { return r.lobby_id === lobby.id; });
                  var reportedCount = lobbyReports.length;
                  var totalCount = (lobby.player_ids || []).length;
                  var allReported = reportedCount === totalCount && totalCount > 0;
                  var placementCounts = {};
                  lobbyReports.forEach(function(r) { placementCounts[r.reported_placement] = (placementCounts[r.reported_placement] || 0) + 1; });
                  var hasDuplicate = Object.keys(placementCounts).some(function(k) { return placementCounts[k] > 1; });
                  var lobbyDisputes = disputes.filter(function(d) { return d.lobby_id === lobby.id && d.status === 'open'; });
                  var canLock = allReported && !hasDuplicate && !isLocked;
                  var iAmHost = myPlayer && hostId === myPlayer.id;

                  return (
                    <div
                      key={lobby.id}
                      id={'lobby-' + lobby.id}
                      className={"bg-surface-container-high rounded overflow-hidden border-2 transition-all " + (isMyLobby && !isLocked ? "border-secondary shadow-[0_0_30px_rgba(217,185,255,0.08)]" : isLocked ? "border-tertiary/30" : hasDuplicate ? "border-error/40" : "border-outline-variant/15")}
                    >
                      {/* Lobby header */}
                      <div className={"px-4 py-3 flex justify-between items-center border-b " + (isMyLobby && !isLocked ? "bg-secondary/10 border-secondary/20" : isLocked ? "bg-tertiary/5 border-tertiary/15" : "bg-surface-container border-outline-variant/10")}>
                        <div className="flex items-center gap-2">
                          <span className={"font-display " + (isMyLobby && !isLocked ? "text-secondary" : isLocked ? "text-tertiary" : "text-on-surface-variant/80")}>
                            {"LOBBY " + lobbyLetter}
                          </span>
                          {isMyLobby && !isLocked && (
                            <span className="bg-secondary/20 text-[10px] text-secondary px-2 py-0.5 rounded font-label font-bold tracking-tighter">YOUR LOBBY</span>
                          )}
                          {isLocked && (
                            <span className="bg-tertiary/10 text-[10px] text-tertiary px-2 py-0.5 rounded font-label font-bold tracking-tighter flex items-center gap-1">
                              <Icon name="lock" size={10} fill />
                              LOCKED
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-on-surface-variant/40">{lobbyPlayers.length + " players"}</span>
                          {isLive && !isLocked && (
                            <span className={"text-[10px] font-label font-bold rounded px-2 py-0.5 border " + (allReported ? "text-tertiary bg-tertiary/10 border-tertiary/20" : "text-primary bg-primary/10 border-primary/20")}>
                              {reportedCount + "/" + totalCount + " reported"}
                            </span>
                          )}
                          {lobby.lobby_code && (
                            <span className="font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/20 rounded px-2 py-0.5 tracking-widest">
                              {lobby.lobby_code}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Player list */}
                      <div className="divide-y divide-outline-variant/5">
                        {lobbyPlayers.map(function(p, pi) {
                          var isHost = p.id === hostId;
                          var isMe = myPlayer && p.id === myPlayer.id;
                          var playerReport = lobbyReports.find(function(r) { return r.player_id === p.id; });
                          var isDupe = playerReport && placementCounts[playerReport.reported_placement] > 1;

                          return (
                            <div
                              key={p.id || pi}
                              className={"flex items-center gap-3 px-4 py-2 " + (isMe ? "bg-secondary/5" : "")}
                            >
                              <span className={"font-mono text-xs " + (pi === 0 ? "text-primary" : pi <= 2 ? "text-on-surface-variant/60" : "text-on-surface-variant/30")}>
                                {String(pi + 1).padStart(2, "0")}
                              </span>
                              <div className="w-7 h-7 rounded bg-surface-container-low flex items-center justify-center flex-shrink-0">
                                <Icon name="person" size={14} className="text-on-surface-variant/40" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={"text-sm font-semibold flex items-center gap-1.5 " + (isMe ? "text-secondary" : "text-on-surface")}>
                                  {p.username || p.name || 'Unknown'}
                                  {isHost && <span className="text-[8px] font-label font-bold tracking-wider uppercase bg-primary/15 text-primary px-1.5 py-0.5 rounded">HOST</span>}
                                </div>
                                <div className="text-[10px] text-on-surface-variant/40">{p.rank || 'Iron'}</div>
                                {(p.riotId || p.riot_id) && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-on-surface-variant/30 truncate">{p.riotId || p.riot_id}</span>
                                    <button
                                      type="button"
                                      onClick={function() { navigator.clipboard.writeText(p.riotId || p.riot_id || ''); toast("Copied Riot ID", "success"); }}
                                      className="text-on-surface-variant/25 hover:text-primary transition-colors flex-shrink-0 bg-transparent border-0 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                                      title="Copy Riot ID"
                                      aria-label={'Copy Riot ID for ' + (p.name || 'player')}>
                                      <Icon name="content_copy" size={10} />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Placement / status */}
                              {isLocked && playerReport ? (
                                <span className={"font-mono text-xs font-bold " + (playerReport.reported_placement === 1 ? "text-primary" : playerReport.reported_placement <= 4 ? "text-tertiary" : "text-on-surface-variant/50")}>
                                  {"#" + playerReport.reported_placement}
                                </span>
                              ) : playerReport ? (
                                <span className={"font-mono text-xs font-bold rounded px-1.5 py-0.5 " + (isDupe ? "text-error bg-error/10" : "text-tertiary bg-tertiary/10")}>
                                  {"#" + playerReport.reported_placement}
                                </span>
                              ) : isLive ? (
                                <span className="text-[10px] text-on-surface-variant/30 font-label">Pending</span>
                              ) : null}

                              {/* Admin / host override */}
                              {(isAdmin || iAmHost) && isLive && !isLocked && (
                                <Sel value="" onChange={function(v) { if (parseInt(v) > 0) adminOverridePlacement(lobby.id, p.id, parseInt(v)); }} className="ml-1">
                                  <option value="">{"--"}</option>
                                  {(lobby.player_ids || []).map(function(_, i) { return (<option key={"ov-" + (i + 1)} value={i + 1}>{i + 1}</option>); })}
                                </Sel>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Lobby status bar (visible to all players) */}
                      {isLive && !isLocked && !isAdmin && canLock && (
                        <div className="border-t border-tertiary/20 p-3 bg-tertiary/5 flex items-center gap-2">
                          <Icon name="check_circle" size={14} fill className="text-tertiary" />
                          <span className="text-[10px] font-label font-bold text-tertiary tracking-wider uppercase">All placements reported - waiting for admin to lock</span>
                        </div>
                      )}
                      {isLive && !isLocked && !isAdmin && hasDuplicate && (
                        <div className="border-t border-error/20 p-3 bg-error/5 flex items-center gap-2">
                          <Icon name="warning" size={14} className="text-error" />
                          <span className="text-[10px] font-label font-bold text-error tracking-wider uppercase">Duplicate placements detected - awaiting resolution</span>
                        </div>
                      )}

                      {/* Admin / host lock button */}
                      {(isAdmin || iAmHost) && isLive && !isLocked && (
                        <div className="border-t border-outline-variant/10 p-4 bg-surface-container-low flex items-center gap-3 flex-wrap">
                          {hasDuplicate && (
                            <span className="text-[10px] font-label font-bold text-error tracking-wider">Duplicate placements - resolve first</span>
                          )}
                          {lobbyDisputes.length > 0 && (
                            <span className="text-[10px] font-label font-bold text-primary bg-primary/10 border border-primary/20 rounded px-2 py-0.5">
                              {lobbyDisputes.length + " dispute" + (lobbyDisputes.length === 1 ? "" : "s")}
                            </span>
                          )}
                          <button
                            onClick={function() { lockLobby(lobby.id); }}
                            disabled={!canLock}
                            className="ml-auto px-4 py-2 bg-tertiary text-on-tertiary font-label font-bold text-xs tracking-widest uppercase rounded disabled:opacity-40 disabled:pointer-events-none hover:brightness-110 transition-all">
                            {canLock ? 'Lock Lobby' : 'Cannot Lock Yet'}
                          </button>
                        </div>
                      )}

                      {/* Host lobby code entry */}
                      {(iAmHost || isAdmin) && !lobby.lobby_code && !isLocked && (
                        <div className="border-t border-outline-variant/10 p-4 bg-surface-container-low flex gap-2 items-center">
                          <input
                            placeholder="Enter lobby code..."
                            value={codeInput}
                            onChange={function(e) { var v = e.target.value; setLobbyCodeInputs(function(prev) { var next = Object.assign({}, prev); next[codeKey] = v; return next; }); }}
                            className="flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded text-sm text-on-surface font-mono placeholder:text-on-surface-variant/30 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <Btn variant="primary" size="sm" onClick={function() { submitLobbyCode(lobby.id, codeInput); }}>Save</Btn>
                        </div>
                      )}

                      {/* Locked footer */}
                      {isLocked && (
                        <div className="px-4 py-2.5 bg-tertiary/5 border-t border-tertiary/10 flex items-center justify-center gap-2">
                          <Icon name="lock" size={14} fill className="text-tertiary" />
                          <span className="font-label text-[10px] font-bold tracking-widest uppercase text-tertiary">Results Locked</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: STANDINGS
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'standings' && (
          <div className="space-y-6">

            {/* Podium for complete tournaments */}
            {isComplete && standings.length >= 3 && (
              <div className="bg-surface-container-low rounded border border-primary/15 px-5 pt-8 pb-5 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Icon name="emoji_events" size={80} />
                </div>
                <div className="text-center font-label font-bold text-xs text-primary mb-8 tracking-[3px] uppercase">Final Results</div>
                <div className="flex gap-3 justify-center items-end flex-wrap">
                  {[1, 0, 2].map(function(rankIdx) {
                    var entry = standings[rankIdx];
                    if (!entry) return null;
                    var pos = rankIdx + 1;
                    var colors = ['text-primary', 'text-on-surface-variant', 'text-on-surface-variant/70'];
                    var bgColors = ['bg-primary/10 border-primary/30', 'bg-on-surface-variant/8 border-on-surface-variant/15', 'bg-on-surface-variant/5 border-on-surface-variant/10'];
                    var avatarSizes = [72, 56, 52];
                    var isFirst = pos === 1;
                    var orderMap = [2, 1, 3];
                    var prizeEntry = prizes.find(function(pr) { return pr.placement === pos; });
                    return (
                      <div
                        key={entry.id}
                        className={"flex flex-col items-center gap-2 rounded border p-4 " + (bgColors[rankIdx])}
                        style={{order: orderMap[rankIdx], flex: isFirst ? '0 0 160px' : '0 0 120px', minWidth: isFirst ? 140 : 100}}
                      >
                        <div
                          className={"rounded-full flex items-center justify-center font-display font-bold border-2 " + (colors[rankIdx])}
                          style={{width: avatarSizes[rankIdx], height: avatarSizes[rankIdx], borderColor: 'currentColor', background: 'currentColor', color: 'transparent'}}
                        >
                          <span style={{color: pos === 1 ? 'var(--md-sys-color-on-primary,#1a1a2e)' : '#1a1a2e'}} className={"font-display font-bold " + (isFirst ? "text-xl" : "text-base")}>{"#" + pos}</span>
                        </div>
                        <div className={"font-bold text-center leading-tight " + (colors[rankIdx]) + " " + (isFirst ? "text-base" : "text-sm")}>{entry.name}</div>
                        <div className={"font-mono text-xs font-bold rounded px-2.5 py-0.5 " + (pos === 1 ? "bg-primary/20 text-primary" : "bg-on-surface-variant/10 text-on-surface-variant")}>{entry.totalPts + " pts"}</div>
                        {prizeEntry && (
                          <div className={"font-label font-bold text-[10px] tracking-wider uppercase rounded px-2.5 py-1 border " + (pos === 1 ? "text-primary bg-primary/15 border-primary/30" : "text-on-surface-variant bg-surface-container-high border-outline-variant/15")}>
                            {prizeEntry.prize}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Standings table */}
            {standings.length === 0 ? (
              <div className="bg-surface-container-low rounded border border-outline-variant/15 text-center py-16">
                <Icon name="bar_chart" size={40} className="text-on-surface-variant/20 mx-auto mb-3" />
                <div className="font-bold text-base text-on-surface mb-1">Standings</div>
                <div className="text-sm text-on-surface-variant">No results yet. Complete games to see standings.</div>
              </div>
            ) : (
              <div className="bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <Icon name="bar_chart" size={18} className="text-primary" />
                  <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">
                    {"Standings - Game " + (allGameNums.length > 0 ? allGameNums[allGameNums.length - 1] : currentGameNumber) + " of " + totalGames}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[400px] border-collapse table-auto">
                    <thead>
                      <tr className="bg-surface-container border-b border-outline-variant/10">
                        <th className="py-2.5 pl-5 pr-2 text-left font-label font-bold text-[10px] text-on-surface-variant/50 uppercase tracking-widest whitespace-nowrap sticky left-0 z-[3] bg-surface-container">#</th>
                        <th className="py-2.5 px-2.5 text-left font-label font-bold text-[10px] text-on-surface-variant/50 uppercase tracking-widest whitespace-nowrap sticky left-[40px] z-[3] bg-surface-container">Player</th>
                        <th className="py-2.5 px-2.5 text-center font-label font-bold text-[10px] text-primary uppercase tracking-widest whitespace-nowrap">Pts</th>
                        <th className="py-2.5 px-2.5 text-center font-label font-bold text-[10px] text-on-surface-variant/50 uppercase tracking-widest whitespace-nowrap">Avg</th>
                        <th className="py-2.5 px-2.5 text-center font-label font-bold text-[10px] text-on-surface-variant/50 uppercase tracking-widest whitespace-nowrap">W</th>
                        <th className="py-2.5 px-2.5 text-center font-label font-bold text-[10px] text-on-surface-variant/50 uppercase tracking-widest whitespace-nowrap">T4</th>
                        {allGameNums.map(function(gn) {
                          return (<th key={gn} className="py-2.5 px-2 text-center font-label font-bold text-[10px] text-secondary uppercase tracking-widest whitespace-nowrap">{"G" + gn}</th>);
                        })}
                        {isComplete && prizes.length > 0 && (
                          <th className="py-2.5 px-2.5 text-center font-label font-bold text-[10px] text-tertiary uppercase tracking-widest whitespace-nowrap">Prize</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map(function(entry, rankIdx) {
                        var pos = rankIdx + 1;
                        var isMe = myPlayer && entry.id === myPlayer.id;
                        var prizeEntry = prizes.find(function(pr) { return pr.placement === pos; });
                        return (
                          <tr
                            key={entry.id}
                            className={"border-b border-outline-variant/5 " + (isMe ? "bg-secondary/5" : pos <= 3 ? "bg-primary/3" : "")}
                          >
                            <td
                              className={"py-2.5 pl-5 pr-2 font-mono text-xs font-bold whitespace-nowrap sticky left-0 z-[2] " + (isMe ? "bg-secondary/5" : pos <= 3 ? "bg-primary/3" : "bg-surface-container-low")}
                              style={{borderLeft: isMe ? '3px solid var(--md-sys-color-secondary, #D9B9FF)' : pos === 1 ? '3px solid var(--md-sys-color-primary, #9B72CF)' : '3px solid transparent'}}
                            >
                              <span className={pos === 1 ? "text-primary" : pos === 2 ? "text-on-surface-variant/60" : pos === 3 ? "text-on-surface-variant/50" : "text-on-surface-variant/30"}>{pos}</span>
                            </td>
                            <td className={"py-2.5 px-2.5 max-w-[160px] sticky left-[40px] z-[2] " + (isMe ? "bg-secondary/5" : pos <= 3 ? "bg-primary/3" : "bg-surface-container-low")}>
                              <div className={"text-sm font-semibold truncate " + (isMe ? "text-secondary" : "text-on-surface")}>{entry.name + (isMe ? " (you)" : "")}</div>
                              <div className="text-[10px] text-on-surface-variant/40">{entry.rank}</div>
                            </td>
                            <td className="py-2.5 px-2.5 text-center font-mono text-sm font-bold text-primary whitespace-nowrap">{entry.totalPts}</td>
                            <td className="py-2.5 px-2.5 text-center font-mono text-xs text-on-surface-variant/50 whitespace-nowrap">{entry.avgPlace.toFixed(1)}</td>
                            <td className="py-2.5 px-2.5 text-center font-mono text-xs text-on-surface font-semibold whitespace-nowrap">{entry.wins}</td>
                            <td className="py-2.5 px-2.5 text-center font-mono text-xs text-on-surface whitespace-nowrap">{entry.top4}</td>
                            {allGameNums.map(function(gn) {
                              var detail = entry.gameDetails.find(function(d) { return d.game === gn; });
                              var plc = detail ? detail.placement : null;
                              return (
                                <td key={gn} className="py-2.5 px-2 text-center whitespace-nowrap">
                                  {plc ? (
                                    <span className={"font-mono text-xs font-bold rounded px-1.5 py-0.5 " + (plc === 1 ? "text-primary bg-primary/15" : plc <= 4 ? "text-tertiary bg-tertiary/10" : "text-on-surface-variant/50 bg-surface-container-high")}>{plc}</span>
                                  ) : (
                                    <span className="text-on-surface-variant/20 font-mono text-xs">{"-"}</span>
                                  )}
                                </td>
                              );
                            })}
                            {isComplete && prizes.length > 0 && (
                              <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                                {prizeEntry ? (
                                  <span className="text-xs font-label font-bold text-tertiary bg-tertiary/10 rounded px-2 py-0.5">{prizeEntry.prize}</span>
                                ) : (
                                  <span className="text-on-surface-variant/20 font-mono text-xs">{"-"}</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            ADMIN: Disputes panel
           ══════════════════════════════════════════════════════════════════════ */}
        {isAdmin && disputes.length > 0 && (
          <div className="bg-surface-container-low rounded border border-primary/15 overflow-hidden mt-6">
            <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
              <Icon name="gavel" size={18} className="text-primary" />
              <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">Disputes</span>
              {openDisputeCount > 0 && (
                <span className="text-[10px] font-label font-bold text-primary bg-primary/15 rounded px-2 py-0.5 border border-primary/20">
                  {openDisputeCount + " open"}
                </span>
              )}
            </div>
            <div className="divide-y divide-outline-variant/5">
              {disputes.map(function(d) {
                var lobbyIdx = lobbies.findIndex(function(l) { return l.id === d.lobby_id; });
                var lobbyLabel = lobbyIdx >= 0 ? 'Lobby ' + lobbyLetters[lobbyIdx] : 'Unknown lobby';
                var pData = d.players || {};
                var isOpen = d.status === 'open';
                return (
                  <div key={d.id} className={"px-5 py-3.5 " + (isOpen ? "bg-primary/3" : "")}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex gap-2 items-center flex-wrap mb-1">
                          <span className="font-semibold text-sm text-on-surface">{pData.username || 'Player'}</span>
                          <span className="text-[10px] text-secondary font-label font-bold tracking-wider">{lobbyLabel}</span>
                          <span className={"text-[10px] font-label font-bold rounded px-1.5 py-0.5 border " + (isOpen ? "text-primary bg-primary/10 border-primary/20" : "text-tertiary bg-tertiary/10 border-tertiary/20")}>
                            {d.status === 'open' ? 'Open' : d.status === 'resolved_accepted' ? 'Accepted' : 'Rejected'}
                          </span>
                        </div>
                        <div className="text-xs text-on-surface-variant/50 font-mono mb-0.5">
                          {"Claimed: #" + (d.claimed_placement || '?') + " - Reported: #" + (d.reported_placement || '?')}
                        </div>
                        {d.reason && <div className="text-xs text-on-surface-variant/40">{d.reason}</div>}
                        {isSafeUrl(d.screenshot_url) && <a href={d.screenshot_url} target="_blank" rel="noopener noreferrer nofollow" className="text-[10px] text-secondary hover:underline">View screenshot</a>}
                      </div>
                      {isOpen && (
                        <div className="flex gap-2 shrink-0">
                          <Btn variant="tertiary" size="sm" onClick={function() { resolveDispute(d.id, true); }}>Accept</Btn>
                          <Btn variant="destructive" size="sm" onClick={function() { resolveDispute(d.id, false); }}>Reject</Btn>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            ADMIN: Controls
           ══════════════════════════════════════════════════════════════════════ */}
        {isAdmin && (
          <div className="bg-surface-container-lowest rounded border border-error/15 overflow-hidden mt-6">
            <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
              <Icon name="admin_panel_settings" size={18} className="text-error" />
              <span className="font-label font-bold text-sm tracking-widest uppercase text-error">Admin Controls</span>
            </div>
            <div className="p-5">
              <div className="flex gap-2 flex-wrap">
                {phase === 'draft' && (
                  <Btn variant="secondary" size="sm" onClick={adminOpenRegistration}>
                    Open Registration
                  </Btn>
                )}
                {phase === 'registration' && (
                  <Btn variant="primary" size="sm" onClick={adminOpenCheckIn}>
                    Open Check-In
                  </Btn>
                )}
                {phase === 'check_in' && (
                  <Btn variant="primary" size="sm" onClick={adminCloseCheckIn}>
                    Close Check-In
                  </Btn>
                )}
                {phase === 'check_in' && checkedInCount >= 2 && lobbies.length === 0 && (
                  <Btn variant="tertiary" size="sm" onClick={generateLobbies} disabled={actionLoading} loading={actionLoading}>
                    {actionLoading ? 'Generating...' : 'Generate Lobbies'}
                  </Btn>
                )}
                {phase === 'check_in' && lobbies.length > 0 && (
                  <span className="flex items-center gap-1.5 text-[10px] font-label font-bold text-tertiary bg-tertiary/10 rounded px-3 py-2 border border-tertiary/20">
                    <Icon name="check" size={12} />
                    {lobbies.length + " lobbies ready"}
                  </span>
                )}
                {(phase === 'check_in' || phase === 'registration') && (
                  <Btn variant="secondary" size="sm" onClick={adminStartTournament}>
                    Start Tournament
                  </Btn>
                )}
                {isLive && allLobbiesLocked && !isLastGame && (
                  <Btn variant="primary" size="sm" onClick={startNextGame}>
                    {"Start Game " + (currentGameNumber + 1)}
                  </Btn>
                )}
                {isLive && allLobbiesLocked && isLastGame && (
                  <Btn variant="tertiary" size="sm" onClick={finalizeTournament}>
                    Finalize Tournament
                  </Btn>
                )}
              </div>
              <div className="text-[10px] font-mono text-on-surface-variant/40 mt-3">
                {"Phase: " + (phaseLabels[phase] || phase) + " | Registered: " + regCount + " | Checked in: " + checkedInCount + (lobbies.length > 0 ? " | " + currentGameLobbies.length + " lobbies" : "") + (isLive ? " | Game " + currentGameNumber + "/" + totalGames : "")}
              </div>
            </div>
          </div>
        )}

      </div>

      {adminLineupModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={function(){ setAdminLineupModal({open: false, regId: null, sel: [], rosterMembers: [], teamName: '', tag: ''}); }}>
          <div className="bg-surface-container rounded border border-outline-variant/20 max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={function(e){ e.stopPropagation(); }}>
            <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="admin_panel_settings" size={18} className="text-error" />
                <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">Admin: Edit Lineup</span>
              </div>
              <button onClick={function(){ setAdminLineupModal({open: false, regId: null, sel: [], rosterMembers: [], teamName: '', tag: ''}); }} className="text-on-surface-variant/60 hover:text-on-surface text-xl leading-none">{'\u2715'}</button>
            </div>
            <div className="px-5 py-3 border-b border-outline-variant/10">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-on-surface">{adminLineupModal.teamName}</span>
                {adminLineupModal.tag && (
                  <span className="text-[10px] font-label font-bold tracking-widest uppercase rounded px-1.5 py-0.5 border border-secondary/30 bg-secondary/10 text-secondary">{adminLineupModal.tag}</span>
                )}
              </div>
              <div className="text-[11px] text-on-surface-variant mt-1">
                {'Pick exactly ' + teamSizeNum + ' starters. ' + (adminLineupModal.sel.length) + '/' + teamSizeNum + ' selected.'}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/5">
              {(adminLineupModal.rosterMembers || []).length === 0 ? (
                <div className="p-5 text-sm text-on-surface-variant">No active roster members on this team.</div>
              ) : (adminLineupModal.rosterMembers || []).map(function(m) {
                var p = m.players || {};
                var picked = (adminLineupModal.sel || []).indexOf(m.player_id) !== -1;
                return (
                  <button key={m.id} type="button" onClick={function(){ toggleAdminLineupSel(m.player_id); }} className={"w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-surface-container-high " + (picked ? "bg-tertiary/5" : "")}>
                    <span className={"w-5 h-5 rounded border flex items-center justify-center " + (picked ? "border-tertiary bg-tertiary/20 text-tertiary" : "border-outline-variant/40")}>
                      {picked ? '\u2713' : ''}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-on-surface">{p.username || 'Player'}</div>
                      <div className="text-[10px] text-on-surface-variant/50">{(p.rank || 'Unranked') + (m.role === 'captain' ? ' - Captain' : m.role === 'sub' ? ' - Sub' : '')}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="px-5 py-4 border-t border-outline-variant/10 flex items-center justify-end gap-2">
              <Btn variant="secondary" size="sm" onClick={function(){ setAdminLineupModal({open: false, regId: null, sel: [], rosterMembers: [], teamName: '', tag: ''}); }}>Cancel</Btn>
              <Btn variant="primary" size="sm" onClick={adminSubmitLineupEdit} disabled={adminLineupModal.sel.length !== teamSizeNum}>Save Lineup</Btn>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
