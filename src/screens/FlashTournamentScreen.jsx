import { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { Panel, Btn } from '../components/ui'
import { supabase } from '../lib/supabase.js'
import { PTS, RANKS } from '../lib/constants.js'
import { buildFlashLobbies } from '../lib/tournament.js'
import { createNotification } from '../lib/notifications.js'
import PageLayout from '../components/layout/PageLayout'

export default function FlashTournamentScreen(props) {
  var tournamentId = props.tournamentId;

  var ctx = useApp();
  var currentUser = ctx.currentUser;
  var setAuthScreen = ctx.setAuthScreen;
  var toast = ctx.toast;
  var setScreen = ctx.setScreen;
  var players = ctx.players;
  var isAdmin = ctx.isAdmin;

  var [tournament, setTournament] = useState(null);
  var [registrations, setRegistrations] = useState([]);
  var [lobbies, setLobbies] = useState([]);
  var [lobbyCodeInputs, setLobbyCodeInputs] = useState({});
  var [loading, setLoading] = useState(true);
  var [activeTab, setActiveTab] = useState('info');
  var [actionLoading, setActionLoading] = useState(false);
  var [reports, setReports] = useState([]);
  var [myPlacement, setMyPlacement] = useState(0);
  var [disputeForm, setDisputeForm] = useState({open: false, lobbyId: null, claimed: 0, reason: '', screenshotUrl: ''});
  var [disputes, setDisputes] = useState([]);
  var [gameResults, setGameResults] = useState([]);
  var channelRef = useRef(null);

  function loadTournament() {
    return supabase.from('tournaments').select('*').eq('id', tournamentId).single().then(function(res) {
      if (res.error) { console.error('[Flash] Failed to load tournament:', res.error); return res; }
      if (res.data) setTournament(res.data);
      return res;
    });
  }

  function loadRegistrations() {
    return supabase.from('registrations').select('*, players(username, riot_id, rank, region)').eq('tournament_id', tournamentId).then(function(res) {
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
    Promise.all([loadTournament(), loadRegistrations(), loadLobbies(), loadDisputes(), loadResults()]).then(function() { setLoading(false); }).catch(function(e) { console.error('[Flash] Initial load failed:', e); setLoading(false); });
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
    channel.subscribe();
    return function() { supabase.removeChannel(channel); channelRef.current = null; };
  }, [tournamentId]);

  function broadcastUpdate(type) {
    if (channelRef.current) {
      channelRef.current.send({type: 'broadcast', event: 'update', payload: {type: type}});
    }
  }

  var rankColors = {Iron: '#5A6573', Bronze: '#CD7F32', Silver: '#C0C0C0', Gold: '#E8A838', Platinum: '#4ECDC4', Emerald: '#52C47C', Diamond: '#93B5F7', Master: '#9B72CF', Grandmaster: '#DC2626', Challenger: '#F59E0B'};

  function getPlayerById(pid) {
    return (players || []).find(function(p) { return p.id === pid; }) || {username: 'Unknown', rank: 'Iron'};
  }

  function submitLobbyCode(lobbyId, code) {
    supabase.from('lobbies').update({lobby_code: code}).eq('id', lobbyId).then(function(res) {
      if (res.error) { toast('Failed to save code', 'error'); return; }
      toast('Lobby code saved!', 'success');
      loadLobbies();
    });
  }

  function generateLobbies() {
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
              if (tRes.error) { console.error('[Flash] Failed to start tournament:', tRes.error); toast && toast('Error: ' + tRes.error.message, 'error'); return; }
              setTournament(Object.assign({}, tournament, {phase: 'in_progress', current_round: 1}));
            });
          toast(result.lobbies.length + ' lobbies generated!', 'success');
          broadcastUpdate('lobbies_generated');
          loadLobbies();
          supabase.from('registrations').select('players(auth_user_id)').eq('tournament_id', tournamentId).eq('status', 'checked_in').then(function(rRes) {
            if (rRes.data) { rRes.data.forEach(function(r) { var uid = r.players && r.players.auth_user_id; if (uid) { createNotification(uid, 'Lobby Assigned', 'Your lobby has been assigned for ' + (tournament ? tournament.name : 'the tournament') + '. Check your lobby now!', 'trophy'); } }); }
          });
        });
      });
  }

  var myPlayer = currentUser ? (players || []).find(function(p) { return p.authUserId === currentUser.id; }) : null;
  var myReg = myPlayer ? registrations.find(function(r) { return r.player_id === myPlayer.id; }) : null;
  var regCount = registrations.filter(function(r) { return r.status === 'registered' || r.status === 'checked_in'; }).length;
  var currentGameNumber = tournament ? (tournament.current_round || 1) : 1;
  var myLobby = lobbies.find(function(l) { return l.player_ids && l.player_ids.indexOf(myPlayer ? myPlayer.id : null) !== -1; });
  var myReport = myPlayer ? reports.find(function(r) { return r.player_id === myPlayer.id; }) : null;
  var openDisputeCount = disputes.filter(function(d) { return d.status === 'open'; }).length;
  var myDisputes = myPlayer ? disputes.filter(function(d) { return d.player_id === myPlayer.id; }) : [];
  var checkedInCount = registrations.filter(function(r) { return r.status === 'checked_in'; }).length;
  var maxP = tournament ? tournament.max_players || 128 : 128;
  var phase = tournament ? tournament.phase : 'draft';
  var prizes = tournament && Array.isArray(tournament.prize_pool_json) ? tournament.prize_pool_json : [];

  function handleRegister() {
    if (!currentUser) { setAuthScreen('login'); return; }
    if (!myPlayer || !myPlayer.riotId) {
      toast('Set your Riot ID in your profile before registering', 'error');
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
      });
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
    });
  }

  function handleUnregister() {
    if (!myReg) return;
    if (!confirm('Are you sure you want to unregister?')) return;
    setActionLoading(true);
    supabase.from('registrations').delete().eq('id', myReg.id).then(function(res) {
      setActionLoading(false);
      if (res.error) { toast('Failed to unregister: ' + res.error.message, 'error'); return; }
      toast('Unregistered', 'success');
      broadcastUpdate('registration');
      loadRegistrations();
    });
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
    });
  }

  function adminOpenCheckIn() {
    supabase.from('tournaments').update({phase: 'check_in', checkin_open_at: new Date().toISOString()}).eq('id', tournamentId).then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
      setTournament(Object.assign({}, tournament, {phase: 'check_in'}));
      toast('Check-in opened!', 'success');
      broadcastUpdate('phase_change');
      supabase.from('registrations').select('players(auth_user_id)').eq('tournament_id', tournamentId).eq('status', 'registered').then(function(rRes) {
        if (rRes.data) { rRes.data.forEach(function(r) { var uid = r.players && r.players.auth_user_id; if (uid) { createNotification(uid, 'Check-in is Open', 'Check in now to secure your spot in ' + (tournament ? tournament.name : 'the tournament') + '!', 'checkmark'); } }); }
      });
    });
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
        supabase.from('registrations').update({status: 'dropped'}).in('id', dropIds).then(function(dropRes) {
          if (dropRes.error) console.error('Drop failed:', dropRes.error);
          var openSpots = maxP - checkedInCount;
          var waitlisted = registrations.filter(function(r) { return r.status === 'waitlisted'; }).sort(function(a, b) { return (a.waitlist_position || 999) - (b.waitlist_position || 999); });
          var toPromote = waitlisted.slice(0, Math.max(0, openSpots));
          if (toPromote.length > 0) {
            var promoteIds = toPromote.map(function(r) { return r.id; });
            supabase.from('registrations').update({status: 'checked_in', checked_in_at: new Date().toISOString()}).in('id', promoteIds).then(function() { loadRegistrations(); });
          } else {
            loadRegistrations();
          }
        });
      } else {
        loadRegistrations();
      }
      toast('Check-in closed. ' + notCheckedIn.length + ' player(s) dropped.', 'success');
      broadcastUpdate('phase_change');
    });
  }

  function adminOpenRegistration() {
    supabase.from('tournaments').update({phase: 'registration', registration_open_at: new Date().toISOString()}).eq('id', tournamentId).then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
      setTournament(Object.assign({}, tournament, {phase: 'registration'}));
      toast('Registration opened!', 'success');
      broadcastUpdate('phase_change');
    });
  }

  function adminStartTournament() {
    supabase.from('tournaments').update({phase: 'in_progress', started_at: new Date().toISOString(), current_round: 1}).eq('id', tournamentId).then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
      setTournament(Object.assign({}, tournament, {phase: 'in_progress', current_round: 1}));
      toast('Tournament started!', 'success');
      broadcastUpdate('phase_change');
    });
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
      });
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
    });
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
    supabase.from('game_results').insert(gameRows).then(function(res) {
      if (res.error) { toast('Failed to lock: ' + res.error.message, 'error'); return; }
      supabase.from('lobbies').update({status: 'locked', reports_complete: true}).eq('id', lobbyId).then(function(luRes) {
        if (luRes.error) { console.error('[Flash] Failed to lock lobby:', luRes.error); toast && toast('Error: ' + luRes.error.message, 'error'); return; }
        toast('Lobby locked!', 'success');
        broadcastUpdate('lobby_locked');
        loadLobbies();
        loadReports();
        loadResults();
      });
    });
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
        toast('Placement overridden', 'success');
        loadReports();
      });
  }

  function isSafeUrl(url) { return url && (url.indexOf('https://') === 0 || url.indexOf('http://') === 0); }

  function resolveDispute(disputeId, accept) {
    var d = disputes.find(function(x) { return x.id === disputeId; });
    if (!d) return;
    var updates = {
      status: accept ? 'resolved_accepted' : 'resolved_rejected',
      resolved_by: currentUser ? currentUser.id : null,
      resolved_at: new Date().toISOString()
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
        });
      }
      toast('Dispute ' + (accept ? 'accepted' : 'rejected'), 'success');
      loadDisputes();
      var disputingPlayer = (players || []).find(function(p) { return p.id === d.player_id; });
      if (disputingPlayer && disputingPlayer.authUserId) {
        createNotification(disputingPlayer.authUserId, 'Dispute ' + (accept ? 'Accepted' : 'Rejected'), 'Your placement dispute has been ' + (accept ? 'accepted. Your placement has been updated.' : 'rejected. The original result stands.'), 'bell');
      }
    });
  }

  function startNextGame() {
    var nextGame = currentGameNumber + 1;
    supabase.from('tournaments').update({current_round: nextGame}).eq('id', tournamentId)
      .then(function(res) {
        if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
        var seedMethod = tournament.seeding_method || 'snake';
        if (seedMethod === 'snake') {
          var checkedIn = registrations.filter(function(r) { return r.status === 'checked_in'; });
          var checkedInPlayers = checkedIn.map(function(r) { return r.players || getPlayerById(r.player_id); }).filter(Boolean);
          checkedInPlayers.sort(function(a, b) {
            var aStand = standings.find(function(s) { return s.id === a.id; });
            var bStand = standings.find(function(s) { return s.id === b.id; });
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
            if (lRes.error) { console.error('[Flash] Failed to create lobbies for next game:', lRes.error); toast && toast('Error: ' + lRes.error.message, 'error'); return; }
            setTournament(Object.assign({}, tournament, {current_round: nextGame}));
            loadLobbies();
            loadReports();
            toast('Game ' + nextGame + ' started! New lobbies generated.', 'success');
            broadcastUpdate('next_game');
          });
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
            if (lRes.error) { console.error('[Flash] Failed to create lobbies for next game:', lRes.error); toast && toast('Error: ' + lRes.error.message, 'error'); return; }
            setTournament(Object.assign({}, tournament, {current_round: nextGame}));
            loadLobbies();
            loadReports();
            toast('Game ' + nextGame + ' started!', 'success');
            broadcastUpdate('next_game');
          });
        }
      });
  }

  function finalizeTournament() {
    if (!confirm('Finalize this tournament? This cannot be undone.')) return;
    supabase.from('tournaments').update({phase: 'complete', completed_at: new Date().toISOString()})
      .eq('id', tournamentId).then(function(res) {
        if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
        setTournament(Object.assign({}, tournament, {phase: 'complete'}));
        toast('Tournament finalized!', 'success');
        broadcastUpdate('finalized');
        supabase.from('registrations').select('players(auth_user_id)').eq('tournament_id', tournamentId).in('status', ['checked_in', 'registered']).then(function(rRes) {
          if (rRes.data) { rRes.data.forEach(function(r) { var uid = r.players && r.players.auth_user_id; if (uid) { createNotification(uid, 'Results Finalized', (tournament ? tournament.name : 'The tournament') + ' has been finalized. Check the results screen for your placement and points.', 'trophy'); } }); }
        });
        supabase.from('game_results').select('player_id,placement,points')
          .eq('tournament_id', tournamentId).then(function(grRes) {
            if (grRes.error || !grRes.data || !grRes.data.length) return;
            var playerAgg = {};
            grRes.data.forEach(function(g) {
              if (!playerAgg[g.player_id]) playerAgg[g.player_id] = {pts: 0, wins: 0, top4: 0, games: 0, placeSum: 0};
              var a = playerAgg[g.player_id];
              a.pts += (g.points || 0);
              a.wins += (g.placement === 1 ? 1 : 0);
              a.top4 += (g.placement <= 4 ? 1 : 0);
              a.games += 1;
              a.placeSum += g.placement;
            });
            var tRows = Object.keys(playerAgg).map(function(pid) {
              var a = playerAgg[pid];
              return {tournament_id: tournamentId, player_id: pid, total_points: a.pts, wins: a.wins, top4_count: a.top4, final_placement: Math.round(a.placeSum / a.games)};
            });
            if (tRows.length > 0) {
              supabase.from('tournament_results').insert(tRows).then(function(tr) {
                if (tr.error) console.error('[TFT] Failed to insert tournament_results:', tr.error);
              });
            }
            Object.keys(playerAgg).forEach(function(pid) {
              var a = playerAgg[pid];
              supabase.from('players').select('season_pts,wins,top4,games,avg_placement').eq('id', pid).single()
                .then(function(pRes) {
                  if (pRes.error || !pRes.data) return;
                  var cur = pRes.data;
                  var newGames = (cur.games || 0) + a.games;
                  var newAvg = newGames > 0 ? (((parseFloat(cur.avg_placement) || 0) * (cur.games || 0) + a.placeSum) / newGames) : 0;
                  supabase.from('players').update({
                    season_pts: (cur.season_pts || 0) + a.pts,
                    wins: (cur.wins || 0) + a.wins,
                    top4: (cur.top4 || 0) + a.top4,
                    games: newGames,
                    avg_placement: parseFloat(newAvg.toFixed(2))
                  }).eq('id', pid).then(function(uRes) {
                    if (uRes.error) console.error('[TFT] Failed to update player stats:', pid, uRes.error);
                  });
                });
            });
          });
      });
  }

  if (loading) {
    return (
      <div className="page wrap text-center pt-20">
        <div className="text-on-surface-variant text-sm">Loading tournament...</div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="page wrap text-center pt-20">
        <div className="text-4xl mb-4">{'!'}</div>
        <h2 className="text-on-surface mb-2.5">Tournament Not Found</h2>
        <p className="text-on-surface-variant mb-4">This tournament may have been removed.</p>
        <Btn v="primary" onClick={function() { setScreen('tournaments'); }}>Back to Tournaments</Btn>
      </div>
    );
  }

  var phaseColors = {draft: '#9AAABF', registration: '#9B72CF', check_in: '#E8A838', in_progress: '#52C47C', complete: '#4ECDC4'};
  var phaseLabels = {draft: 'Draft', registration: 'Registration Open', check_in: 'Check-In Open', in_progress: 'In Progress', completed: 'Completed', complete: 'Complete'};
  var dateStr = tournament.date ? new Date(tournament.date).toLocaleDateString('en-GB', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : 'TBD';

  var regBtnLabel = 'Register';
  var regBtnVariant = 'primary';
  var regBtnAction = handleRegister;
  var regBtnDisabled = false;
  if (myReg && myReg.status === 'registered' && phase === 'check_in') {
    regBtnLabel = 'Check In'; regBtnVariant = 'success'; regBtnAction = handleCheckIn;
  } else if (myReg && myReg.status === 'checked_in') {
    regBtnLabel = 'Checked In'; regBtnVariant = 'success'; regBtnDisabled = true;
  } else if (myReg && myReg.status === 'waitlisted') {
    regBtnLabel = 'Waitlisted (#' + (myReg.waitlist_position || '?') + ')'; regBtnVariant = 'dark'; regBtnDisabled = true;
  } else if (myReg && myReg.status === 'registered') {
    regBtnLabel = 'Registered'; regBtnVariant = 'success'; regBtnDisabled = true;
  } else if (phase !== 'registration' && phase !== 'check_in') {
    regBtnLabel = phase === 'draft' ? 'Registration Not Open' : 'Registration Closed'; regBtnDisabled = true; regBtnVariant = 'dark';
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
  var isLastGame = currentGameNumber >= (tournament && tournament.round_count ? tournament.round_count : 3);

  var allGameNums = [];
  gameResults.forEach(function(g) { if (allGameNums.indexOf(g.game_number) === -1) allGameNums.push(g.game_number); });
  allGameNums.sort(function(a, b) { return a - b; });

  var tabs = [{id: 'info', label: 'Info'}, {id: 'players', label: 'Players (' + regCount + ')'}];
  if (phase === 'in_progress' || phase === 'complete' || (phase === 'check_in' && isAdmin)) {
    tabs.push({id: 'bracket', label: 'Lobbies' + (lobbies.length > 0 ? ' (' + lobbies.length + ')' : '')});
  }
  if (phase === 'in_progress' || phase === 'complete') {
    tabs.push({id: 'standings', label: phase === 'complete' ? 'Final Results' : 'Standings'});
  }

  var sortedRegs = [].concat(registrations).sort(function(a, b) {
    var statusOrder = {checked_in: 0, registered: 1, waitlisted: 2, dropped: 3};
    return (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
  });

  return (
    <PageLayout>
      <div className="page wrap">
        <button
          onClick={function() { setScreen('tournaments'); }}
          className="flex items-center gap-1 text-primary text-[13px] font-semibold cursor-pointer pb-4 bg-transparent border-0 font-[inherit]"
        >
          {'\u2190 Back to Tournaments'}
        </button>

        <div className="rounded-2xl p-7 mb-5 bg-gradient-to-br from-secondary/[0.12] to-tertiary/[0.08] border border-secondary/20">
          <div className="flex items-center gap-2.5 mb-3 flex-wrap">
            <span
              className="text-[11px] font-bold uppercase tracking-wide bg-white/[.06] rounded-md px-2.5 py-[3px]"
              style={{color: phaseColors[phase]}}
            >
              {phaseLabels[phase] || phase}
            </span>
            <span className="text-[11px] text-on-surface-variant">{dateStr}</span>
          </div>
          <h1 className="text-on-surface text-[28px] font-bold mb-2">{tournament.name}</h1>
          <div className="flex gap-4 flex-wrap text-[13px] text-on-surface-variant">
            <span>{(tournament.round_count || 3) + ' games'}</span>
            <span>{(tournament.seeding_method || 'snake') + ' seeding'}</span>
            <span>{maxP + ' max players'}</span>
          </div>
        </div>

        {prizes.length > 0 && (
          <Panel className="p-[18px] mb-4">
            <div className="font-bold text-sm text-[#E8A838] mb-3">{'Prize Pool'}</div>
            <div className="flex gap-2.5 flex-wrap">
              {prizes.map(function(p, i) {
                var colors = ['#E8A838', '#C0C0C0', '#CD7F32'];
                var c = colors[i] || '#9B72CF';
                return (
                  <div key={i} className="bg-white/[.03] rounded-[10px] px-[18px] py-3 min-w-[80px] text-center" style={{border: '1px solid ' + c + '33'}}>
                    <div className="text-xl font-bold mb-1" style={{color: c}}>{'#' + p.placement}</div>
                    <div className="text-[13px] text-on-surface font-semibold">{p.prize}</div>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        <Panel className="px-5 py-4 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-2.5">
            <div>
              <div className="text-[22px] font-bold text-on-surface">{regCount + ' / ' + maxP}</div>
              <div className="text-[11px] text-on-surface-variant">{'players registered' + (phase === 'check_in' ? ' - ' + checkedInCount + ' checked in' : '')}</div>
            </div>
            <div className="flex gap-2 items-center">
              <Btn v={regBtnVariant} onClick={regBtnAction} disabled={regBtnDisabled || actionLoading}>{actionLoading ? '...' : regBtnLabel}</Btn>
              {canUnregister && <Btn v="dark" s="sm" onClick={handleUnregister} disabled={actionLoading}>Unregister</Btn>}
            </div>
          </div>
          <div className="h-1 rounded-sm bg-white/[.06] mt-2.5">
            <div className="h-1 rounded-sm bg-primary transition-all duration-300" style={{width: Math.min(100, Math.round((regCount / maxP) * 100)) + '%'}}/>
          </div>
        </Panel>

        <div
          className="flex gap-1 mb-4 border-b border-on-surface/[.06] pb-0.5 overflow-x-auto whitespace-nowrap"
          style={{WebkitOverflowScrolling: 'touch', msOverflowStyle: 'none', scrollbarWidth: 'none'}}
        >
          {tabs.map(function(t) {
            var active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={function() { setActiveTab(t.id); }}
                className={'shrink-0 whitespace-nowrap border-0 border-b-2 px-4 py-2 text-[13px] font-[inherit] cursor-pointer transition-all duration-150 ' + (active ? 'bg-secondary/15 border-b-secondary font-bold text-on-surface' : 'bg-transparent border-b-transparent font-medium text-on-surface-variant')}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'info' && (
          <div className="flex flex-col gap-3.5">
            <Panel className="p-[18px]">
              <div className="font-bold text-sm text-on-surface mb-2.5">Tournament Details</div>
              <div className="grid grid-cols-2 gap-2.5 text-[13px]">
                <div><span className="text-on-surface-variant">Format: </span><span className="text-on-surface font-semibold">{tournament.seeding_method || 'snake'}</span></div>
                <div><span className="text-on-surface-variant">Games: </span><span className="text-on-surface font-semibold">{tournament.round_count || 3}</span></div>
                <div><span className="text-on-surface-variant">Max Players: </span><span className="text-on-surface font-semibold">{maxP}</span></div>
                <div><span className="text-on-surface-variant">Lobby Host: </span><span className="text-on-surface font-semibold">{tournament.lobby_host_method || 'random'}</span></div>
              </div>
            </Panel>
            {tournament.announcement && (
              <Panel className="p-4" style={{background: 'rgba(232,168,56,.06)', borderColor: 'rgba(232,168,56,.2)'}}>
                <div className="text-xs font-bold text-[#E8A838] mb-1.5">Announcement</div>
                <div className="text-[13px] text-on-surface leading-relaxed">{tournament.announcement}</div>
              </Panel>
            )}
          </div>
        )}

        {activeTab === 'players' && (
          <Panel className="p-4">
            <div className="font-bold text-sm text-on-surface mb-3">{'Registered Players (' + registrations.length + ')'}</div>
            {sortedRegs.length === 0 && (
              <div className="text-center py-8 px-5 text-on-surface-variant text-sm">No players registered yet. Share the tournament link!</div>
            )}
            <div className="flex flex-col gap-1">
              {sortedRegs.map(function(r, idx) {
                var pData = r.players || {};
                var statusColors = {checked_in: '#52C47C', registered: '#9B72CF', waitlisted: '#E8A838', dropped: '#F87171'};
                var statusIcons = {checked_in: '\u2713', registered: '\u25CF', waitlisted: '\u25CB', dropped: '\u2717'};
                return (
                  <div key={r.id || idx} className="flex items-center gap-2.5 px-2.5 py-2 bg-white/[.02] rounded-md border border-on-surface/[.04]">
                    <span className="text-sm w-[18px] text-center" style={{color: statusColors[r.status] || '#8896A8'}}>{statusIcons[r.status] || '?'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13px] text-on-surface">{pData.username || 'Player'}</div>
                      <div className="text-[11px] text-on-surface-variant">{(pData.rank || 'Unranked') + ' - ' + (pData.region || '')}</div>
                    </div>
                    <span className="text-[11px] font-bold uppercase" style={{color: statusColors[r.status] || '#8896A8'}}>{r.status === 'checked_in' ? 'Checked In' : r.status}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        {activeTab === 'bracket' && (
          <div className="flex flex-col gap-3">
            {phase === 'in_progress' && myPlayer && myLobby && (
              <Panel className="p-[18px]" style={{borderColor: 'rgba(155,114,207,.35)', background: 'rgba(155,114,207,.05)'}}>
                <div className="font-bold text-sm text-primary mb-3">{'Game ' + currentGameNumber + ' - Report Your Placement'}</div>
                {myReport ? (
                  <div>
                    <div className="flex items-center gap-2.5 mb-2.5 flex-wrap">
                      <span className="text-[13px] text-[#52C47C] font-semibold">{'\u2713 You reported: ' + myReport.reported_placement + (myReport.reported_placement === 1 ? 'st' : myReport.reported_placement === 2 ? 'nd' : myReport.reported_placement === 3 ? 'rd' : 'th') + ' place'}</span>
                      <button
                        onClick={function() { setMyPlacement(myReport.reported_placement); }}
                        className="bg-transparent rounded-md px-2.5 py-1 text-[11px] text-primary cursor-pointer font-[inherit] border border-secondary/30"
                      >
                        Update
                      </button>
                    </div>
                    {myPlacement > 0 && (
                      <div className="flex gap-2 items-center mb-2.5">
                        <select
                          value={myPlacement}
                          onChange={function(e) { setMyPlacement(parseInt(e.target.value) || 0); }}
                          className="bg-white/[.06] rounded-md px-2.5 py-[7px] text-[13px] text-on-surface font-[inherit] outline-none border border-secondary/30"
                        >
                          {(myLobby.player_ids || []).map(function(_, i) {
                            return (<option key={i + 1} value={i + 1}>{i + 1 + (i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th') + ' place'}</option>);
                          })}
                        </select>
                        <Btn v="primary" s="sm" onClick={function() { submitReport(myPlacement); }}>Submit</Btn>
                        <Btn v="dark" s="sm" onClick={function() { setMyPlacement(0); }}>Cancel</Btn>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2 items-center mb-2.5 flex-wrap">
                    <select
                      value={myPlacement}
                      onChange={function(e) { setMyPlacement(parseInt(e.target.value) || 0); }}
                      className="bg-white/[.06] rounded-md px-2.5 py-[7px] text-[13px] text-on-surface font-[inherit] outline-none"
                      style={{border: '1px solid rgba(155,114,207,.3)'}}
                    >
                      <option value={0}>Select placement...</option>
                      {(myLobby.player_ids || []).map(function(_, i) {
                        return (<option key={i + 1} value={i + 1}>{i + 1 + (i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th') + ' place'}</option>);
                      })}
                    </select>
                    <Btn v="primary" s="sm" onClick={function() { if (myPlacement > 0) submitReport(myPlacement); else toast('Select a placement first', 'error'); }} disabled={myPlacement === 0}>Submit</Btn>
                  </div>
                )}
                {myReport && !disputeForm.open && (
                  <button
                    onClick={function() { setDisputeForm({open: true, lobbyId: myLobby.id, claimed: myReport.reported_placement, reason: '', screenshotUrl: ''}); }}
                    className="bg-transparent rounded-md px-3 py-[5px] text-[11px] text-[#F87171] cursor-pointer font-[inherit] mt-1 border border-[#F87171]/30"
                  >
                    {'Dispute this result'}
                  </button>
                )}
                {disputeForm.open && disputeForm.lobbyId === myLobby.id && (
                  <div className="mt-3 p-[14px] rounded-[10px] bg-[#F87171]/[0.05] border border-[#F87171]/20">
                    <div className="font-bold text-xs text-[#F87171] mb-2.5">Submit Dispute</div>
                    <div className="flex gap-2 mb-2 flex-wrap items-center">
                      <label className="text-xs text-on-surface-variant min-w-[80px]">My actual placement:</label>
                      <select
                        value={disputeForm.claimed}
                        onChange={function(e) { setDisputeForm(Object.assign({}, disputeForm, {claimed: parseInt(e.target.value) || 0})); }}
                        className="bg-white/[.06] rounded-md px-2.5 py-[6px] text-xs text-on-surface font-[inherit] outline-none border border-[#F87171]/30"
                      >
                        <option value={0}>Select...</option>
                        {(myLobby.player_ids || []).map(function(_, i) {
                          return (<option key={i + 1} value={i + 1}>{i + 1 + (i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th')}</option>);
                        })}
                      </select>
                    </div>
                    <textarea
                      placeholder="Reason for dispute..."
                      value={disputeForm.reason}
                      onChange={function(e) { setDisputeForm(Object.assign({}, disputeForm, {reason: e.target.value})); }}
                      rows={2}
                      className="w-full bg-white/[.05] rounded-md px-2.5 py-2 text-xs text-on-surface font-[inherit] outline-none resize-y mb-2 border border-[#F87171]/20 box-border"
                    />
                    <input
                      placeholder="Screenshot URL (optional)"
                      value={disputeForm.screenshotUrl}
                      onChange={function(e) { setDisputeForm(Object.assign({}, disputeForm, {screenshotUrl: e.target.value})); }}
                      className="w-full bg-white/[.05] rounded-md px-2.5 py-[7px] text-xs text-on-surface font-[inherit] outline-none mb-2.5 border border-[#F87171]/20 box-border"
                    />
                    <div className="flex gap-2">
                      <Btn v="danger" s="sm" onClick={submitDispute} disabled={!disputeForm.claimed || !disputeForm.reason}>Submit Dispute</Btn>
                      <Btn v="dark" s="sm" onClick={function() { setDisputeForm({open: false, lobbyId: null, claimed: 0, reason: '', screenshotUrl: ''}); }}>Cancel</Btn>
                    </div>
                  </div>
                )}
              </Panel>
            )}
            {phase === 'in_progress' && myPlayer && myLobby && myLobby.status === 'locked' && myReport && (
              <div
                className="mt-2.5 px-[14px] py-2.5 rounded-[10px] text-[13px] font-semibold"
                style={{
                  background: 'rgba(78,205,196,.08)',
                  border: '1px solid rgba(78,205,196,.2)',
                  color: myReport.reported_placement === 1 ? '#E8A838' : myReport.reported_placement === 2 ? '#C0C0C0' : myReport.reported_placement === 3 ? '#CD7F32' : '#4ECDC4'
                }}
              >
                {'Your result: ' + myReport.reported_placement + (myReport.reported_placement === 1 ? 'st' : myReport.reported_placement === 2 ? 'nd' : myReport.reported_placement === 3 ? 'rd' : 'th') + ' place - ' + (PTS[myReport.reported_placement] || 0) + ' points'}
              </div>
            )}
            {phase === 'in_progress' && myPlayer && myDisputes.length > 0 && (
              <div className="px-[18px] py-[14px] rounded-[10px] flex flex-col gap-2.5" style={{background: 'rgba(232,168,56,.06)', border: '1px solid rgba(232,168,56,.2)'}}>
                <div className="font-bold text-xs text-[#E8A838] tracking-[.05em] uppercase">Your Disputes</div>
                {myDisputes.map(function(d) {
                  var isPending = d.status === 'open';
                  var isAccepted = d.status === 'resolved_accepted';
                  var statusColor = isPending ? '#E8A838' : isAccepted ? '#52C47C' : '#F87171';
                  var statusLabel = isPending ? 'Pending review' : isAccepted ? 'Accepted - placement updated' : 'Rejected';
                  return (
                    <div key={d.id} className="bg-black/25 rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-2" style={{marginBottom: d.resolution_note ? 6 : 0}}>
                        <div className="w-2 h-2 rounded-full shrink-0" style={{background: statusColor}}/>
                        <div className="text-xs font-semibold" style={{color: statusColor}}>{statusLabel}</div>
                        {d.claimed_placement && (
                          <div className="text-[11px] text-on-surface-variant ml-auto">{'Claimed: ' + d.claimed_placement + (d.claimed_placement === 1 ? 'st' : d.claimed_placement === 2 ? 'nd' : d.claimed_placement === 3 ? 'rd' : 'th')}</div>
                        )}
                      </div>
                      {d.resolution_note && (
                        <div className="text-[11px] text-on-surface-variant pl-4">{d.resolution_note}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {lobbies.length === 0 && (
              <Panel className="py-12 px-5 text-center">
                <div className="font-bold text-base text-on-surface mb-1.5">Lobbies</div>
                <div className="text-[13px] text-on-surface-variant">Lobbies will appear once the admin generates them.</div>
              </Panel>
            )}
            {lobbies.map(function(lobby, idx) {
              var lobbyPlayers = (lobby.player_ids || []).map(function(pid) { return getPlayerById(pid); });
              var hostId = lobby.host_player_id;
              var isMyLobby = myPlayer && (lobby.player_ids || []).indexOf(myPlayer.id) !== -1;
              var iAmHost = myPlayer && hostId === myPlayer.id;
              var lobbyLetter = String.fromCharCode(65 + idx);
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
              var letterColor = isLocked ? '#52C47C' : '#9B72CF';
              var cardBorderColor = hasDuplicate ? 'rgba(248,113,113,.5)' : isLocked ? 'rgba(82,196,124,.3)' : isMyLobby ? 'rgba(155,114,207,.4)' : 'rgba(242,237,228,.08)';
              var cardBorderLeft = isLocked ? '4px solid #52C47C' : hasDuplicate ? '4px solid #F87171' : '4px solid transparent';
              return (
                <Panel
                  key={lobby.id}
                  className="overflow-hidden rounded-[10px] p-0"
                  style={{
                    borderColor: cardBorderColor,
                    boxShadow: isMyLobby && !hasDuplicate ? '0 0 0 1px rgba(155,114,207,.2)' : 'none',
                    borderLeft: cardBorderLeft,
                    background: isLocked ? 'rgba(82,196,124,.08)' : undefined
                  }}
                >
                  {isLocked && (
                    <div className="px-3 py-1 rounded-t-[10px] text-[11px] font-bold text-white text-center tracking-[.04em] bg-gradient-to-r from-[#52C47C] to-[#3DA867]">
                      {'\u2713 LOCKED'}
                    </div>
                  )}
                  <div className="px-[18px] py-4">
                    <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-9 h-9 rounded-[10px] flex items-center justify-center font-bold text-lg shrink-0"
                          style={{
                            background: isLocked ? 'rgba(82,196,124,.15)' : 'rgba(155,114,207,.15)',
                            border: '1px solid ' + (isLocked ? 'rgba(82,196,124,.4)' : 'rgba(155,114,207,.3)'),
                            color: letterColor
                          }}
                        >
                          {lobbyLetter}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-on-surface">{'Lobby ' + lobbyLetter}</div>
                          <div className="text-[11px] text-on-surface-variant">{lobbyPlayers.length + ' players' + (isLocked ? ' - Locked' : '')}</div>
                        </div>
                      </div>
                      <div className="flex gap-1.5 items-center flex-wrap">
                        {isAdmin && phase === 'in_progress' && (
                          <span
                            className="text-[11px] font-bold rounded-md px-2 py-[3px]"
                            style={{
                              color: allReported ? '#52C47C' : '#E8A838',
                              background: allReported ? 'rgba(82,196,124,.1)' : 'rgba(232,168,56,.1)',
                              border: '1px solid ' + (allReported ? 'rgba(82,196,124,.3)' : 'rgba(232,168,56,.3)')
                            }}
                          >
                            {reportedCount + '/' + totalCount + ' reported'}
                          </span>
                        )}
                        {isAdmin && lobbyDisputes.length > 0 && (
                          <span className="text-[11px] font-bold text-[#F97316] bg-[rgba(249,115,22,.1)] rounded-md px-2 py-[3px] border border-[#F97316]/30">
                            {lobbyDisputes.length + ' dispute' + (lobbyDisputes.length === 1 ? '' : 's')}
                          </span>
                        )}
                        {lobby.lobby_code && (
                          <div className="bg-[rgba(232,168,56,.1)] rounded-lg px-[14px] py-1.5 font-mono text-[15px] font-bold text-[#E8A838] tracking-[2px] border border-primary/30">
                            {lobby.lobby_code}
                          </div>
                        )}
                      </div>
                    </div>
                    {isAdmin && phase === 'in_progress' ? (
                      <div className="flex flex-col gap-1 mb-3">
                        {lobbyPlayers.map(function(p, pi) {
                          var isHost = p.id === hostId;
                          var rc = rankColors[p.rank || 'Iron'] || '#8896A8';
                          var playerReport = lobbyReports.find(function(r) { return r.player_id === p.id; });
                          var isDupe = playerReport && placementCounts[playerReport.reported_placement] > 1;
                          return (
                            <div
                              key={p.id || pi}
                              className="flex items-center gap-2 px-2 py-1.5 bg-white/[.02] rounded-md"
                              style={{border: '1px solid ' + (isDupe ? 'rgba(248,113,113,.3)' : isHost ? 'rgba(232,168,56,.15)' : 'rgba(242,237,228,.04)')}}
                            >
                              <span className="text-[11px] font-bold rounded min-w-[60px] text-center px-1.5 py-0.5" style={{color: rc, background: rc + '18'}}>{p.rank || 'Iron'}</span>
                              <span className="flex-1 text-[13px] text-on-surface font-semibold">{p.username || 'Unknown'}</span>
                              {playerReport ? (
                                <span
                                  className="text-xs font-bold rounded px-2 py-0.5"
                                  style={{
                                    color: isDupe ? '#F87171' : '#52C47C',
                                    background: isDupe ? 'rgba(248,113,113,.1)' : 'rgba(82,196,124,.1)'
                                  }}
                                >
                                  {playerReport.reported_placement + (playerReport.reported_placement === 1 ? 'st' : playerReport.reported_placement === 2 ? 'nd' : playerReport.reported_placement === 3 ? 'rd' : 'th')}
                                </span>
                              ) : (
                                <span className="text-[11px] text-[#E8A838] font-semibold">Not reported</span>
                              )}
                              <select
                                defaultValue=""
                                onChange={function(e) { var v = parseInt(e.target.value) || 0; if (v > 0) adminOverridePlacement(lobby.id, p.id, v); e.target.value = ''; }}
                                className="bg-white/[.06] rounded text-[11px] text-primary font-[inherit] outline-none cursor-pointer px-1.5 py-[3px] border border-secondary/20"
                              >
                                <option value="">Override</option>
                                {(lobby.player_ids || []).map(function(_, i) { return (<option key={i + 1} value={i + 1}>{i + 1}</option>); })}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={'flex flex-col gap-1 ' + (iAmHost && !lobby.lobby_code ? 'mb-3' : '')}>
                        {lobbyPlayers.map(function(p, pi) {
                          var isHost = p.id === hostId;
                          var rc = rankColors[p.rank || 'Iron'] || '#8896A8';
                          var playerReport = reports.find(function(r) { return r.player_id === p.id && r.lobby_id === lobby.id; });
                          var hasReported = !!playerReport;
                          return (
                            <div
                              key={p.id || pi}
                              className="flex items-center gap-2 px-2 py-1.5 bg-white/[.02] rounded-md"
                              style={{border: '1px solid ' + (isHost ? 'rgba(232,168,56,.15)' : 'rgba(242,237,228,.04)')}}
                            >
                              <span className="text-[11px] font-bold rounded min-w-[60px] text-center px-1.5 py-0.5" style={{color: rc, background: rc + '18'}}>{p.rank || 'Iron'}</span>
                              <span className="flex-1 text-[13px] text-on-surface font-semibold">
                                {isHost && <span className="text-[#E8A838] mr-1" title="Lobby Host">{'\u265B'}</span>}
                                {p.username || 'Unknown'}
                              </span>
                              {phase === 'in_progress' && (
                                <span
                                  className="text-[13px] font-bold"
                                  style={{color: hasReported ? '#52C47C' : 'rgba(136,150,168,.4)'}}
                                  title={hasReported ? 'Reported' : 'Not yet reported'}
                                >
                                  {hasReported ? '\u2713' : '\u25CB'}
                                </span>
                              )}
                              {playerReport && (
                                <span className="text-xs font-bold text-[#52C47C]">{playerReport.reported_placement + (playerReport.reported_placement === 1 ? 'st' : playerReport.reported_placement === 2 ? 'nd' : playerReport.reported_placement === 3 ? 'rd' : 'th')}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {isAdmin && phase === 'in_progress' && !isLocked && (
                      <div
                        className="flex gap-2 items-center pt-2.5 flex-wrap border-t border-on-surface/[.06]"
                      >
                        {hasDuplicate && <span className="text-[11px] text-[#F87171]">{'Duplicate placements - resolve before locking'}</span>}
                        <Btn v="success" s="sm" onClick={function() { lockLobby(lobby.id); }} disabled={!canLock}>{isLocked ? 'Locked' : canLock ? 'Lock Lobby' : 'Cannot Lock Yet'}</Btn>
                      </div>
                    )}
                    {iAmHost && !lobby.lobby_code && (
                      <div
                        className={'flex gap-2 items-center mt-2 pt-2.5 border-t border-on-surface/[.06] ' + (isLocked ? 'opacity-70 pointer-events-none' : '')}
                      >
                        <input
                          placeholder="Enter lobby code..."
                          value={codeInput}
                          onChange={function(e) { var v = e.target.value; setLobbyCodeInputs(function(prev) { var next = Object.assign({}, prev); next[codeKey] = v; return next; }); }}
                          className="flex-1 bg-white/[.05] rounded-md px-3 py-[7px] text-[13px] text-on-surface font-mono outline-none border border-secondary/30"
                        />
                        <Btn v="primary" s="sm" onClick={function() { submitLobbyCode(lobby.id, codeInput); }}>Save</Btn>
                      </div>
                    )}
                  </div>
                </Panel>
              );
            })}
          </div>
        )}

        {activeTab === 'standings' && (
          <div className="flex flex-col gap-4">
            {phase === 'complete' && standings.length >= 3 && (
              <Panel
                className="px-5 pt-7 pb-4"
                style={{background: 'linear-gradient(160deg,rgba(232,168,56,.09),rgba(155,114,207,.09),rgba(17,24,39,0))', border: '1px solid rgba(232,168,56,.18)'}}
              >
                <div className="text-center font-extrabold text-[13px] text-[#E8A838] mb-6 tracking-[2px] uppercase">{'Final Results'}</div>
                <div className="flex gap-2 justify-center items-end flex-wrap">
                  {[1, 0, 2].map(function(rankIdx) {
                    var entry = standings[rankIdx];
                    if (!entry) return null;
                    var pos = rankIdx + 1;
                    var colors = ['#E8A838', '#C0C0C0', '#CD7F32'];
                    var cardBgs = ['linear-gradient(160deg,rgba(232,168,56,.18),rgba(232,168,56,.04))', 'linear-gradient(160deg,rgba(192,192,192,.12),rgba(192,192,192,.03))', 'linear-gradient(160deg,rgba(205,127,50,.12),rgba(205,127,50,.03))'];
                    var cardBorders = ['rgba(232,168,56,.45)', 'rgba(192,192,192,.3)', 'rgba(205,127,50,.3)'];
                    var avatarSizes = [80, 64, 60];
                    var nameSizes = [16, 13, 13];
                    var cardPaddings = ['20px 18px', '16px 14px', '16px 14px'];
                    var prizeEntry = prizes.find(function(pr) { return pr.placement === pos; });
                    var isFirst = pos === 1;
                    var orderMap = [2, 1, 3];
                    var displayOrder = orderMap[rankIdx];
                    return (
                      <div
                        key={entry.id}
                        className="flex flex-col items-center gap-1.5 rounded-[14px]"
                        style={{
                          order: displayOrder,
                          flex: isFirst ? '0 0 160px' : '0 0 130px',
                          background: cardBgs[rankIdx],
                          border: '1px solid ' + cardBorders[rankIdx],
                          padding: cardPaddings[rankIdx],
                          minWidth: isFirst ? 140 : 110,
                          maxWidth: isFirst ? 180 : 150
                        }}
                      >
                        <div
                          className="rounded-full flex items-center justify-center font-extrabold"
                          style={{
                            width: avatarSizes[rankIdx],
                            height: avatarSizes[rankIdx],
                            background: 'linear-gradient(135deg,' + colors[rankIdx] + '44,' + colors[rankIdx] + '11)',
                            border: '2.5px solid ' + colors[rankIdx],
                            fontSize: isFirst ? 24 : 18,
                            color: colors[rankIdx],
                            boxShadow: isFirst ? '0 0 18px ' + colors[rankIdx] + '55' : 'none'
                          }}
                        >
                          {'#' + pos}
                        </div>
                        <div className="font-bold text-center mt-1 leading-tight text-on-surface" style={{fontSize: nameSizes[rankIdx]}}>{entry.name}</div>
                        <div className="text-xs font-bold rounded-lg px-2.5 py-0.5" style={{color: colors[rankIdx], background: colors[rankIdx] + '18'}}>{entry.totalPts + ' pts'}</div>
                        {prizeEntry && (
                          <div
                            className="font-extrabold rounded-lg px-3 py-1 mt-0.5"
                            style={{
                              fontSize: isFirst ? 14 : 12,
                              color: colors[rankIdx],
                              background: colors[rankIdx] + '22',
                              border: '1px solid ' + colors[rankIdx] + '55'
                            }}
                          >
                            {prizeEntry.prize}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Panel>
            )}

            {standings.length === 0 ? (
              <Panel className="py-12 px-5 text-center">
                <div className="font-bold text-base text-on-surface mb-1.5">Standings</div>
                <div className="text-[13px] text-on-surface-variant">No results yet. Complete games to see standings.</div>
              </Panel>
            ) : (
              <Panel className="pt-4 pb-0 overflow-hidden">
                <div className="px-[18px] pb-3 font-bold text-sm text-on-surface">
                  {'Standings - Game ' + (allGameNums.length > 0 ? allGameNums[allGameNums.length - 1] : currentGameNumber) + ' of ' + (tournament.round_count || 3)}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px] min-w-[360px] border-collapse table-auto">
                    <thead>
                      <tr className="bg-white/[.03] border-b border-on-surface/[.08]">
                        <th className="py-2 pl-[18px] pr-2.5 text-left font-semibold text-[11px] text-on-surface-variant whitespace-nowrap sticky left-0 z-[3] bg-surface">#</th>
                        <th className="py-2 px-2.5 text-left font-semibold text-[11px] text-on-surface-variant whitespace-nowrap sticky left-[40px] z-[3] bg-surface">Player</th>
                        <th className="py-2 px-2.5 text-center font-semibold text-[11px] text-[#E8A838] whitespace-nowrap">Pts</th>
                        <th className="py-2 px-2.5 text-center font-semibold text-[11px] text-on-surface-variant whitespace-nowrap">Avg</th>
                        <th className="py-2 px-2.5 text-center font-semibold text-[11px] text-on-surface-variant whitespace-nowrap">Wins</th>
                        <th className="py-2 px-2.5 text-center font-semibold text-[11px] text-on-surface-variant whitespace-nowrap">Top4</th>
                        {allGameNums.map(function(gn) {
                          return (<th key={gn} className="py-2 px-2 text-center font-semibold text-[11px] text-primary whitespace-nowrap">{'G' + gn}</th>);
                        })}
                        {phase === 'complete' && prizes.length > 0 && (
                          <th className="py-2 px-2.5 text-center font-semibold text-[11px] text-[#52C47C] whitespace-nowrap">Prize</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map(function(entry, rankIdx) {
                        var pos = rankIdx + 1;
                        var isMe = myPlayer && entry.id === myPlayer.id;
                        var isCut = tournament.cut_line_pts && entry.totalPts < tournament.cut_line_pts && phase === 'in_progress';
                        var rowColors = ['rgba(232,168,56,.08)', 'rgba(192,192,192,.05)', 'rgba(205,127,50,.05)'];
                        var borderColors = ['rgba(232,168,56,.3)', 'rgba(192,192,192,.15)', 'rgba(205,127,50,.15)'];
                        var bg = pos <= 3 ? rowColors[pos - 1] : (isCut ? 'rgba(248,113,113,.04)' : 'transparent');
                        var borderL = isMe ? '3px solid #E8A838' : (pos <= 3 ? '3px solid ' + borderColors[pos - 1] : (isCut ? '3px solid rgba(248,113,113,.3)' : '3px solid transparent'));
                        var prizeEntry = prizes.find(function(pr) { return pr.placement === pos; });
                        return (
                          <tr
                            key={entry.id}
                            className="border-b border-on-surface/[.04]"
                            style={{background: bg, outline: isMe ? '1px solid rgba(232,168,56,.35)' : 'none', position: 'relative'}}
                          >
                            <td
                              className="py-2.5 pl-4 pr-2.5 font-bold whitespace-nowrap sticky left-0 z-[2] bg-surface"
                              style={{
                                color: pos === 1 ? '#E8A838' : pos === 2 ? '#C0C0C0' : pos === 3 ? '#CD7F32' : '#8896A8',
                                borderLeft: borderL
                              }}
                            >
                              {pos}
                            </td>
                            <td className="py-2.5 px-2.5 max-w-[160px] sticky left-[40px] z-[2] bg-surface">
                              <div className="font-semibold text-[13px] whitespace-nowrap overflow-hidden text-ellipsis" style={{color: isMe ? '#E8A838' : '#F2EDE4'}}>{entry.name + (isMe ? ' (you)' : '')}</div>
                              <div className="text-[10px] text-on-surface-variant">{entry.rank}</div>
                            </td>
                            <td className="py-2.5 px-2.5 text-center font-bold text-[#E8A838] text-sm whitespace-nowrap">{entry.totalPts}</td>
                            <td className="py-2.5 px-2.5 text-center text-on-surface-variant text-xs whitespace-nowrap">{entry.avgPlace.toFixed(1)}</td>
                            <td className="py-2.5 px-2.5 text-center text-on-surface font-semibold whitespace-nowrap">{entry.wins}</td>
                            <td className="py-2.5 px-2.5 text-center text-on-surface whitespace-nowrap">{entry.top4}</td>
                            {allGameNums.map(function(gn) {
                              var detail = entry.gameDetails.find(function(d) { return d.game === gn; });
                              var plc = detail ? detail.placement : null;
                              var plcColor = plc === 1 ? '#E8A838' : plc === 2 ? '#C0C0C0' : plc === 3 ? '#CD7F32' : plc <= 4 ? '#52C47C' : '#8896A8';
                              return (
                                <td key={gn} className="py-2.5 px-2 text-center whitespace-nowrap">
                                  {plc ? (
                                    <span className="text-xs font-bold rounded px-1.5 py-0.5" style={{color: plcColor, background: plcColor + '18'}}>{plc}</span>
                                  ) : (
                                    <span className="text-[11px]" style={{color: 'rgba(136,150,168,.4)'}}> - </span>
                                  )}
                                </td>
                              );
                            })}
                            {phase === 'complete' && prizes.length > 0 && (
                              <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                                {prizeEntry ? (
                                  <span className="text-xs font-bold text-[#52C47C] bg-[rgba(82,196,124,.12)] rounded px-2 py-0.5">{prizeEntry.prize}</span>
                                ) : (
                                  <span className="text-[11px]" style={{color: 'rgba(136,150,168,.4)'}}> - </span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {tournament.cut_line_pts && phase === 'in_progress' && (
                  <div className="px-[18px] py-2.5 text-[11px] text-[#F87171] border-t border-[rgba(248,113,113,.15)] bg-[rgba(248,113,113,.03)]">
                    {'Cut line: ' + tournament.cut_line_pts + ' pts - players below this threshold are at risk of elimination'}
                  </div>
                )}
              </Panel>
            )}
          </div>
        )}

        {isAdmin && disputes.length > 0 && (
          <Panel className="p-[18px] mt-4" style={{borderColor: 'rgba(249,115,22,.2)'}}>
            <div className="flex items-center gap-2.5 mb-[14px] flex-wrap">
              <div className="font-bold text-sm text-[#F97316]">{'Disputes'}</div>
              {openDisputeCount > 0 && (
                <span className="text-[11px] font-bold text-[#F97316] bg-[rgba(249,115,22,.15)] rounded-[20px] px-[9px] py-0.5 border border-[#F97316]/30">
                  {openDisputeCount + ' open'}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {disputes.map(function(d) {
                var lobbyIdx = lobbies.findIndex(function(l) { return l.id === d.lobby_id; });
                var lobbyLabel = lobbyIdx >= 0 ? 'Lobby ' + String.fromCharCode(65 + lobbyIdx) : 'Unknown lobby';
                var pData = d.players || {};
                var isOpen = d.status === 'open';
                return (
                  <div
                    key={d.id}
                    className="rounded-lg px-[14px] py-3"
                    style={{
                      background: isOpen ? 'rgba(249,115,22,.05)' : 'rgba(255,255,255,.02)',
                      border: '1px solid ' + (isOpen ? 'rgba(249,115,22,.25)' : 'rgba(242,237,228,.06)')
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex gap-2 items-center flex-wrap mb-1">
                          <span className="font-bold text-[13px] text-on-surface">{pData.username || 'Player'}</span>
                          <span className="text-[11px] text-primary">{lobbyLabel}</span>
                          <span
                            className="text-[11px] font-semibold rounded px-1.5 py-[1px]"
                            style={{
                              color: isOpen ? '#F97316' : '#52C47C',
                              background: isOpen ? 'rgba(249,115,22,.1)' : 'rgba(82,196,124,.1)'
                            }}
                          >
                            {d.status === 'open' ? 'Open' : d.status === 'resolved_accepted' ? 'Accepted' : 'Rejected'}
                          </span>
                        </div>
                        <div className="text-xs text-on-surface-variant mb-1">
                          {'Claimed: ' + (d.claimed_placement || '?') + (d.claimed_placement === 1 ? 'st' : d.claimed_placement === 2 ? 'nd' : d.claimed_placement === 3 ? 'rd' : 'th') + ' - Reported: ' + (d.reported_placement || '?') + (d.reported_placement === 1 ? 'st' : d.reported_placement === 2 ? 'nd' : d.reported_placement === 3 ? 'rd' : 'th')}
                        </div>
                        {d.reason && <div className="text-xs text-on-surface-variant italic mb-1">{d.reason}</div>}
                        {isSafeUrl(d.screenshot_url) && <a href={d.screenshot_url} target="_blank" rel="noreferrer" className="text-[11px] text-secondary">{'View screenshot'}</a>}
                      </div>
                      {isOpen && (
                        <div className="flex gap-1.5 shrink-0">
                          <Btn v="success" s="sm" onClick={function() { resolveDispute(d.id, true); }}>Accept</Btn>
                          <Btn v="danger" s="sm" onClick={function() { resolveDispute(d.id, false); }}>Reject</Btn>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        {isAdmin && (
          <Panel className="p-[18px] mt-5" style={{borderColor: 'rgba(248,113,113,.15)'}}>
            <div className="font-bold text-sm text-[#F87171] mb-[14px]">{'Admin Controls'}</div>
            <div className="flex gap-2 flex-wrap">
              {phase === 'draft' && <Btn v="purple" s="sm" onClick={adminOpenRegistration}>Open Registration</Btn>}
              {phase === 'registration' && <Btn v="primary" s="sm" onClick={adminOpenCheckIn}>Open Check-In</Btn>}
              {phase === 'check_in' && <Btn v="primary" s="sm" onClick={adminCloseCheckIn}>Close Check-In</Btn>}
              {phase === 'check_in' && checkedInCount >= 2 && lobbies.length === 0 && (
                <Btn v="success" s="sm" onClick={generateLobbies} disabled={actionLoading}>{actionLoading ? 'Generating...' : 'Generate Lobbies'}</Btn>
              )}
              {phase === 'check_in' && lobbies.length > 0 && (
                <span className="text-xs text-[#52C47C] px-2.5 py-1 bg-[rgba(82,196,124,.1)] rounded-md font-semibold border border-[#52C47C]/20">
                  {'\u2713 ' + lobbies.length + ' lobbies ready'}
                </span>
              )}
              {(phase === 'check_in' || phase === 'registration') && <Btn v="dark" s="sm" onClick={adminStartTournament}>Start Tournament</Btn>}

              {phase === 'in_progress' && allLobbiesLocked && !isLastGame && (
                <Btn v="primary" s="sm" onClick={startNextGame}>{'Start Game ' + (currentGameNumber + 1)}</Btn>
              )}
              {phase === 'in_progress' && allLobbiesLocked && isLastGame && (
                <Btn v="success" s="sm" onClick={finalizeTournament}>Finalize Tournament</Btn>
              )}
            </div>
            <div className="text-[11px] text-on-surface-variant mt-2.5">
              {'Phase: ' + (phaseLabels[phase] || phase) + ' - Registered: ' + regCount + ' - Checked in: ' + checkedInCount + (lobbies.length > 0 ? ' - ' + lobbies.length + ' lobbies' : '') + (phase === 'in_progress' ? ' - Game ' + currentGameNumber + ' of ' + (tournament.round_count || 3) : '')}
            </div>
          </Panel>
        )}
      </div>
    </PageLayout>
  );
}
