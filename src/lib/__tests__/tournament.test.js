// Unit tests for the tournament scoring, tiebreaker, and elimination-ladder
// engine. Runs on Node's built-in test runner (no extra deps):
//   node --test src/lib/__tests__
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeFlashStandings,
  computeTournamentStandings,
  applyCutLine,
  suggestedCutLine,
  scoreTeamGame,
  scoreDoubleUpGame,
  scoreLobbyGame,
  ladderSchedule,
  totalLadderGames,
  advanceCountAfterGame,
  ladderCutsAfterGame,
  applyLadderCut,
  TOURNAMENT_FORMATS
} from '../tournament.js';

// Build a game_results-style row. `points` is decoupled from placement so we
// can force equal totals while varying placement distributions.
function row(playerId, placement, points, gameNumber) {
  return { player_id: playerId, placement: placement, points: points, game_number: gameNumber || 1 };
}

function orderOf(rows) {
  return computeFlashStandings(rows, {
    playerLookup: function (id) { return { name: String(id) }; }
  }).map(function (p) { return p.id; });
}

test('tiebreaker: most Top 4 beats a player with more wins', function () {
  // Equal total points (10 each). X has a 1st (a win) but only one top4;
  // Y has two top4s and no wins. Spec ranks Top4 count above 1st-place count.
  var rows = [
    row('X', 1, 5), row('X', 8, 5),
    row('Y', 4, 5), row('Y', 4, 5)
  ];
  assert.deepEqual(orderOf(rows), ['Y', 'X']);
});

test('tiebreaker: fewest Bot 3s wins when Top 4 count is equal', function () {
  var rows = [
    row('X', 4, 5), row('X', 6, 5), // one top4, one bot3
    row('Y', 4, 5), row('Y', 5, 5)  // one top4, zero bot3
  ];
  assert.deepEqual(orderOf(rows), ['Y', 'X']);
});

test('tiebreaker: most 1st places wins when Top4 and Bot3 are equal', function () {
  var rows = [
    row('X', 1, 5), row('X', 5, 5), // one win
    row('Y', 2, 5), row('Y', 5, 5)  // zero wins
  ];
  assert.deepEqual(orderOf(rows), ['X', 'Y']);
});

test('tiebreaker: better last-game placement breaks an otherwise-full tie', function () {
  var rows = [
    row('X', 3, 5, 1), row('X', 5, 5, 2), // last game placement 5
    row('Y', 5, 5, 1), row('Y', 3, 5, 2)  // last game placement 3
  ];
  assert.deepEqual(orderOf(rows), ['Y', 'X']);
});

test('total points always dominates the tiebreaker chain', function () {
  var rows = [
    row('X', 8, 1), row('X', 8, 1), // 2 pts, all bot3, no top4
    row('Y', 1, 50)                 // 50 pts
  ];
  assert.deepEqual(orderOf(rows), ['Y', 'X']);
});

test('ladderSchedule: canonical 64-player ladder', function () {
  assert.deepEqual(ladderSchedule(64), [64, 56, 48, 40, 32, 24, 16, 8]);
});

test('ladderSchedule: canonical 128-player ladder', function () {
  assert.deepEqual(ladderSchedule(128), [128, 96, 64, 56, 48, 40, 32, 24, 16, 8]);
});

test('ladderSchedule: generic field cuts 8 per game down to 8', function () {
  assert.deepEqual(ladderSchedule(32), [32, 24, 16, 8]);
  assert.deepEqual(ladderSchedule(24), [24, 16, 8]);
  assert.deepEqual(ladderSchedule(8), [8]);
});

test('totalLadderGames matches schedule length', function () {
  assert.equal(totalLadderGames(64), 8);
  assert.equal(totalLadderGames(128), 10);
  assert.equal(totalLadderGames(32), 4);
});

test('advanceCountAfterGame: game 1 no cut, game 2 first cut, clamps past finals', function () {
  assert.equal(advanceCountAfterGame(64, 1), 64);
  assert.equal(advanceCountAfterGame(64, 2), 56);
  assert.equal(advanceCountAfterGame(64, 8), 8);
  assert.equal(advanceCountAfterGame(64, 99), 8);
});

test('ladderCutsAfterGame: no cut after game 1, cut after game 2', function () {
  assert.equal(ladderCutsAfterGame(64, 1), false);
  assert.equal(ladderCutsAfterGame(64, 2), true);
  assert.equal(ladderCutsAfterGame(64, 8), true);
});

test('applyLadderCut: takes the top N, eliminates the rest, mutates nothing', function () {
  var sorted = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  var res = applyLadderCut(sorted, 2);
  assert.deepEqual(res.advancing.map(function (p) { return p.id; }), ['a', 'b']);
  assert.deepEqual(res.eliminated.map(function (p) { return p.id; }), ['c', 'd']);
  assert.equal(sorted.length, 4); // unchanged
});

test('applyLadderCut: advanceCount >= length advances everyone', function () {
  var sorted = [{ id: 'a' }, { id: 'b' }];
  var res = applyLadderCut(sorted, 8);
  assert.equal(res.advancing.length, 2);
  assert.equal(res.eliminated.length, 0);
});

test('elimination_ladder format preset is registered with ladder cut mode', function () {
  var f = TOURNAMENT_FORMATS.elimination_ladder;
  assert.ok(f, 'preset exists');
  assert.equal(f.cutMode, 'ladder');
  assert.equal(f.cutEnabled, true);
});

// ---------------------------------------------------------------------------
// applyCutLine: the DEFAULT (threshold) elimination mode for a live clash.
// ---------------------------------------------------------------------------
test('applyCutLine: keeps players at/above the line, eliminates those below', function () {
  var standings = [
    { id: 'A', tournamentPts: 20, gamesInTournament: 4 },
    { id: 'B', tournamentPts: 12, gamesInTournament: 4 }, // exactly on the line -> survives
    { id: 'C', tournamentPts: 11, gamesInTournament: 4 }  // one under -> cut
  ];
  var res = applyCutLine(standings, 12, 4);
  assert.deepEqual(res.advancing.map(function (p) { return p.id; }), ['A', 'B']);
  assert.deepEqual(res.eliminated.map(function (p) { return p.id; }), ['C']);
});

test('applyCutLine: a player who has not yet played the cut game is never cut', function () {
  var standings = [
    { id: 'A', tournamentPts: 2, gamesInTournament: 2 }, // only 2 games, cut is after 4
    { id: 'B', tournamentPts: 2, gamesInTournament: 4 }  // reached the cut game, under line
  ];
  var res = applyCutLine(standings, 12, 4);
  assert.deepEqual(res.advancing.map(function (p) { return p.id; }), ['A']);
  assert.deepEqual(res.eliminated.map(function (p) { return p.id; }), ['B']);
});

test('applyCutLine: cutLine of 0 (or falsy) is a no-op that advances everyone', function () {
  var standings = [{ id: 'A', tournamentPts: 1, gamesInTournament: 9 }];
  var res = applyCutLine(standings, 0, 4);
  assert.equal(res.advancing.length, 1);
  assert.equal(res.eliminated.length, 0);
});

test('applyCutLine: does not mutate the input standings array', function () {
  var standings = [
    { id: 'A', tournamentPts: 20, gamesInTournament: 4 },
    { id: 'B', tournamentPts: 1, gamesInTournament: 4 }
  ];
  applyCutLine(standings, 12, 4);
  assert.equal(standings.length, 2);
});

test('suggestedCutLine: picks the right bracket per field size', function () {
  assert.deepEqual(
    [suggestedCutLine(128).cutLine, suggestedCutLine(128).cutAfterGame], [13, 4]);
  assert.deepEqual(
    [suggestedCutLine(64).cutLine, suggestedCutLine(64).cutAfterGame], [15, 3]);
  assert.deepEqual(
    [suggestedCutLine(32).cutLine, suggestedCutLine(32).cutAfterGame], [12, 3]);
  assert.equal(suggestedCutLine(8).cutLine, 0); // small event: no cut
});

// ---------------------------------------------------------------------------
// computeTournamentStandings: the season-clash standings writer. Same spec
// tiebreaker chain as computeFlashStandings, plus player-merge + filtering.
// ---------------------------------------------------------------------------
function gr(playerId, placement, points, gameNumber, tournamentId) {
  return {
    player_id: playerId, placement: placement, points: points,
    game_number: gameNumber || 1, tournamentId: tournamentId || 't1'
  };
}

test('computeTournamentStandings: sums points and ranks by the spec chain', function () {
  var players = [{ id: 'X', username: 'X' }, { id: 'Y', username: 'Y' }];
  var rows = [
    gr('X', 1, 5, 1), gr('X', 8, 5, 2), // 10 pts, 1 win, 1 top4, 1 bot3
    gr('Y', 4, 5, 1), gr('Y', 4, 5, 2)  // 10 pts, 0 win, 2 top4, 0 bot3
  ];
  var standings = computeTournamentStandings(players, rows, 't1');
  // Equal points; Y has more Top 4 so ranks ahead (Top4 beats win count).
  assert.deepEqual(standings.map(function (p) { return p.id; }), ['Y', 'X']);
  assert.equal(standings[0].tournamentPts, 10);
  assert.equal(standings.find(function (p) { return p.id === 'X'; }).bot3, 1);
});

test('computeTournamentStandings: excludes players with zero games', function () {
  var players = [{ id: 'X' }, { id: 'GHOST' }];
  var rows = [gr('X', 1, 8, 1)];
  var standings = computeTournamentStandings(players, rows, 't1');
  assert.deepEqual(standings.map(function (p) { return p.id; }), ['X']);
});

test('computeTournamentStandings: ignores results from other tournaments', function () {
  var players = [{ id: 'X' }];
  var rows = [gr('X', 1, 8, 1, 't1'), gr('X', 1, 8, 2, 'OTHER')];
  var standings = computeTournamentStandings(players, rows, 't1');
  assert.equal(standings[0].tournamentPts, 8); // only the t1 row counted
  assert.equal(standings[0].gamesInTournament, 1);
});

test('computeTournamentStandings: falls back to PTS when a row has no points', function () {
  var players = [{ id: 'X' }];
  var rows = [{ player_id: 'X', placement: 1, game_number: 1, tournamentId: 't1' }];
  var standings = computeTournamentStandings(players, rows, 't1');
  assert.equal(standings[0].tournamentPts, 8); // PTS[1] === 8
});

// ---------------------------------------------------------------------------
// scoreTeamGame / scoreDoubleUpGame / scoreLobbyGame: per-game scoring.
// ---------------------------------------------------------------------------
test('scoreTeamGame: team score is the sum of PTS for its players', function () {
  var placements = [
    { player_id: 'a1', team_id: 'A', placement: 1 },
    { player_id: 'a2', team_id: 'A', placement: 2 }, // 8 + 7 = 15
    { player_id: 'b1', team_id: 'B', placement: 3 },
    { player_id: 'b2', team_id: 'B', placement: 4 }  // 6 + 5 = 11
  ];
  var res = scoreTeamGame(placements);
  assert.deepEqual(res.map(function (t) { return t.team_id; }), ['A', 'B']);
  assert.equal(res[0].score, 15);
  assert.equal(res[1].score, 11);
});

test('scoreTeamGame: equal score breaks on best individual placement', function () {
  var placements = [
    { player_id: 'a1', team_id: 'A', placement: 1 },
    { player_id: 'a2', team_id: 'A', placement: 4 }, // 8 + 5 = 13, best=1
    { player_id: 'b1', team_id: 'B', placement: 2 },
    { player_id: 'b2', team_id: 'B', placement: 3 }  // 7 + 6 = 13, best=2
  ];
  var res = scoreTeamGame(placements);
  assert.equal(res[0].team_id, 'A'); // both 13 pts, A has the 1st place
});

test('scoreDoubleUpGame: uses DOUBLE_UP_PTS and applies swiss multipliers', function () {
  var casual = scoreDoubleUpGame(
    [{ team_id: 'A', placement: 1 }, { team_id: 'B', placement: 2 }], null, 'double_up');
  assert.equal(casual[0].score, 4); // DOUBLE_UP_PTS[1]
  assert.equal(casual[1].score, 3); // DOUBLE_UP_PTS[2]

  var swiss = scoreDoubleUpGame(
    [{ team_id: 'A', placement: 1 }], 4, 'double_up_swiss');
  assert.equal(swiss[0].score, 5); // round(4 * 1.25)
  assert.equal(swiss[0].perPartner, 5); // both partners receive it
});

test('scoreLobbyGame: dispatches by pointsScale', function () {
  var du = scoreLobbyGame({ pointsScale: 'double_up', teamPlacements: [{ team_id: 'A', placement: 1 }] });
  assert.equal(du[0].score, 4);

  var squads = scoreLobbyGame({ pointsScale: 'standard', playerPlacements: [
    { player_id: 'a1', team_id: 'A', placement: 1 }
  ] });
  assert.equal(squads[0].score, 8);

  var solo = scoreLobbyGame({ pointsScale: 'standard' }); // no playerPlacements
  assert.deepEqual(solo, []);
});
