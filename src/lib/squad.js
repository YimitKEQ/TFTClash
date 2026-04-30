/**
 * 4v4 Squads tournament logic - pure functions, no DB.
 *
 * Lobby model: 8 players = 2 teams of 4. Mechanically identical to solo TFT.
 * Scoring: sum of placement points per team. Standard scale matches PTS in constants.
 * Tiebreakers (industry standard): 1st-place finisher -> top-4 count -> top-2 count
 *  -> last-game finish.
 */
import { PTS } from './constants.js';

// Placement points scales. Standard matches your existing PTS constant.
// Win-weighted is the Mortdog Madness flavor (extra weight on 1st).
export var POINT_SCALES = {
  standard: { 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 },
  weighted: { 1: 10, 2: 8, 3: 7, 4: 6, 5: 4, 6: 3, 7: 2, 8: 1 }
};

export function pointsFor(placement, scaleId) {
  var scale = POINT_SCALES[scaleId] || POINT_SCALES.standard;
  return scale[placement] || 0;
}

// Team-level config defaults. Used by the 4v4 admin form.
export var SQUAD_DEFAULTS = {
  teamSize: 4,
  teamsPerLobby: 2,
  maxTeams: 16,
  subsAllowed: 2,
  pointsScale: 'standard',
  leaveCooldownMinutes: 60,
  groupStageRounds: 3,
  groupSize: 4,
  matchFormat: { group: 'Bo1', quarter: 'Bo3', semi: 'Bo3', final: 'Bo5' },
  checkmateThreshold: 0
};

// ─── Team formation rules ────────────────────────────────────────────────────

export function canPlayerJoinTeam(player, opts) {
  var nowTs = (opts && opts.nowTs) || Date.now();
  var leaveCooldownMs = ((opts && opts.cooldownMinutes) || SQUAD_DEFAULTS.leaveCooldownMinutes) * 60000;
  var adminOverride = !!(opts && opts.adminOverride);
  if (player.currentTeamId) {
    return { allowed: false, reason: 'already_on_team' };
  }
  if (!adminOverride && player.lastLeftTeamAt) {
    var elapsed = nowTs - new Date(player.lastLeftTeamAt).getTime();
    if (elapsed < leaveCooldownMs) {
      var minsLeft = Math.ceil((leaveCooldownMs - elapsed) / 60000);
      return { allowed: false, reason: 'cooldown', minutesLeft: minsLeft };
    }
  }
  return { allowed: true };
}

export function validateTeamForRegistration(team, opts) {
  var teamSize = (opts && opts.teamSize) || SQUAD_DEFAULTS.teamSize;
  var subsAllowed = (opts && opts.subsAllowed) || SQUAD_DEFAULTS.subsAllowed;
  var members = team.members || [];
  var actives = members.filter(function(m) { return m.role === 'captain' || m.role === 'main'; });
  var subs = members.filter(function(m) { return m.role === 'sub'; });
  if (actives.length < teamSize) {
    return { ok: false, reason: 'need_actives', need: teamSize - actives.length };
  }
  if (subs.length > subsAllowed) {
    return { ok: false, reason: 'too_many_subs', max: subsAllowed };
  }
  var regions = {};
  members.forEach(function(m) { if (m.region) regions[m.region] = true; });
  if (Object.keys(regions).length > 1) {
    return { ok: false, reason: 'mixed_regions' };
  }
  return { ok: true };
}

// ─── Team-snake seeding ──────────────────────────────────────────────────────

// Distributes teams into N lobbies in snake pattern. Each lobby gets 2 teams.
// Uses team.seedScore for ordering (higher = better seed).
export function snakeSeedTeams(teams, lobbyCount) {
  var lc = Math.max(1, lobbyCount);
  var sorted = teams.slice().sort(function(a, b) {
    return (b.seedScore || 0) - (a.seedScore || 0);
  });
  var lobbies = [];
  for (var i = 0; i < lc; i++) lobbies.push([]);
  sorted.forEach(function(t, idx) {
    var row = Math.floor(idx / lc);
    var col = row % 2 === 0 ? (idx % lc) : (lc - 1 - (idx % lc));
    lobbies[col].push(t);
  });
  return lobbies;
}

// Single round-robin pairings for a 4-team group.
// Returns an array of rounds; each round has 2 lobbies (pair of teams each).
export function buildGroupRoundRobin(group) {
  if (group.length !== 4) {
    throw new Error('buildGroupRoundRobin requires exactly 4 teams');
  }
  return [
    [[group[0], group[1]], [group[2], group[3]]],
    [[group[0], group[2]], [group[1], group[3]]],
    [[group[0], group[3]], [group[1], group[2]]]
  ];
}

// ─── Per-lobby scoring ───────────────────────────────────────────────────────

// Given a lobby of 8 players (each tagged with teamId) and their placements
// (map of playerId -> placement 1..8), compute team scores + apply tiebreakers.
//
// Returns:
//   { teams: [{teamId, score, wins, top4, top2, firstPlacePlayerId, members:[...]}],
//     winnerTeamId, tiebreakerUsed }
export function scoreLobby(lobby, placements, scaleId) {
  var teamMap = {};
  lobby.players.forEach(function(p) {
    var pl = placements[p.playerId];
    if (!pl) return;
    if (!teamMap[p.teamId]) {
      teamMap[p.teamId] = {
        teamId: p.teamId,
        score: 0,
        wins: 0,
        top4: 0,
        top2: 0,
        firstPlacePlayerId: null,
        members: []
      };
    }
    var t = teamMap[p.teamId];
    var pts = pointsFor(pl, scaleId);
    t.score += pts;
    if (pl === 1) { t.wins += 1; t.firstPlacePlayerId = p.playerId; }
    if (pl <= 2) t.top2 += 1;
    if (pl <= 4) t.top4 += 1;
    t.members.push({ playerId: p.playerId, name: p.name, placement: pl, points: pts });
  });

  var teams = Object.keys(teamMap).map(function(k) { return teamMap[k]; });
  teams.forEach(function(t) {
    t.members.sort(function(a, b) { return a.placement - b.placement; });
  });

  if (teams.length === 0) return { teams: [], winnerTeamId: null, tiebreakerUsed: null };
  if (teams.length === 1) return { teams: teams, winnerTeamId: teams[0].teamId, tiebreakerUsed: null };

  var a = teams[0];
  var b = teams[1];
  var winner = null;
  var tiebreakerUsed = null;
  if (a.score !== b.score) {
    winner = a.score > b.score ? a.teamId : b.teamId;
  } else if (a.wins !== b.wins) {
    winner = a.wins > b.wins ? a.teamId : b.teamId;
    tiebreakerUsed = 'first_place';
  } else if (a.top4 !== b.top4) {
    winner = a.top4 > b.top4 ? a.teamId : b.teamId;
    tiebreakerUsed = 'top4_count';
  } else if (a.top2 !== b.top2) {
    winner = a.top2 > b.top2 ? a.teamId : b.teamId;
    tiebreakerUsed = 'top2_count';
  } else {
    // True deadlock - rare but fair. Coin-flip equivalent: stable order.
    winner = a.teamId;
    tiebreakerUsed = 'stable_order';
  }

  return { teams: teams, winnerTeamId: winner, tiebreakerUsed: tiebreakerUsed };
}

// Aggregate lobby outcomes across multiple lobbies (for a group stage or series).
export function aggregateTeamStandings(lobbyOutcomes) {
  var agg = {};
  lobbyOutcomes.forEach(function(out) {
    out.teams.forEach(function(t) {
      if (!agg[t.teamId]) {
        agg[t.teamId] = {
          teamId: t.teamId,
          totalScore: 0,
          lobbyWins: 0,
          lobbiesPlayed: 0,
          firstPlaceFinishes: 0,
          top4Finishes: 0,
          top2Finishes: 0
        };
      }
      var a = agg[t.teamId];
      a.totalScore += t.score;
      a.lobbiesPlayed += 1;
      a.firstPlaceFinishes += t.wins;
      a.top4Finishes += t.top4;
      a.top2Finishes += t.top2;
      if (out.winnerTeamId === t.teamId) a.lobbyWins += 1;
    });
  });
  var rows = Object.keys(agg).map(function(k) { return agg[k]; });
  rows.sort(function(x, y) {
    if (y.lobbyWins !== x.lobbyWins) return y.lobbyWins - x.lobbyWins;
    if (y.totalScore !== x.totalScore) return y.totalScore - x.totalScore;
    if (y.firstPlaceFinishes !== x.firstPlaceFinishes) return y.firstPlaceFinishes - x.firstPlaceFinishes;
    if (y.top4Finishes !== x.top4Finishes) return y.top4Finishes - x.top4Finishes;
    return y.top2Finishes - x.top2Finishes;
  });
  return rows;
}

// Best-of-N series: first team to ceil(N/2) lobby wins takes the series.
// Returns null if series not yet decided.
export function seriesWinner(lobbyOutcomes, bestOf) {
  var needed = Math.ceil(bestOf / 2);
  var counts = {};
  for (var i = 0; i < lobbyOutcomes.length; i++) {
    var w = lobbyOutcomes[i].winnerTeamId;
    if (!w) continue;
    counts[w] = (counts[w] || 0) + 1;
    if (counts[w] >= needed) return { winnerTeamId: w, decidedAtLobby: i + 1, score: counts };
  }
  return null;
}

// Convenience: PTS reference (for any consumer that wants the standard scale).
export var STANDARD_PTS = PTS;
