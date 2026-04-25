import { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase.js'
import { PTS } from '../lib/constants.js'
import { hasFeature, getMaxScrimPlayers } from '../lib/tiers.js'
import { TIER_LABELS } from '../lib/paypal.js'
import PageLayout from '../components/layout/PageLayout'
import { Btn, Panel, Icon, PillTab } from '../components/ui'

// ── Bar Trend (replaces line sparkline) ──────────────────────────────────────
// ── Placement Board ───────────────────────────────────────────────────────────
function PlacementBoard(props) {
  var roster = props.roster;
  var results = props.results;
  var onPlace = props.onPlace;
  var comps = props.comps || {};
  var onComp = props.onComp;
  var PLACES = [1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <div className="flex flex-col gap-3">
      {roster.map(function(p) {
        var selected = results[p.id];
        var c = selected === 1 ? '#E8A838' : selected === 2 ? '#C0C0C0' : selected === 3 ? '#CD7F32' : selected <= 4 ? '#4ECDC4' : '#F87171';
        return (
          <div key={p.id} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-24 font-bold text-sm text-on-surface truncate flex-shrink-0">{p.name}</div>
              <div className="flex gap-1 flex-wrap flex-1">
                {PLACES.map(function(place) {
                  var pc = place === 1 ? '#E8A838' : place === 2 ? '#C0C0C0' : place === 3 ? '#CD7F32' : place <= 4 ? '#4ECDC4' : '#F87171';
                  var isSelected = selected === place;
                  return (
                    <button key={place} onClick={function() { onPlace(p.id, place); }}
                      className="w-7 h-7 rounded text-xs font-bold font-mono transition-all"
                      style={{
                        background: isSelected ? pc + '44' : 'rgba(255,255,255,0.04)',
                        border: isSelected ? '1px solid ' + pc : '1px solid rgba(255,255,255,0.08)',
                        color: isSelected ? pc : 'rgba(255,255,255,0.35)',
                        transform: isSelected ? 'scale(1.12)' : 'scale(1)'
                      }}>{place}</button>
                  );
                })}
              </div>
              {selected && (
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-xs font-bold"
                  style={{background: c + '33', border: '1px solid ' + c + '66', color: c}}>
                  {selected}
                </div>
              )}
            </div>
            {onComp && (
              <div className="flex items-center gap-2 pl-[104px]">
                <input
                  type="text"
                  value={comps[p.id] || ''}
                  onChange={function(e) { onComp(p.id, e.target.value); }}
                  placeholder="Comp played (optional)"
                  className="flex-1 bg-surface-container-highest/50 border-0 border-b border-outline-variant/20 focus:border-primary text-on-surface-variant font-mono text-[11px] px-0 py-1 outline-none placeholder-on-surface-variant/30 transition-colors"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── DB helpers ────────────────────────────────────────────────────────────────
function createScrim(name, createdBy, notes, targetGames) {
  return supabase.from('scrims').insert({
    name: name, created_by: createdBy, notes: notes || null,
    target_games: targetGames || 5, status: 'active'
  }).select().single();
}

function addScrimPlayers(scrimId, playerIds) {
  return supabase.from('scrim_players').insert(
    playerIds.map(function(pid) { return {scrim_id: scrimId, player_id: pid}; })
  );
}

function submitScrimResult(scrimId, gameNumber, results, tag, note, duration, roundNumber, lobbyIndex) {
  var row = {
    scrim_id: scrimId, game_number: gameNumber, status: 'completed',
    tag: tag || 'standard', note: note || null, duration: duration || 0
  };
  if (roundNumber != null) row.round_number = roundNumber;
  if (lobbyIndex != null) row.lobby_index = lobbyIndex;
  return supabase.from('scrim_games').insert(row).select().single().then(function(res) {
    if (res.error) return res;
    var gameId = res.data.id;
    var rows = results.map(function(r) {
      return {scrim_game_id: gameId, player_id: r.playerId, placement: r.placement, points: PTS[r.placement] || 0, comp: r.comp || null};
    });
    return supabase.from('scrim_results').insert(rows).then(function(ins) {
      return ins.error ? ins : {data: res.data, error: null};
    });
  });
}

function updateScrimGame(gameId, note, tag) {
  return supabase.from('scrim_games').update({note: note || null, tag: tag || 'standard'}).eq('id', gameId);
}

function loadScrims() {
  return supabase.from('scrims')
    .select('*, scrim_players(player_id), scrim_games(*, scrim_results(*))')
    .order('created_at', {ascending: false}).limit(50);
}

function endScrimDb(id) { return supabase.from('scrims').update({status: 'ended'}).eq('id', id); }
function deleteScrimGameDb(id) { return supabase.from('scrim_games').delete().eq('id', id); }
function deleteScrimDb(id) { return supabase.from('scrims').delete().eq('id', id); }

// ── Placement color helper ────────────────────────────────────────────────────
function placeColor(p) {
  return p === 1 ? '#E8A838' : p === 2 ? '#C0C0C0' : p === 3 ? '#CD7F32' : p <= 4 ? '#4ECDC4' : p <= 6 ? '#facc15' : '#f87171';
}

// ── Multi-lobby seeding ──────────────────────────────────────────────────────
function chunkArray(arr, size) {
  var chunks = [];
  for (var i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function shuffleArray(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function seedRandom(roster, lobbySize) {
  var shuffled = shuffleArray(roster);
  return chunkArray(shuffled, lobbySize || 8);
}

function seedSwiss(roster, lobbySize, pointsMap) {
  var size = lobbySize || 8;
  var sorted = roster.slice().sort(function(a, b) {
    var ptsA = pointsMap[a.id] || 0;
    var ptsB = pointsMap[b.id] || 0;
    return ptsB - ptsA;
  });
  return chunkArray(sorted, size);
}

function seedSnake(roster, lobbySize, pointsMap) {
  var size = lobbySize || 8;
  var sorted = roster.slice().sort(function(a, b) {
    var ptsA = pointsMap[a.id] || 0;
    var ptsB = pointsMap[b.id] || 0;
    return ptsB - ptsA;
  });
  var numLobbies = Math.ceil(sorted.length / size);
  var lobbies = [];
  for (var i = 0; i < numLobbies; i++) lobbies.push([]);
  var forward = true;
  var li = 0;
  for (var pi = 0; pi < sorted.length; pi++) {
    lobbies[li].push(sorted[pi]);
    if (forward) {
      if (li >= numLobbies - 1) { forward = false; }
      else { li++; }
    } else {
      if (li <= 0) { forward = true; }
      else { li--; }
    }
  }
  return lobbies;
}

// ── Player search + guest add ─────────────────────────────────────────────────
function PlayerSearch(props) {
  var allPlayers = props.players;
  var roster = props.roster;
  var onAdd = props.onAdd;
  var onAddGuest = props.onAddGuest;
  var disabled = !!props.disabled;
  var disabledPlaceholder = props.disabledPlaceholder || 'Roster at cap - upgrade to add more';
  var _q = useState(''); var q = _q[0]; var setQ = _q[1];
  var _open = useState(false); var open = _open[0]; var setOpen = _open[1];
  var inputRef = useRef(null);
  var qtrim = q.trim();
  var filtered = qtrim && !disabled ? allPlayers.filter(function(p) {
    var alreadyIn = roster.find(function(r) { return String(r.id) === String(p.id); });
    return !alreadyIn && (p.name || '').toLowerCase().indexOf(qtrim.toLowerCase()) !== -1;
  }).slice(0, 8) : [];
  var exactMatch = allPlayers.find(function(p) { return (p.name || '').toLowerCase() === qtrim.toLowerCase(); });
  var canAddGuest = !disabled && qtrim.length > 0 && !exactMatch;
  function pick(p) { if (disabled) return; onAdd(p); setQ(''); setOpen(false); if (inputRef.current) inputRef.current.focus(); }
  function addGuest() { if (disabled) return; if (!qtrim) return; onAddGuest(qtrim); setQ(''); setOpen(false); }
  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text" value={disabled ? '' : q}
        disabled={disabled}
        onChange={function(e) { if (disabled) return; setQ(e.target.value); setOpen(true); }}
        onFocus={function() { if (disabled) return; if (q) setOpen(true); }}
        onBlur={function() { setTimeout(function() { setOpen(false); }, 150); }}
        onKeyDown={function(e) {
          if (disabled) return;
          if (e.key === 'Enter') { if (filtered.length > 0) pick(filtered[0]); else if (canAddGuest) addGuest(); e.preventDefault(); }
          if (e.key === 'Escape') { setOpen(false); setQ(''); }
        }}
        placeholder={disabled ? disabledPlaceholder : 'Search players...'}
        className={'w-full bg-surface-container-highest border-0 text-on-surface font-mono text-sm p-3 outline-none focus:ring-1 focus:ring-primary ' + (disabled ? 'opacity-50 cursor-not-allowed' : '')}
      />
      {!disabled && open && (filtered.length > 0 || canAddGuest) && (
        <div className="absolute left-0 right-0 top-full z-20 bg-surface-container-high border border-outline-variant/20 shadow-xl max-h-52 overflow-y-auto">
          {filtered.map(function(p) {
            return (
              <button key={p.id} onMouseDown={function(e) { e.preventDefault(); pick(p); }}
                className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-surface-container transition-colors border-0 bg-transparent cursor-pointer">
                <span className="font-bold text-sm text-on-surface">{p.name}</span>
                {p.role === 'guest' && <span className="text-[9px] font-label text-on-surface-variant uppercase tracking-widest px-1.5 py-0.5 bg-surface-container-highest">guest</span>}
                {p.rank && p.role !== 'guest' && <span className="text-[10px] font-label text-on-surface-variant">{p.rank}</span>}
              </button>
            );
          })}
          {canAddGuest && (
            <button onMouseDown={function(e) { e.preventDefault(); addGuest(); }}
              className={'w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-primary/10 transition-colors border-0 bg-transparent cursor-pointer' + (filtered.length > 0 ? ' border-t border-outline-variant/10' : '')}>
              <Icon name="person_add" size={14} className="text-primary flex-shrink-0"/>
              <span className="font-mono text-sm text-primary font-bold">{qtrim}</span>
              <span className="text-[10px] font-label text-on-surface-variant uppercase tracking-wide">add as guest</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── ScrimsScreen ──────────────────────────────────────────────────────────────
export default function ScrimsScreen() {
  var ctx = useApp();
  var players = ctx.players;
  var setPlayers = ctx.setPlayers;
  var toast = ctx.toast;
  var currentUser = ctx.currentUser;
  var isAdmin = ctx.isAdmin;
  var scrimAccess = ctx.scrimAccess;
  var scrimHostAccess = ctx.scrimHostAccess || [];

  var devMode = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  var _tab = useState('lobbies'); var tab = _tab[0]; var setTab = _tab[1];
  var _statsTab = useState('players'); var statsTab = _statsTab[0]; var setStatsTab = _statsTab[1];
  var _activeId = useState(null); var activeId = _activeId[0]; var setActiveId = _activeId[1];

  // Create form
  var _newName = useState(''); var newName = _newName[0]; var setNewName = _newName[1];
  var _newNotes = useState(''); var newNotes = _newNotes[0]; var setNewNotes = _newNotes[1];
  var _newTarget = useState('5'); var newTarget = _newTarget[0]; var setNewTarget = _newTarget[1];
  var _scrimRoster = useState([]); var scrimRoster = _scrimRoster[0]; var setScrimRoster = _scrimRoster[1];
  var rosterDirtyRef = useRef(false);

  // Record game
  var _scrimResults = useState({}); var scrimResults = _scrimResults[0]; var setScrimResults = _scrimResults[1];
  var _gameComps = useState({}); var gameComps = _gameComps[0]; var setGameComps = _gameComps[1];
  var _gameNote = useState(''); var gameNote = _gameNote[0]; var setGameNote = _gameNote[1];
  var _gameTag = useState('standard'); var gameTag = _gameTag[0]; var setGameTag = _gameTag[1];
  var _timer = useState(0); var timer = _timer[0]; var setTimer = _timer[1];
  var _timerActive = useState(false); var timerActive = _timerActive[0]; var setTimerActive = _timerActive[1];
  var timerRef = useRef(null);

  // Multi-lobby
  var _seedMode = useState('random'); var seedMode = _seedMode[0]; var setSeedMode = _seedMode[1];
  var _lobbies = useState(null); var lobbies = _lobbies[0]; var setLobbies = _lobbies[1];
  var _lobbyResults = useState({}); var lobbyResults = _lobbyResults[0]; var setLobbyResults = _lobbyResults[1];
  var _lobbyComps = useState({}); var lobbyComps = _lobbyComps[0]; var setLobbyComps = _lobbyComps[1];
  var _currentRound = useState(1); var currentRound = _currentRound[0]; var setCurrentRound = _currentRound[1];
  var _roundStandings = useState(null); var roundStandings = _roundStandings[0]; var setRoundStandings = _roundStandings[1];

  // Edit game
  var _editGame = useState(null); var editGame = _editGame[0]; var setEditGame = _editGame[1];

  // Delete confirm
  var _confirmDelete = useState(null); var confirmDelete = _confirmDelete[0]; var setConfirmDelete = _confirmDelete[1];

  // History expand
  var _expandedSession = useState(null); var expandedSession = _expandedSession[0]; var setExpandedSession = _expandedSession[1];

  // DB
  var _dbScrims = useState([]); var dbScrims = _dbScrims[0]; var setDbScrims = _dbScrims[1];
  var _dbLoading = useState(true); var dbLoading = _dbLoading[0]; var setDbLoading = _dbLoading[1];

  // Local-only sessions (dev mode fallback)
  var _localSessions = useState([]); var localSessions = _localSessions[0]; var setLocalSessions = _localSessions[1];

  useEffect(function() {
    if (timerActive) { timerRef.current = setInterval(function() { setTimer(function(t) { return t + 1; }); }, 1000); }
    else clearInterval(timerRef.current);
    return function() { clearInterval(timerRef.current); };
  }, [timerActive]);

  useEffect(function() {
    if (!currentUser) { setDbScrims([]); setDbLoading(false); return; }
    var cancelled = false;
    setDbLoading(true);
    loadScrims().then(function(res) {
      if (cancelled) return;
      if (res.error) { toast('Failed to load scrims: ' + res.error.message, 'error'); setDbLoading(false); return; }
      setDbScrims(res.data || []);
      setDbLoading(false);
    }).catch(function() { setDbLoading(false); });
    return function() { cancelled = true; };
  }, [currentUser]);

  function reloadScrims() {
    if (!currentUser) return;
    loadScrims().then(function(res) { if (!res.error) setDbScrims(res.data || []); }).catch(function() {});
  }

  var fmt = function(s) { return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

  // Convert DB shape → UI shape
  var safeSessions = dbScrims.map(function(sc) {
    var games = (sc.scrim_games || []).map(function(g) {
      var results = {}; var comps = {};
      (g.scrim_results || []).forEach(function(r) {
        results[r.player_id] = r.placement;
        if (r.comp) comps[r.player_id] = r.comp;
      });
      return {id: g.id, results: results, comps: comps, note: g.note || '', tag: g.tag || 'standard', duration: g.duration || 0, ts: new Date(g.created_at).getTime(), gameNumber: g.game_number, roundNumber: g.round_number || null, lobbyIndex: g.lobby_index != null ? g.lobby_index : null};
    }).sort(function(a, b) { return a.gameNumber - b.gameNumber; });
    return {
      id: sc.id, name: sc.name, notes: sc.notes || '', targetGames: sc.target_games || 5,
      games: games, createdAt: new Date(sc.created_at).toLocaleDateString(),
      active: sc.status === 'active', createdBy: sc.created_by,
      playerIds: (sc.scrim_players || []).map(function(sp) { return sp.player_id; })
    };
  }).concat(localSessions);

  var session = safeSessions.find(function(s) { return s.id === activeId; });
  var sessionRoster = (function() {
    if (!session) return scrimRoster;
    if (session.playerIds.length > 0) {
      return session.playerIds.map(function(pid) {
        return players.find(function(p) { return String(p.id) === String(pid); });
      }).filter(Boolean);
    }
    return scrimRoster;
  }());
  var rosterForGame = rosterDirtyRef.current && scrimRoster.length > 0 ? scrimRoster : (sessionRoster.length > 0 ? sessionRoster : scrimRoster);
  var isMultiLobby = rosterForGame.length > 8;
  var allGames = safeSessions.flatMap(function(s) { return s.games; });
  var placedCount = Object.keys(scrimResults).length;
  var allPlaced = rosterForGame.length > 0 && placedCount >= rosterForGame.length;

  // Multi-lobby: compute cumulative points for seeding
  var sessionPointsMap = {};
  if (session) {
    session.games.forEach(function(g) {
      Object.keys(g.results).forEach(function(pid) {
        if (!sessionPointsMap[pid]) sessionPointsMap[pid] = 0;
        sessionPointsMap[pid] += PTS[g.results[pid]] || 0;
      });
    });
  }

  // Multi-lobby: check if all lobbies are fully placed
  var allLobbiesPlaced = false;
  if (lobbies && lobbies.length > 0) {
    allLobbiesPlaced = lobbies.every(function(lobby, li) {
      var lr = lobbyResults[li] || {};
      return lobby.length > 0 && Object.keys(lr).length >= lobby.length;
    });
  }

  // Detect current round from existing games
  var sessionRoundCount = 0;
  if (session) {
    var maxRound = 0;
    session.games.forEach(function(g) {
      if (g.roundNumber && g.roundNumber > maxRound) maxRound = g.roundNumber;
    });
    sessionRoundCount = maxRound;
  }

  // Per-player stats
  var scrimStats = players.map(function(p) {
    var pGames = allGames.filter(function(g) { return g.results[p.id] != null || g.results[String(p.id)] != null; });
    if (pGames.length === 0) return null;
    var placements = pGames.map(function(g) { return g.results[p.id] != null ? g.results[p.id] : g.results[String(p.id)]; });
    var wins = placements.filter(function(x) { return x === 1; }).length;
    var top4 = placements.filter(function(x) { return x <= 4; }).length;
    var pts = placements.reduce(function(s, v) { return s + (PTS[v] || 0); }, 0);
    var avgPlacement = (placements.reduce(function(s, v) { return s + v; }, 0) / placements.length).toFixed(2);
    var recent = pGames.slice().sort(function(a, b) { return b.ts - a.ts; }).map(function(g) { return g.results[p.id] != null ? g.results[p.id] : g.results[String(p.id)]; });
    var streak = 0;
    for (var si = 0; si < recent.length; si++) { if (recent[si] <= 4) streak++; else break; }
    return Object.assign({}, p, {
      pts: pts, wins: wins, top4: top4, games: pGames.length, avg: avgPlacement,
      best: Math.min.apply(null, placements), worst: Math.max.apply(null, placements),
      streak: streak, placements: placements,
      top4Rate: ((top4 / pGames.length) * 100).toFixed(0),
      winRate: ((wins / pGames.length) * 100).toFixed(0),
      ppg: (pts / pGames.length).toFixed(1)
    });
  }).filter(Boolean).sort(function(a, b) { return b.pts - a.pts; });

  // Comp stats
  var compMap = {};
  allGames.forEach(function(g) {
    Object.keys(g.results).forEach(function(pid) {
      var comp = g.comps && g.comps[pid];
      if (!comp || !comp.trim()) return;
      var key = comp.trim();
      if (!compMap[key]) compMap[key] = {name: key, games: 0, wins: 0, top4: 0, ptsTotal: 0};
      compMap[key].games++;
      var place = g.results[pid];
      if (place === 1) compMap[key].wins++;
      if (place <= 4) compMap[key].top4++;
      compMap[key].ptsTotal += PTS[place] || 0;
    });
  });
  var compList = Object.values(compMap).sort(function(a, b) { return b.games - a.games; });

  // Multi-lobby functions
  function generateLobbies() {
    var roster = rosterForGame;
    if (roster.length <= 8) return;
    var result;
    if (seedMode === 'swiss') {
      result = seedSwiss(roster, 8, sessionPointsMap);
    } else if (seedMode === 'snake') {
      result = seedSnake(roster, 8, sessionPointsMap);
    } else {
      result = seedRandom(roster, 8);
    }
    setLobbies(result);
    setLobbyResults({});
    setLobbyComps({});
    setRoundStandings(null);
    setCurrentRound(sessionRoundCount + 1);
  }

  function buildRoundStandings() {
    var standings = {};
    lobbies.forEach(function(lobby, li) {
      var lr = lobbyResults[li] || {};
      Object.keys(lr).forEach(function(pid) {
        var place = lr[pid];
        var pts = PTS[place] || 0;
        var cumPts = (sessionPointsMap[pid] || 0) + pts;
        var p = players.find(function(pl) { return String(pl.id) === String(pid); });
        if (!standings[pid]) standings[pid] = {name: p ? p.name : pid, roundPts: 0, totalPts: 0, roundPlace: 0, lobby: 0};
        standings[pid].roundPts = pts;
        standings[pid].roundPlace = place;
        standings[pid].totalPts = cumPts;
        standings[pid].lobby = li;
      });
    });
    return Object.values(standings).sort(function(a, b) { return b.totalPts - a.totalPts; });
  }

  function lockRoundLocal() {
    var baseGameNum = session ? session.games.length + 1 : 1;
    var newGames = lobbies.map(function(lobby, li) {
      var lr = lobbyResults[li] || {};
      var lc = lobbyComps[li] || {};
      var results = {}; var comps = {};
      Object.keys(lr).forEach(function(pid) { results[pid] = lr[pid]; });
      Object.keys(lc).forEach(function(pid) { if (lc[pid]) comps[pid] = lc[pid]; });
      return {id: 'game-' + Date.now() + '-' + li, results: results, comps: comps, note: gameNote, tag: gameTag, duration: timer, ts: Date.now(), gameNumber: baseGameNum + li, roundNumber: currentRound, lobbyIndex: li};
    });
    setLocalSessions(function(prev) {
      return prev.map(function(s) {
        if (s.id !== activeId) return s;
        return Object.assign({}, s, {games: s.games.concat(newGames)});
      });
    });
    setRoundStandings(buildRoundStandings());
    setLobbyResults({}); setLobbyComps({}); setGameNote(''); setTimer(0); setTimerActive(false);
    toast('Round ' + currentRound + ' locked - ' + lobbies.length + ' lobbies (local)', 'success');
  }

  function lockRound() {
    if (!activeId || !lobbies || !allLobbiesPlaced) return;
    if (devMode || String(activeId).startsWith('local-')) { lockRoundLocal(); return; }
    var baseGameNum = session ? session.games.length + 1 : 1;
    var promises = lobbies.map(function(lobby, li) {
      var lr = lobbyResults[li] || {};
      var lc = lobbyComps[li] || {};
      var resultRows = Object.keys(lr).map(function(pid) {
        return {playerId: pid, placement: lr[pid], comp: lc[pid] || null};
      });
      return submitScrimResult(activeId, baseGameNum + li, resultRows, gameTag, gameNote, timer, currentRound, li);
    });
    Promise.all(promises).then(function(results) {
      var anyError = results.find(function(r) { return r.error; });
      if (anyError) { lockRoundLocal(); return; }
      setRoundStandings(buildRoundStandings());
      reloadScrims();
      setLobbyResults({}); setLobbyComps({}); setGameNote(''); setTimer(0); setTimerActive(false);
      toast('Round ' + currentRound + ' locked - ' + lobbies.length + ' lobbies', 'success');
    }).catch(function() { lockRoundLocal(); });
  }

  function nextRound() {
    setRoundStandings(null);
    setLobbies(null);
  }

  // Fns
  function createSessionLocal() {
    var localId = 'local-' + Date.now();
    var sess = {
      id: localId, name: newName.trim(), notes: newNotes.trim(),
      targetGames: parseInt(newTarget) || 5, games: [], active: true,
      createdAt: new Date().toLocaleDateString(), createdBy: 'dev',
      playerIds: scrimRoster.map(function(p) { return p.id; })
    };
    setLocalSessions(function(prev) { return [sess].concat(prev); });
    setActiveId(localId);
    setNewName(''); setNewNotes(''); setNewTarget('5');
    toast('Session created (local)', 'success');
    setTab('record');
  }

  function createSession() {
    if (!newName.trim()) { toast('Name required', 'error'); return; }
    if (!currentUser) { toast('Login required', 'error'); return; }
    if (devMode) { createSessionLocal(); return; }
    var authId = currentUser.auth_user_id || currentUser.id;
    if (!authId) { toast('Auth session not found', 'error'); return; }
    createScrim(newName.trim(), authId, newNotes.trim(), parseInt(newTarget) || 5).then(function(res) {
      if (res.error) { createSessionLocal(); return; }
      var scrimId = res.data.id;
      var pids = scrimRoster.map(function(p) { return p.id; }).filter(Boolean);
      if (pids.length > 0) {
        addScrimPlayers(scrimId, pids).then(function() { reloadScrims(); }).catch(function() { reloadScrims(); });
      } else { reloadScrims(); }
      setActiveId(scrimId);
      setNewName(''); setNewNotes(''); setNewTarget('5');
      toast('Session created', 'success');
      setTab('record');
    }).catch(function() { createSessionLocal(); });
  }


  function lockGameLocal(gameNum) {
    var results = {}; var comps = {};
    Object.keys(scrimResults).forEach(function(pid) {
      results[pid] = scrimResults[pid];
      if (gameComps[pid]) comps[pid] = gameComps[pid];
    });
    var game = {id: 'game-' + Date.now(), results: results, comps: comps, note: gameNote, tag: gameTag, duration: timer, ts: Date.now(), gameNumber: gameNum, roundNumber: null, lobbyIndex: null};
    setLocalSessions(function(prev) {
      return prev.map(function(s) {
        if (s.id !== activeId) return s;
        return Object.assign({}, s, {games: s.games.concat([game])});
      });
    });
    setScrimResults({}); setGameComps({}); setGameNote(''); setTimer(0); setTimerActive(false);
    toast('Game locked (local)', 'success');
  }

  function lockGame() {
    if (!activeId) { toast('Select a session first', 'error'); return; }
    if (!allPlaced) { toast('Set all placements first', 'error'); return; }
    var gameNum = session ? session.games.length + 1 : 1;
    if (devMode || String(activeId).startsWith('local-')) { lockGameLocal(gameNum); return; }
    var resultRows = Object.keys(scrimResults).map(function(pid) {
      return {playerId: pid, placement: scrimResults[pid], comp: gameComps[pid] || null};
    });
    submitScrimResult(activeId, gameNum, resultRows, gameTag, gameNote, timer).then(function(res) {
      if (res.error) { lockGameLocal(gameNum); return; }
      reloadScrims();
      setScrimResults({}); setGameComps({}); setGameNote(''); setTimer(0); setTimerActive(false);
      toast('Game locked', 'success');
    }).catch(function() { lockGameLocal(gameNum); });
  }

  function stopSession(id) {
    if (devMode || String(id).startsWith('local-')) {
      setLocalSessions(function(prev) { return prev.map(function(s) { return s.id === id ? Object.assign({}, s, {active: false}) : s; }); });
      toast('Session ended (local)', 'success');
      return;
    }
    endScrimDb(id).then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
      reloadScrims(); toast('Session ended', 'success');
    }).catch(function() { toast('Failed to end session', 'error'); });
  }

  function saveEditGame() {
    if (!editGame) return;
    updateScrimGame(editGame.id, editGame.note, editGame.tag).then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
      reloadScrims(); setEditGame(null); toast('Game updated', 'success');
    }).catch(function() { toast('Failed to update game', 'error'); });
  }

  function deleteGame(gameId) {
    if (devMode || String(activeId).startsWith('local-')) {
      setLocalSessions(function(prev) {
        return prev.map(function(s) {
          return Object.assign({}, s, {games: s.games.filter(function(g) { return g.id !== gameId; })});
        });
      });
      setConfirmDelete(null); toast('Game deleted (local)', 'success');
      return;
    }
    deleteScrimGameDb(gameId).then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
      reloadScrims(); setConfirmDelete(null); toast('Game deleted', 'success');
    }).catch(function() { toast('Failed to delete game', 'error'); });
  }

  function deleteSession(sessionId) {
    if (devMode || String(sessionId).startsWith('local-')) {
      setLocalSessions(function(prev) { return prev.filter(function(s) { return s.id !== sessionId; }); });
      if (activeId === sessionId) { setActiveId(null); setScrimRoster([]); setScrimResults({}); rosterDirtyRef.current = false; }
      setConfirmDelete(null); toast('Session deleted (local)', 'success');
      return;
    }
    deleteScrimDb(sessionId).then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
      reloadScrims();
      if (activeId === sessionId) { setActiveId(null); setScrimRoster([]); setScrimResults({}); rosterDirtyRef.current = false; }
      setConfirmDelete(null); toast('Session deleted', 'success');
    }).catch(function() { toast('Failed to delete session', 'error'); });
  }

  function addGuestPlayer(name) {
    var existing = players.find(function(p) { return (p.name || '').toLowerCase() === name.toLowerCase(); });
    if (existing) {
      var alreadyIn = (rosterDirtyRef.current ? scrimRoster : rosterForGame).find(function(r) { return String(r.id) === String(existing.id); });
      if (!alreadyIn) {
        rosterDirtyRef.current = true;
        var base = scrimRoster.length > 0 ? scrimRoster : rosterForGame;
        var newR = base.concat([existing]);
        setScrimRoster(newR);
        syncRosterToDb(newR);
      }
      return;
    }
    supabase.from('players').insert({username: name, role: 'guest'}).select().single().then(function(res) {
      if (res.error) {
        // Fallback: add as local-only guest (dev mode / no auth session)
        var localId = 'guest-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        var np = {id: localId, name: name, role: 'guest', rank: null, pts: 0, wins: 0, games: 0, top4: 0, avg: '0'};
        setPlayers(function(prev) { return prev.concat([np]); });
        rosterDirtyRef.current = true;
        var base = scrimRoster.length > 0 ? scrimRoster : rosterForGame;
        var newR = base.concat([np]);
        setScrimRoster(newR);
        toast(name + ' added as local guest', 'success');
        return;
      }

      var np = {id: res.data.id, name: res.data.username || name, role: 'guest', rank: null, pts: 0, wins: 0, games: 0, top4: 0, avg: '0'};
      setPlayers(function(prev) { return prev.concat([np]); });
      rosterDirtyRef.current = true;
      var base = scrimRoster.length > 0 ? scrimRoster : rosterForGame;
      var newR = base.concat([np]);
      setScrimRoster(newR);
      syncRosterToDb(newR);
      toast(name + ' added as guest', 'success');
    }).catch(function() { toast('Failed to add guest', 'error'); });
  }

  function syncRosterToDb(newRoster) {
    if (!activeId) return;
    if (devMode || String(activeId).startsWith('local-')) {
      // Update local session playerIds
      setLocalSessions(function(prev) {
        return prev.map(function(s) {
          if (s.id !== activeId) return s;
          return Object.assign({}, s, {playerIds: newRoster.map(function(p) { return p.id; })});
        });
      });
      return;
    }
    var ids = newRoster.map(function(p) { return p.id; });
    // Delete existing scrim_players and re-insert
    supabase.from('scrim_players').delete().eq('scrim_id', activeId).then(function() {
      if (ids.length > 0) {
        var rows = ids.map(function(pid) { return {scrim_id: activeId, player_id: pid}; });
        supabase.from('scrim_players').insert(rows).then(function() {}).catch(function() {});
      }
    }).catch(function() {});
  }

  function exportCSV() {
    var rows = [['Session', 'Game', 'Player', 'Placement', 'Points', 'Comp', 'Tag', 'Note']];
    safeSessions.forEach(function(sess) {
      sess.games.forEach(function(g) {
        Object.keys(g.results).forEach(function(pid) {
          var p = players.find(function(pl) { return String(pl.id) === String(pid); });
          var name = p ? p.name : pid;
          var place = g.results[pid];
          rows.push([sess.name, 'G' + g.gameNumber, name, place, PTS[place] || 0, g.comps[pid] || '', g.tag, g.note]);
        });
      });
    });
    var csv = rows.map(function(r) { return r.map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var blob = new Blob([csv], {type: 'text/csv'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'scrims.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function copyText() {
    var lines = ['TFT SCRIMS EXPORT', ''];
    safeSessions.forEach(function(sess) {
      lines.push('=== ' + sess.name + ' (' + sess.createdAt + ') ===');
      if (sess.notes) lines.push('Notes: ' + sess.notes);
      sess.games.forEach(function(g) {
        lines.push('  G' + g.gameNumber + (g.tag !== 'standard' ? ' [' + g.tag + ']' : '') + (g.note ? ' - ' + g.note : ''));
        var sorted = Object.entries(g.results).sort(function(a, b) { return a[1] - b[1]; });
        sorted.forEach(function(entry) {
          var pname = (players.find(function(pl) { return String(pl.id) === String(entry[0]); }) || {}).name || entry[0];
          var comp = g.comps[entry[0]] ? ' (' + g.comps[entry[0]] + ')' : '';
          lines.push('    #' + entry[1] + ' ' + pname + comp);
        });
      });
      lines.push('');
    });
    navigator.clipboard.writeText(lines.join('\n')).then(function() { toast('Copied to clipboard', 'success'); });
  }

  // Access guard
  var currentUsername = (currentUser && (currentUser.username || currentUser.name)) || '';
  var currentUsernameLower = currentUsername.toLowerCase();
  var isScrimHost = !!(currentUsername && scrimHostAccess.some(function(u) { return u.toLowerCase() === currentUsernameLower; }));
  var isScrimmer = !!(currentUsername && (scrimAccess || []).some(function(u) { return u.toLowerCase() === currentUsernameLower; }));
  var userTier = ctx.userTier || 'free';
  var hasTierAccess = hasFeature(userTier, 'createScrimRoom');
  var hasAccess = isAdmin || isScrimHost || isScrimmer || hasTierAccess;
  var canManage = isAdmin || isScrimHost || hasTierAccess;

  // Tier-based roster cap (scrim=8, bundle=16, host=32, others=0)
  // Admins and scrim-hosts bypass the cap (legacy access, not tier-based).
  var tierMaxPlayers = getMaxScrimPlayers(userTier);
  var bypassCap = isAdmin || isScrimHost;
  var effectiveMaxPlayers = bypassCap ? 9999 : tierMaxPlayers;
  var tierLabel = (TIER_LABELS && TIER_LABELS[userTier]) || 'current tier';
  var upgradeHint = userTier === 'scrim'
    ? ' Upgrade to Pro + Scrim for 16 (two lobbies) or Host for 32.'
    : (userTier === 'bundle' ? ' Upgrade to Host for 32 players (four lobbies).' : '');
  var createRosterSize = (scrimRoster || []).length;
  var createOverCap = !bypassCap && createRosterSize > effectiveMaxPlayers;
  var createAtCap = !bypassCap && createRosterSize >= effectiveMaxPlayers;
  var recordRosterSize = (rosterForGame || []).length;
  var recordOverCap = !bypassCap && recordRosterSize > effectiveMaxPlayers;
  var recordAtCap = !bypassCap && recordRosterSize >= effectiveMaxPlayers;
  if (!hasAccess) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <Icon name="lock" size={32} className="text-on-surface-variant mb-4 opacity-40"/>
          <div className="font-editorial text-2xl font-bold text-on-surface mb-2">Friends Only</div>
          <div className="text-sm text-on-surface-variant">Ask an admin to grant access.</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-editorial italic text-5xl font-black text-on-surface tracking-tight">Practice Arena</h1>
            <p className="text-on-surface-variant text-sm mt-1">{allGames.length} games logged across {safeSessions.length} sessions</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end flex-shrink-0">
            {[
              {id: 'lobbies', icon: 'dashboard', label: 'Lobbies'},
              ...(canManage ? [{id: 'record', icon: 'sports_esports', label: 'Record'}] : []),
              {id: 'stats', icon: 'analytics', label: 'Statistics'},
              {id: 'history', icon: 'history', label: 'History'}
            ].map(function(t) {
              return (
                <PillTab
                  key={t.id}
                  icon={t.icon}
                  active={tab === t.id}
                  onClick={function() { setTab(t.id); }}
                >
                  {t.label}
                </PillTab>
              );
            })}
          </div>
        </div>

        {/* ════════════ LOBBIES TAB ════════════ */}
        {tab === 'lobbies' && (
          <div className="grid grid-cols-12 gap-5">
            {/* Create form */}
            {canManage && (
            <div className="col-span-12 lg:col-span-4">
              <Panel padding="none" className="overflow-hidden">
                <div className="px-5 py-4 bg-surface-container">
                  <h2 className="font-editorial text-xl font-bold">New Session</h2>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-[10px] font-label text-on-surface-variant uppercase tracking-widest mb-1.5">Session Name</label>
                    <input type="text" value={newName} onChange={function(e) { setNewName(e.target.value); }}
                      onKeyDown={function(e) { if (e.key === 'Enter') createSession(); }}
                      placeholder="e.g. FRIDAY GRIND"
                      className="w-full bg-surface-container-highest border-0 text-on-surface font-mono text-sm p-3 outline-none focus:ring-1 focus:ring-primary"/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-label text-on-surface-variant uppercase tracking-widest mb-1.5">Notes / Goal</label>
                    <input type="text" value={newNotes} onChange={function(e) { setNewNotes(e.target.value); }}
                      placeholder="Focus area, comps to test..."
                      className="w-full bg-surface-container-highest border-0 text-on-surface font-mono text-sm p-3 outline-none focus:ring-1 focus:ring-primary"/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-label text-on-surface-variant uppercase tracking-widest mb-1.5">Target Games</label>
                    <select value={newTarget} onChange={function(e) { setNewTarget(e.target.value); }}
                      className="w-full bg-surface-container-highest border-0 text-on-surface font-mono text-sm p-3 outline-none focus:ring-1 focus:ring-primary">
                      {[1,2,3,4,5,6,7,8,10,12].map(function(n) { return <option key={n} value={n}>{n} games</option>; })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-label text-on-surface-variant uppercase tracking-widest mb-1.5">
                      Roster {!bypassCap && effectiveMaxPlayers > 0 && (
                        <span className={'ml-1 normal-case tracking-normal ' + (createOverCap ? 'text-error' : 'text-on-surface-variant/70')}>
                          ({createRosterSize}/{effectiveMaxPlayers})
                        </span>
                      )}
                    </label>
                    <PlayerSearch
                      players={players}
                      roster={scrimRoster}
                      onAdd={function(p) { setScrimRoster(function(r) { return r.concat([p]); }); }}
                      onAddGuest={addGuestPlayer}
                      disabled={createAtCap}
                      disabledPlaceholder={'Roster at ' + effectiveMaxPlayers + ' player cap - upgrade to add more'}
                    />
                    {scrimRoster.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {scrimRoster.map(function(p) {
                          return (
                            <div key={p.id} className="flex items-center gap-1 px-2 py-1 bg-primary/10 border border-primary/20">
                              <span className="text-[11px] font-mono text-primary">{p.name}</span>
                              <button onClick={function() { setScrimRoster(function(r) { return r.filter(function(x) { return x.id !== p.id; }); }); }}
                                className="text-primary/40 hover:text-error transition-colors text-sm leading-none bg-transparent border-0 cursor-pointer p-0 ml-0.5">x</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {(createOverCap || createAtCap) && !bypassCap && (
                      <div className="mt-3 p-3 rounded-lg bg-error-container/20 border border-error/20 text-error font-mono text-xs leading-relaxed">
                        Your {tierLabel} plan allows up to {effectiveMaxPlayers} players per scrim.{upgradeHint}{' '}
                        {createOverCap ? 'Reduce roster or ' : 'At cap - '}
                        <a href="/pricing" className="underline">upgrade</a>{createOverCap ? '.' : ' for more slots.'}
                      </div>
                    )}
                  </div>
                  <Btn variant="primary" size="lg" icon="add" onClick={createSession} disabled={createOverCap} className="w-full">
                    Create Session
                  </Btn>
                </div>
              </Panel>
            </div>
            )}

            {/* Sessions list */}
            <div className={"col-span-12 " + (canManage ? "lg:col-span-8" : "") + " space-y-3"}>
              {dbLoading ? (
                <Panel className="p-12 text-center text-on-surface-variant/40 font-label text-xs uppercase tracking-widest" padding="none">Loading...</Panel>
              ) : safeSessions.length === 0 ? (
                <Panel padding="none" className="p-16 flex flex-col items-center justify-center gap-3">
                  <Icon name="sports_esports" size={40} className="text-on-surface-variant opacity-20"/>
                  <div className="text-xs font-label text-on-surface-variant uppercase tracking-widest">No sessions yet - create one to get started</div>
                </Panel>
              ) : (
                <>
                  {/* Active */}
                  {safeSessions.filter(function(s) { return s.active; }).length > 0 && (
                    <div>
                      <div className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest mb-2 px-1">Active</div>
                      {safeSessions.filter(function(s) { return s.active; }).map(function(s) {
                        var progress = Math.min(s.games.length / s.targetGames, 1);
                        return (
                          <Panel key={s.id} padding="tight" className={'mb-2 flex items-center gap-4 ' + (activeId === s.id ? 'ring-1 ring-primary/50' : '')}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"/>
                                <span className="font-mono text-sm font-bold text-on-surface uppercase">{s.name}</span>
                                <span className="text-[10px] font-label text-on-surface-variant">{s.createdAt}</span>
                              </div>
                              {s.notes && <div className="text-xs text-on-surface-variant/60 mb-2">{s.notes}</div>}
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-1 bg-surface-container-highest rounded-full overflow-hidden">
                                  <div className="h-full bg-tertiary rounded-full transition-all" style={{width: (progress * 100) + '%'}}/>
                                </div>
                                <span className="font-mono text-xs text-on-surface-variant flex-shrink-0">{s.games.length}/{s.targetGames}</span>
                              </div>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              {canManage && (
                                <Btn variant="primary" size="sm" onClick={function() { setActiveId(s.id); setScrimResults({}); setTab('record'); }}>Record</Btn>
                              )}
                              {canManage && (
                                <Btn variant="destructive" size="sm" onClick={function() { stopSession(s.id); }}>End</Btn>
                              )}
                            </div>
                          </Panel>
                        );
                      })}
                    </div>
                  )}
                  {/* Completed */}
                  {safeSessions.filter(function(s) { return !s.active; }).length > 0 && (
                    <div>
                      <div className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest mb-2 px-1">Completed</div>
                      {safeSessions.filter(function(s) { return !s.active; }).map(function(s) {
                        return (
                          <Panel key={s.id} padding="tight" className="flex items-center gap-4 mb-2 opacity-70 hover:opacity-100 transition-opacity">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-mono text-sm font-bold text-on-surface uppercase">{s.name}</span>
                                <span className="text-[10px] font-label text-on-surface-variant">{s.createdAt}</span>
                              </div>
                              <span className="font-mono text-xs text-on-surface-variant">{s.games.length} games recorded</span>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <Btn variant="secondary" size="sm" onClick={function() { setTab('history'); setExpandedSession(s.id); }}>View</Btn>
                              {isAdmin && (
                                <Btn variant="destructive" size="sm" onClick={function() { setConfirmDelete({type: 'session', id: s.id}); }}>Del</Btn>
                              )}
                            </div>
                          </Panel>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ════════════ RECORD TAB ════════════ */}
        {tab === 'record' && (
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 xl:col-span-7 space-y-4">
              {/* Session selector */}
              <Panel padding="default">
                <label className="block text-[10px] font-label text-on-surface-variant uppercase tracking-widest mb-2">Session</label>
                <select value={activeId || ''} onChange={function(e) { var v = e.target.value || null; setActiveId(v); setScrimResults({}); setGameComps({}); rosterDirtyRef.current = false; if (v) setScrimRoster([]); setLobbies(null); setLobbyResults({}); setLobbyComps({}); setRoundStandings(null); }}
                  className="w-full bg-surface-container-highest border-0 text-on-surface font-mono text-sm p-3 outline-none focus:ring-1 focus:ring-primary">
                  <option value="">- Select session -</option>
                  {safeSessions.filter(function(s) { return s.active; }).map(function(s) {
                    return <option key={s.id} value={s.id}>{s.name} ({s.games.length}/{s.targetGames})</option>;
                  })}
                </select>
                {!activeId && (
                  <p className="text-[10px] font-label text-on-surface-variant mt-2">
                    No active session?{' '}
                    <button type="button" onClick={function() { setTab('lobbies'); }} className="text-primary underline underline-offset-2 bg-transparent border-0 cursor-pointer p-0 font-label text-[10px]">Create one in Lobbies.</button>
                  </p>
                )}
              </Panel>

              {activeId && (
                <>
                  {/* Roster */}
                  <Panel padding="default">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-[10px] font-label text-on-surface-variant uppercase tracking-widest">
                        Roster ({rosterForGame.length}{!bypassCap && effectiveMaxPlayers > 0 ? '/' + effectiveMaxPlayers : ''} players)
                        {isMultiLobby && <span className="text-tertiary ml-2">{Math.ceil(rosterForGame.length / 8)} lobbies</span>}
                      </label>
                      {isMultiLobby && <span className="text-[9px] font-label bg-tertiary/15 text-tertiary px-2 py-0.5 uppercase tracking-widest">Multi-Lobby</span>}
                    </div>
                    <PlayerSearch
                      players={players}
                      roster={rosterForGame}
                      onAdd={function(p) {
                        rosterDirtyRef.current = true;
                        var newRoster;
                        if (session && session.playerIds.length > 0 && scrimRoster.length === 0) {
                          newRoster = rosterForGame.concat([p]);
                        } else {
                          newRoster = scrimRoster.concat([p]);
                        }
                        setScrimRoster(newRoster);
                        syncRosterToDb(newRoster);
                        setLobbies(null); setRoundStandings(null);
                      }}
                      onAddGuest={addGuestPlayer}
                      disabled={recordAtCap}
                      disabledPlaceholder={'Roster at ' + effectiveMaxPlayers + ' player cap - upgrade to add more'}
                    />
                    {(recordOverCap || recordAtCap) && !bypassCap && (
                      <div className="mt-3 p-3 rounded-lg bg-error-container/20 border border-error/20 text-error font-mono text-xs leading-relaxed">
                        Your {tierLabel} plan allows up to {effectiveMaxPlayers} players per scrim.{upgradeHint}{' '}
                        {recordOverCap ? 'Remove players or ' : 'At cap - '}
                        <a href="/pricing" className="underline">upgrade</a>{recordOverCap ? '.' : ' for more slots.'}
                      </div>
                    )}
                    {rosterForGame.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {rosterForGame.map(function(p) {
                          return (
                            <div key={p.id} className="flex items-center gap-1 px-2 py-1 bg-primary/10 border border-primary/20">
                              <span className="text-[11px] font-mono text-primary">{p.name}</span>
                              {p.role === 'guest' && <span className="text-[9px] font-label text-on-surface-variant/50 uppercase">guest</span>}
                              <button onClick={function() {
                                var override = rosterForGame.filter(function(r) { return String(r.id) !== String(p.id); });
                                rosterDirtyRef.current = true;
                                setScrimRoster(override);
                                syncRosterToDb(override);
                                setScrimResults(function(prev) { var n = Object.assign({}, prev); delete n[p.id]; return n; });
                                setLobbies(null); setRoundStandings(null);
                              }} className="text-primary/40 hover:text-error transition-colors text-sm leading-none bg-transparent border-0 cursor-pointer p-0 ml-0.5">x</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Panel>

                  {/* Game controls */}
                  <Panel padding="default" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-sm text-on-surface-variant">
                        {isMultiLobby ? 'Round ' + (sessionRoundCount + 1) : 'Game ' + (session ? session.games.length + 1 : 1)}{session ? ' / ' + session.targetGames : ''}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={'font-mono text-base font-bold w-14 ' + (timerActive ? 'text-primary' : 'text-on-surface-variant/40')}>{fmt(timer)}</div>
                        <Btn variant="secondary" size="sm" onClick={function() { setTimerActive(function(t) { return !t; }); }}>{timerActive ? 'Pause' : 'Start'}</Btn>
                        <Btn variant="secondary" size="sm" onClick={function() { setTimer(0); setTimerActive(false); }}>Reset</Btn>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-label text-on-surface-variant uppercase tracking-widest mb-1.5">Tag</label>
                        <select value={gameTag} onChange={function(e) { setGameTag(e.target.value); }}
                          className="w-full bg-surface-container-highest border-0 text-on-surface font-mono text-sm p-2.5 outline-none">
                          {['standard','draft comp','test run','ranked sim','meta test'].map(function(t) { return <option key={t} value={t}>{t}</option>; })}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-label text-on-surface-variant uppercase tracking-widest mb-1.5">Note</label>
                        <input type="text" value={gameNote} onChange={function(e) { setGameNote(e.target.value); }}
                          placeholder="comps, pivots, highlights..."
                          className="w-full bg-surface-container-highest border-0 text-on-surface font-mono text-sm p-2.5 outline-none"/>
                      </div>
                    </div>
                  </Panel>

                  {/* ── Single lobby mode (8 or fewer) ── */}
                  {!isMultiLobby && rosterForGame.length >= 2 && (
                    <Panel padding="default" className="space-y-5">
                      <div>
                        <label className="block text-[10px] font-label text-on-surface-variant uppercase tracking-widest mb-3">Placements - {placedCount}/{rosterForGame.length} set</label>
                        <PlacementBoard roster={rosterForGame} results={scrimResults}
                          onPlace={function(pid, place) { setScrimResults(function(r) { return Object.assign({}, r, {[pid]: place}); }); }}
                          comps={gameComps} onComp={function(pid, val) { setGameComps(function(c) { return Object.assign({}, c, {[pid]: val}); }); }}/>
                      </div>
                      <Btn variant="primary" size="xl" icon="lock" onClick={lockGame} disabled={!allPlaced} className="w-full">
                        Lock Game
                      </Btn>
                      {session && session.active && (
                        <Btn variant="destructive" size="md" onClick={function() { stopSession(session.id); }} className="w-full">
                          End Session
                        </Btn>
                      )}
                    </Panel>
                  )}

                  {/* ── Multi-lobby mode (9+) ── */}
                  {isMultiLobby && (
                    <div className="space-y-4">
                      {/* Seeding controls */}
                      {!lobbies && !roundStandings && (
                        <Panel padding="default" className="space-y-4">
                          <div>
                            <label className="block text-[10px] font-label text-on-surface-variant uppercase tracking-widest mb-3">Seeding Mode</label>
                            <div className="flex gap-2">
                              {[
                                {id: 'random', label: 'Random', icon: 'shuffle', desc: 'Pure shuffle'},
                                {id: 'swiss', label: 'Swiss', icon: 'swap_vert', desc: 'Group by points'},
                                {id: 'snake', label: 'Snake', icon: 'route', desc: 'Balanced draft'}
                              ].map(function(mode) {
                                var isActive = seedMode === mode.id;
                                var isDisabled = mode.id !== 'random' && sessionRoundCount === 0;
                                return (
                                  <button key={mode.id} onClick={function() { if (!isDisabled) setSeedMode(mode.id); }}
                                    className={'flex-1 p-3 rounded border transition-all text-left ' + (isActive ? 'border-primary bg-primary/10' : isDisabled ? 'border-outline-variant/10 opacity-30 cursor-not-allowed' : 'border-outline-variant/10 hover:border-primary/30')}>
                                    <div className="flex items-center gap-2 mb-1">
                                      <Icon name={mode.icon} size={14} className={isActive ? 'text-primary' : 'text-on-surface-variant/40'}/>
                                      <span className={'font-label text-xs uppercase tracking-widest font-bold ' + (isActive ? 'text-primary' : 'text-on-surface')}>{mode.label}</span>
                                    </div>
                                    <div className="text-[10px] text-on-surface-variant/50">{mode.desc}{isDisabled ? ' (need round 1 first)' : ''}</div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <Btn variant="primary" size="xl" icon="groups" onClick={generateLobbies} className="w-full">
                            Generate Lobbies - Round {sessionRoundCount + 1}
                          </Btn>
                        </Panel>
                      )}

                      {/* Round standings (after locking) */}
                      {roundStandings && (
                        <Panel padding="none" className="overflow-hidden">
                          <div className="px-5 py-4 bg-surface-container flex items-center justify-between">
                            <div>
                              <h3 className="font-editorial text-xl font-bold">Round {currentRound} Complete</h3>
                              <p className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest mt-0.5">Cross-lobby standings</p>
                            </div>
                            <Btn variant="primary" size="sm" icon="skip_next" onClick={nextRound}>
                              Next Round
                            </Btn>
                          </div>
                          <div className="p-5">
                            <table className="w-full">
                              <thead>
                                <tr className="bg-white/[0.03]">
                                  {['#','Player','Lobby','Round Pts','Total Pts'].map(function(h, hi) {
                                    return <th key={h} className={'py-2.5 text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest ' + (hi <= 1 ? 'text-left px-4' : 'text-center px-3')}>{h}</th>;
                                  })}
                                </tr>
                              </thead>
                              <tbody>
                                {roundStandings.map(function(s, si) {
                                  var rankColor = si === 0 ? '#E8A838' : si === 1 ? '#C0C0C0' : si === 2 ? '#CD7F32' : 'rgba(255,255,255,0.2)';
                                  var lobbyLetter = String.fromCharCode(65 + s.lobby);
                                  return (
                                    <tr key={s.name} className="border-b border-white/[0.04]" style={{background: si === 0 ? 'rgba(232,168,56,0.03)' : 'transparent'}}>
                                      <td className="px-4 py-3"><span className="font-mono font-black text-sm" style={{color: rankColor}}>{si + 1}</span></td>
                                      <td className="px-4 py-3">
                                        <div className="font-bold text-sm text-on-surface">{s.name}</div>
                                        <div className="text-[10px] text-on-surface-variant/50">#{s.roundPlace} in lobby</div>
                                      </td>
                                      <td className="px-3 py-3 text-center"><span className="font-mono text-xs font-bold text-tertiary">{lobbyLetter}</span></td>
                                      <td className="px-3 py-3 text-center"><span className="font-mono text-sm font-bold" style={{color: placeColor(s.roundPlace)}}>{s.roundPts}</span></td>
                                      <td className="px-3 py-3 text-center"><span className="font-mono text-lg font-black text-primary">{s.totalPts}</span></td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {session && session.active && (
                            <div className="px-5 pb-4">
                              <Btn variant="destructive" size="md" onClick={function() { stopSession(session.id); }} className="w-full">
                                End Session
                              </Btn>
                            </div>
                          )}
                        </Panel>
                      )}

                      {/* Side-by-side lobby boards */}
                      {lobbies && !roundStandings && (
                        <div className="space-y-4">
                          <div className={'grid gap-4 ' + (lobbies.length === 2 ? 'grid-cols-1 xl:grid-cols-2' : lobbies.length === 3 ? 'grid-cols-1 xl:grid-cols-3' : 'grid-cols-1 xl:grid-cols-2')}>
                            {lobbies.map(function(lobby, li) {
                              var lr = lobbyResults[li] || {};
                              var lc = lobbyComps[li] || {};
                              var lobbyPlaced = Object.keys(lr).length;
                              var lobbyLetter = String.fromCharCode(65 + li);
                              var lobbyColor = li === 0 ? '#E8A838' : li === 1 ? '#4ECDC4' : li === 2 ? '#C4B5FD' : '#f97316';
                              return (
                                <Panel key={li} padding="none" className="overflow-hidden">
                                  <div className="px-4 py-3 bg-surface-container flex items-center justify-between" style={{borderTop: '2px solid ' + lobbyColor}}>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-sm font-black" style={{color: lobbyColor}}>Lobby {lobbyLetter}</span>
                                      <span className="text-[10px] font-label text-on-surface-variant">{lobby.length} players</span>
                                    </div>
                                    <span className={'font-mono text-xs font-bold ' + (lobbyPlaced >= lobby.length ? 'text-emerald-400' : 'text-on-surface-variant/40')}>{lobbyPlaced}/{lobby.length}</span>
                                  </div>
                                  <div className="p-4">
                                    <PlacementBoard roster={lobby} results={lr}
                                      onPlace={function(pid, place) {
                                        setLobbyResults(function(prev) {
                                          var updated = Object.assign({}, prev);
                                          updated[li] = Object.assign({}, updated[li] || {});
                                          updated[li][pid] = place;
                                          return updated;
                                        });
                                      }}
                                      comps={lc}
                                      onComp={function(pid, val) {
                                        setLobbyComps(function(prev) {
                                          var updated = Object.assign({}, prev);
                                          updated[li] = Object.assign({}, updated[li] || {});
                                          updated[li][pid] = val;
                                          return updated;
                                        });
                                      }}/>
                                  </div>
                                </Panel>
                              );
                            })}
                          </div>

                          <Btn variant="primary" size="xl" icon="lock" onClick={lockRound} disabled={!allLobbiesPlaced} className="w-full">
                            Lock Round {currentRound} - {lobbies.length} Lobbies
                          </Btn>
                          <Btn variant="secondary" size="md" onClick={function() { setLobbies(null); setLobbyResults({}); setLobbyComps({}); }} className="w-full">
                            Re-shuffle Lobbies
                          </Btn>
                          {session && session.active && (
                            <Btn variant="destructive" size="md" onClick={function() { stopSession(session.id); }} className="w-full">
                              End Session
                            </Btn>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Recent games sidebar */}
            <div className="col-span-12 xl:col-span-5">
              <div className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest mb-3">
                {session ? session.name + ' - Games' : 'Recent Games'}
              </div>
              {(session ? session.games.slice().reverse() : allGames.slice().reverse()).slice(0, 8).length === 0 ? (
                <Panel padding="none" className="p-10 text-center">
                  <Icon name="sports_esports" size={32} className="text-on-surface-variant opacity-20 mb-3"/>
                  <div className="text-xs font-label text-on-surface-variant uppercase tracking-widest">No games yet</div>
                </Panel>
              ) : (
                <div className="space-y-3">
                  {(session ? session.games.slice().reverse() : allGames.slice().reverse()).slice(0, 8).map(function(g, gi) {
                    var sorted = Object.entries(g.results).sort(function(a, b) { return a[1] - b[1]; });
                    var winner = sorted[0];
                    var winnerPlayer = winner ? players.find(function(pl) { return String(pl.id) === String(winner[0]); }) : null;
                    return (
                      <Panel key={g.id} padding="none" className="overflow-hidden">
                        <div className="flex justify-between items-center px-4 py-2.5 bg-surface-container">
                          <div className="flex gap-2 items-center">
                            <span className="font-mono text-xs font-bold text-primary">{g.roundNumber ? 'R' + g.roundNumber : 'G' + (g.gameNumber || (gi + 1))}</span>
                            {g.lobbyIndex != null && <span className="text-[9px] font-label bg-tertiary/15 text-tertiary px-1.5 py-0.5 uppercase">Lobby {String.fromCharCode(65 + g.lobbyIndex)}</span>}
                            {g.tag !== 'standard' && <span className="text-[9px] font-label bg-secondary/10 text-secondary px-1.5 py-0.5 uppercase">{g.tag}</span>}
                            {g.duration > 0 && <span className="font-mono text-[10px] text-on-surface-variant/50">{fmt(g.duration)}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            {winnerPlayer && <span className="text-[10px] font-label text-on-surface-variant/60">Winner: <span className="font-bold text-amber-400">{winnerPlayer.name}</span></span>}
                            {isAdmin && (
                              <div className="flex gap-1">
                                <button onClick={function() { setEditGame({id: g.id, note: g.note, tag: g.tag}); }}
                                  className="p-1 text-on-surface-variant/30 hover:text-primary transition-colors"><Icon name="edit" size={12} className="text-current"/></button>
                                <button onClick={function() { setConfirmDelete({type: 'game', id: g.id}); }}
                                  className="p-1 text-on-surface-variant/30 hover:text-error transition-colors"><Icon name="delete" size={12} className="text-current"/></button>
                              </div>
                            )}
                          </div>
                        </div>
                        {g.note && <div className="text-[10px] text-on-surface-variant/50 px-4 pt-2 italic">"{g.note}"</div>}
                        <div className="px-4 py-2.5 divide-y divide-outline-variant/5">
                          {sorted.map(function(entry) {
                            var pid = entry[0]; var place = entry[1];
                            var p = players.find(function(pl) { return String(pl.id) === String(pid); });
                            if (!p) return null;
                            var c = placeColor(place);
                            var pts = PTS[place] || 0;
                            return (
                              <div key={pid} className="flex items-center gap-2.5 py-1.5">
                                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 rounded font-mono text-[10px] font-black" style={{background: c + '20', color: c}}>{place}</div>
                                <span className="text-xs truncate flex-1" style={{color: place <= 4 ? '#D1C9BC' : 'rgba(255,255,255,0.3)', fontWeight: place <= 4 ? 600 : 400}}>{p.name}</span>
                                {g.comps && g.comps[pid] && <span className="text-[9px] font-label text-on-surface-variant/30 truncate max-w-[80px]">{g.comps[pid]}</span>}
                                <span className="font-mono text-[10px] font-bold flex-shrink-0" style={{color: c}}>{pts}pt</span>
                              </div>
                            );
                          })}
                        </div>
                      </Panel>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════ STATISTICS TAB ════════════ */}
        {tab === 'stats' && (
          <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex gap-1">
              {[{id:'players',label:'Players'},{id:'comps',label:'Comps'}].map(function(t) {
                return (
                  <button key={t.id} onClick={function() { setStatsTab(t.id); }}
                    className={'px-5 py-2 font-label text-xs uppercase tracking-widest border-b-2 transition-colors ' + (statsTab === t.id ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-on-surface')}>
                    {t.label}
                  </button>
                );
              })}
            </div>

            {statsTab === 'players' && scrimStats.length === 0 && (
              <Panel padding="none" className="p-16 text-center">
                <Icon name="analytics" size={40} className="text-on-surface-variant opacity-20 mb-4"/>
                <div className="text-xs font-label text-on-surface-variant uppercase tracking-widest">Record games to unlock statistics</div>
              </Panel>
            )}

            {statsTab === 'players' && scrimStats.length > 0 && (
              <>
                {/* Hero strip */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                  {(function() {
                    var bestPts = scrimStats[0];
                    var bestAvg = scrimStats.slice().sort(function(a, b) { return parseFloat(a.avg) - parseFloat(b.avg); })[0];
                    var bestWR = scrimStats.slice().sort(function(a, b) { return parseFloat(b.winRate) - parseFloat(a.winRate); })[0];
                    var bestTop4 = scrimStats.slice().sort(function(a, b) { return parseFloat(b.top4Rate) - parseFloat(a.top4Rate); })[0];
                    var mostGames = scrimStats.slice().sort(function(a, b) { return b.games - a.games; })[0];
                    var stdDevs = scrimStats.filter(function(p) { return p.games >= 3; }).map(function(p) {
                      var mean = p.placements.reduce(function(s, v) { return s + v; }, 0) / p.placements.length;
                      var variance = p.placements.reduce(function(s, v) { return s + Math.pow(v - mean, 2); }, 0) / p.placements.length;
                      return {name: p.name, sd: Math.sqrt(variance)};
                    }).sort(function(a, b) { return a.sd - b.sd; });
                    var consistent = stdDevs.length > 0 ? stdDevs[0] : null;
                    return [
                      {label: 'Games Logged',    val: allGames.length,          sub: safeSessions.length + ' sessions',                    color: '#C4B5FD', icon: 'sports_esports'},
                      {label: 'Most Points',     val: bestPts.pts,              sub: bestPts.name + ' - ' + bestPts.ppg + ' ppg',          color: '#f97316', icon: 'emoji_events'},
                      {label: 'Best Average',    val: bestAvg.avg,              sub: bestAvg.name,                                         color: '#4ade80', icon: 'trending_up'},
                      {label: 'Top Win Rate',    val: bestWR.winRate + '%',     sub: bestWR.name + ' - ' + bestWR.wins + ' wins',          color: '#E8A838', icon: 'military_tech'},
                      {label: consistent ? 'Most Consistent' : 'Most Active', val: consistent ? consistent.sd.toFixed(1) + ' sd' : mostGames.games + 'g', sub: consistent ? consistent.name : mostGames.name, color: '#4ECDC4', icon: consistent ? 'balance' : 'local_fire_department'},
                    ].map(function(item) {
                      return (
                        <div key={item.label} className="bg-surface-container-low p-4 border-t-2 space-y-0.5" style={{borderColor: item.color + '55'}}>
                          <div className="flex items-center gap-2">
                            <div className="font-mono text-2xl font-black leading-none" style={{color: item.color}}>{item.val}</div>
                          </div>
                          <div className="text-[9px] font-label text-on-surface-variant uppercase tracking-widest">{item.label}</div>
                          <div className="text-[10px] text-on-surface-variant/50 truncate">{item.sub}</div>
                        </div>
                      );
                    });
                  }())}
                </div>

                {/* Leaderboard */}
                <Panel padding="none" className="overflow-hidden">
                  <div className="px-6 py-4 bg-surface-container flex items-center justify-between">
                    <div>
                      <h2 className="font-editorial text-2xl font-bold">Player Leaderboard</h2>
                      <p className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest mt-0.5">Sorted by total points</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-separate border-spacing-0 min-w-[680px]">
                      <thead>
                        <tr className="bg-white/[0.03]">
                          {['#','Player','PTS','PPG','AVG','WIN%','TOP4%'].map(function(h, hi) {
                            return <th key={h} className={'py-3 text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest ' + (hi <= 1 ? 'text-left px-4' : 'text-center px-3')}>{h}</th>;
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {scrimStats.map(function(p, i) {
                          var avgV = parseFloat(p.avg);
                          var avgColor = avgV < 3 ? '#4ade80' : avgV <= 5 ? '#facc15' : '#f87171';
                          var rankColor = i === 0 ? '#E8A838' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'rgba(255,255,255,0.2)';
                          return (
                            <tr key={p.id} className="border-b border-white/[0.04]" style={{background: i === 0 ? 'rgba(232,168,56,0.03)' : 'transparent'}}>
                              <td className="px-4 py-4 w-10 text-center">
                                <span className="font-mono font-black text-base" style={{color: rankColor}}>{i + 1}</span>
                              </td>
                              <td className="px-4 py-4 min-w-[160px]">
                                <div className="font-bold text-sm text-on-surface">{p.name}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] font-label text-on-surface-variant">{p.games}g</span>
                                  {p.streak >= 2 && <span className="text-[10px] font-mono text-orange-400">{'\uD83D\uDD25'}{p.streak}</span>}
                                  <div className="flex gap-px">
                                    {p.placements.slice(-5).map(function(pl, pi) {
                                      return <div key={pi} className="w-4 h-4 flex items-center justify-center text-[9px] font-mono font-bold" style={{background: placeColor(pl) + '25', color: placeColor(pl)}}>{pl}</div>;
                                    })}
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-4 text-center">
                                <span className="font-mono text-xl font-black text-primary">{p.pts}</span>
                              </td>
                              <td className="px-3 py-4 text-center">
                                <span className="font-mono text-sm font-bold text-on-surface-variant">{p.ppg}</span>
                                <div className="text-[9px] font-label text-on-surface-variant/40 uppercase">pts/g</div>
                              </td>
                              <td className="px-3 py-4 text-center">
                                <span className="font-mono text-sm font-bold" style={{color: avgColor}}>{p.avg}</span>
                              </td>
                              <td className="px-3 py-4 text-center">
                                <div className="font-mono text-sm font-bold text-emerald-400">{p.winRate}%</div>
                                <div className="w-10 h-0.5 bg-surface-container-highest mx-auto mt-1 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-400" style={{width: p.winRate + '%'}}/>
                                </div>
                              </td>
                              <td className="px-3 py-4 text-center">
                                <div className="font-mono text-sm font-bold text-secondary">{p.top4Rate}%</div>
                                <div className="w-10 h-0.5 bg-surface-container-highest mx-auto mt-1 rounded-full overflow-hidden">
                                  <div className="h-full bg-secondary" style={{width: p.top4Rate + '%'}}/>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Panel>

                {/* Session breakdown */}
                {safeSessions.length >= 2 && (
                  <Panel padding="none" className="overflow-hidden">
                    <div className="px-6 py-4 bg-surface-container">
                      <h2 className="font-editorial text-2xl font-bold">Session Breakdown</h2>
                      <p className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest mt-0.5">Points and avg per session - track improvement over time</p>
                    </div>
                    <div className="p-6 overflow-x-auto">
                      <table className="border-separate border-spacing-1" style={{minWidth: 180 + safeSessions.length * 140 + 'px'}}>
                        <thead>
                          <tr>
                            <th className="text-left text-[10px] font-label text-on-surface-variant uppercase tracking-widest pr-4 w-28"/>
                            {safeSessions.map(function(sess) {
                              return (
                                <th key={sess.id} className="text-center min-w-[120px]">
                                  <div className="font-mono text-[10px] font-bold text-on-surface truncate max-w-[120px]">{sess.name}</div>
                                  <div className="text-[9px] font-label text-on-surface-variant uppercase">{sess.games.length}g{sess.active ? ' · LIVE' : ''}</div>
                                </th>
                              );
                            })}
                            <th className="text-center pl-2 text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Overall</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scrimStats.map(function(p) {
                            return (
                              <tr key={p.id}>
                                <td className="pr-4 py-1 font-bold text-xs text-on-surface">{p.name}</td>
                                {safeSessions.map(function(sess) {
                                  var pGames = sess.games.filter(function(g) { return g.results[p.id] != null || g.results[String(p.id)] != null; });
                                  if (pGames.length === 0) return <td key={sess.id} className="text-center py-1"><div className="w-[120px] h-10 flex items-center justify-center mx-auto text-on-surface-variant/20 text-xs bg-white/[0.02]">-</div></td>;
                                  var pls = pGames.map(function(g) { return g.results[p.id] != null ? g.results[p.id] : g.results[String(p.id)]; });
                                  var pts = pls.reduce(function(s, v) { return s + (PTS[v] || 0); }, 0);
                                  var avg = (pls.reduce(function(s, v) { return s + v; }, 0) / pls.length).toFixed(1);
                                  var avgV = parseFloat(avg);
                                  var c = avgV < 3 ? '#4ade80' : avgV <= 5 ? '#facc15' : '#f87171';
                                  return (
                                    <td key={sess.id} className="text-center py-1">
                                      <div className="w-[120px] h-10 flex flex-col items-center justify-center mx-auto" style={{background: c + '10', border: '1px solid ' + c + '22'}}>
                                        <div className="font-mono text-sm font-black text-primary">{pts}<span className="text-[9px] font-normal text-on-surface-variant/40 ml-0.5">pts</span></div>
                                        <div className="font-mono text-[10px]" style={{color: c}}>{avg} avg</div>
                                      </div>
                                    </td>
                                  );
                                })}
                                <td className="pl-2 text-center py-1">
                                  <div className="font-mono text-sm font-black text-primary">{p.pts}</div>
                                  <div className="font-mono text-[10px]" style={{color: parseFloat(p.avg) < 3 ? '#4ade80' : parseFloat(p.avg) <= 5 ? '#facc15' : '#f87171'}}>{p.avg} avg</div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                )}
              </>
            )}

            {/* Comps sub-tab */}
            {statsTab === 'comps' && (
              <div className="space-y-4">
                {compList.length === 0 ? (
                  <Panel padding="none" className="p-16 text-center space-y-3">
                    <Icon name="category" size={40} className="text-on-surface-variant opacity-20"/>
                    <div className="text-xs font-label text-on-surface-variant uppercase tracking-widest">No comp data yet</div>
                    <div className="text-xs text-on-surface-variant/50 max-w-xs mx-auto">When recording games, fill in the comp field below each player's placements to track comp performance here.</div>
                  </Panel>
                ) : (
                  <Panel padding="none" className="overflow-hidden">
                    <div className="px-6 py-4 bg-surface-container flex items-center justify-between">
                      <div>
                        <h2 className="font-editorial text-2xl font-bold">Comp Performance</h2>
                        <p className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest mt-0.5">{compList.length} comps tracked across {allGames.length} games</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-separate border-spacing-0 min-w-[520px]">
                        <thead>
                          <tr className="bg-white/[0.03]">
                            {['#','Comp','Games','Play Rate','Win%','Top4%','Avg Place'].map(function(h, hi) {
                              return <th key={h} className={'py-3 text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest ' + (hi <= 1 ? 'text-left px-5' : 'text-center px-4')}>{h}</th>;
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {compList.map(function(c, i) {
                            var winPct = Math.round((c.wins / c.games) * 100);
                            var top4Pct = Math.round((c.top4 / c.games) * 100);
                            var avgPl = (c.ptsTotal / c.games);
                            var playRate = Math.round((c.games / allGames.length) * 100);
                            var avgPlace = (c.ptsTotal > 0 ? (allGames.length > 0 ? (c.games > 0 ? '' : '') : '') : '');
                            // Recompute avg placement from source
                            var totalPlacement = 0; var plCount = 0;
                            allGames.forEach(function(g) {
                              Object.keys(g.results).forEach(function(pid) {
                                if (g.comps && g.comps[pid] && g.comps[pid].trim() === c.name) {
                                  totalPlacement += g.results[pid]; plCount++;
                                }
                              });
                            });
                            var avgPlStr = plCount > 0 ? (totalPlacement / plCount).toFixed(2) : '-';
                            var avgPlV = parseFloat(avgPlStr);
                            var avgPlColor = avgPlV < 3 ? '#4ade80' : avgPlV <= 5 ? '#facc15' : '#f87171';
                            return (
                              <tr key={c.name} className="border-b border-white/[0.04]">
                                <td className="px-5 py-4 font-mono text-sm font-bold text-on-surface-variant/40 w-10">{i + 1}</td>
                                <td className="px-5 py-4">
                                  <div className="font-bold text-sm text-on-surface">{c.name}</div>
                                  <div className="text-[10px] text-on-surface-variant font-label">{c.games} games</div>
                                </td>
                                <td className="px-4 py-4 text-center font-mono text-sm text-on-surface-variant">{c.games}</td>
                                <td className="px-4 py-4 text-center">
                                  <div className="font-mono text-sm font-bold text-on-surface">{playRate}%</div>
                                  <div className="w-12 h-0.5 bg-surface-container-highest mx-auto mt-1 overflow-hidden">
                                    <div className="h-full bg-on-surface-variant/40" style={{width: playRate + '%'}}/>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <div className="font-mono text-sm font-bold" style={{color: winPct >= 25 ? '#4ade80' : winPct >= 12 ? '#facc15' : '#f87171'}}>{winPct}%</div>
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <div className="font-mono text-sm font-bold" style={{color: top4Pct >= 50 ? '#4ECDC4' : top4Pct >= 35 ? '#facc15' : '#f87171'}}>{top4Pct}%</div>
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <span className="font-mono text-lg font-black" style={{color: avgPlColor}}>{avgPlStr}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════════════ HISTORY TAB ════════════ */}
        {tab === 'history' && (
          <div className="space-y-4">
            {/* Export bar */}
            {allGames.length > 0 && (
              <Panel padding="none" className="flex items-center justify-between px-5 py-3">
                <span className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">{allGames.length} games across {safeSessions.length} sessions</span>
                <div className="flex gap-2">
                  <Btn variant="secondary" size="sm" icon="content_copy" onClick={copyText}>
                    Copy Text
                  </Btn>
                  <Btn variant="secondary" size="sm" icon="download" onClick={exportCSV}>
                    CSV
                  </Btn>
                </div>
              </Panel>
            )}

            {safeSessions.length === 0 ? (
              <Panel padding="none" className="p-16 text-center">
                <Icon name="history" size={40} className="text-on-surface-variant opacity-20 mb-4"/>
                <div className="text-xs font-label text-on-surface-variant uppercase tracking-widest">No history yet</div>
              </Panel>
            ) : (
              safeSessions.map(function(sess) {
                var isExpanded = expandedSession === sess.id;
                var sessPlayers = {};
                sess.games.forEach(function(g) {
                  Object.keys(g.results).forEach(function(pid) {
                    if (!sessPlayers[pid]) sessPlayers[pid] = [];
                    sessPlayers[pid].push(g.results[pid]);
                  });
                });
                var sessStats = Object.keys(sessPlayers).map(function(pid) {
                  var pl = sessPlayers[pid];
                  var avg = (pl.reduce(function(s, v) { return s + v; }, 0) / pl.length).toFixed(2);
                  var pobj = players.find(function(p) { return String(p.id) === String(pid); });
                  return {name: pobj ? pobj.name : pid, avg: avg, games: pl.length, wins: pl.filter(function(x) { return x === 1; }).length, pts: pl.reduce(function(s, v) { return s + (PTS[v] || 0); }, 0)};
                }).sort(function(a, b) { return b.pts - a.pts; });

                return (
                  <Panel key={sess.id} padding="none" className="overflow-hidden">
                    {/* Session header */}
                    <button onClick={function() { setExpandedSession(isExpanded ? null : sess.id); }}
                      className="w-full px-5 py-4 flex items-center gap-4 hover:bg-surface-container transition-colors text-left">
                      <Icon name={isExpanded ? 'expand_less' : 'expand_more'} size={18} className="text-on-surface-variant flex-shrink-0"/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-mono text-sm font-bold text-on-surface uppercase">{sess.name}</span>
                          <span className={'text-[9px] font-label px-2 py-0.5 uppercase tracking-widest ' + (sess.active ? 'bg-tertiary/15 text-tertiary' : 'bg-surface-container-highest text-on-surface-variant')}>{sess.active ? 'Live' : 'Ended'}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-[10px] font-label text-on-surface-variant">{sess.games.length} games</span>
                          <span className="text-[10px] text-on-surface-variant/30">|</span>
                          <span className="text-[10px] font-label text-on-surface-variant">{Object.keys(sessPlayers).length} players</span>
                          <span className="text-[10px] text-on-surface-variant/30">|</span>
                          <span className="text-[10px] font-label text-on-surface-variant">{sess.createdAt}</span>
                          {sessStats.length > 0 && (
                            <>
                              <span className="text-[10px] text-on-surface-variant/30">|</span>
                              <span className="text-[10px] font-label text-amber-400">MVP: {sessStats[0].name} ({sessStats[0].pts}pts)</span>
                            </>
                          )}
                          {sess.notes && <span className="text-[10px] text-on-surface-variant/50 italic truncate">{sess.notes}</span>}
                        </div>
                      </div>
                      {/* Mini podium */}
                      {sessStats.length > 0 && (
                        <div className="hidden lg:flex gap-1.5 flex-shrink-0 items-center">
                          {sessStats.slice(0, 3).map(function(s, si) {
                            var medal = si === 0 ? '#E8A838' : si === 1 ? '#C0C0C0' : '#CD7F32';
                            return (
                              <div key={s.name} className="flex items-center gap-1.5 px-2 py-1 rounded" style={{background: medal + '10', border: '1px solid ' + medal + '20'}}>
                                <span className="font-mono text-[10px] font-black" style={{color: medal}}>{si + 1}</span>
                                <span className="text-[10px] font-label text-on-surface truncate max-w-[56px]">{s.name}</span>
                                <span className="font-mono text-[10px] font-bold text-primary">{s.pts}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-outline-variant/10">
                        {/* Session summary stats */}
                        {sessStats.length > 0 && (
                          <div className="px-5 py-4 border-b border-outline-variant/10">
                            <div className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest mb-3">Session Standings</div>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[400px]">
                                <thead>
                                  <tr>
                                    {['#','Player','Games','Avg','Win%','Pts'].map(function(h, hi) {
                                      return <th key={h} className={'py-1.5 text-[10px] font-label text-on-surface-variant uppercase tracking-widest ' + (hi <= 1 ? 'text-left pr-4' : 'text-center px-3')}>{h}</th>;
                                    })}
                                  </tr>
                                </thead>
                                <tbody>
                                  {sessStats.map(function(s, si) {
                                    var c = placeColor(Math.round(parseFloat(s.avg)));
                                    return (
                                      <tr key={s.name} className="border-t border-white/[0.04]">
                                        <td className="py-2 pr-2 font-mono text-xs font-bold text-on-surface-variant/40 w-6">{si + 1}</td>
                                        <td className="py-2 pr-4 font-bold text-xs text-on-surface">{s.name}</td>
                                        <td className="py-2 text-center font-mono text-xs text-on-surface-variant">{s.games}</td>
                                        <td className="py-2 text-center font-mono text-sm font-bold" style={{color: c}}>{s.avg}</td>
                                        <td className="py-2 text-center font-mono text-xs text-emerald-400">{s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0}%</td>
                                        <td className="py-2 text-center font-mono text-sm font-bold text-primary">{s.pts}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Game list */}
                        <div className="p-5 space-y-3">
                          <div className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest mb-3">Games</div>
                          {sess.games.map(function(g) {
                            var isEditing = editGame && editGame.id === g.id;
                            var sorted = Object.entries(g.results).sort(function(a, b) { return a[1] - b[1]; });
                            var winnerEntry = sorted[0];
                            var winnerPlayer = winnerEntry ? players.find(function(pl) { return String(pl.id) === String(winnerEntry[0]); }) : null;
                            return (
                              <div key={g.id} className="bg-surface-container-high rounded overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-2.5 bg-surface-container-highest/50">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-xs font-bold text-primary">{g.roundNumber ? 'R' + g.roundNumber : 'G' + g.gameNumber}</span>
                                    {g.lobbyIndex != null && <span className="text-[9px] font-label bg-tertiary/15 text-tertiary px-1.5 py-0.5 uppercase">Lobby {String.fromCharCode(65 + g.lobbyIndex)}</span>}
                                    {g.tag !== 'standard' && <span className="text-[9px] font-label bg-secondary/10 text-secondary px-1.5 py-0.5 uppercase">{g.tag}</span>}
                                    {g.duration > 0 && <span className="font-mono text-[10px] text-on-surface-variant/50">{fmt(g.duration)}</span>}
                                    {!isEditing && g.note && <span className="text-[10px] text-on-surface-variant/50 italic">"{g.note}"</span>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {winnerPlayer && <span className="text-[10px] font-label text-on-surface-variant/60">Winner: <span className="font-bold text-amber-400">{winnerPlayer.name}</span></span>}
                                    {isAdmin && (
                                      <div className="flex gap-1 flex-shrink-0">
                                        <button onClick={function() { setEditGame(isEditing ? null : {id: g.id, note: g.note, tag: g.tag}); }}
                                          className="p-1 text-on-surface-variant/30 hover:text-primary transition-colors"><Icon name={isEditing ? 'close' : 'edit'} size={12} className="text-current"/></button>
                                        <button onClick={function() { setConfirmDelete({type: 'game', id: g.id}); }}
                                          className="p-1 text-on-surface-variant/30 hover:text-error transition-colors"><Icon name="delete" size={12} className="text-current"/></button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {isEditing && (
                                  <div className="flex gap-2 px-4 py-3 border-b border-outline-variant/10">
                                    <select value={editGame.tag} onChange={function(e) { setEditGame(Object.assign({}, editGame, {tag: e.target.value})); }}
                                      className="bg-surface-container-lowest border-0 text-on-surface font-mono text-xs p-2 outline-none focus:ring-1 focus:ring-primary">
                                      {['standard','draft comp','test run','ranked sim','meta test'].map(function(t) { return <option key={t} value={t}>{t}</option>; })}
                                    </select>
                                    <input type="text" value={editGame.note} onChange={function(e) { setEditGame(Object.assign({}, editGame, {note: e.target.value})); }}
                                      placeholder="Game note..."
                                      className="flex-1 bg-surface-container-lowest border-0 text-on-surface font-mono text-xs p-2 outline-none focus:ring-1 focus:ring-primary"/>
                                    <Btn variant="primary" size="sm" onClick={saveEditGame}>Save</Btn>
                                  </div>
                                )}

                                <div className="px-4 py-2.5 divide-y divide-outline-variant/5">
                                  {sorted.map(function(entry) {
                                    var pid = entry[0]; var place = entry[1];
                                    var p = players.find(function(pl) { return String(pl.id) === String(pid); });
                                    if (!p) return null;
                                    var c = placeColor(place);
                                    var pts = PTS[place] || 0;
                                    return (
                                      <div key={pid} className="flex items-center gap-2.5 py-1.5">
                                        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 rounded font-mono text-[10px] font-black" style={{background: c + '20', color: c}}>{place}</div>
                                        <span className="text-xs truncate flex-1" style={{color: place <= 4 ? '#D1C9BC' : 'rgba(255,255,255,0.3)', fontWeight: place <= 4 ? 600 : 400}}>{p.name}</span>
                                        {g.comps && g.comps[pid] && <span className="text-[9px] font-label text-on-surface-variant/30 truncate max-w-[100px]">{g.comps[pid]}</span>}
                                        <span className="font-mono text-[10px] font-bold flex-shrink-0" style={{color: c}}>{pts}pt</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </Panel>
                );
              })
            )}
          </div>
        )}

        {/* Confirm delete modal */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <Panel padding="default" className="max-w-sm w-full">
              <div className="font-editorial text-lg font-bold text-on-surface mb-2">Delete {confirmDelete.type}?</div>
              <div className="text-sm text-on-surface-variant mb-5">This cannot be undone.</div>
              <div className="flex gap-3">
                <Btn variant="secondary" size="md" onClick={function() { setConfirmDelete(null); }} className="flex-1">Cancel</Btn>
                <Btn variant="destructive" size="md" onClick={function() { if (confirmDelete.type === 'game') deleteGame(confirmDelete.id); else deleteSession(confirmDelete.id); }} className="flex-1">Delete</Btn>
              </div>
            </Panel>
          </div>
        )}

      </div>
    </PageLayout>
  );
}
