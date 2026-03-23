import { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase.js'
import { PTS } from '../lib/constants.js'
import PageLayout from '../components/layout/PageLayout'
import { Panel, Btn, Inp, Tag, Progress } from '../components/ui'

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
    <svg width={w || 60} height={(h || 20) + 2} style={{display: 'block', overflow: 'visible'}}>
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

var TABS = [
  {id: 'dashboard', label: 'Dashboard', icon: 'dashboard'},
  {id: 'play', label: 'Play', icon: 'sports_esports'},
  {id: 'stats', label: 'Stats', icon: 'analytics'},
  {id: 'history', label: 'History', icon: 'history'},
  {id: 'sessions', label: 'Sessions', icon: 'folder'}
];

export default function ScrimsScreen() {
  var ctx = useApp();
  var players = ctx.players;
  var toast = ctx.toast;
  var currentUser = ctx.currentUser;
  var isAdmin = ctx.isAdmin;
  var scrimAccess = ctx.scrimAccess;

  var _tab = useState('dashboard');
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
  var allGames = safeSessions.flatMap(function(s) { return s.games; });
  var allPlayers = players.concat(scrimRoster.filter(function(r) {
    return !players.find(function(p) { return p.id === r.id; });
  }));

  // Per-player stats
  var scrimStats = allPlayers.map(function(p) {
    var pGames = allGames.filter(function(g) { return g.results[p.id] != null; });
    if (pGames.length === 0) return null;
    var placements = pGames.map(function(g) { return g.results[p.id]; });
    var wins = placements.filter(function(x) { return x === 1; }).length;
    var top4 = placements.filter(function(x) { return x <= 4; }).length;
    var avgPlacement = (placements.reduce(function(s, v) { return s + v; }, 0) / placements.length).toFixed(2);
    var pts = placements.reduce(function(s, v) { return s + (PTS[v] || 0); }, 0);
    var best = Math.min.apply(null, placements);
    var worst = Math.max.apply(null, placements);
    var recent = pGames.slice().sort(function(a, b) { return b.ts - a.ts; }).map(function(g) { return g.results[p.id]; });
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

  // Awards
  var awards = [];
  if (scrimStats.length > 0) {
    var ironButt = scrimStats.slice().sort(function(a, b) { return b.eighths - a.eighths; })[0];
    if (ironButt && ironButt.eighths > 0) awards.push({icon: 'sentiment_very_dissatisfied', title: 'Iron Butt', desc: 'Most 8th places', player: ironButt.name, val: ironButt.eighths + 'x 8th'});
    var consistent = scrimStats.filter(function(p) { return p.games >= 3; }).slice().sort(function(a, b) { return a.variance - b.variance; })[0];
    if (consistent) awards.push({icon: 'gps_fixed', title: 'Consistent King', desc: 'Lowest placement variance', player: consistent.name, val: 'variance=' + consistent.variance.toFixed(1)});
    var streakKing = scrimStats.slice().sort(function(a, b) { return b.streak - a.streak; })[0];
    if (streakKing && streakKing.streak >= 2) awards.push({icon: 'local_fire_department', title: 'Streak Lord', desc: 'Current top-4 streak', player: streakKing.name, val: streakKing.streak + ' games'});
    var winKing = scrimStats.slice().sort(function(a, b) { return b.wins - a.wins; })[0];
    if (winKing && winKing.wins > 0) awards.push({icon: 'emoji_events', title: 'Clutch Player', desc: 'Most first place finishes', player: winKing.name, val: winKing.wins + 'x 1st'});
    var glassCannon = scrimStats.filter(function(p) { return p.games >= 3 && p.wins > 0 && p.eighths > 0; }).slice().sort(function(a, b) { return b.variance - a.variance; })[0];
    if (glassCannon) awards.push({icon: 'bolt', title: 'Glass Cannon', desc: 'Highest highs and lowest lows', player: glassCannon.name, val: 'var=' + glassCannon.variance.toFixed(1)});
  }

  function createSession() {
    if (!newName.trim()) { toast('Name required', 'error'); return; }
    if (!currentUser) { toast('Login required', 'error'); return; }
    var tgt = parseInt(newTarget) || 5;
    createScrim(newName.trim(), currentUser.id, null, newNotes.trim(), tgt).then(function(res) {
      if (res.error) { toast('Failed to create: ' + res.error.message, 'error'); return; }
      var scrimId = res.data.id;
      var pids = scrimRoster.map(function(p) { return typeof p.id === 'number' ? p.id : parseInt(p.id); }).filter(function(v) { return !isNaN(v); });
      if (pids.length > 0) {
        addScrimPlayers(scrimId, pids).then(function() { reloadScrims(); });
      } else {
        reloadScrims();
      }
      setActiveId(scrimId);
      setNewName(''); setNewNotes(''); setNewTarget('5');
      toast('Session created, go to Play tab to record games', 'success');
      setTab('play');
    });
  }

  function addPlayer() {
    if (!customName.trim()) return;
    var fromRoster = players.find(function(p) { return p.name.toLowerCase() === customName.toLowerCase(); });
    if (scrimRoster.find(function(p) { return p.name.toLowerCase() === customName.toLowerCase(); })) { toast('Already added', 'error'); return; }
    var np = fromRoster || {id: 'c' + Date.now(), name: customName.trim(), rank: 'Gold', pts: 0, games: 0, wins: 0, top4: 0, avg: '0'};
    setScrimRoster(function(r) { return r.concat([np]); });
    setCustomName('');
  }

  function lockGame() {
    if (!activeId) { toast('Select or create a session first', 'error'); return; }
    if (Object.keys(scrimResults).length < scrimRoster.length) { toast('All placements required', 'error'); return; }
    var gameNum = session ? session.games.length + 1 : 1;
    var resultRows = Object.keys(scrimResults).map(function(pid) {
      return {playerId: parseInt(pid), placement: scrimResults[pid]};
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

  function deleteGame(sessionId, gameId) {
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
      if (activeId === sessionId) setActiveId(null);
      setConfirmDelete(null);
      toast('Session deleted', 'success');
    });
  }

  // Access guard
  var hasAccess = isAdmin || (currentUser && scrimAccess.includes(currentUser.username));
  if (!hasAccess) {
    return (
      <PageLayout>
        <div className="text-center py-20 text-on-surface/40">
          <div className="text-5xl mb-4">🔒</div>
          <div className="text-lg font-bold text-on-surface mb-2">The Lab is Friends Only</div>
          <div className="text-sm">Ask an admin to grant you scrim access.</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="font-serif text-2xl text-on-surface font-black">The Lab</h2>
            <div className="flex gap-2 items-center mt-1">
              <Tag color="#9B72CF">Friends Only</Tag>
              <span className="text-xs text-on-surface/40 font-mono">{allGames.length} games - {safeSessions.length} sessions</span>
            </div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto whitespace-nowrap pb-1">
            {TABS.map(function(t) {
              return (
                <Btn
                  key={t.id}
                  variant={tab === t.id ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={function() { setTab(t.id); }}
                  className="flex-shrink-0"
                >
                  {t.label}
                </Btn>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── DASHBOARD TAB ── */}
      {tab === 'dashboard' && (
        <div>
          {allGames.length === 0 ? (
            <Panel className="text-center py-16">
              <div className="text-5xl mb-4">🎮</div>
              <div className="text-base font-bold text-on-surface mb-2">The Lab is empty</div>
              <div className="text-sm text-on-surface/40 mb-6">Create a session and start logging games to see your crew's stats.</div>
              <Btn variant="primary" onClick={function() { setTab('sessions'); }}>Create First Session</Btn>
            </Panel>
          ) : (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  {label: 'Games Logged', val: allGames.length, color: '#C4B5FD'},
                  {label: 'Sessions', val: safeSessions.length, color: '#E8A838'},
                  {label: 'Players', val: scrimStats.length, color: '#4ECDC4'},
                  {label: 'Top Player', val: scrimStats.length > 0 ? scrimStats[0].name : '-', color: '#6EE7B7'}
                ].map(function(item) {
                  return (
                    <Panel key={item.label} className="p-4 text-center">
                      <div className="font-mono text-xl font-bold truncate" style={{color: item.color}}>{item.val}</div>
                      <div className="text-[10px] font-bold text-on-surface/40 uppercase tracking-widest mt-1">{item.label}</div>
                    </Panel>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-[11px] font-bold text-on-surface/40 uppercase tracking-widest mb-3">Standings</div>
                  <Panel className="p-0 overflow-hidden">
                    {scrimStats.map(function(p, i) {
                      var avgC = parseFloat(p.avg) < 3 ? '#4ade80' : parseFloat(p.avg) <= 5 ? '#facc15' : '#f87171';
                      return (
                        <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-outline-variant/10 last:border-b-0">
                          <div className="font-mono text-xs font-bold w-5 text-center flex-shrink-0" style={{color: i === 0 ? '#E8A838' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'rgba(255,255,255,0.3)'}}>{i + 1}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-on-surface truncate">{p.name}</div>
                            <div className="text-[10px] text-on-surface/40">{p.games}g - avg {p.avg}{p.streak >= 3 ? ' - ' + p.streak : ''}</div>
                          </div>
                          <ScrimSparkline placements={p.placements} w={60} h={20}/>
                          <div className="font-mono text-sm font-bold w-8 text-right flex-shrink-0" style={{color: avgC}}>{p.avg}</div>
                        </div>
                      );
                    })}
                  </Panel>
                </div>

                <div>
                  <div className="text-[11px] font-bold text-on-surface/40 uppercase tracking-widest mb-3">Awards</div>
                  {awards.length === 0 ? (
                    <Panel className="p-5 text-center text-on-surface/40 text-sm">Log 3+ games per player to unlock awards.</Panel>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {awards.map(function(a) {
                        return (
                          <Panel key={a.title} className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="text-xl flex-shrink-0 text-primary">{a.title.charAt(0)}</div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm text-on-surface">{a.title}</div>
                                <div className="text-[11px] text-on-surface/40">{a.desc}</div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-sm font-bold text-primary">{a.player}</div>
                                <div className="font-mono text-[10px] text-on-surface/40">{a.val}</div>
                              </div>
                            </div>
                          </Panel>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {scrimStats.length >= 3 && (
                <div className="mb-6">
                  <div className="text-[11px] font-bold text-on-surface/40 uppercase tracking-widest mb-3">Head to Head</div>
                  <Panel className="p-1 overflow-x-auto">
                    <table style={{borderCollapse: 'collapse', width: '100%', minWidth: 300}}>
                      <thead>
                        <tr>
                          <th className="px-3 py-2 text-[10px] text-on-surface/40 text-left font-bold uppercase tracking-wide border-b border-outline-variant/10 whitespace-nowrap">vs</th>
                          {scrimStats.map(function(p) {
                            return <th key={p.id} className="px-2 py-2 text-[11px] text-on-surface/60 font-bold border-b border-outline-variant/10 whitespace-nowrap text-center">{p.name}</th>;
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {scrimStats.map(function(rowP) {
                          return (
                            <tr key={rowP.id}>
                              <td className="px-3 py-2 text-[11px] font-bold text-on-surface/60 border-b border-outline-variant/5 whitespace-nowrap">{rowP.name}</td>
                              {scrimStats.map(function(colP) {
                                if (String(rowP.id) === String(colP.id)) {
                                  return <td key={colP.id} className="px-2 py-2 text-center text-on-surface/20 text-xs border-b border-outline-variant/5" style={{background: 'rgba(255,255,255,0.02)'}}>-</td>;
                                }
                                var rowKey = String(rowP.id), colKey = String(colP.id);
                                var rec = h2hData[rowKey] && h2hData[rowKey][colKey];
                                if (!rec || rec.total === 0) {
                                  return <td key={colP.id} className="px-2 py-2 text-center text-on-surface/20 text-xs border-b border-outline-variant/5">-</td>;
                                }
                                var wr = rec.wins / rec.total;
                                var bg = wr >= 0.6 ? 'rgba(155,114,207,0.18)' : wr <= 0.4 ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.03)';
                                var col = wr >= 0.6 ? '#C4B5FD' : wr <= 0.4 ? '#F87171' : 'rgba(255,255,255,0.4)';
                                return (
                                  <td key={colP.id} className="px-2 py-2 text-center border-b border-outline-variant/5" style={{background: bg}}>
                                    <span className="font-mono text-xs font-bold" style={{color: col}}>{rec.wins}-{rec.total - rec.wins}</span>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </Panel>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── PLAY TAB ── */}
      {tab === 'play' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
          <div className="flex flex-col gap-4">
            <Panel className="p-4 flex items-center gap-3 flex-wrap">
              <div className="flex-1">
                <div className="text-[11px] font-bold text-on-surface/40 uppercase tracking-widest mb-2">Active Session</div>
                <select
                  value={activeId || ''}
                  onChange={function(e) { setActiveId(e.target.value || null); }}
                  className="w-full bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-on-surface text-sm"
                >
                  <option value="">- Select session -</option>
                  {safeSessions.map(function(s) {
                    return <option key={s.id} value={s.id}>{s.name} ({s.games.length}/{s.targetGames}){s.active ? '' : ' - Ended'}</option>;
                  })}
                </select>
              </div>
              {session && <Tag color={session.active ? '#52C47C' : '#BECBD9'}>{session.active ? 'Active' : 'Ended'}</Tag>}
              {session && session.active && (
                <Btn variant="destructive" size="sm" onClick={function() { stopSession(session.id); }}>End Session</Btn>
              )}
            </Panel>

            <Panel className="p-4">
              <div className="text-sm font-bold text-on-surface mb-3">Lobby Roster</div>
              <div className="flex gap-2 mb-3">
                <Inp
                  value={customName}
                  onChange={function(e) { setCustomName(e.target.value); }}
                  placeholder="Add player by name"
                  onKeyDown={function(e) { if (e.key === 'Enter') addPlayer(); }}
                  className="flex-1"
                />
                <Btn variant="primary" size="sm" onClick={addPlayer}>Add</Btn>
              </div>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {players.map(function(p) {
                  var inRoster = scrimRoster.find(function(r) { return r.id === p.id; });
                  return (
                    <Btn
                      key={p.id}
                      variant={inRoster ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={function() {
                        if (!inRoster) setScrimRoster(function(r) { return r.concat([p]); });
                      }}
                    >
                      {p.name}
                    </Btn>
                  );
                })}
              </div>
              {scrimRoster.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {scrimRoster.map(function(p) {
                    return (
                      <div key={p.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/30 rounded-sm">
                        <span className="text-xs font-semibold text-primary">{p.name}</span>
                        <button
                          onClick={function() { setScrimRoster(function(r) { return r.filter(function(x) { return x.id !== p.id; }); }); }}
                          className="text-on-surface/40 hover:text-on-surface text-base leading-none bg-transparent border-0 cursor-pointer p-0"
                        >
                          x
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            {scrimRoster.length >= 2 && (
              <Panel className="p-4">
                <div className="flex justify-between items-center flex-wrap gap-3 mb-4">
                  <div className="text-sm font-bold text-on-surface">
                    Game {session ? session.games.length + 1 : 1}{session ? ' / ' + session.targetGames : ''}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="font-mono text-lg font-bold w-14" style={{color: timerActive ? '#E8A838' : 'rgba(255,255,255,0.3)'}}>{fmt(timer)}</div>
                    <Btn variant="secondary" size="sm" onClick={function() { setTimerActive(function(t) { return !t; }); }}>
                      {timerActive ? 'Pause' : 'Start'}
                    </Btn>
                    <Btn variant="secondary" size="sm" onClick={function() { setTimer(0); setTimerActive(false); }}>Reset</Btn>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <div className="text-[11px] font-bold text-on-surface/40 uppercase tracking-widest mb-2">Tag</div>
                    <select
                      value={gameTag}
                      onChange={function(e) { setGameTag(e.target.value); }}
                      className="w-full bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-on-surface text-sm"
                    >
                      {['standard', 'draft comp', 'test run', 'ranked sim', 'meta test'].map(function(t) {
                        return <option key={t} value={t}>{t}</option>;
                      })}
                    </select>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-on-surface/40 uppercase tracking-widest mb-2">Note</div>
                    <Inp
                      value={gameNote}
                      onChange={function(e) { setGameNote(e.target.value); }}
                      placeholder="comp, pivot, notes..."
                    />
                  </div>
                </div>

                <PlacementBoard
                  roster={scrimRoster}
                  results={scrimResults}
                  onPlace={function(pid, place) { setScrimResults(function(r) { return Object.assign({}, r, {[pid]: place}); }); }}
                  locked={false}
                />

                <div className="mt-4">
                  <Btn
                    variant="primary"
                    size="lg"
                    className="w-full"
                    disabled={Object.keys(scrimResults).length < scrimRoster.length}
                    onClick={lockGame}
                  >
                    Lock Game - {Object.keys(scrimResults).length}/{scrimRoster.length} placed
                  </Btn>
                </div>
              </Panel>
            )}
          </div>

          <div>
            <div className="text-[11px] font-bold text-on-surface/40 uppercase tracking-widest mb-3">Recent Games</div>
            {allGames.length === 0 && (
              <Panel className="p-6 text-center">
                <div className="text-3xl mb-3">🎮</div>
                <div className="text-sm text-on-surface/40">No games logged yet. Record a game to see it here.</div>
              </Panel>
            )}
            {allGames.slice().reverse().slice(0, 8).map(function(g, gi) {
              var sessionName = (safeSessions.find(function(s) {
                return s.games.find(function(sg) { return sg.id === g.id; });
              }) || {}).name || '';
              var sorted = Object.entries(g.results).sort(function(a, b) { return a[1] - b[1]; });
              return (
                <Panel key={g.id} className="p-3 mb-2">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex gap-2 items-center">
                      <span className="font-mono text-xs font-bold text-primary">G{allGames.length - gi}</span>
                      {g.tag !== 'standard' && <Tag color="#4ECDC4">{g.tag}</Tag>}
                      {g.duration > 0 && <span className="font-mono text-[10px] text-on-surface/40">{fmt(g.duration)}</span>}
                    </div>
                    <span className="text-[10px] text-on-surface/40">{sessionName}</span>
                  </div>
                  {g.note && <div className="text-[10px] text-on-surface/40 mb-2 italic">"{g.note}"</div>}
                  <div className="flex flex-col gap-1">
                    {sorted.map(function(entry) {
                      var pid = entry[0], place = entry[1];
                      var p = allPlayers.find(function(pl) { return String(pl.id) === String(pid); });
                      if (!p) return null;
                      var c = place === 1 ? '#E8A838' : place === 2 ? '#C0C0C0' : place === 3 ? '#CD7F32' : place <= 4 ? '#4ECDC4' : '#F87171';
                      return (
                        <div key={pid} className="flex items-center justify-between">
                          <span className="text-xs truncate flex-1" style={{color: place <= 4 ? '#D1C9BC' : 'rgba(255,255,255,0.3)', fontWeight: place <= 4 ? 600 : 400}}>{p.name}</span>
                          <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ml-2" style={{background: c + '22', border: '1px solid ' + c + '55'}}>
                            <span className="font-mono text-[11px] font-bold" style={{color: c}}>{place}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STATS TAB ── */}
      {tab === 'stats' && (
        <div>
          {scrimStats.length === 0 ? (
            <div className="text-center py-16 text-on-surface/40 text-sm">Log some games first to see stats.</div>
          ) : (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  {label: 'Games Logged', val: allGames.length, color: '#C4B5FD'},
                  {label: 'Sessions', val: safeSessions.length, color: '#E8A838'},
                  {label: 'Players Tracked', val: scrimStats.length, color: '#4ECDC4'},
                  {label: 'Avg Game Time', val: allGames.length > 0 ? fmt(Math.round(allGames.reduce(function(s, g) { return s + g.duration; }, 0) / allGames.length)) : '-', color: '#6EE7B7'}
                ].map(function(item) {
                  return (
                    <Panel key={item.label} className="p-4 text-center">
                      <div className="font-mono text-xl font-bold" style={{color: item.color}}>{item.val}</div>
                      <div className="text-[10px] font-bold text-on-surface/40 uppercase tracking-widest mt-1">{item.label}</div>
                    </Panel>
                  );
                })}
              </div>

              <Panel className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="grid gap-0" style={{gridTemplateColumns: '28px 1fr 52px 48px 48px 48px 48px 48px', minWidth: 480}}>
                    <div className="px-3 py-2 border-b border-outline-variant/10"/>
                    <div className="px-3 py-2 text-[10px] font-bold text-on-surface/40 uppercase tracking-widest border-b border-outline-variant/10">Player</div>
                    {['AVG', 'WIN%', 'TOP4', 'BEST', 'WRST', 'PTS'].map(function(h) {
                      return <div key={h} className="px-2 py-2 text-[10px] font-bold text-on-surface/40 uppercase tracking-widest text-center border-b border-outline-variant/10">{h}</div>;
                    })}
                    {scrimStats.map(function(p, i) {
                      var avgC = parseFloat(p.avg) < 3 ? '#4ade80' : parseFloat(p.avg) <= 5 ? '#facc15' : '#f87171';
                      return (
                        <div key={p.id} className="contents">
                          <div className="px-3 py-2.5 font-mono text-xs font-bold text-center" style={{color: i === 0 ? '#E8A838' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'rgba(255,255,255,0.3)', background: i === 0 ? 'rgba(232,168,56,0.04)' : 'transparent'}}>{i + 1}</div>
                          <div className="px-3 py-2.5 min-w-0" style={{background: i === 0 ? 'rgba(232,168,56,0.04)' : 'transparent'}}>
                            <div className="font-bold text-sm text-on-surface truncate">{p.name}</div>
                            <div className="text-[10px] text-on-surface/40">{p.games}g{p.streak >= 3 ? ' - ' + p.streak : ''}</div>
                            <div className="flex gap-0.5 flex-wrap mt-1">
                              {p.placements.map(function(pl, pi) {
                                var c = pl === 1 ? '#E8A838' : pl === 2 ? '#C0C0C0' : pl === 3 ? '#CD7F32' : pl <= 4 ? '#4ECDC4' : '#F87171';
                                return (
                                  <div key={pi} className="w-4 h-4 rounded flex items-center justify-center" style={{background: c + '22', border: '1px solid ' + c + '55'}}>
                                    <span className="font-mono text-[9px] font-bold" style={{color: c}}>{pl}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <div className="px-2 py-2.5 font-mono text-sm font-bold text-center" style={{color: avgC, background: i === 0 ? 'rgba(232,168,56,0.04)' : 'transparent'}}>{p.avg}</div>
                          <div className="px-2 py-2.5 font-mono text-xs font-semibold text-center text-emerald-400" style={{background: i === 0 ? 'rgba(232,168,56,0.04)' : 'transparent'}}>{p.winRate}%</div>
                          <div className="px-2 py-2.5 font-mono text-xs font-semibold text-center text-secondary" style={{background: i === 0 ? 'rgba(232,168,56,0.04)' : 'transparent'}}>{p.top4Rate}%</div>
                          <div className="px-2 py-2.5 font-mono text-xs font-semibold text-center text-tertiary" style={{background: i === 0 ? 'rgba(232,168,56,0.04)' : 'transparent'}}>#{p.best}</div>
                          <div className="px-2 py-2.5 font-mono text-xs font-semibold text-center text-rose-400" style={{background: i === 0 ? 'rgba(232,168,56,0.04)' : 'transparent'}}>#{p.worst}</div>
                          <div className="px-2 py-2.5 font-mono text-xs font-bold text-center text-primary" style={{background: i === 0 ? 'rgba(232,168,56,0.04)' : 'transparent'}}>{p.pts}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Panel>
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === 'history' && (
        <div>
          {allGames.length === 0 ? (
            <div className="text-center py-16 text-on-surface/40 text-sm">No games logged yet.</div>
          ) : (
            <div>
              {safeSessions.map(function(sess) {
                if (sess.games.length === 0) return null;
                return (
                  <div key={sess.id} className="mb-8">
                    <div className="flex items-center gap-3 flex-wrap mb-3">
                      <h3 className="text-base font-bold text-on-surface">{sess.name}</h3>
                      <Tag color={sess.active ? '#52C47C' : '#BECBD9'}>{sess.active ? 'Active' : 'Ended'}</Tag>
                      <span className="text-xs text-on-surface/40">{sess.games.length} games - {sess.createdAt}</span>
                      {sess.notes && <span className="text-xs text-on-surface/40 italic">{sess.notes}</span>}
                    </div>
                    <Panel className="p-0 overflow-hidden mb-3">
                      <div className="overflow-x-auto">
                        <table style={{width: '100%', borderCollapse: 'collapse', minWidth: 420}}>
                          <thead>
                            <tr className="bg-surface-container-highest">
                              <th className="px-4 py-2.5 text-left text-[10px] font-bold text-on-surface/40 uppercase tracking-widest border-b border-outline-variant/10 whitespace-nowrap">Player</th>
                              {sess.games.map(function(g, gi) {
                                return (
                                  <th key={g.id} className="px-2.5 py-2.5 text-center text-[10px] font-bold text-on-surface/40 uppercase tracking-widest border-b border-outline-variant/10 whitespace-nowrap">
                                    G{gi + 1}
                                    {g.tag !== 'standard' && <div className="text-[8px] text-secondary normal-case tracking-normal font-normal">{g.tag}</div>}
                                  </th>
                                );
                              })}
                              <th className="px-2.5 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest border-b border-outline-variant/10" style={{color: '#E8A838'}}>Avg</th>
                              <th className="px-2.5 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest border-b border-outline-variant/10 text-emerald-400">Pts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sess.games.flatMap(function(g) { return Object.keys(g.results); }).filter(function(pid, idx, arr) { return arr.indexOf(pid) === idx; }).map(function(pid, pidIdx) {
                              var p = allPlayers.find(function(pl) { return String(pl.id) === String(pid); });
                              if (!p) return null;
                              var placements = sess.games.map(function(g) { return g.results[pid]; });
                              var validPl = placements.filter(function(v) { return v != null; });
                              var avg = validPl.length > 0 ? (validPl.reduce(function(s, v) { return s + v; }, 0) / validPl.length).toFixed(2) : '-';
                              var pts = validPl.reduce(function(s, v) { return s + (PTS[v] || 0); }, 0);
                              return (
                                <tr key={p.id} style={{background: pidIdx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'}} className="border-b border-outline-variant/5">
                                  <td className="px-4 py-2.5">
                                    <span className="text-sm font-semibold text-on-surface">{p.name}</span>
                                  </td>
                                  {placements.map(function(place, pi) {
                                    var c = place == null ? 'rgba(255,255,255,0.2)' : place === 1 ? '#E8A838' : place === 2 ? '#C0C0C0' : place === 3 ? '#CD7F32' : place <= 4 ? '#4ECDC4' : '#F87171';
                                    return (
                                      <td key={pi} className="px-1.5 py-2.5 text-center">
                                        {place != null ? (
                                          <div className="w-7 h-7 rounded inline-flex items-center justify-center mx-auto" style={{background: c + '22', border: '1px solid ' + c + '55'}}>
                                            <span className="font-mono text-xs font-bold" style={{color: c}}>{place}</span>
                                          </div>
                                        ) : <span className="text-on-surface/20 text-xs">-</span>}
                                      </td>
                                    );
                                  })}
                                  <td className="px-2.5 py-2.5 text-center">
                                    <span className="font-mono text-sm font-bold" style={{color: parseFloat(avg) < 3 ? '#4ade80' : parseFloat(avg) <= 5 ? '#facc15' : '#f87171'}}>{avg}</span>
                                  </td>
                                  <td className="px-2.5 py-2.5 text-center">
                                    <span className="font-mono text-sm font-bold text-primary">{pts}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-surface-container-highest border-t border-outline-variant/10">
                              <td className="px-4 py-2 text-[10px] text-on-surface/40 font-bold uppercase tracking-widest">Notes</td>
                              {sess.games.map(function(g) {
                                return (
                                  <td key={g.id} className="px-1.5 py-2 text-center text-[10px] text-secondary max-w-[60px]">
                                    {g.note || '-'}
                                  </td>
                                );
                              })}
                              <td/><td/>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </Panel>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SESSIONS TAB ── */}
      {tab === 'sessions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Panel accent="purple" className="p-5">
            <h3 className="text-base font-bold text-on-surface mb-4">New Session</h3>
            <div className="flex flex-col gap-3 mb-4">
              <div>
                <div className="text-[11px] font-bold text-on-surface/40 uppercase tracking-widest mb-2">Session Name</div>
                <Inp
                  value={newName}
                  onChange={function(e) { setNewName(e.target.value); }}
                  placeholder="Friday Grind"
                />
              </div>
              <div>
                <div className="text-[11px] font-bold text-on-surface/40 uppercase tracking-widest mb-2">Notes / Goals</div>
                <Inp
                  value={newNotes}
                  onChange={function(e) { setNewNotes(e.target.value); }}
                  placeholder="Focus area, comps to test..."
                />
              </div>
              <div>
                <div className="text-[11px] font-bold text-on-surface/40 uppercase tracking-widest mb-2">Target Games</div>
                <select
                  value={newTarget}
                  onChange={function(e) { setNewTarget(e.target.value); }}
                  className="w-full bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-on-surface text-sm"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map(function(n) {
                    return <option key={n} value={n}>{n} games</option>;
                  })}
                </select>
              </div>
            </div>
            <Btn variant="primary" size="md" className="w-full" onClick={createSession}>Create Session</Btn>
          </Panel>

          <div className="flex flex-col gap-3">
            {safeSessions.map(function(s) {
              return (
                <Panel key={s.id} className={'p-4 ' + (s.active ? 'border-primary/30' : '')}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-bold text-sm text-on-surface mb-1 flex items-center gap-2">
                        {s.name}
                        {s.active && <div className="w-1.5 h-1.5 rounded-full bg-primary inline-block"/>}
                      </div>
                      {s.notes && <div className="text-xs text-on-surface/40 mb-1.5">{s.notes}</div>}
                      <div className="flex gap-1.5 flex-wrap">
                        <Tag color="#9B72CF">{s.games.length}/{s.targetGames} games</Tag>
                        <span className="text-[10px] text-on-surface/40 font-mono self-center">{s.createdAt}</span>
                        {!s.active && <Tag color="#BECBD9">Ended</Tag>}
                        {s.games.length >= s.targetGames && s.active && <Tag color="#E8A838">Target reached!</Tag>}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Btn variant="primary" size="sm" onClick={function() { setActiveId(s.id); setTab('play'); }}>Open</Btn>
                      {s.active && <Btn variant="destructive" size="sm" onClick={function() { stopSession(s.id); }}>End</Btn>}
                    </div>
                  </div>
                  <Progress value={s.games.length} max={s.targetGames}/>
                </Panel>
              );
            })}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
