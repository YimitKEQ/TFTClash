// Unit tests for the per-clash Day Summary standings builder.
// Runs on Node's built-in test runner: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildClashDayStandings } from '../clashSummary.js';

test('day winner is the clash points leader, not the season leader', function () {
  // Season leader is A (100 season pts) but on THIS clash B won the day.
  var players = [
    { id: 'A', name: 'Alpha', rank: 'Gold', region: 'EU', pts: 100 },
    { id: 'B', name: 'Bravo', rank: 'Iron', region: 'EU', pts: 10 }
  ];
  var results = [
    { player_id: 'B', final_placement: 1, total_points: 30 },
    { player_id: 'A', final_placement: 5, total_points: 12 }
  ];
  var standings = buildClashDayStandings(results, players);
  assert.equal(standings[0].id, 'B');               // day winner
  assert.notEqual(standings[0].id, players[0].id);  // NOT the season leader (A)
  assert.equal(standings[0].dayPts, 30);
});

test('ranks by authoritative final_placement, ties fall back to day points', function () {
  var players = [
    { id: 'A', name: 'Alpha' }, { id: 'B', name: 'Bravo' }, { id: 'C', name: 'Charlie' }
  ];
  var results = [
    { player_id: 'C', final_placement: 2, total_points: 20 },
    { player_id: 'A', final_placement: 1, total_points: 25 },
    { player_id: 'B', final_placement: 3, total_points: 18 }
  ];
  var ids = buildClashDayStandings(results, players).map(function (r) { return r.id; });
  assert.deepEqual(ids, ['A', 'C', 'B']);
});

test('enriches avg/wins/top4 from game_results without changing rank order', function () {
  var players = [{ id: 'A', name: 'Alpha' }, { id: 'B', name: 'Bravo' }];
  var results = [
    { player_id: 'A', final_placement: 1, total_points: 16 },
    { player_id: 'B', final_placement: 2, total_points: 9 }
  ];
  var gameResults = [
    { player_id: 'A', placement: 1, game_number: 1 }, { player_id: 'A', placement: 1, game_number: 2 },
    { player_id: 'B', placement: 4, game_number: 1 }, { player_id: 'B', placement: 2, game_number: 2 }
  ];
  var standings = buildClashDayStandings(results, players, gameResults);
  assert.equal(standings[0].id, 'A');
  assert.equal(standings[0].wins, 2);
  assert.equal(standings[0].avgPlacement, 1);
  assert.equal(standings[1].avgPlacement, 3); // (4+2)/2
});

test('falls back to a placeholder name when the player left the roster', function () {
  var standings = buildClashDayStandings(
    [{ player_id: 'ghost', final_placement: 1, total_points: 8 }], []
  );
  assert.equal(standings[0].name, 'Player ghost');
});
