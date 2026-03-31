import { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase.js'
import { PTS } from '../lib/constants.js'
import PageLayout from '../components/layout/PageLayout'
import Icon from '../components/ui/Icon'

// ── Bar Trend (replaces line sparkline) ──────────────────────────────────────
function ScrimTrend(props) {
  var placements = props.placements;
  if (!placements || placements.length === 0) return null;
  var last = placements.slice(-8);
  var maxH = 28;
  return (
    <div className="flex items-end gap-px flex-shrink-0" style={{height: maxH + 'px'}}>
      {last.map(function(pl, i) {
        var barH = Math.max(3, Math.round(((9 - pl) / 8) * maxH));
        var c = pl === 1 ? '#E8A838' : pl === 2 ? '#C0C0C0' : pl === 3 ? '#CD7F32' : pl <= 4 ? '#4ECDC4' : pl <= 6 ? '#facc15' : '#f87171';
        return (
          <div key={i} style={{
            width: '5px', height: barH + 'px', background: c,
            opacity: 0.35 + (i / Math.max(last.length - 1, 1)) * 0.65,
            borderRadius: '2px 2px 0 0'
          }}/>
        );
      })}
    </div>
  );
}

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
              <div className="flex items-center gap-2 pl-26" style={{paddingLeft: '104px'}}>
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

function submitScrimResult(scrimId, gameNumber, results, tag, note, duration) {
  return supabase.from('scrim_games').insert({
    scrim_id: scrimId, game_number: gameNumber, status: 'completed',
    tag: tag || 'standard', note: note || null, duration: duration || 0
  }).select().single().then(function(res) {
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

// ── ScrimsScreen ──────────────────────────────────────────────────────────────
export default function ScrimsScreen() {
  var ctx = useApp();
  var players = ctx.players;
  var toast = ctx.toast;
  var currentUser = ctx.currentUser;
  var isAdmin = ctx.isAdmin;
  var scrimAccess = ctx.scrimAccess;
  var scrimHostAccess = ctx.scrimHostAccess || [];

  var _tab = useState('lobbies'); var tab = _tab[0]; var setTab = _tab[1];
  var _statsTab = useState('players'); var statsTab = _statsTab[0]; var setStatsTab = _statsTab[1];
  var _activeId = useState(null); var activeId = _activeId[0]; var setActiveId = _activeId[1];

  // Create form
  var _newName = useState(''); var newName = _newName[0]; var setNewName = _newName[1];
  var _newNotes = useState(''); var newNotes = _newNotes[0]; var setNewNotes = _newNotes[1];
  var _newTarget = useState('5'); var newTarget = _newTarget[0]; var setNewTarget = _newTarget[1];
  var _scrimRoster = useState([]); var scrimRoster = _scrimRoster[0]; var setScrimRoster = _scrimRoster[1];

  // Record game
  var _scrimResults = useState({}); var scrimResults = _scrimResults[0]; var setScrimResults = _scrimResults[1];
  var _gameComps = useState({}); var gameComps = _gameComps[0]; var setGameComps = _gameComps[1];
  var _gameNote = useState(''); var gameNote = _gameNote[0]; var setGameNote = _gameNote[1];
  var _gameTag = useState('standard'); var gameTag = _gameTag[0]; var setGameTag = _gameTag[1];
  var _timer = useState(0); var timer = _timer[0]; var setTimer = _timer[1];
  var _timerActive = useState(false); var timerActive = _timerActive[0]; var setTimerActive = _timerActive[1];
  var timerRef = useRef(null);

  // Edit game
  var _editGame = useState(null); var editGame = _editGame[0]; var setEditGame = _editGame[1];

  // Delete confirm
  var _confirmDelete = useState(null); var confirmDelete = _confirmDelete[0]; var setConfirmDelete = _confirmDelete[1];

  // History expand
  var _expandedSession = useState(null); var expandedSession = _expandedSession[0]; var setExpandedSession = _expandedSession[1];

  // DB
  var _dbScrims = useState([]); var dbScrims = _dbScrims[0]; var setDbScrims = _dbScrims[1];
  var _dbLoading = useState(true); var dbLoading = _dbLoading[0]; var setDbLoading = _dbLoading[1];

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
    });
    return function() { cancelled = true; };
  }, [currentUser]);

  function reloadScrims() {
    if (!currentUser) return;
    loadScrims().then(function(res) { if (!res.error) setDbScrims(res.data || []); });
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
      return {id: g.id, results: results, comps: comps, note: g.note || '', tag: g.tag || 'standard', duration: g.duration || 0, ts: new Date(g.created_at).getTime(), gameNumber: g.game_number};
    }).sort(function(a, b) { return a.gameNumber - b.gameNumber; });
    return {
      id: sc.id, name: sc.name, notes: sc.notes || '', targetGames: sc.target_games || 5,
      games: games, createdAt: new Date(sc.created_at).toLocaleDateString(),
      active: sc.status === 'active', createdBy: sc.created_by,
      playerIds: (sc.scrim_players || []).map(function(sp) { return sp.player_id; })
    };
  });

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
  var rosterForGame = sessionRoster.length > 0 ? sessionRoster : scrimRoster;
  var allGames = safeSessions.flatMap(function(s) { return s.games; });
  var placedCount = Object.keys(scrimResults).length;
  var allPlaced = rosterForGame.length > 0 && placedCount >= rosterForGame.length;

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
  }).filter(Boolean).sort(function(a, b) { return parseFloat(a.avg) - parseFloat(b.avg); });

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

  // Fns
  function createSession() {
    if (!newName.trim()) { toast('Name required', 'error'); return; }
    if (!currentUser) { toast('Login required', 'error'); return; }
    var authId = currentUser.auth_user_id;
    if (!authId) { toast('Auth session not found', 'error'); return; }
    createScrim(newName.trim(), authId, newNotes.trim(), parseInt(newTarget) || 5).then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
      var scrimId = res.data.id;
      var pids = scrimRoster.map(function(p) { return p.id; }).filter(Boolean);
      if (pids.length > 0) {
        addScrimPlayers(scrimId, pids).then(function() { reloadScrims(); });
      } else { reloadScrims(); }
      setActiveId(scrimId);
      setNewName(''); setNewNotes(''); setNewTarget('5');
      toast('Session created', 'success');
      setTab('record');
    });
  }


  function lockGame() {
    if (!activeId) { toast('Select a session first', 'error'); return; }
    if (!allPlaced) { toast('Set all placements first', 'error'); return; }
    var gameNum = session ? session.games.length + 1 : 1;
    var resultRows = Object.keys(scrimResults).map(function(pid) {
      return {playerId: pid, placement: scrimResults[pid], comp: gameComps[pid] || null};
    });
    submitScrimResult(activeId, gameNum, resultRows, gameTag, gameNote, timer).then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
      reloadScrims();
      setScrimResults({}); setGameComps({}); setGameNote(''); setTimer(0); setTimerActive(false);
      toast('Game locked', 'success');
    });
  }

  function stopSession(id) {
    endScrimDb(id).then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
      reloadScrims(); toast('Session ended', 'success');
    });
  }

  function saveEditGame() {
    if (!editGame) return;
    updateScrimGame(editGame.id, editGame.note, editGame.tag).then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
      reloadScrims(); setEditGame(null); toast('Game updated', 'success');
    });
  }

  function deleteGame(gameId) {
    deleteScrimGameDb(gameId).then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
      reloadScrims(); setConfirmDelete(null); toast('Game deleted', 'success');
    });
  }

  function deleteSession(sessionId) {
    deleteScrimDb(sessionId).then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return; }
      reloadScrims();
      if (activeId === sessionId) { setActiveId(null); setScrimRoster([]); setScrimResults({}); }
      setConfirmDelete(null); toast('Session deleted', 'success');
    });
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
  var isScrimHost = !!(currentUsername && scrimHostAccess.includes(currentUsername));
  var isScrimmer = !!(currentUsername && (scrimAccess || []).includes(currentUsername));
  var hasAccess = isAdmin || isScrimHost || isScrimmer;
  var canManage = isAdmin || isScrimHost;
  if (!hasAccess) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <Icon name="lock" size={32} className="text-on-surface-variant mb-4 opacity-40"/>
          <div className="font-serif text-2xl font-bold text-on-surface mb-2">Friends Only</div>
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
            <h1 className="font-serif text-5xl font-black text-on-surface tracking-tight">Practice Arena</h1>
            <p className="text-on-surface-variant text-sm mt-1">{allGames.length} games logged across {safeSessions.length} sessions</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {[
              {id: 'lobbies', icon: 'dashboard', label: 'Lobbies'},
              ...(canManage ? [{id: 'record', icon: 'sports_esports', label: 'Record'}] : []),
              {id: 'stats', icon: 'analytics', label: 'Statistics'},
              {id: 'history', icon: 'history', label: 'History'}
            ].map(function(t) {
              return (
                <button key={t.id} onClick={function() { setTab(t.id); }}
                  className={'flex items-center gap-1.5 px-3 py-2 font-sans-condensed text-xs uppercase tracking-widest transition-all ' + (tab === t.id ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface')}>
                  <Icon name={t.icon} size={13} className="text-current"/>{t.label}
                </button>
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
              <div className="bg-surface-container-low rounded-sm overflow-hidden">
                <div className="px-5 py-4 bg-surface-container">
                  <h2 className="font-serif text-xl font-bold">New Session</h2>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-1.5">Session Name</label>
                    <input type="text" value={newName} onChange={function(e) { setNewName(e.target.value); }}
                      onKeyDown={function(e) { if (e.key === 'Enter') createSession(); }}
                      placeholder="e.g. FRIDAY GRIND"
                      className="w-full bg-surface-container-highest border-0 text-on-surface font-mono text-sm p-3 outline-none focus:ring-1 focus:ring-primary"/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-1.5">Notes / Goal</label>
                    <input type="text" value={newNotes} onChange={function(e) { setNewNotes(e.target.value); }}
                      placeholder="Focus area, comps to test..."
                      className="w-full bg-surface-container-highest border-0 text-on-surface font-mono text-sm p-3 outline-none focus:ring-1 focus:ring-primary"/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-1.5">Target Games</label>
                    <select value={newTarget} onChange={function(e) { setNewTarget(e.target.value); }}
                      className="w-full bg-surface-container-highest border-0 text-on-surface font-mono text-sm p-3 outline-none focus:ring-1 focus:ring-primary">
                      {[1,2,3,4,5,6,7,8,10,12].map(function(n) { return <option key={n} value={n}>{n} games</option>; })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-1.5">Roster</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {players.map(function(p) {
                        var inRoster = scrimRoster.find(function(r) { return r.id === p.id; });
                        return (
                          <button key={p.id} onClick={function() {
                            if (inRoster) setScrimRoster(function(r) { return r.filter(function(x) { return x.id !== p.id; }); });
                            else setScrimRoster(function(r) { return r.concat([p]); });
                          }} className={'text-[10px] font-sans-condensed uppercase px-2 py-1 border transition-colors ' + (inRoster ? 'bg-primary/10 text-primary border-primary/30' : 'bg-surface-container-highest text-on-surface-variant border-outline-variant/20 hover:text-on-surface')}>
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
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
                  </div>
                  <button onClick={createSession}
                    className="w-full py-3 bg-primary text-on-primary font-sans-condensed font-bold uppercase tracking-widest text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                    <Icon name="add" size={16} className="text-current"/>Create Session
                  </button>
                </div>
              </div>
            </div>
            )}

            {/* Sessions list */}
            <div className={"col-span-12 " + (canManage ? "lg:col-span-8" : "") + " space-y-3"}>
              {dbLoading ? (
                <div className="bg-surface-container-low p-12 rounded-sm text-center text-on-surface-variant/40 font-sans-condensed text-xs uppercase tracking-widest">Loading...</div>
              ) : safeSessions.length === 0 ? (
                <div className="bg-surface-container-low p-16 rounded-sm flex flex-col items-center justify-center gap-3">
                  <Icon name="sports_esports" size={40} className="text-on-surface-variant opacity-20"/>
                  <div className="text-xs font-sans-condensed text-on-surface-variant uppercase tracking-widest">No sessions yet - create one to get started</div>
                </div>
              ) : (
                <>
                  {/* Active */}
                  {safeSessions.filter(function(s) { return s.active; }).length > 0 && (
                    <div>
                      <div className="text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-2 px-1">Active</div>
                      {safeSessions.filter(function(s) { return s.active; }).map(function(s) {
                        var progress = Math.min(s.games.length / s.targetGames, 1);
                        return (
                          <div key={s.id} className={'rounded-sm overflow-hidden mb-2 ' + (activeId === s.id ? 'ring-1 ring-primary/50' : '')}>
                            <div className="bg-surface-container-low p-4 flex items-center gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"/>
                                  <span className="font-mono text-sm font-bold text-on-surface uppercase">{s.name}</span>
                                  <span className="text-[10px] font-sans-condensed text-on-surface-variant">{s.createdAt}</span>
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
                                <button onClick={function() { setActiveId(s.id); setScrimResults({}); setTab('record'); }}
                                  className="px-4 py-2 bg-primary text-on-primary font-sans-condensed text-xs font-bold uppercase tracking-wide hover:opacity-90 transition-opacity">Record</button>
                              )}
                              {canManage && (
                                <button onClick={function() { stopSession(s.id); }}
                                  className="px-3 py-2 border border-error/30 text-error font-sans-condensed text-xs uppercase hover:bg-error/10 transition-colors">End</button>
                              )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Completed */}
                  {safeSessions.filter(function(s) { return !s.active; }).length > 0 && (
                    <div>
                      <div className="text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-2 px-1">Completed</div>
                      {safeSessions.filter(function(s) { return !s.active; }).map(function(s) {
                        return (
                          <div key={s.id} className="bg-surface-container-low rounded-sm p-4 flex items-center gap-4 mb-2 opacity-70 hover:opacity-100 transition-opacity">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-mono text-sm font-bold text-on-surface uppercase">{s.name}</span>
                                <span className="text-[10px] font-sans-condensed text-on-surface-variant">{s.createdAt}</span>
                              </div>
                              <span className="font-mono text-xs text-on-surface-variant">{s.games.length} games recorded</span>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <button onClick={function() { setTab('history'); setExpandedSession(s.id); }}
                                className="px-3 py-2 bg-surface-container-high text-on-surface-variant font-sans-condensed text-xs uppercase hover:text-on-surface transition-colors">View</button>
                              {isAdmin && (
                                <button onClick={function() { setConfirmDelete({type: 'session', id: s.id}); }}
                                  className="px-3 py-2 border border-error/20 text-error/50 font-sans-condensed text-xs uppercase hover:text-error hover:border-error/40 transition-colors">Del</button>
                              )}
                            </div>
                          </div>
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
              <div className="bg-surface-container-low rounded-sm p-5">
                <label className="block text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-2">Session</label>
                <select value={activeId || ''} onChange={function(e) { var v = e.target.value || null; setActiveId(v); setScrimResults({}); setGameComps({}); if (v) setScrimRoster([]); }}
                  className="w-full bg-surface-container-highest border-0 text-on-surface font-mono text-sm p-3 outline-none focus:ring-1 focus:ring-primary">
                  <option value="">- Select session -</option>
                  {safeSessions.filter(function(s) { return s.active; }).map(function(s) {
                    return <option key={s.id} value={s.id}>{s.name} ({s.games.length}/{s.targetGames})</option>;
                  })}
                </select>
                {!activeId && (
                  <p className="text-[10px] font-sans-condensed text-on-surface-variant mt-2">No active session? <button onClick={function() { setTab('lobbies'); }} className="text-primary underline underline-offset-2 bg-transparent border-0 cursor-pointer p-0 font-sans-condensed text-[10px]">Create one in Lobbies.</button></p>
                )}
              </div>

              {activeId && (
                <>
                  {/* Roster */}
                  <div className="bg-surface-container-low rounded-sm p-5">
                    <label className="block text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-3">Roster ({rosterForGame.length} players)</label>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {players.map(function(p) {
                        var inRoster = rosterForGame.find(function(r) { return String(r.id) === String(p.id); });
                        return (
                          <button key={p.id} onClick={function() {
                            if (inRoster) {
                              var override = rosterForGame.filter(function(r) { return String(r.id) !== String(p.id); });
                              setScrimRoster(override);
                              setScrimResults(function(prev) { var n = Object.assign({}, prev); delete n[p.id]; return n; });
                            } else {
                              setScrimRoster(session && session.playerIds.length > 0 && scrimRoster.length === 0 ? rosterForGame.concat([p]) : function(r) { return r.concat([p]); });
                            }
                          }} className={'text-[10px] font-sans-condensed uppercase px-2.5 py-1.5 border transition-colors ' + (inRoster ? 'bg-primary/10 text-primary border-primary/30' : 'bg-surface-container-highest text-on-surface-variant border-outline-variant/20 hover:text-on-surface')}>
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Game controls */}
                  <div className="bg-surface-container-low rounded-sm p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-sm text-on-surface-variant">
                        Game {session ? session.games.length + 1 : 1}{session ? ' / ' + session.targetGames : ''}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={'font-mono text-base font-bold w-14 ' + (timerActive ? 'text-primary' : 'text-on-surface-variant/40')}>{fmt(timer)}</div>
                        <button onClick={function() { setTimerActive(function(t) { return !t; }); }}
                          className="px-3 py-1.5 bg-surface-container-highest text-on-surface font-sans-condensed text-xs uppercase hover:text-primary transition-colors">{timerActive ? 'Pause' : 'Start'}</button>
                        <button onClick={function() { setTimer(0); setTimerActive(false); }}
                          className="px-3 py-1.5 bg-surface-container-highest text-on-surface font-sans-condensed text-xs uppercase hover:text-primary transition-colors">Reset</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-1.5">Tag</label>
                        <select value={gameTag} onChange={function(e) { setGameTag(e.target.value); }}
                          className="w-full bg-surface-container-highest border-0 text-on-surface font-mono text-sm p-2.5 outline-none">
                          {['standard','draft comp','test run','ranked sim','meta test'].map(function(t) { return <option key={t} value={t}>{t}</option>; })}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-1.5">Note</label>
                        <input type="text" value={gameNote} onChange={function(e) { setGameNote(e.target.value); }}
                          placeholder="comps, pivots, highlights..."
                          className="w-full bg-surface-container-highest border-0 text-on-surface font-mono text-sm p-2.5 outline-none"/>
                      </div>
                    </div>
                  </div>

                  {rosterForGame.length >= 2 && (
                    <div className="bg-surface-container-low rounded-sm p-5 space-y-5">
                      <div>
                        <label className="block text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-3">Placements — {placedCount}/{rosterForGame.length} set</label>
                        <PlacementBoard roster={rosterForGame} results={scrimResults}
                          onPlace={function(pid, place) { setScrimResults(function(r) { return Object.assign({}, r, {[pid]: place}); }); }}
                          comps={gameComps} onComp={function(pid, val) { setGameComps(function(c) { return Object.assign({}, c, {[pid]: val}); }); }}/>
                      </div>
                      <button onClick={lockGame} disabled={!allPlaced}
                        className="w-full py-3.5 bg-primary text-on-primary font-sans-condensed font-bold uppercase tracking-widest text-sm hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2">
                        <Icon name="lock" size={15} className="text-current"/>Lock Game
                      </button>
                      {session && session.active && (
                        <button onClick={function() { stopSession(session.id); }}
                          className="w-full py-2.5 border border-error/30 text-error font-sans-condensed text-xs uppercase tracking-widest hover:bg-error/10 transition-colors">
                          End Session
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Recent games sidebar */}
            <div className="col-span-12 xl:col-span-5">
              <div className="text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-3">
                {session ? session.name + ' - Games' : 'Recent Games'}
              </div>
              {(session ? session.games.slice().reverse() : allGames.slice().reverse()).slice(0, 8).length === 0 ? (
                <div className="bg-surface-container-low p-10 rounded-sm text-center">
                  <Icon name="sports_esports" size={32} className="text-on-surface-variant opacity-20 mb-3"/>
                  <div className="text-xs font-sans-condensed text-on-surface-variant uppercase tracking-widest">No games yet</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {(session ? session.games.slice().reverse() : allGames.slice().reverse()).slice(0, 8).map(function(g, gi) {
                    var sorted = Object.entries(g.results).sort(function(a, b) { return a[1] - b[1]; });
                    return (
                      <div key={g.id} className="bg-surface-container-low rounded-sm p-3.5">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex gap-2 items-center">
                            <span className="font-mono text-xs font-bold text-primary">G{g.gameNumber || (gi + 1)}</span>
                            {g.tag !== 'standard' && <span className="text-[9px] font-sans-condensed bg-secondary/10 text-secondary px-1.5 py-0.5 uppercase">{g.tag}</span>}
                            {g.duration > 0 && <span className="font-mono text-[10px] text-on-surface-variant/50">{fmt(g.duration)}</span>}
                          </div>
                          {isAdmin && (
                            <div className="flex gap-1">
                              <button onClick={function() { setEditGame({id: g.id, note: g.note, tag: g.tag}); }}
                                className="p-1 text-on-surface-variant/30 hover:text-primary transition-colors"><Icon name="edit" size={12} className="text-current"/></button>
                              <button onClick={function() { setConfirmDelete({type: 'game', id: g.id}); }}
                                className="p-1 text-on-surface-variant/30 hover:text-error transition-colors"><Icon name="delete" size={12} className="text-current"/></button>
                            </div>
                          )}
                        </div>
                        {g.note && <div className="text-[10px] text-on-surface-variant/50 mb-2 italic">"{g.note}"</div>}
                        <div className="space-y-1">
                          {sorted.map(function(entry) {
                            var pid = entry[0]; var place = entry[1];
                            var p = players.find(function(pl) { return String(pl.id) === String(pid); });
                            if (!p) return null;
                            var c = placeColor(place);
                            return (
                              <div key={pid} className="flex items-center justify-between gap-2">
                                <span className="text-xs truncate" style={{color: place <= 4 ? '#D1C9BC' : 'rgba(255,255,255,0.3)', fontWeight: place <= 4 ? 600 : 400}}>{p.name}</span>
                                {g.comps && g.comps[pid] && <span className="text-[9px] font-sans-condensed text-on-surface-variant/40 truncate flex-1 text-center">{g.comps[pid]}</span>}
                                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 font-mono text-[10px] font-bold" style={{background: c + '25', border: '1px solid ' + c + '55', color: c}}>{place}</div>
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
        )}

        {/* ════════════ STATISTICS TAB ════════════ */}
        {tab === 'stats' && (
          <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex gap-1">
              {[{id:'players',label:'Players'},{id:'comps',label:'Comps'}].map(function(t) {
                return (
                  <button key={t.id} onClick={function() { setStatsTab(t.id); }}
                    className={'px-5 py-2 font-sans-condensed text-xs uppercase tracking-widest border-b-2 transition-colors ' + (statsTab === t.id ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-on-surface')}>
                    {t.label}
                  </button>
                );
              })}
            </div>

            {statsTab === 'players' && scrimStats.length === 0 && (
              <div className="bg-surface-container-low p-16 rounded-sm text-center">
                <Icon name="analytics" size={40} className="text-on-surface-variant opacity-20 mb-4"/>
                <div className="text-xs font-sans-condensed text-on-surface-variant uppercase tracking-widest">Record games to unlock statistics</div>
              </div>
            )}

            {statsTab === 'players' && scrimStats.length > 0 && (
              <>
                {/* Hero strip */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                  {(function() {
                    var bestAvg = scrimStats[0];
                    var bestWR = scrimStats.slice().sort(function(a, b) { return parseFloat(b.winRate) - parseFloat(a.winRate); })[0];
                    var bestTop4 = scrimStats.slice().sort(function(a, b) { return parseFloat(b.top4Rate) - parseFloat(a.top4Rate); })[0];
                    var bestPts = scrimStats.slice().sort(function(a, b) { return b.pts - a.pts; })[0];
                    var bestStreak = scrimStats.slice().sort(function(a, b) { return b.streak - a.streak; })[0];
                    return [
                      {label: 'Games Logged',   val: allGames.length,               sub: safeSessions.length + ' sessions',      color: '#C4B5FD'},
                      {label: 'Best Avg',        val: bestAvg.avg,                   sub: bestAvg.name,                           color: '#4ade80'},
                      {label: 'Top Win Rate',    val: bestWR.winRate + '%',          sub: bestWR.name,                            color: '#E8A838'},
                      {label: 'Top Top-4 Rate',  val: bestTop4.top4Rate + '%',       sub: bestTop4.name,                          color: '#4ECDC4'},
                      {label: 'Most Points',     val: bestPts.pts + ' pts',          sub: bestStreak.streak + ' streak ' + bestStreak.name, color: '#f97316'},
                    ].map(function(item) {
                      return (
                        <div key={item.label} className="bg-surface-container-low p-4 border-t-2 space-y-0.5" style={{borderColor: item.color + '55'}}>
                          <div className="font-mono text-2xl font-black leading-none" style={{color: item.color}}>{item.val}</div>
                          <div className="text-[9px] font-sans-condensed text-on-surface-variant uppercase tracking-widest">{item.label}</div>
                          <div className="text-[10px] text-on-surface-variant/50 truncate">{item.sub}</div>
                        </div>
                      );
                    });
                  }())}
                </div>

                {/* Leaderboard */}
                <div className="bg-surface-container-low rounded-sm overflow-hidden">
                  <div className="px-6 py-4 bg-surface-container flex items-center justify-between">
                    <div>
                      <h2 className="font-serif text-2xl font-bold">Player Leaderboard</h2>
                      <p className="text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mt-0.5">Sorted by average placement</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-separate border-spacing-0 min-w-[680px]">
                      <thead>
                        <tr style={{background: 'rgba(255,255,255,0.03)'}}>
                          {['#','Player','AVG','WIN%','TOP4%','PTS','PPG','BEST','WORST','STREAK','TREND'].map(function(h, hi) {
                            return <th key={h} className={'py-3 text-[10px] font-sans-condensed font-bold text-on-surface-variant uppercase tracking-widest ' + (hi <= 1 ? 'text-left px-4' : 'text-center px-3')}>{h}</th>;
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {scrimStats.map(function(p, i) {
                          var avgV = parseFloat(p.avg);
                          var avgColor = avgV < 3 ? '#4ade80' : avgV <= 5 ? '#facc15' : '#f87171';
                          var rankColor = i === 0 ? '#E8A838' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'rgba(255,255,255,0.2)';
                          return (
                            <tr key={p.id} style={{borderBottom: '1px solid rgba(255,255,255,0.04)', background: i === 0 ? 'rgba(232,168,56,0.03)' : 'transparent'}}>
                              <td className="px-4 py-4 w-10 text-center">
                                <span className="font-mono font-black text-base" style={{color: rankColor}}>{i + 1}</span>
                              </td>
                              <td className="px-4 py-4 min-w-[160px]">
                                <div className="font-bold text-sm text-on-surface">{p.name}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] font-sans-condensed text-on-surface-variant">{p.games}g</span>
                                  {p.streak >= 2 && <span className="text-[10px] font-mono text-orange-400">{'\uD83D\uDD25'}{p.streak}</span>}
                                  <div className="flex gap-px">
                                    {p.placements.slice(-5).map(function(pl, pi) {
                                      return <div key={pi} className="w-4 h-4 flex items-center justify-center text-[9px] font-mono font-bold" style={{background: placeColor(pl) + '25', color: placeColor(pl)}}>{pl}</div>;
                                    })}
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-4 text-center">
                                <span className="font-mono text-xl font-black" style={{color: avgColor}}>{p.avg}</span>
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
                              <td className="px-3 py-4 text-center">
                                <span className="font-mono text-sm font-bold text-primary">{p.pts}</span>
                              </td>
                              <td className="px-3 py-4 text-center">
                                <span className="font-mono text-xs text-on-surface-variant">{p.ppg}</span>
                                <div className="text-[9px] font-sans-condensed text-on-surface-variant/40 uppercase">pts/g</div>
                              </td>
                              <td className="px-3 py-4 text-center">
                                <div className="w-6 h-6 flex items-center justify-center mx-auto font-mono text-[10px] font-bold" style={{background: '#E8A83822', border: '1px solid #E8A83844', color: '#E8A838'}}>#{p.best}</div>
                              </td>
                              <td className="px-3 py-4 text-center">
                                <div className="w-6 h-6 flex items-center justify-center mx-auto font-mono text-[10px] font-bold" style={{background: '#f8717122', border: '1px solid #f8717144', color: '#f87171'}}>#{p.worst}</div>
                              </td>
                              <td className="px-3 py-4 text-center">
                                {p.streak > 0 ? (
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5" style={{background: p.streak >= 3 ? '#f9731620' : 'rgba(255,255,255,0.04)', border: '1px solid ' + (p.streak >= 3 ? '#f9731640' : 'rgba(255,255,255,0.06)')}}>
                                    <span className="font-mono text-xs font-bold" style={{color: p.streak >= 3 ? '#f97316' : 'rgba(255,255,255,0.35)'}}>{p.streak}</span>
                                  </div>
                                ) : <span className="text-on-surface-variant/20 text-xs">-</span>}
                              </td>
                              <td className="px-3 py-4 text-center">
                                <ScrimTrend placements={p.placements}/>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Placement heatmap */}
                <div className="bg-surface-container-low rounded-sm overflow-hidden">
                  <div className="px-6 py-4 bg-surface-container">
                    <h2 className="font-serif text-2xl font-bold">Placement Distribution</h2>
                    <p className="text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mt-0.5">Frequency heatmap — brighter = more occurrences</p>
                  </div>
                  <div className="p-6 overflow-x-auto">
                    <table className="border-separate border-spacing-1 min-w-[480px]">
                      <thead>
                        <tr>
                          <th className="text-left text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest pr-4 w-28"/>
                          {[1,2,3,4,5,6,7,8].map(function(n) {
                            return <th key={n} className="text-center text-xs font-mono font-bold w-10" style={{color: placeColor(n)}}>#{n}</th>;
                          })}
                          <th className="text-center text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest pl-2">GP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scrimStats.map(function(p) {
                          var counts = [1,2,3,4,5,6,7,8].map(function(n) { return p.placements.filter(function(x) { return x === n; }).length; });
                          var maxC = Math.max.apply(null, counts) || 1;
                          return (
                            <tr key={p.id}>
                              <td className="pr-4 py-1 font-bold text-xs text-on-surface">{p.name}</td>
                              {counts.map(function(count, ci) {
                                var n = ci + 1;
                                var c = placeColor(n);
                                var alpha = count > 0 ? Math.round((0.15 + (count / maxC) * 0.6) * 255).toString(16).padStart(2, '0') : '00';
                                return (
                                  <td key={n} className="text-center py-1">
                                    <div className="w-10 h-10 flex items-center justify-center mx-auto font-mono text-xs font-bold"
                                      style={{background: count > 0 ? c + alpha : 'rgba(255,255,255,0.03)', border: '1px solid ' + (count > 0 ? c + '44' : 'rgba(255,255,255,0.05)'), color: count > 0 ? c : 'rgba(255,255,255,0.15)'}}>
                                      {count > 0 ? count : ''}
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="pl-2 text-center font-mono text-xs text-on-surface-variant">{p.games}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Session breakdown */}
                {safeSessions.length >= 2 && (
                  <div className="bg-surface-container-low rounded-sm overflow-hidden">
                    <div className="px-6 py-4 bg-surface-container">
                      <h2 className="font-serif text-2xl font-bold">Session Breakdown</h2>
                      <p className="text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mt-0.5">Avg placement per session - track improvement over time</p>
                    </div>
                    <div className="p-6 overflow-x-auto">
                      <table className="border-separate border-spacing-1" style={{minWidth: 180 + safeSessions.length * 120 + 'px'}}>
                        <thead>
                          <tr>
                            <th className="text-left text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest pr-4 w-28"/>
                            {safeSessions.map(function(sess) {
                              return (
                                <th key={sess.id} className="text-center min-w-[110px]">
                                  <div className="font-mono text-[10px] font-bold text-on-surface truncate max-w-[110px]">{sess.name}</div>
                                  <div className="text-[9px] font-sans-condensed text-on-surface-variant uppercase">{sess.games.length}g{sess.active ? ' · LIVE' : ''}</div>
                                </th>
                              );
                            })}
                            <th className="text-center pl-2 text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest">Overall</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scrimStats.map(function(p) {
                            return (
                              <tr key={p.id}>
                                <td className="pr-4 py-1 font-bold text-xs text-on-surface">{p.name}</td>
                                {safeSessions.map(function(sess) {
                                  var pGames = sess.games.filter(function(g) { return g.results[p.id] != null || g.results[String(p.id)] != null; });
                                  if (pGames.length === 0) return <td key={sess.id} className="text-center py-1"><div className="w-14 h-8 flex items-center justify-center mx-auto text-on-surface-variant/20 text-xs" style={{background: 'rgba(255,255,255,0.02)'}}>-</div></td>;
                                  var pls = pGames.map(function(g) { return g.results[p.id] != null ? g.results[p.id] : g.results[String(p.id)]; });
                                  var avg = (pls.reduce(function(s, v) { return s + v; }, 0) / pls.length).toFixed(2);
                                  var c = parseFloat(avg) < 3 ? '#4ade80' : parseFloat(avg) <= 5 ? '#facc15' : '#f87171';
                                  return (
                                    <td key={sess.id} className="text-center py-1">
                                      <div className="w-14 h-8 flex items-center justify-center mx-auto font-mono text-sm font-bold" style={{background: c + '18', border: '1px solid ' + c + '33', color: c}}>{avg}</div>
                                    </td>
                                  );
                                })}
                                <td className="pl-2 text-center py-1 font-mono text-sm font-bold" style={{color: parseFloat(p.avg) < 3 ? '#4ade80' : parseFloat(p.avg) <= 5 ? '#facc15' : '#f87171'}}>{p.avg}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Comps sub-tab */}
            {statsTab === 'comps' && (
              <div className="space-y-4">
                {compList.length === 0 ? (
                  <div className="bg-surface-container-low p-16 rounded-sm text-center space-y-3">
                    <Icon name="category" size={40} className="text-on-surface-variant opacity-20"/>
                    <div className="text-xs font-sans-condensed text-on-surface-variant uppercase tracking-widest">No comp data yet</div>
                    <div className="text-xs text-on-surface-variant/50 max-w-xs mx-auto">When recording games, fill in the comp field below each player's placements to track comp performance here.</div>
                  </div>
                ) : (
                  <div className="bg-surface-container-low rounded-sm overflow-hidden">
                    <div className="px-6 py-4 bg-surface-container flex items-center justify-between">
                      <div>
                        <h2 className="font-serif text-2xl font-bold">Comp Performance</h2>
                        <p className="text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mt-0.5">{compList.length} comps tracked across {allGames.length} games</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-separate border-spacing-0 min-w-[520px]">
                        <thead>
                          <tr style={{background: 'rgba(255,255,255,0.03)'}}>
                            {['#','Comp','Games','Play Rate','Win%','Top4%','Avg Place'].map(function(h, hi) {
                              return <th key={h} className={'py-3 text-[10px] font-sans-condensed font-bold text-on-surface-variant uppercase tracking-widest ' + (hi <= 1 ? 'text-left px-5' : 'text-center px-4')}>{h}</th>;
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
                              <tr key={c.name} style={{borderBottom: '1px solid rgba(255,255,255,0.04)'}}>
                                <td className="px-5 py-4 font-mono text-sm font-bold text-on-surface-variant/40 w-10">{i + 1}</td>
                                <td className="px-5 py-4">
                                  <div className="font-bold text-sm text-on-surface">{c.name}</div>
                                  <div className="text-[10px] text-on-surface-variant font-sans-condensed">{c.games} games</div>
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
                  </div>
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
              <div className="flex items-center justify-between bg-surface-container-low rounded-sm px-5 py-3">
                <span className="text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest">{allGames.length} games across {safeSessions.length} sessions</span>
                <div className="flex gap-2">
                  <button onClick={copyText} className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-high text-on-surface font-sans-condensed text-xs uppercase tracking-wide hover:text-primary transition-colors">
                    <Icon name="content_copy" size={13} className="text-current"/>Copy Text
                  </button>
                  <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-high text-on-surface font-sans-condensed text-xs uppercase tracking-wide hover:text-primary transition-colors">
                    <Icon name="download" size={13} className="text-current"/>CSV
                  </button>
                </div>
              </div>
            )}

            {safeSessions.length === 0 ? (
              <div className="bg-surface-container-low p-16 rounded-sm text-center">
                <Icon name="history" size={40} className="text-on-surface-variant opacity-20 mb-4"/>
                <div className="text-xs font-sans-condensed text-on-surface-variant uppercase tracking-widest">No history yet</div>
              </div>
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
                }).sort(function(a, b) { return parseFloat(a.avg) - parseFloat(b.avg); });

                return (
                  <div key={sess.id} className="bg-surface-container-low rounded-sm overflow-hidden">
                    {/* Session header */}
                    <button onClick={function() { setExpandedSession(isExpanded ? null : sess.id); }}
                      className="w-full px-5 py-4 flex items-center gap-4 hover:bg-surface-container transition-colors text-left">
                      <Icon name={isExpanded ? 'expand_less' : 'expand_more'} size={18} className="text-on-surface-variant flex-shrink-0"/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-mono text-sm font-bold text-on-surface uppercase">{sess.name}</span>
                          <span className={'text-[9px] font-sans-condensed px-2 py-0.5 uppercase tracking-widest ' + (sess.active ? 'bg-tertiary/15 text-tertiary' : 'bg-surface-container-highest text-on-surface-variant')}>{sess.active ? 'Live' : 'Ended'}</span>
                          <span className="text-[10px] font-sans-condensed text-on-surface-variant">{sess.games.length} games · {sess.createdAt}</span>
                          {sess.notes && <span className="text-[10px] text-on-surface-variant/50 italic truncate">{sess.notes}</span>}
                        </div>
                      </div>
                      {/* Mini summary */}
                      {sessStats.length > 0 && (
                        <div className="hidden md:flex gap-3 flex-shrink-0">
                          {sessStats.slice(0, 3).map(function(s, si) {
                            var c = placeColor(Math.round(parseFloat(s.avg)));
                            return (
                              <div key={s.name} className="text-right">
                                <div className="font-mono text-xs font-bold" style={{color: c}}>{s.avg}</div>
                                <div className="text-[9px] font-sans-condensed text-on-surface-variant/50">{s.name}</div>
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
                            <div className="text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-3">Session Standings</div>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[400px]">
                                <thead>
                                  <tr>
                                    {['#','Player','Games','Avg','Win%','Pts'].map(function(h, hi) {
                                      return <th key={h} className={'py-1.5 text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest ' + (hi <= 1 ? 'text-left pr-4' : 'text-center px-3')}>{h}</th>;
                                    })}
                                  </tr>
                                </thead>
                                <tbody>
                                  {sessStats.map(function(s, si) {
                                    var c = placeColor(Math.round(parseFloat(s.avg)));
                                    return (
                                      <tr key={s.name} style={{borderTop: '1px solid rgba(255,255,255,0.04)'}}>
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
                        <div className="p-5 space-y-2">
                          <div className="text-[10px] font-sans-condensed text-on-surface-variant uppercase tracking-widest mb-3">Games</div>
                          {sess.games.map(function(g) {
                            var isEditing = editGame && editGame.id === g.id;
                            var sorted = Object.entries(g.results).sort(function(a, b) { return a[1] - b[1]; });
                            return (
                              <div key={g.id} className="bg-surface-container-high rounded-sm p-4">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-xs font-bold text-primary">G{g.gameNumber}</span>
                                    {g.tag !== 'standard' && <span className="text-[9px] font-sans-condensed bg-secondary/10 text-secondary px-1.5 py-0.5 uppercase">{g.tag}</span>}
                                    {g.duration > 0 && <span className="font-mono text-[10px] text-on-surface-variant/50">{fmt(g.duration)}</span>}
                                    {!isEditing && g.note && <span className="text-[10px] text-on-surface-variant/50 italic">"{g.note}"</span>}
                                  </div>
                                  {isAdmin && (
                                  <div className="flex gap-1 flex-shrink-0">
                                    <button onClick={function() { setEditGame(isEditing ? null : {id: g.id, note: g.note, tag: g.tag}); }}
                                      className="p-1 text-on-surface-variant/30 hover:text-primary transition-colors"><Icon name={isEditing ? 'close' : 'edit'} size={12} className="text-current"/></button>
                                    <button onClick={function() { setConfirmDelete({type: 'game', id: g.id}); }}
                                      className="p-1 text-on-surface-variant/30 hover:text-error transition-colors"><Icon name="delete" size={12} className="text-current"/></button>
                                  </div>
                                  )}
                                </div>

                                {isEditing && (
                                  <div className="flex gap-2 mb-3">
                                    <select value={editGame.tag} onChange={function(e) { setEditGame(Object.assign({}, editGame, {tag: e.target.value})); }}
                                      className="bg-surface-container-lowest border-0 text-on-surface font-mono text-xs p-2 outline-none focus:ring-1 focus:ring-primary">
                                      {['standard','draft comp','test run','ranked sim','meta test'].map(function(t) { return <option key={t} value={t}>{t}</option>; })}
                                    </select>
                                    <input type="text" value={editGame.note} onChange={function(e) { setEditGame(Object.assign({}, editGame, {note: e.target.value})); }}
                                      placeholder="Game note..."
                                      className="flex-1 bg-surface-container-lowest border-0 text-on-surface font-mono text-xs p-2 outline-none focus:ring-1 focus:ring-primary"/>
                                    <button onClick={saveEditGame}
                                      className="px-3 py-2 bg-primary text-on-primary font-sans-condensed text-xs uppercase hover:opacity-90 transition-opacity">Save</button>
                                  </div>
                                )}

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                  {sorted.map(function(entry) {
                                    var pid = entry[0]; var place = entry[1];
                                    var p = players.find(function(pl) { return String(pl.id) === String(pid); });
                                    if (!p) return null;
                                    var c = placeColor(place);
                                    return (
                                      <div key={pid} className="flex items-center gap-2 px-2 py-1.5" style={{background: c + '0d', border: '1px solid ' + c + '22'}}>
                                        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 font-mono text-[10px] font-bold" style={{color: c, background: c + '25'}}>#{place}</div>
                                        <div className="min-w-0">
                                          <div className="font-bold text-xs text-on-surface truncate">{p.name}</div>
                                          {g.comps && g.comps[pid] && <div className="text-[9px] font-sans-condensed text-on-surface-variant/50 truncate">{g.comps[pid]}</div>}
                                        </div>
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
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Confirm delete modal */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-surface-container-low rounded-sm p-6 max-w-sm w-full">
              <div className="font-serif text-lg font-bold text-on-surface mb-2">Delete {confirmDelete.type}?</div>
              <div className="text-sm text-on-surface-variant mb-5">This cannot be undone.</div>
              <div className="flex gap-3">
                <button onClick={function() { setConfirmDelete(null); }}
                  className="flex-1 py-2.5 bg-surface-container-high text-on-surface font-sans-condensed text-xs uppercase tracking-widest hover:bg-surface-container-highest transition-colors">Cancel</button>
                <button onClick={function() { if (confirmDelete.type === 'game') deleteGame(confirmDelete.id); else deleteSession(confirmDelete.id); }}
                  className="flex-1 py-2.5 bg-error text-on-error font-sans-condensed text-xs uppercase tracking-widest hover:opacity-90 transition-opacity">Delete</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PageLayout>
  );
}
