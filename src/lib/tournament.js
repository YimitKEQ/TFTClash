import { RANKS, PTS } from './constants.js';

// Tournament phases  -  strict state machine
export var T_PHASE = {
  DRAFT: "draft",
  REGISTRATION: "registration",
  CHECK_IN: "checkin",
  LOBBY_SETUP: "lobby_setup",
  IN_PROGRESS: "inprogress",
  BETWEEN_ROUNDS: "between_rounds",
  COMPLETE: "complete"
};

// Valid state transitions
export var T_TRANSITIONS = {};
T_TRANSITIONS[T_PHASE.DRAFT] = [T_PHASE.REGISTRATION];
T_TRANSITIONS[T_PHASE.REGISTRATION] = [T_PHASE.CHECK_IN, T_PHASE.DRAFT];
T_TRANSITIONS[T_PHASE.CHECK_IN] = [T_PHASE.LOBBY_SETUP, T_PHASE.REGISTRATION];
T_TRANSITIONS[T_PHASE.LOBBY_SETUP] = [T_PHASE.IN_PROGRESS, T_PHASE.CHECK_IN];
T_TRANSITIONS[T_PHASE.IN_PROGRESS] = [T_PHASE.BETWEEN_ROUNDS, T_PHASE.COMPLETE];
T_TRANSITIONS[T_PHASE.BETWEEN_ROUNDS] = [T_PHASE.IN_PROGRESS, T_PHASE.COMPLETE];
T_TRANSITIONS[T_PHASE.COMPLETE] = [];

export function canTransition(from, to) {
  return (T_TRANSITIONS[from] || []).indexOf(to) !== -1;
}

// Format presets
export var TOURNAMENT_FORMATS = {
  casual: {name:"Casual Clash",description:"Single stage, 3 games, all players",games:3,stages:1,maxPlayers:24,cutEnabled:false,cutLine:0,cutAfterGame:0,seeding:"random"},
  standard: {name:"Standard Clash",description:"Single stage, 5 games, seeded lobbies",games:5,stages:1,maxPlayers:32,cutEnabled:false,cutLine:0,cutAfterGame:0,seeding:"snake"},
  competitive: {name:"Competitive (128p)",description:"6 games, cut after 4, snake seeded",games:6,stages:2,maxPlayers:128,cutEnabled:true,cutLine:13,cutAfterGame:4,seeding:"snake"},
  weekly: {name:"Weekly Clash",description:"3 games, open lobby format",games:3,stages:1,maxPlayers:24,cutEnabled:false,cutLine:0,cutAfterGame:0,seeding:"rank-based"}
};

// Snake seeding: distributes players across lobbies so each has a mix of skill levels
export function snakeSeed(sortedPlayers, lobbySize) {
  var lobbyCount = Math.ceil(sortedPlayers.length / lobbySize);
  if (lobbyCount <= 0) return [];
  var lobbies = Array.from({length: lobbyCount}, function() { return []; });
  sortedPlayers.forEach(function(p, i) {
    var row = Math.floor(i / lobbyCount);
    var col = row % 2 === 0 ? (i % lobbyCount) : (lobbyCount - 1 - (i % lobbyCount));
    lobbies[col].push(p);
  });
  return lobbies;
}

// Calculate lobby assignments based on seeding method
export function buildLobbies(players, method, lobbySize) {
  lobbySize = lobbySize || 8;
  if (!players || players.length === 0) return [];
  var pool;
  if (method === "random") {
    pool = [].concat(players);
    for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
    var result = [];
    for (var k = 0; k < pool.length; k += lobbySize) result.push(pool.slice(k, k + lobbySize));
    return result;
  }
  if (method === "snake") {
    var sorted = [].concat(players).sort(function(a, b) { return (b.pts || 0) - (a.pts || 0) || (b.wins || 0) - (a.wins || 0); });
    return snakeSeed(sorted, lobbySize);
  }
  // Default: rank-based (top seeds together)
  var ranked = [].concat(players).sort(function(a, b) { return (b.pts || 0) - (a.pts || 0); });
  var res = [];
  for (var m = 0; m < ranked.length; m += lobbySize) res.push(ranked.slice(m, m + lobbySize));
  return res;
}

// Build lobbies for a 4v4 (squads) tournament. Each lobby pairs 2 teams of
// `teamSize` players (default 4 → 8 players per lobby).
//
// teams: array of { id, name, tag?, players: [{id, username, ...}], seed? }
// teamSize: number of starters per team (typically 4)
// seedingMethod: 'snake' | 'random' | 'rank-based' (snake is the default for
// squads — strongest team plays the weakest in each lobby pairing)
//
// Returns: [{ teams: [teamA, teamB], players: [...flattened roster...] }, ...]
export function buildTeamLobbies(teams, teamSize, seedingMethod) {
  teamSize = teamSize || 4;
  if (!teams || teams.length === 0) return [];
  var pool = [].concat(teams);
  if (seedingMethod === "random") {
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
  } else if (seedingMethod === "rank-based") {
    pool.sort(function(a, b) { return (b.seed || 0) - (a.seed || 0); });
  } else {
    // snake / default — sort by seed descending so the pairing logic below
    // matches strongest with weakest.
    pool.sort(function(a, b) { return (b.seed || 0) - (a.seed || 0); });
  }
  var lobbies = [];
  if (seedingMethod === "snake" || !seedingMethod || seedingMethod === undefined) {
    // Pair top with bottom: lobby 0 = (1st, last), lobby 1 = (2nd, 2nd-last), ...
    var lo = 0;
    var hi = pool.length - 1;
    while (lo < hi) {
      var lobbyTeams = [pool[lo], pool[hi]];
      lobbies.push({
        teams: lobbyTeams,
        players: flattenLobbyRoster(lobbyTeams, teamSize)
      });
      lo += 1; hi -= 1;
    }
    if (lo === hi) {
      lobbies.push({
        teams: [pool[lo]],
        players: flattenLobbyRoster([pool[lo]], teamSize)
      });
    }
  } else {
    // random / rank-based: pair sequentially (0-1, 2-3, ...)
    for (var k = 0; k < pool.length; k += 2) {
      var pair = pool.slice(k, k + 2);
      lobbies.push({
        teams: pair,
        players: flattenLobbyRoster(pair, teamSize)
      });
    }
  }
  return lobbies;
}

function flattenLobbyRoster(lobbyTeams, teamSize) {
  var out = [];
  (lobbyTeams || []).forEach(function(team) {
    var roster = (team && team.players) || [];
    var starters = roster.slice(0, teamSize);
    starters.forEach(function(p) {
      out.push(Object.assign({}, p, { team_id: team.id, team_name: team.name }));
    });
  });
  return out;
}

// Sum-of-placement-points scoring for a single 4v4 lobby game result.
// Each player has a placement (1-8). Team score = sum of `PTS[placement]` for
// the team's players. Ties broken by:
//   1. Highest individual placement (lower number wins)
//   2. Number of top-4 finishers
//   3. Number of top-2 finishers
//   4. Latest single placement (used as tournament-level tiebreaker upstream)
//
// playerPlacements: [{player_id, team_id, placement}]
// Returns: [{team_id, score, top4, top2, bestPlacement}]
export function scoreTeamGame(playerPlacements) {
  var byTeam = {};
  (playerPlacements || []).forEach(function(p) {
    var tid = p.team_id;
    if (!tid) return;
    if (!byTeam[tid]) {
      byTeam[tid] = { team_id: tid, score: 0, top4: 0, top2: 0, bestPlacement: 9 };
    }
    var s = byTeam[tid];
    var place = p.placement || 0;
    s.score += (PTS[place] || 0);
    if (place > 0 && place <= 4) s.top4 += 1;
    if (place > 0 && place <= 2) s.top2 += 1;
    if (place > 0 && place < s.bestPlacement) s.bestPlacement = place;
  });
  return Object.keys(byTeam).map(function(k) { return byTeam[k]; })
    .sort(function(a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (a.bestPlacement !== b.bestPlacement) return a.bestPlacement - b.bestPlacement;
      if (b.top2 !== a.top2) return b.top2 - a.top2;
      if (b.top4 !== a.top4) return b.top4 - a.top4;
      return 0;
    });
}

// Build lobbies for a flash tournament from checked-in players
export function buildFlashLobbies(checkedInPlayers, seedingMethod) {
  var N = checkedInPlayers.length;
  if (N < 2) return {lobbies: [], byes: checkedInPlayers};
  var pool = [].concat(checkedInPlayers);
  if (seedingMethod === "random") {
    for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
  } else {
    // snake or rank-based: sort by rank then pts
    pool.sort(function(a, b) { return (RANKS.indexOf(b.rank || "Iron") - RANKS.indexOf(a.rank || "Iron")) || ((b.pts || 0) - (a.pts || 0)); });
  }
  var k = Math.floor(N / 8);
  var remainder = N - (k * 8);
  if (remainder === 0) {
    // perfect
  } else if (remainder >= 6) {
    k = k + 1;
  } else {
    if (k >= 1) { k = k + 1; }
    else { k = 1; }
  }
  if (k < 1) k = 1;
  var lobbies = [];
  for (var li = 0; li < k; li++) lobbies.push([]);
  pool.forEach(function(p, idx) {
    var row = Math.floor(idx / k);
    var col = row % 2 === 0 ? (idx % k) : (k - 1 - (idx % k));
    lobbies[col].push(p);
  });
  return {lobbies: lobbies, byes: []};
}

// Cut line: determine which players advance after N games
export function applyCutLine(playerStandings, cutLine, cutAfterGame) {
  if (!cutLine || cutLine <= 0) return {advancing: playerStandings, eliminated: []};
  var advancing = [];
  var eliminated = [];
  playerStandings.forEach(function(p) {
    var gamesPlayed = p.gamesInTournament || 0;
    if (gamesPlayed < cutAfterGame) { advancing.push(p); return; }
    var pts = p.tournamentPts || 0;
    if (pts >= cutLine) { advancing.push(p); }
    else { eliminated.push(p); }
  });
  return {advancing: advancing, eliminated: eliminated};
}

// Calculate suggested cut line for a given player count
export function suggestedCutLine(playerCount) {
  if (playerCount >= 96) return {cutLine: 13, cutAfterGame: 4, reason: "128p format: avg 18pts after 4 games, cut at 13"};
  if (playerCount >= 48) return {cutLine: 15, cutAfterGame: 3, reason: "64p format: tighter field, cut after 3 games"};
  if (playerCount >= 24) return {cutLine: 12, cutAfterGame: 3, reason: "32p format: smaller field, lower cut"};
  return {cutLine: 0, cutAfterGame: 0, reason: "Small event: no cut recommended"};
}

// Compute tournament standings from game_results
export function computeTournamentStandings(players, gameResults, tournamentId) {
  var standingsMap = {};
  gameResults.forEach(function(g) {
    if (tournamentId && g.tournamentId !== tournamentId) return;
    var pid = g.player_id || g.playerId;
    if (!standingsMap[pid]) standingsMap[pid] = {playerId: pid, tournamentPts: 0, gamesInTournament: 0, placements: [], wins: 0, top4: 0};
    var s = standingsMap[pid];
    s.tournamentPts += (g.points || PTS[g.placement] || 0);
    s.gamesInTournament += 1;
    s.placements.push(g.placement);
    if (g.placement === 1) s.wins += 1;
    if (g.placement <= 4) s.top4 += 1;
  });
  // Merge with player info
  return players.map(function(p) {
    var s = standingsMap[p.id] || {tournamentPts: 0, gamesInTournament: 0, placements: [], wins: 0, top4: 0};
    return Object.assign({}, p, s);
  }).filter(function(p) { return p.gamesInTournament > 0; })
    .sort(function(a, b) {
      if (b.tournamentPts !== a.tournamentPts) return b.tournamentPts - a.tournamentPts;
      var aScore = a.wins * 2 + a.top4; var bScore = b.wins * 2 + b.top4;
      if (bScore !== aScore) return bScore - aScore;
      return 0;
    });
}
