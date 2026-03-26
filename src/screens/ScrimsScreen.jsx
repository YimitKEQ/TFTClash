import { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase.js'
import { PTS } from '../lib/constants.js'
import PageLayout from '../components/layout/PageLayout'
import Icon from '../components/ui/Icon'

// ── Helper: ScrimSparkline ────────────────────────────────────────────────────

function ScrimSparkline(props) {
  var placements = props.placements;
  var w = props.w;
  var h = props.h;
  if (!placements || placements.length < 2) return null;
  var last = placements.slice(-12);
  var pts = last.map(function(v, i) {
    var x = (i / (last.length - 1)) * (w || 60);
    var y = ((v - 1) / 7) * (h || 18) + 1;
    return x + ',' + y;
  }).join(' ');
  var topPt = last.map(function(v, i) {
    return {x: (i / (last.length - 1)) * (w || 60), y: ((v - 1) / 7) * (h || 18) + 1, v: v};
  }).reduce(function(a, b) { return a.y < b.y ? a : b; });
  return (
    <svg width={w || 60} height={(h || 20) + 2} className="block overflow-visible">
      <polyline points={pts} fill="none" stroke="#9B72CF" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.7"/>
      <circle cx={topPt.x} cy={topPt.y} r="2" fill="#E8A838"/>
    </svg>
  );
}

// ── Helper: PlacementBoard ────────────────────────────────────────────────────

function PlacementBoard(props) {
  var roster = props.roster;
  var results = props.results;
  var onPlace = props.onPlace;
  var PLACES = [1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <div className="flex flex-col gap-2">
      {roster.map(function(p) {
        var selected = results[p.id];
        return (
          <div key={p.id} className="flex items-center gap-2">
            <div className="w-24 text-sm font-bold text-on-surface truncate flex-shrink-0">{p.name}</div>
            <div className="flex gap-1 flex-wrap">
              {PLACES.map(function(place) {
                var c = place === 1 ? '#E8A838' : place === 2 ? '#C0C0C0' : place === 3 ? '#CD7F32' : place <= 4 ? '#4ECDC4' : '#F87171';
                var isSelected = selected === place;
                return (
                  <button
                    key={place}
                    onClick={function() { onPlace(p.id, place); }}
                    className="w-7 h-7 rounded text-xs font-bold font-mono transition-all"
                    style={{
                      background: isSelected ? c + '44' : 'rgba(255,255,255,0.04)',
                      border: isSelected ? '1px solid ' + c : '1px solid rgba(255,255,255,0.08)',
                      color: isSelected ? c : 'rgba(255,255,255,0.4)',
                      transform: isSelected ? 'scale(1.15)' : 'scale(1)'
                    }}
                  >
                    {place}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── DB helpers ────────────────────────────────────────────────────────────────

function createScrim(name, createdBy, tag, notes, targetGames) {
  return supabase.from('scrims').insert({
    name: name, created_by: createdBy, tag: tag || null, notes: notes || null,
    target_games: targetGames || 5, status: 'active'
  }).select().single();
}

function addScrimPlayers(scrimId, playerIds) {
  var rows = playerIds.map(function(pid) {
    return {scrim_id: scrimId, player_id: pid};
  });
  return supabase.from('scrim_players').insert(rows);
}

function submitScrimResult(scrimId, gameNumber, results, tag, note, duration) {
  return supabase.from('scrim_games').insert({
    scrim_id: scrimId, game_number: gameNumber, status: 'completed',
    tag: tag || 'standard', note: note || null, duration: duration || 0
  }).select().single().then(function(res) {
    if (res.error) return res;
    var gameId = res.data.id;
    var rows = results.map(function(r) {
      return {scrim_game_id: gameId, player_id: r.playerId, placement: r.placement, points: PTS[r.placement] || 0};
    });
    return supabase.from('scrim_results').insert(rows).then(function(insRes) {
      if (insRes.error) return insRes;
      return {data: Object.assign({}, res.data, {scrim_results: rows}), error: null};
    });
  });
}

function loadScrims() {
  return supabase.from('scrims')
    .select('*, scrim_players(player_id), scrim_games(*, scrim_results(*))')
    .order('created_at', {ascending: false})
    .limit(50);
}

function endScrimDb(scrimId) {
  return supabase.from('scrims').update({status: 'ended'}).eq('id', scrimId);
}

function deleteScrimGameDb(gameId) {
  return supabase.from('scrim_games').delete().eq('id', gameId);
}

function deleteScrimDb(scrimId) {
  return supabase.from('scrims').delete().eq('id', scrimId);
}

// ── ScrimsScreen ─────────────────────────────────────────────────────────────

export default function ScrimsScreen() {
  var ctx = useApp();
  var players = ctx.players;
  var toast = ctx.toast;
  var currentUser = ctx.currentUser;
  var isAdmin = ctx.isAdmin;
  var scrimAccess = ctx.scrimAccess;

  var _tab = useState('lobbies');
  var tab = _tab[0];
  var setTab = _tab[1];

  var _activeId = useState(null);
  var activeId = _activeId[0];
  var setActiveId = _activeId[1];

  var _newName = useState('');
  var newName = _newName[0];
  var setNewName = _newName[1];

  var _newNotes = useState('');
  var newNotes = _newNotes[0];
  var setNewNotes = _newNotes[1];

  var _newTarget = useState('5');
  var newTarget = _newTarget[0];
  var setNewTarget = _newTarget[1];

  var _newRegion = useState('EUW');
  var newRegion = _newRegion[0];
  var setNewRegion = _newRegion[1];

  var _newFormat = useState('BO3');
  var newFormat = _newFormat[0];
  var setNewFormat = _newFormat[1];

  // scrimRoster: players selected for the *create form* only
  var _scrimRoster = useState([]);
  var scrimRoster = _scrimRoster[0];
  var setScrimRoster = _scrimRoster[1];

  var _customName = useState('');
  var customName = _customName[0];
  var setCustomName = _customName[1];

  var _scrimResults = useState({});
  var scrimResults = _scrimResults[0];
  var setScrimResults = _scrimResults[1];

  var _gameNote = useState('');
  var gameNote = _gameNote[0];
  var setGameNote = _gameNote[1];

  var _gameTag = useState('standard');
  var gameTag = _gameTag[0];
  var setGameTag = _gameTag[1];

  var _timer = useState(0);
  var timer = _timer[0];
  var setTimer = _timer[1];

  var _timerActive = useState(false);
  var timerActive = _timerActive[0];
  var setTimerActive = _timerActive[1];

  var _confirmDelete = useState(null);
  var confirmDelete = _confirmDelete[0];
  var setConfirmDelete = _confirmDelete[1];

  var timerRef = useRef(null);

  var _dbScrims = useState([]);
  var dbScrims = _dbScrims[0];
  var setDbScrims = _dbScrims[1];

  var _dbLoading = useState(true);
  var dbLoading = _dbLoading[0];
  var setDbLoading = _dbLoading[1];

  // Load scrims from DB on mount
  useEffect(function() {
    var cancelled = false;
    setDbLoading(true);
    loadScrims().then(function(res) {
      if (cancelled) return;
      if (res.error) { toast('Failed to load scrims: ' + res.error.message, 'error'); setDbLoading(false); return; }
      setDbScrims(res.data || []);
      setDbLoading(false);
    });
    return function() { cancelled = true; };
  }, []);

  function reloadScrims() {
    loadScrims().then(function(res) {
      if (!res.error) setDbScrims(res.data || []);
    });
  }

  useEffect(function() {
    if (timerActive) { timerRef.current = setInterval(function() { setTimer(function(t) { return t + 1; }); }, 1000); }
    else clearInterval(timerRef.current);
    return function() { clearInterval(timerRef.current); };
  }, [timerActive]);

  var fmt = function(s) {
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };

  // Convert DB scrims to UI shape (sessions with .games array)
  var safeSessions = dbScrims.map(function(sc) {
    var games = (sc.scrim_games || []).map(function(g) {
      var results = {};
      (g.scrim_results || []).forEach(function(r) { results[r.player_id] = r.placement; });
      return {id: g.id, results: results, note: g.note || '', tag: g.tag || 'standard', duration: g.duration || 0, ts: new Date(g.created_at).getTime(), gameNumber: g.game_number};
    }).sort(function(a, b) { return a.gameNumber - b.gameNumber; });
    return {
      id: sc.id, name: sc.name, notes: sc.notes || '', targetGames: sc.target_games || 5,
      games: games, createdAt: new Date(sc.created_at).toLocaleDateString(),
      active: sc.status === 'active', tag: sc.tag, createdBy: sc.created_by,
      playerIds: (sc.scrim_players || []).map(function(sp) { return sp.player_id; })
    };
  });

  var session = safeSessions.find(function(s) { return s.id === activeId; });

  // Derive the roster for the currently active session in Play mode.
  // Prefer players from DB scrim_players; fall back to the create-form scrimRoster if the session is brand new.
  var sessionRoster = (function() {
    if (!session) return scrimRoster;
    if (session.playerIds.length > 0) {
      return session.playerIds.map(function(pid) {
        return players.find(function(p) { return String(p.id) === String(pid); });
      }).filter(Boolean);
    }
    return scrimRoster;
  }());

  var allGames = safeSessions.flatMap(function(s) { return s.games; });
  var allPlayers = players;

  // Per-player stats across all sessions
  var scrimStats = allPlayers.map(function(p) {
    var pGames = allGames.filter(function(g) { return g.results[p.id] != null || g.results[String(p.id)] != null; });
    if (pGames.length === 0) return null;
    var placements = pGames.map(function(g) { return g.results[p.id] != null ? g.results[p.id] : g.results[String(p.id)]; });
    var wins = placements.filter(function(x) { return x === 1; }).length;
    var top4 = placements.filter(function(x) { return x <= 4; }).length;
    var avgPlacement = (placements.reduce(function(s, v) { return s + v; }, 0) / placements.length).toFixed(2);
    var pts = placements.reduce(function(s, v) { return s + (PTS[v] || 0); }, 0);
    var best = Math.min.apply(null, placements);
    var worst = Math.max.apply(null, placements);
    var recent = pGames.slice().sort(function(a, b) { return b.ts - a.ts; }).map(function(g) { return g.results[p.id] != null ? g.results[p.id] : g.results[String(p.id)]; });
    var streak = 0;
    for (var si = 0; si < recent.length; si++) { if (recent[si] <= 4) streak++; else break; }
    var mean = placements.reduce(function(s, v) { return s + v; }, 0) / placements.length;
    var variance = placements.reduce(function(s, v) { return s + Math.pow(v - mean, 2); }, 0) / placements.length;
    var eighths = placements.filter(function(x) { return x === 8; }).length;
    return Object.assign({}, p, {
      pts: pts, wins: wins, top4: top4, games: pGames.length, avg: avgPlacement,
      best: best, worst: worst, streak: streak, placements: placements,
      variance: variance, eighths: eighths,
      top4Rate: ((top4 / pGames.length) * 100).toFixed(0),
      winRate: ((wins / pGames.length) * 100).toFixed(0)
    });
  }).filter(Boolean).sort(function(a, b) { return parseFloat(a.avg) - parseFloat(b.avg); });

  // H2H matrix
  var h2hData = {};
  if (scrimStats.length >= 2) {
    allGames.forEach(function(g) {
      var ids = Object.keys(g.results);
      for (var ii = 0; ii < ids.length; ii++) {
        for (var jj = ii + 1; jj < ids.length; jj++) {
          var a = ids[ii], b = ids[jj];
          var pa = g.results[a], pb = g.results[b];
          if (!h2hData[a]) h2hData[a] = {};
          if (!h2hData[b]) h2hData[b] = {};
          if (!h2hData[a][b]) h2hData[a][b] = {wins: 0, total: 0};
          if (!h2hData[b][a]) h2hData[b][a] = {wins: 0, total: 0};
          h2hData[a][b].total++;
          h2hData[b][a].total++;
          if (pa < pb) h2hData[a][b].wins++;
          else if (pb < pa) h2hData[b][a].wins++;
        }
      }
    });
  }

  var activeLobbyCount = safeSessions.filter(function(s) { return s.active; }).length;

  function createSession() {
    if (!newName.trim()) { toast('Name required', 'error'); return; }
    if (!currentUser) { toast('Login required', 'error'); return; }
    var tgt = parseInt(newTarget) || 5;
    // MUST use auth_user_id (the auth UUID) not the players.id integer
    var authId = currentUser.auth_user_id;
    if (!authId) { toast('Auth session not found, please re-login', 'error'); return; }
    createScrim(newName.trim(), authId, null, newNotes.trim(), tgt).then(function(res) {
      if (res.error) { toast('Failed to create: ' + res.error.message, 'error'); return; }
      var scrimId = res.data.id;
      // player IDs are UUID strings from players.id - do NOT parseInt
      var pids = scrimRoster.map(function(p) { return p.id; }).filter(function(v) { return v; });
      if (pids.length > 0) {
        addScrimPlayers(scrimId, pids).then(function(r) {
          if (r && r.error) { toast('Scrim created but failed to add players: ' + r.error.message, 'error'); }
          reloadScrims();
        });
      } else {
        reloadScrims();
      }
      setActiveId(scrimId);
      setNewName(''); setNewNotes(''); setNewTarget('5');
      // Keep scrimRoster for the Play tab since the DB hasn't reloaded yet
      toast('Lobby created - switch to Play to record games', 'success');
      setTab('play');
    });
  }

  function addPlayerToRoster(name) {
    var trimmed = (name || '').trim();
    if (!trimmed) return;
    var fromPlayers = players.find(function(p) { return p.name.toLowerCase() === trimmed.toLowerCase(); });
    if (scrimRoster.find(function(p) { return p.name.toLowerCase() === trimmed.toLowerCase(); })) { toast('Already added', 'error'); return; }
    var np = fromPlayers || {id: crypto.randomUUID(), name: trimmed, rank: 'Gold', pts: 0};
    setScrimRoster(function(r) { return r.concat([np]); });
    setCustomName('');
  }

  // Number of placements filled vs roster size for current session
  var rosterForGame = sessionRoster.length > 0 ? sessionRoster : scrimRoster;
  var placedCount = Object.keys(scrimResults).length;
  var allPlaced = rosterForGame.length > 0 && placedCount >= rosterForGame.length;

  function lockGame() {
    if (!activeId) { toast('Select or create a lobby first', 'error'); return; }
    if (rosterForGame.length === 0) { toast('Add players to the roster first', 'error'); return; }
    if (!allPlaced) { toast('Set placement for every player first', 'error'); return; }
    var gameNum = session ? session.games.length + 1 : 1;
    // player IDs are UUID strings - do NOT parseInt
    var resultRows = Object.keys(scrimResults).map(function(pid) {
      return {playerId: pid, placement: scrimResults[pid]};
    });
    submitScrimResult(activeId, gameNum, resultRows, gameTag, gameNote, timer).then(function(res) {
      if (res.error) { toast('Failed to save game: ' + res.error.message, 'error'); return; }
      reloadScrims();
      setScrimResults({}); setGameNote(''); setTimer(0); setTimerActive(false);
      toast('Game locked', 'success');
    });
  }

  function stopSession(id) {
    endScrimDb(id).then(function(res) {
      if (res.error) { toast('Failed to end session: ' + res.error.message, 'error'); return; }
      reloadScrims();
      toast('Session ended, results saved', 'success');
    });
  }

  function deleteGame(gameId) {
    deleteScrimGameDb(gameId).then(function(res) {
      if (res.error) { toast('Failed to delete game: ' + res.error.message, 'error'); return; }
      reloadScrims();
      setConfirmDelete(null);
      toast('Game deleted', 'success');
    });
  }

  function deleteSession(sessionId) {
    deleteScrimDb(sessionId).then(function(res) {
      if (res.error) { toast('Failed to delete session: ' + res.error.message, 'error'); return; }
      reloadScrims();
      if (activeId === sessionId) { setActiveId(null); setScrimRoster([]); setScrimResults({}); }
      setConfirmDelete(null);
      toast('Session deleted', 'success');
    });
  }

  // Access guard — scrimAccess holds player names (strings)
  var currentUsername = currentUser && (currentUser.username || currentUser.name || '');
  var hasAccess = isAdmin || (currentUser && (scrimAccess || []).includes(currentUsername));
  if (!hasAccess) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-16 h-16 bg-surface-container-high flex items-center justify-center mb-6">
            <Icon name="lock" size={28} className="text-on-surface-variant"/>
          </div>
          <div className="font-serif text-2xl font-bold text-on-surface mb-2">Friends Only</div>
          <div className="text-sm text-on-surface-variant max-w-xs">Ask an admin to grant you access to the Practice Arena.</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="space-y-6">

        {/* ── HEADER SECTION ── */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="font-serif text-5xl font-black text-on-surface tracking-tight mb-2">Practice Arena</h1>
            <p className="text-on-surface-variant max-w-xl font-body text-sm">Manage high-stakes scrims, monitor player performance, and analyze head-to-head dominance.</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-surface-container-low p-4 rounded-sm flex items-center gap-4">
              <div className="text-right">
                <div className="text-[10px] font-sans-condensed text-on-surface-variant tracking-widest uppercase">Global Lobby Status</div>
                <div className="font-mono text-tertiary text-lg font-bold">{activeLobbyCount} ACTIVE</div>
              </div>
              <div className="w-2 h-10 bg-tertiary/20 rounded-full relative">
                <div
                  className="absolute bottom-0 w-full bg-tertiary rounded-full"
                  style={{height: activeLobbyCount > 0 ? '75%' : '10%'}}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── TAB NAVIGATION BAR ── */}
        <div className="flex gap-1 border-b border-outline-variant/20">
          {[
            {id: 'lobbies', label: 'Lobbies', icon: 'groups'},
            {id: 'play', label: 'Record Game', icon: 'sports_esports'},
            {id: 'stats', label: 'Statistics', icon: 'analytics'},
            {id: 'history', label: 'History', icon: 'history'}
          ].map(function(t) {
            return (
              <button
                key={t.id}
                onClick={function() { setTab(t.id); }}
                className={'flex items-center gap-2 px-4 py-3 font-sans-condensed text-xs uppercase tracking-widest transition-colors border-b-2 -mb-px ' + (tab === t.id ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-on-surface')}
              >
                <Icon name={t.icon} size={14} className="text-current"/>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── LOBBIES TAB ── */}
        {tab === 'lobbies' && (
          <div className="grid grid-cols-12 gap-6">

            {/* Left column: Create form + stat card */}
            <div className="col-span-12 lg:col-span-4 space-y-6">

              {/* Initialize Scrim */}
              <div className="bg-surface-container-low p-6 rounded-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Icon name="add_circle" size={64} className="text-on-surface"/>
                </div>
                <h2 className="font-serif text-2xl font-bold mb-6">Initialize Scrim</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-1">Lobby Name</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={function(e) { setNewName(e.target.value); }}
                      onKeyDown={function(e) { if (e.key === 'Enter') createSession(); }}
                      placeholder="e.g. SET 10 MASTERS DRILL"
                      className="w-full bg-surface-container-lowest border-0 focus:ring-1 focus:ring-primary text-on-surface font-mono text-sm p-3 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-1">Region</label>
                      <select
                        value={newRegion}
                        onChange={function(e) { setNewRegion(e.target.value); }}
                        className="w-full bg-surface-container-lowest border-0 focus:ring-1 focus:ring-primary text-on-surface font-mono text-sm p-3 outline-none"
                      >
                        <option>NA</option>
                        <option>EUW</option>
                        <option>KR</option>
                        <option>EUNE</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-1">Target Games</label>
                      <select
                        value={newTarget}
                        onChange={function(e) { setNewTarget(e.target.value); }}
                        className="w-full bg-surface-container-lowest border-0 focus:ring-1 focus:ring-primary text-on-surface font-mono text-sm p-3 outline-none"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map(function(n) {
                          return <option key={n} value={n}>{n} games</option>;
                        })}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-1">Notes</label>
                    <input
                      type="text"
                      value={newNotes}
                      onChange={function(e) { setNewNotes(e.target.value); }}
                      placeholder="Optional notes..."
                      className="w-full bg-surface-container-lowest border-0 focus:ring-1 focus:ring-primary text-on-surface font-mono text-sm p-3 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-2">Roster</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {players.map(function(p) {
                        var inRoster = scrimRoster.find(function(r) { return r.id === p.id; });
                        return (
                          <button
                            key={p.id}
                            onClick={function() {
                              if (inRoster) {
                                setScrimRoster(function(r) { return r.filter(function(x) { return x.id !== p.id; }); });
                              } else {
                                setScrimRoster(function(r) { return r.concat([p]); });
                              }
                            }}
                            className={'text-[10px] font-sans-condensed uppercase px-2 py-1 rounded-sm border transition-colors ' + (inRoster ? 'bg-secondary/10 text-secondary border-secondary/30' : 'bg-surface-container-highest text-on-surface-variant border-outline-variant/20 hover:text-on-surface')}
                          >
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={customName}
                        onChange={function(e) { setCustomName(e.target.value); }}
                        onKeyDown={function(e) { if (e.key === 'Enter') addPlayerToRoster(customName); }}
                        placeholder="Add custom player name"
                        className="flex-1 bg-surface-container-lowest border-0 focus:ring-1 focus:ring-primary text-on-surface font-mono text-sm p-2.5 outline-none"
                      />
                      <button
                        onClick={function() { addPlayerToRoster(customName); }}
                        className="px-4 py-2.5 bg-surface-container-highest text-on-surface font-sans-condensed text-xs uppercase tracking-wide hover:text-primary transition-colors"
                      >
                        Add
                      </button>
                    </div>
                    {scrimRoster.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {scrimRoster.map(function(p) {
                          return (
                            <div key={p.id} className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 border border-primary/20 rounded-sm">
                              <span className="text-[11px] font-mono text-primary">{p.name}</span>
                              <button
                                onClick={function() { setScrimRoster(function(r) { return r.filter(function(x) { return x.id !== p.id; }); }); }}
                                className="text-primary/40 hover:text-primary text-sm leading-none bg-transparent border-0 cursor-pointer p-0"
                              >
                                x
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={createSession}
                    className="w-full py-4 mt-2 bg-surface-variant text-on-surface font-sans-condensed font-bold uppercase tracking-widest rounded-full hover:bg-primary hover:text-on-primary transition-all duration-300 flex items-center justify-center gap-2 border border-outline-variant/20"
                    type="button"
                  >
                    <Icon name="rocket_launch" size={16} className="text-current"/>
                    Create Lobby
                  </button>
                </div>
              </div>

              {/* Win Rate Stat Card */}
              {scrimStats.length > 0 && (
                <div className="bg-surface-container-low p-6 rounded-sm flex justify-between items-center">
                  <div>
                    <div className="text-[10px] font-sans-condensed text-on-surface-variant tracking-widest uppercase mb-1">
                      {scrimStats[0].name} Win Rate
                    </div>
                    <div className="font-display text-4xl text-primary">
                      {scrimStats[0].winRate}%
                    </div>
                    <div className="text-[10px] font-sans-condensed text-on-surface-variant mt-1">{scrimStats[0].games} games played</div>
                  </div>
                  <div className="w-16 h-16 rounded-full border-4 border-surface-container-highest border-t-primary rotate-45"/>
                </div>
              )}

            </div>

            {/* Right column: Lobbies list */}
            <div className="col-span-12 lg:col-span-8">
              <div className="bg-surface-container-low rounded-sm overflow-hidden flex flex-col min-h-[380px]">
                <div className="px-6 py-4 bg-surface-container flex justify-between items-center">
                  <h2 className="font-serif text-2xl font-bold">Live Lobbies</h2>
                  <button
                    onClick={reloadScrims}
                    className="p-2 bg-surface-container-highest rounded-sm hover:text-primary transition-colors"
                    title="Refresh"
                  >
                    <Icon name="refresh" size={16} className="text-current"/>
                  </button>
                </div>

                {dbLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest">Loading...</div>
                  </div>
                ) : safeSessions.filter(function(s) { return s.active; }).length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
                    <Icon name="sports_esports" size={40} className="text-on-surface-variant opacity-30"/>
                    <div className="text-sm font-sans-condensed text-on-surface-variant uppercase tracking-widest">No active lobbies</div>
                    <div className="text-xs text-on-surface-variant/60 text-center">Initialize a scrim on the left to get started.</div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {safeSessions.filter(function(s) { return s.active; }).map(function(s) {
                      var isFull = s.games.length >= s.targetGames;
                      var playerCount = s.playerIds.length;
                      var statusLabel = isFull ? 'Full' : s.games.length > 0 ? 'Live' : 'Recruiting';
                      var statusColor = isFull ? 'text-primary-container' : s.games.length > 0 ? 'text-tertiary' : 'text-primary';
                      var statusBg = isFull ? 'bg-primary-container/20' : s.games.length > 0 ? 'bg-tertiary/10' : 'bg-primary/10';
                      var iconName = s.games.length > 0 ? 'groups' : 'public';
                      return (
                        <div
                          key={s.id}
                          className={'bg-surface-container-high p-4 flex items-center justify-between group hover:translate-x-1 transition-transform cursor-pointer' + (activeId === s.id ? ' ring-1 ring-primary/40' : '')}
                          onClick={function() { setActiveId(s.id); }}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-surface-container-lowest flex items-center justify-center border border-outline-variant/10 flex-shrink-0">
                              <Icon name={iconName} size={20} className="text-tertiary"/>
                            </div>
                            <div>
                              <div className="font-mono text-sm text-on-surface font-bold uppercase">{s.name}</div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className={'text-[10px] font-sans-condensed px-2 py-0.5 rounded-sm uppercase tracking-widest ' + statusBg + ' ' + statusColor}>{statusLabel}</span>
                                <span className="text-[10px] font-sans-condensed text-on-surface-variant tracking-widest uppercase">{s.games.length}/{s.targetGames} GAMES</span>
                                {playerCount > 0 && (
                                  <span className="text-[10px] font-sans-condensed text-on-surface-variant tracking-widest uppercase">{playerCount} PLAYERS</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="hidden sm:block text-right">
                              <div className="text-[9px] font-sans-condensed text-on-surface-variant uppercase tracking-widest">Created</div>
                              <div className="font-mono text-sm">{s.createdAt}</div>
                            </div>
                            <button
                              onClick={function(e) { e.stopPropagation(); setActiveId(s.id); setScrimResults({}); setTab('play'); }}
                              className="px-4 py-2 rounded-full bg-primary text-on-primary font-sans-condensed font-bold text-xs uppercase hover:scale-105 transition-all"
                            >
                              Play
                            </button>
                            {isFull && (
                              <button
                                onClick={function(e) { e.stopPropagation(); stopSession(s.id); }}
                                className="px-4 py-2 rounded-full border border-error/30 text-error font-sans-condensed font-bold text-xs uppercase hover:bg-error/10 transition-all"
                              >
                                End
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Completed sessions section */}
              {safeSessions.filter(function(s) { return !s.active; }).length > 0 && (
                <div className="bg-surface-container-low rounded-sm overflow-hidden mt-4">
                  <div className="px-6 py-4 bg-surface-container flex justify-between items-center">
                    <h2 className="font-serif text-lg font-bold text-on-surface-variant">Completed Sessions</h2>
                    <span className="text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest">{safeSessions.filter(function(s) { return !s.active; }).length} ended</span>
                  </div>
                  <div className="p-4 space-y-2">
                    {safeSessions.filter(function(s) { return !s.active; }).map(function(s) {
                      return (
                        <div
                          key={s.id}
                          className="bg-surface-container-high p-4 flex items-center justify-between opacity-70 hover:opacity-90 transition-opacity cursor-pointer"
                          onClick={function() { setActiveId(s.id); setTab('history'); }}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-surface-container-lowest flex items-center justify-center border border-outline-variant/10 flex-shrink-0">
                              <Icon name="check_circle" size={16} className="text-on-surface-variant"/>
                            </div>
                            <div>
                              <div className="font-mono text-sm text-on-surface-variant font-bold uppercase">{s.name}</div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest">{s.games.length} games - {s.createdAt}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={function(e) { e.stopPropagation(); setTab('history'); }}
                              className="px-3 py-1.5 rounded-full border border-outline-variant/30 text-on-surface-variant font-sans-condensed font-bold text-xs uppercase hover:text-on-surface transition-colors"
                            >
                              Review
                            </button>
                            {(isAdmin || (currentUser && s.createdBy === currentUser.auth_user_id)) && (
                              <button
                                onClick={function(e) { e.stopPropagation(); setConfirmDelete({type: 'session', id: s.id, name: s.name}); }}
                                className="p-1.5 text-error/40 hover:text-error transition-colors"
                                title="Delete session"
                              >
                                <Icon name="delete" size={14} className="text-current"/>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PLAY TAB ── */}
        {tab === 'play' && (
          <div className="bg-surface-container-low rounded-sm overflow-hidden">
            <div className="px-6 py-4 bg-surface-container flex justify-between items-center">
              <h2 className="font-serif text-2xl font-bold">Record Game</h2>
              <button
                onClick={function() { setTab('lobbies'); }}
                className="p-2 bg-surface-container-highest rounded-sm hover:text-primary transition-colors"
              >
                <Icon name="close" size={16} className="text-current"/>
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="space-y-4">

                {/* Lobby selector */}
                <div>
                  <label className="block text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-2">Active Lobby</label>
                  <select
                    value={activeId || ''}
                    onChange={function(e) {
                      var val = e.target.value || null;
                      setActiveId(val);
                      setScrimResults({});
                      // When selecting an existing lobby, clear the create-form roster
                      // so sessionRoster will derive from DB players
                      if (val) setScrimRoster([]);
                    }}
                    className="w-full bg-surface-container-lowest border-0 focus:ring-1 focus:ring-primary text-on-surface font-mono text-sm p-3 outline-none"
                  >
                    <option value="">- Select lobby -</option>
                    {safeSessions.filter(function(s) { return s.active; }).map(function(s) {
                      return <option key={s.id} value={s.id}>{s.name} ({s.games.length}/{s.targetGames})</option>;
                    })}
                  </select>
                </div>

                {/* Roster display/editor */}
                {activeId && (
                  <div>
                    <label className="block text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-2">
                      Roster ({rosterForGame.length} players)
                    </label>
                    {/* Pill list of players from the context */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {players.map(function(p) {
                        var inRoster = rosterForGame.find(function(r) { return String(r.id) === String(p.id); });
                        return (
                          <button
                            key={p.id}
                            onClick={function() {
                              if (inRoster) {
                                // If roster is from DB, we need to work with scrimRoster override
                                if (session && session.playerIds.length > 0) {
                                  // Build a local override from the session roster minus this player
                                  var overrideRoster = rosterForGame.filter(function(r) { return String(r.id) !== String(p.id); });
                                  setScrimRoster(overrideRoster);
                                } else {
                                  setScrimRoster(function(r) { return r.filter(function(x) { return String(x.id) !== String(p.id); }); });
                                }
                                // Clear any placement result for this player
                                setScrimResults(function(prev) {
                                  var next = Object.assign({}, prev);
                                  delete next[p.id];
                                  return next;
                                });
                              } else {
                                if (session && session.playerIds.length > 0 && scrimRoster.length === 0) {
                                  // Initialize override from existing session roster
                                  setScrimRoster(rosterForGame.concat([p]));
                                } else {
                                  setScrimRoster(function(r) { return r.concat([p]); });
                                }
                              }
                            }}
                            className={'text-[10px] font-sans-condensed uppercase px-2 py-1 rounded-sm border transition-colors ' + (inRoster ? 'bg-primary/10 text-primary border-primary/30' : 'bg-surface-container-highest text-on-surface-variant border-outline-variant/20 hover:text-on-surface')}
                          >
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customName}
                        onChange={function(e) { setCustomName(e.target.value); }}
                        onKeyDown={function(e) { if (e.key === 'Enter') addPlayerToRoster(customName); }}
                        placeholder="Add custom player name"
                        className="flex-1 bg-surface-container-lowest border-0 focus:ring-1 focus:ring-primary text-on-surface font-mono text-sm p-2.5 outline-none"
                      />
                      <button
                        onClick={function() { addPlayerToRoster(customName); }}
                        className="px-4 py-2.5 bg-surface-container-highest text-on-surface font-sans-condensed text-xs uppercase tracking-wide hover:text-primary transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}

                {rosterForGame.length >= 2 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest">
                        Game {session ? session.games.length + 1 : 1}{session ? ' / ' + session.targetGames : ''}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={'font-mono text-base font-bold w-14 ' + (timerActive ? 'text-primary' : 'text-on-surface-variant/40')}>{fmt(timer)}</div>
                        <button
                          onClick={function() { setTimerActive(function(t) { return !t; }); }}
                          className="px-3 py-1.5 bg-surface-container-highest text-on-surface font-sans-condensed text-xs uppercase tracking-wide hover:text-primary transition-colors"
                        >
                          {timerActive ? 'Pause' : 'Start'}
                        </button>
                        <button
                          onClick={function() { setTimer(0); setTimerActive(false); }}
                          className="px-3 py-1.5 bg-surface-container-highest text-on-surface font-sans-condensed text-xs uppercase tracking-wide hover:text-primary transition-colors"
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-1">Tag</label>
                        <select
                          value={gameTag}
                          onChange={function(e) { setGameTag(e.target.value); }}
                          className="w-full bg-surface-container-lowest border-0 focus:ring-1 focus:ring-primary text-on-surface font-mono text-sm p-3 outline-none"
                        >
                          {['standard', 'draft comp', 'test run', 'ranked sim', 'meta test'].map(function(t) {
                            return <option key={t} value={t}>{t}</option>;
                          })}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-1">Note</label>
                        <input
                          type="text"
                          value={gameNote}
                          onChange={function(e) { setGameNote(e.target.value); }}
                          placeholder="comp, pivot, notes..."
                          className="w-full bg-surface-container-lowest border-0 focus:ring-1 focus:ring-primary text-on-surface font-mono text-sm p-3 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-3">
                        Placements ({placedCount}/{rosterForGame.length} set)
                      </label>
                      <PlacementBoard
                        roster={rosterForGame}
                        results={scrimResults}
                        onPlace={function(pid, place) { setScrimResults(function(r) { return Object.assign({}, r, {[pid]: place}); }); }}
                      />
                    </div>

                    <button
                      onClick={lockGame}
                      disabled={!allPlaced}
                      className="w-full py-4 bg-primary text-on-primary font-sans-condensed font-bold uppercase tracking-widest rounded-full hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Icon name="lock" size={16} className="text-current"/>
                      Lock Game - {placedCount}/{rosterForGame.length} placed
                    </button>

                    {session && session.active && (
                      <button
                        onClick={function() { stopSession(session.id); }}
                        className="w-full py-3 border border-error/30 text-error font-sans-condensed font-bold uppercase tracking-widest rounded-full hover:bg-error/10 transition-colors text-sm"
                      >
                        End Session
                      </button>
                    )}
                  </div>
                )}

                {activeId && rosterForGame.length < 2 && (
                  <div className="bg-surface-container-high p-6 text-center rounded-sm">
                    <Icon name="group_add" size={28} className="text-on-surface-variant opacity-40 mb-2"/>
                    <div className="text-xs text-on-surface-variant font-sans-condensed uppercase tracking-widest">Add at least 2 players to the roster above</div>
                  </div>
                )}

                {!activeId && (
                  <div className="bg-surface-container-high p-6 text-center rounded-sm">
                    <Icon name="sports_esports" size={28} className="text-on-surface-variant opacity-40 mb-2"/>
                    <div className="text-xs text-on-surface-variant font-sans-condensed uppercase tracking-widest">Select a lobby above to start recording</div>
                  </div>
                )}

              </div>

              {/* Recent games sidebar */}
              <div>
                <div className="text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-4">
                  {session ? session.name + ' - Games' : 'Recent Games'}
                </div>
                {(session ? session.games : allGames).length === 0 ? (
                  <div className="bg-surface-container-high p-8 text-center">
                    <Icon name="sports_esports" size={32} className="text-on-surface-variant opacity-30 mb-3"/>
                    <div className="text-xs text-on-surface-variant font-sans-condensed uppercase tracking-widest">No games logged yet</div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[560px] overflow-y-auto">
                    {(session ? session.games.slice().reverse() : allGames.slice().reverse()).slice(0, 10).map(function(g, gi) {
                      var sorted = Object.entries(g.results).sort(function(a, b) { return a[1] - b[1]; });
                      return (
                        <div key={g.id} className="bg-surface-container-high p-4">
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex gap-2 items-center">
                              <span className="font-mono text-xs font-bold text-primary">G{g.gameNumber || (gi + 1)}</span>
                              {g.tag !== 'standard' && (
                                <span className="text-[10px] font-sans-condensed bg-secondary/10 text-secondary px-2 py-0.5 rounded-sm uppercase">{g.tag}</span>
                              )}
                              {g.duration > 0 && <span className="font-mono text-[10px] text-on-surface-variant">{fmt(g.duration)}</span>}
                            </div>
                            {(isAdmin || (currentUser && session && session.createdBy === currentUser.auth_user_id)) && (
                              <button
                                onClick={function() { setConfirmDelete({type: 'game', id: g.id}); }}
                                className="text-error/30 hover:text-error transition-colors p-1"
                                title="Delete game"
                              >
                                <Icon name="delete" size={12} className="text-current"/>
                              </button>
                            )}
                          </div>
                          {g.note && <div className="text-[10px] text-on-surface-variant mb-2 italic">"{g.note}"</div>}
                          <div className="space-y-1">
                            {sorted.map(function(entry) {
                              var pid = entry[0], place = entry[1];
                              var p = allPlayers.find(function(pl) { return String(pl.id) === String(pid); });
                              if (!p) return null;
                              var c = place === 1 ? '#E8A838' : place === 2 ? '#C0C0C0' : place === 3 ? '#CD7F32' : place <= 4 ? '#4ECDC4' : '#F87171';
                              return (
                                <div key={pid} className="flex items-center justify-between">
                                  <span className="text-xs truncate flex-1" style={{color: place <= 4 ? '#D1C9BC' : 'rgba(255,255,255,0.3)', fontWeight: place <= 4 ? 600 : 400}}>{p.name}</span>
                                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 ml-2" style={{background: c + '22', border: '1px solid ' + c + '55'}}>
                                    <span className="font-mono text-[11px] font-bold" style={{color: c}}>{place}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── H2H PERFORMANCE MATRIX ── */}
        {tab === 'stats' && scrimStats.length >= 2 && (
          <div className="bg-surface-container-low p-8 rounded-sm">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h2 className="font-serif text-3xl font-black mb-1">H2H Performance Matrix</h2>
                <p className="text-xs font-sans-condensed uppercase tracking-widest text-on-surface-variant">Player Matchups &amp; Win/Loss Ratios</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-tertiary"/>
                  <span className="text-[10px] font-sans-condensed uppercase text-on-surface-variant">Positive</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-error"/>
                  <span className="text-[10px] font-sans-condensed uppercase text-on-surface-variant">Negative</span>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1 min-w-[400px]">
                <thead>
                  <tr>
                    <th className="p-4 bg-surface-container-lowest"/>
                    {scrimStats.map(function(p) {
                      return (
                        <th key={p.id} className="p-4 bg-surface-container-lowest text-center">
                          <div className="font-sans-condensed uppercase text-[10px] text-on-surface-variant tracking-tighter">Player</div>
                          <div className="font-mono text-sm">{p.name}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {scrimStats.map(function(rowP) {
                    return (
                      <tr key={rowP.id}>
                        <td className="p-4 bg-surface-container-lowest font-mono text-sm font-bold whitespace-nowrap">{rowP.name}</td>
                        {scrimStats.map(function(colP) {
                          if (String(rowP.id) === String(colP.id)) {
                            return <td key={colP.id} className="p-4 bg-surface-container-highest/50 text-center text-on-surface-variant">-</td>;
                          }
                          var rowKey = String(rowP.id), colKey = String(colP.id);
                          var rec = h2hData[rowKey] && h2hData[rowKey][colKey];
                          if (!rec || rec.total === 0) {
                            return <td key={colP.id} className="p-4 bg-surface-container-high text-center text-on-surface-variant/40 text-xs">-</td>;
                          }
                          var wr = rec.wins / rec.total;
                          var isPositive = wr >= 0.6;
                          var isNegative = wr <= 0.4;
                          var bgClass = isPositive ? 'bg-tertiary/10 border border-tertiary/20' : isNegative ? 'bg-error/10 border border-error/20' : 'bg-surface-container-high';
                          var textColor = isPositive ? 'text-tertiary' : isNegative ? 'text-error' : 'text-on-surface-variant';
                          var subColor = isPositive ? 'text-tertiary/60' : isNegative ? 'text-error/60' : 'text-on-surface-variant/60';
                          return (
                            <td key={colP.id} className={'p-4 text-center ' + bgClass}>
                              <div className={'font-mono font-bold text-sm ' + textColor}>{rec.wins}-{rec.total - rec.wins}</div>
                              <div className={'text-[10px] ' + subColor}>{Math.round(wr * 100)}% WR</div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── STATS PANEL ── */}
        {tab === 'stats' && scrimStats.length > 0 && (
          <div className="bg-surface-container-low rounded-sm overflow-hidden">
            <div className="px-6 py-4 bg-surface-container">
              <h2 className="font-serif text-2xl font-bold">Player Statistics</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  {label: 'Games Logged', val: allGames.length, color: 'text-secondary'},
                  {label: 'Sessions', val: safeSessions.length, color: 'text-primary'},
                  {label: 'Players Tracked', val: scrimStats.length, color: 'text-tertiary'},
                  {label: 'Avg Game Time', val: allGames.length > 0 ? fmt(Math.round(allGames.reduce(function(s, g) { return s + g.duration; }, 0) / allGames.length)) : '-', color: 'text-on-surface'}
                ].map(function(item) {
                  return (
                    <div key={item.label} className="bg-surface-container-high p-4 text-center">
                      <div className={'font-mono text-2xl font-bold ' + item.color}>{item.val}</div>
                      <div className="text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mt-1">{item.label}</div>
                    </div>
                  );
                })}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-1 min-w-[480px]">
                  <thead>
                    <tr>
                      <th className="p-3 bg-surface-container-lowest text-left text-[10px] font-sans-condensed font-bold text-on-surface-variant uppercase tracking-widest">#</th>
                      <th className="p-3 bg-surface-container-lowest text-left text-[10px] font-sans-condensed font-bold text-on-surface-variant uppercase tracking-widest">Player</th>
                      {['AVG', 'WIN%', 'TOP4%', 'BEST', 'WORST', 'PTS'].map(function(h) {
                        return <th key={h} className="p-3 bg-surface-container-lowest text-center text-[10px] font-sans-condensed font-bold text-on-surface-variant uppercase tracking-widest">{h}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {scrimStats.map(function(p, i) {
                      var avgC = parseFloat(p.avg) < 3 ? 'text-emerald-400' : parseFloat(p.avg) <= 5 ? 'text-yellow-400' : 'text-rose-400';
                      var rankColor = i === 0 ? '#E8A838' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'rgba(255,255,255,0.3)';
                      return (
                        <tr key={p.id} className={i === 0 ? 'bg-primary/5' : ''}>
                          <td className="p-3 font-mono text-sm font-bold text-center" style={{color: rankColor}}>{i + 1}</td>
                          <td className="p-3 bg-surface-container-high">
                            <div className="font-bold text-sm text-on-surface">{p.name}</div>
                            <div className="text-[10px] text-on-surface-variant font-sans-condensed">{p.games}g</div>
                            <div className="flex gap-0.5 flex-wrap mt-1">
                              {p.placements.slice(-8).map(function(pl, pi) {
                                var c = pl === 1 ? '#E8A838' : pl === 2 ? '#C0C0C0' : pl === 3 ? '#CD7F32' : pl <= 4 ? '#4ECDC4' : '#F87171';
                                return (
                                  <div key={pi} className="w-4 h-4 flex items-center justify-center" style={{background: c + '22', border: '1px solid ' + c + '55'}}>
                                    <span className="font-mono text-[9px] font-bold" style={{color: c}}>{pl}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                          <td className={'p-3 font-mono text-sm font-bold text-center bg-surface-container-high ' + avgC}>{p.avg}</td>
                          <td className="p-3 font-mono text-xs font-semibold text-center bg-surface-container-high text-emerald-400">{p.winRate}%</td>
                          <td className="p-3 font-mono text-xs font-semibold text-center bg-surface-container-high text-secondary">{p.top4Rate}%</td>
                          <td className="p-3 font-mono text-xs font-semibold text-center bg-surface-container-high text-tertiary">#{p.best}</td>
                          <td className="p-3 font-mono text-xs font-semibold text-center bg-surface-container-high text-rose-400">#{p.worst}</td>
                          <td className="p-3 font-mono text-xs font-bold text-center bg-surface-container-high text-primary">{p.pts}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'stats' && scrimStats.length === 0 && (
          <div className="bg-surface-container-low p-12 rounded-sm text-center">
            <Icon name="analytics" size={40} className="text-on-surface-variant opacity-30 mb-4"/>
            <div className="text-sm font-sans-condensed text-on-surface-variant uppercase tracking-widest">No stats yet - record some games first</div>
          </div>
        )}

        {/* ── HISTORY PANEL ── */}
        {tab === 'history' && (
          <div className="bg-surface-container-low rounded-sm overflow-hidden">
            <div className="px-6 py-4 bg-surface-container flex justify-between items-center">
              <h2 className="font-serif text-2xl font-bold">Session History</h2>
              <span className="text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest">{safeSessions.length} sessions</span>
            </div>
            {allGames.length === 0 ? (
              <div className="p-12 text-center">
                <Icon name="history" size={40} className="text-on-surface-variant opacity-30 mb-4"/>
                <div className="text-sm font-sans-condensed text-on-surface-variant uppercase tracking-widest">No games recorded yet</div>
              </div>
            ) : (
              <div className="p-6 space-y-8">
                {safeSessions.map(function(sess) {
                  if (sess.games.length === 0) return null;
                  // Collect all unique player IDs from the session's game results
                  var sessPlayerIds = sess.games.flatMap(function(g) { return Object.keys(g.results); }).filter(function(pid, idx, arr) { return arr.indexOf(pid) === idx; });
                  return (
                    <div key={sess.id}>
                      <div className="flex items-center gap-3 flex-wrap mb-4">
                        <h3 className="font-mono text-sm font-bold text-on-surface uppercase">{sess.name}</h3>
                        <span className={'text-[10px] font-sans-condensed px-2 py-0.5 rounded-sm uppercase tracking-widest ' + (sess.active ? 'bg-tertiary/10 text-tertiary' : 'bg-on-surface-variant/10 text-on-surface-variant')}>{sess.active ? 'Active' : 'Ended'}</span>
                        <span className="text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest">{sess.games.length} games - {sess.createdAt}</span>
                        {sess.notes && <span className="text-xs text-on-surface-variant italic">{sess.notes}</span>}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-separate border-spacing-0.5 min-w-[420px]">
                          <thead>
                            <tr>
                              <th className="p-3 text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-widest bg-surface-container-lowest whitespace-nowrap">Player</th>
                              {sess.games.map(function(g, gi) {
                                return (
                                  <th key={g.id} className="p-3 text-center text-[10px] font-bold text-on-surface-variant uppercase tracking-widest bg-surface-container-lowest whitespace-nowrap">
                                    G{gi + 1}
                                    {g.tag !== 'standard' && <div className="text-[8px] text-secondary normal-case tracking-normal font-normal">{g.tag}</div>}
                                  </th>
                                );
                              })}
                              <th className="p-3 text-center text-[10px] font-bold uppercase tracking-widest bg-surface-container-lowest text-primary">Avg</th>
                              <th className="p-3 text-center text-[10px] font-bold uppercase tracking-widest bg-surface-container-lowest text-tertiary">Pts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sessPlayerIds.map(function(pid, pidIdx) {
                              var p = allPlayers.find(function(pl) { return String(pl.id) === String(pid); });
                              if (!p) return null;
                              var placements = sess.games.map(function(g) { return g.results[pid]; });
                              var validPl = placements.filter(function(v) { return v != null; });
                              var avg = validPl.length > 0 ? (validPl.reduce(function(s, v) { return s + v; }, 0) / validPl.length).toFixed(2) : '-';
                              var pts = validPl.reduce(function(s, v) { return s + (PTS[v] || 0); }, 0);
                              return (
                                <tr key={pid} className={'border-b border-outline-variant/5' + (pidIdx % 2 === 0 ? ' bg-surface-container-high/30' : '')}>
                                  <td className="p-3">
                                    <span className="font-mono text-sm font-bold text-on-surface">{p.name}</span>
                                  </td>
                                  {placements.map(function(place, pi) {
                                    var c = place == null ? 'rgba(255,255,255,0.2)' : place === 1 ? '#E8A838' : place === 2 ? '#C0C0C0' : place === 3 ? '#CD7F32' : place <= 4 ? '#4ECDC4' : '#F87171';
                                    return (
                                      <td key={pi} className="p-1.5 text-center">
                                        {place != null ? (
                                          <div className="w-7 h-7 inline-flex items-center justify-center mx-auto" style={{background: c + '22', border: '1px solid ' + c + '55'}}>
                                            <span className="font-mono text-xs font-bold" style={{color: c}}>{place}</span>
                                          </div>
                                        ) : <span className="text-on-surface/20 text-xs">-</span>}
                                      </td>
                                    );
                                  })}
                                  <td className="p-3 text-center">
                                    <span className="font-mono text-sm font-bold" style={{color: parseFloat(avg) < 3 ? '#4ade80' : parseFloat(avg) <= 5 ? '#facc15' : '#f87171'}}>{avg}</span>
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className="font-mono text-sm font-bold text-primary">{pts}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-surface-container-highest/50 border-t border-outline-variant/10">
                              <td className="p-3 text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Notes</td>
                              {sess.games.map(function(g) {
                                return (
                                  <td key={g.id} className="p-2 text-center text-[10px] text-secondary max-w-[60px]">
                                    {g.note || '-'}
                                  </td>
                                );
                              })}
                              <td/><td/>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── CONFIRM DELETE MODAL ── */}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-surface-container-low p-8 rounded-sm max-w-sm w-full mx-4 shadow-2xl">
              <div className="font-serif text-xl font-bold text-on-surface mb-3">
                {confirmDelete.type === 'game' ? 'Delete Game?' : 'Delete Session?'}
              </div>
              <p className="text-sm text-on-surface-variant mb-6">
                {confirmDelete.type === 'game'
                  ? 'This will permanently delete the game and all its results.'
                  : 'This will permanently delete the session "' + confirmDelete.name + '" and all its games.'}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={function() { setConfirmDelete(null); }}
                  className="px-5 py-2.5 font-sans-condensed text-xs uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={function() {
                    if (confirmDelete.type === 'game') deleteGame(confirmDelete.id);
                    else deleteSession(confirmDelete.id);
                  }}
                  className="px-5 py-2.5 bg-error text-on-error font-sans-condensed text-xs uppercase tracking-widest font-bold rounded-sm hover:opacity-90 transition-opacity"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PageLayout>
  );
}
