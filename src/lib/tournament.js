import { RANKS, PTS, DOUBLE_UP_PTS, DOUBLE_UP_MULTIPLIERS } from './constants.js';

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
//
// Each preset describes the games-per-tournament shape AND the lobby shape
// (teamSize, teamsPerLobby, pointsScale). For solo formats teamSize/teamsPerLobby
// stay implicit (1/1). For team modes both are explicit so the lobby builder
// and scoring pipeline can branch deterministically.
export var TOURNAMENT_FORMATS = {
  casual: {name:"Casual Clash",description:"Single stage, 3 games, all players",games:3,stages:1,maxPlayers:24,cutEnabled:false,cutLine:0,cutAfterGame:0,seeding:"random",teamSize:1,teamsPerLobby:1,pointsScale:"standard"},
  standard: {name:"Standard Clash",description:"Single stage, 5 games, seeded lobbies",games:5,stages:1,maxPlayers:32,cutEnabled:false,cutLine:0,cutAfterGame:0,seeding:"snake",teamSize:1,teamsPerLobby:1,pointsScale:"standard"},
  competitive: {name:"Competitive (128p)",description:"6 games, cut after 4, snake seeded",games:6,stages:2,maxPlayers:128,cutEnabled:true,cutLine:13,cutAfterGame:4,seeding:"snake",teamSize:1,teamsPerLobby:1,pointsScale:"standard"},
  weekly: {name:"Weekly Clash",description:"3 games, open lobby format",games:3,stages:1,maxPlayers:24,cutEnabled:false,cutLine:0,cutAfterGame:0,seeding:"rank-based",teamSize:1,teamsPerLobby:1,pointsScale:"standard"},
  squads_4v4: {name:"4v4 Squads",description:"2 teams per lobby, 4 starters each. Riot-standard scoring.",games:5,stages:1,maxPlayers:32,cutEnabled:false,cutLine:0,cutAfterGame:0,seeding:"snake",teamSize:4,teamsPerLobby:2,pointsScale:"standard"},
  double_up_casual: {name:"Double Up (2v2) Casual",description:"4 teams of 2 per lobby, 3 games, no cuts.",games:3,stages:1,maxPlayers:32,cutEnabled:false,cutLine:0,cutAfterGame:0,seeding:"random",teamSize:2,teamsPerLobby:4,pointsScale:"double_up"},
  double_up_swiss: {name:"Double Up (2v2) Swiss",description:"4 teams of 2 per lobby, 5 games with reshuffles + late multipliers (R4 1.25x, R5 1.5x). Host configures cut line.",games:5,stages:2,maxPlayers:64,cutEnabled:false,cutLine:0,cutAfterGame:3,seeding:"random",teamSize:2,teamsPerLobby:4,pointsScale:"double_up_swiss"}
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

// Build lobbies for a team-based tournament. Each lobby groups `teamsPerLobby`
// teams of `teamSize` starters each. Defaults to 4v4 squads shape (2 teams per
// lobby, 4 starters each = 8 players) for backwards compat.
//
// teams: array of { id, name, tag?, players: [{id, username, ...}], seed? }
// teamSize: starters per team (4 for squads, 2 for Double Up)
// teamsPerLobby: how many teams play together (2 for squads, 4 for Double Up)
// seedingMethod: 'snake' | 'random' | 'rank-based'
//   * snake: strongest paired with weakest (only meaningful for 2-teams-per-lobby)
//   * random: shuffle then chunk
//   * rank-based: top seeds together, then next chunk, etc.
//
// Returns: [{ teams: [...], players: [...flattened roster...] }, ...]
export function buildTeamLobbies(teams, teamSize, teamsPerLobby, seedingMethod) {
  teamSize = teamSize || 4;
  teamsPerLobby = teamsPerLobby || 2;
  if (!teams || teams.length === 0) return [];
  var pool = [].concat(teams);
  if (seedingMethod === "random") {
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
  } else {
    // snake / rank-based / default: sort by seed descending
    pool.sort(function(a, b) { return (b.seed || 0) - (a.seed || 0); });
  }
  var lobbies = [];
  // Snake-pair only makes sense when exactly 2 teams play per lobby (4v4 squads).
  // For 4 teams per lobby (Double Up) we just chunk in order regardless of seed mode.
  if (teamsPerLobby === 2 && (seedingMethod === "snake" || !seedingMethod)) {
    var lo = 0;
    var hi = pool.length - 1;
    while (lo < hi) {
      var lobbyTeams = [pool[lo], pool[hi]];
      lobbies.push({ teams: lobbyTeams, players: flattenLobbyRoster(lobbyTeams, teamSize) });
      lo += 1; hi -= 1;
    }
    // Odd team count: drop a one-team "bye" lobby into the closest lobby as a
    // third team rather than booking an opponent-less game. Caller surfaces
    // the bye via the returned `byes` array so the admin can warn the host.
    if (lo === hi) {
      if (lobbies.length > 0) {
        var lastLobby = lobbies[lobbies.length - 1];
        lastLobby.teams.push(pool[lo]);
        lastLobby.players = flattenLobbyRoster(lastLobby.teams, teamSize);
        lastLobby.bye_team_id = pool[lo].id;
      } else {
        lobbies.push({ teams: [pool[lo]], players: flattenLobbyRoster([pool[lo]], teamSize), bye_team_id: pool[lo].id });
      }
    }
  } else {
    // Sequential chunks of teamsPerLobby
    for (var k = 0; k < pool.length; k += teamsPerLobby) {
      var chunk = pool.slice(k, k + teamsPerLobby);
      var lob = { teams: chunk, players: flattenLobbyRoster(chunk, teamSize) };
      if (chunk.length < teamsPerLobby) {
        lob.short_lobby = true;
      }
      lobbies.push(lob);
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

// Scoring for a single 2v2 Double Up lobby game.
//
// teamPlacements: [{team_id, placement}] where placement is 1..4 (team finish).
//   Both partners share the placement; per-player point fan-out happens at the
//   caller (each partner gets the same score).
// roundNumber (optional): for Swiss DU, applies DOUBLE_UP_MULTIPLIERS in
//   late rounds. Ignored for casual.
// pointsScale: 'double_up' (no multipliers) or 'double_up_swiss' (multipliers).
//
// Returns: [{team_id, score, perPartner, placement}] sorted by score desc.
//   `perPartner` is what each of the two partners receives in season-style
//   per-player records (currently both partners get the team's score, since
//   custom-only).
export function scoreDoubleUpGame(teamPlacements, roundNumber, pointsScale) {
  var rows = (teamPlacements || []).map(function(t) {
    var place = t.placement || 0;
    var base = (DOUBLE_UP_PTS[place] || 0);
    var mult = 1;
    if (pointsScale === "double_up_swiss" && roundNumber && DOUBLE_UP_MULTIPLIERS[roundNumber]) {
      mult = DOUBLE_UP_MULTIPLIERS[roundNumber];
    }
    var score = Math.round(base * mult);
    return { team_id: t.team_id, placement: place, score: score, perPartner: score };
  });
  rows.sort(function(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return (a.placement || 9) - (b.placement || 9);
  });
  return rows;
}

// Convenience dispatcher. Picks the right scoring function based on
// pointsScale. For solo, returns null (callers use computeTournamentStandings
// path instead).
export function scoreLobbyGame(opts) {
  var scale = (opts && opts.pointsScale) || "standard";
  if (scale === "double_up" || scale === "double_up_swiss") {
    return scoreDoubleUpGame(opts.teamPlacements, opts.roundNumber, scale);
  }
  if (opts && opts.playerPlacements) {
    return scoreTeamGame(opts.playerPlacements);
  }
  return [];
}

// Aggregate multiple Double Up game results into per-team tournament
// standings. Applies the Discord-style tiebreaker chain (adapted to 4-team):
//   1. Total points (with multipliers already baked in via scoreDoubleUpGame)
//   2. Most top-2 finishes (equivalent of solo "top-4")
//   3. Fewest 4ths (equivalent of solo "fewest bot-3s")
//   4. Most 1sts
//   5. Best placement in the most recent game
//
// gameRows: [{team_id, placement, score, round_number?}] - one row per team per game
// Returns: [{team_id, totalPoints, top2, fourths, firsts, games, lastPlacement}]
//   sorted by the tiebreaker chain (best team first).
export function computeDoubleUpStandings(gameRows) {
  var byTeam = {};
  (gameRows || []).forEach(function(g) {
    var tid = g.team_id;
    if (!tid) return;
    if (!byTeam[tid]) {
      byTeam[tid] = {
        team_id: tid,
        totalPoints: 0,
        top2: 0,
        fourths: 0,
        firsts: 0,
        games: 0,
        lastRound: -1,
        lastPlacement: 9
      };
    }
    var s = byTeam[tid];
    var place = g.placement || 0;
    s.totalPoints += (g.score || 0);
    s.games += 1;
    if (place === 1) { s.firsts += 1; s.top2 += 1; }
    else if (place === 2) { s.top2 += 1; }
    else if (place === 4) { s.fourths += 1; }
    var rnd = g.round_number || 0;
    if (rnd > s.lastRound) { s.lastRound = rnd; s.lastPlacement = place || 9; }
  });
  return Object.keys(byTeam).map(function(k) { return byTeam[k]; })
    .sort(function(a, b) {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.top2 !== a.top2) return b.top2 - a.top2;
      if (a.fourths !== b.fourths) return a.fourths - b.fourths;
      if (b.firsts !== a.firsts) return b.firsts - a.firsts;
      return (a.lastPlacement || 9) - (b.lastPlacement || 9);
    });
}

// Resolve the lobby shape from a tournament row. Returns
// {teamSize, teamsPerLobby, pointsScale, mode}. Falls back to solo when
// neither column nor format preset specifies anything.
export function resolveLobbyShape(tournament) {
  if (!tournament) return {teamSize:1, teamsPerLobby:1, pointsScale:"standard", mode:"solo"};
  var teamSize = tournament.team_size || 1;
  var teamsPerLobby = tournament.teams_per_lobby || (teamSize === 4 ? 2 : (teamSize === 2 ? 4 : 1));
  var pointsScale = tournament.points_scale || "standard";
  var mode = "solo";
  if (teamSize === 4 && teamsPerLobby === 2) mode = "squads_4v4";
  else if (teamSize === 2 && teamsPerLobby === 4) mode = "double_up_2v2";
  return {teamSize:teamSize, teamsPerLobby:teamsPerLobby, pointsScale:pointsScale, mode:mode};
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
