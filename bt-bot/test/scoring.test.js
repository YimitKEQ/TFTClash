/**
 * Tests for lib/scoring.js and the pure parts of lib/cards.js.
 *
 * The scorecard is what the crew gets judged by, so the weights have to be
 * deliberate and stable. The card ranking is what autocomplete shows, so a
 * regression there makes every /card verb feel broken.
 */

import './env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { memberScorecard, buildDigest, accountabilityStanding } from '../lib/scoring.js';
import { rankCards, isKnownColumn, assigneePatch } from '../lib/cards.js';

var NOW = new Date('2026-08-07T12:00:00Z');

function daysAgo(n) {
  return new Date(NOW.getTime() - n * 86400000).toISOString();
}

function daysAhead(n) {
  return new Date(NOW.getTime() + n * 86400000).toISOString();
}

function card(overrides) {
  return Object.assign({
    id: 'c1',
    title: 'A card',
    column_id: 'production',
    department: 'engineering',
    assignees: ['Levitate'],
    blocked: false,
    column_changed_at: NOW.toISOString(),
  }, overrides || {});
}

// ---- memberScorecard ---------------------------------------------------------

test('memberScorecard only counts the cards that person owns', function() {
  var cards = [
    card({ id: '1', assignees: ['Levitate'], due_date: daysAgo(1) }),
    card({ id: '2', assignees: ['Fridley'], due_date: daysAgo(1) }),
  ];
  assert.equal(memberScorecard(cards, 'Levitate', NOW).overdue, 1);
  assert.equal(memberScorecard(cards, 'Fridley', NOW).overdue, 1);
  assert.equal(memberScorecard(cards, 'Tactic', NOW).overdue, 0);
});

test('shippedThisWeek counts published cards inside the seven day window', function() {
  var cards = [
    card({ id: '1', column_id: 'published', updated_at: daysAgo(2) }),
    card({ id: '2', column_id: 'published', updated_at: daysAgo(6) }),
    card({ id: '3', column_id: 'published', updated_at: daysAgo(9) }),
  ];
  assert.equal(memberScorecard(cards, 'Levitate', NOW).shippedThisWeek, 2);
});

test('a published card is not counted as active', function() {
  var cards = [card({ id: '1', column_id: 'published', updated_at: daysAgo(1) })];
  assert.equal(memberScorecard(cards, 'Levitate', NOW).active, 0);
});

test('blocked ignores finished work', function() {
  var cards = [
    card({ id: '1', blocked: true }),
    card({ id: '2', blocked: true, column_id: 'published' }),
    card({ id: '3', blocked: true, column_id: 'archive' }),
  ];
  assert.equal(memberScorecard(cards, 'Levitate', NOW).blocked, 1);
});

// ---- accountabilityStanding --------------------------------------------------

test('a clean slate scores full marks', function() {
  var s = accountabilityStanding({ overdue: 0, stuck: 0, blocked: 0, shippedThisWeek: 0 });
  assert.equal(s.score, 100);
  assert.equal(s.band, 'On top of it');
});

test('overdue is weighted heavier than stuck', function() {
  var overdue = accountabilityStanding({ overdue: 1 }).score;
  var stuck = accountabilityStanding({ stuck: 1 }).score;
  assert.ok(overdue < stuck, 'an overdue card must hurt more than a quiet one');
});

test('shipping pulls the standing back up, but only so far', function() {
  var none = accountabilityStanding({ overdue: 2, shippedThisWeek: 0 }).score;
  var some = accountabilityStanding({ overdue: 2, shippedThisWeek: 2 }).score;
  assert.ok(some > none);

  // The shipping bonus is capped so nobody can ship their way out of a pile of
  // overdue work without ever closing it.
  var many = accountabilityStanding({ overdue: 2, shippedThisWeek: 50 }).score;
  var three = accountabilityStanding({ overdue: 2, shippedThisWeek: 3 }).score;
  assert.equal(many, three);
});

test('the standing is clamped to 0..100', function() {
  assert.equal(accountabilityStanding({ overdue: 99 }).score, 0);
  assert.equal(accountabilityStanding({ shippedThisWeek: 99 }).score, 100);
});

test('every band maps to a verdict and a colour', function() {
  [
    { overdue: 0 },
    { stuck: 3 },
    { overdue: 3 },
    { overdue: 9 },
  ].forEach(function(input) {
    var s = accountabilityStanding(input);
    assert.ok(s.band && s.band.length > 0);
    assert.ok(s.verdict && s.verdict.length > 0);
    assert.equal(typeof s.color, 'number');
  });
});

test('accountabilityStanding tolerates a missing scorecard', function() {
  assert.equal(accountabilityStanding(null).score, 100);
  assert.equal(accountabilityStanding(undefined).score, 100);
});

// ---- buildDigest -------------------------------------------------------------

test('buildDigest returns a row per crew member plus board totals', function() {
  var cards = [
    card({ id: '1', assignees: ['Levitate'], column_id: 'published', updated_at: daysAgo(1) }),
    card({ id: '2', assignees: ['Fridley'], due_date: daysAgo(3) }),
    card({ id: '3', assignees: ['Fridley'], blocked: true }),
  ];
  var digest = buildDigest(cards, NOW);

  assert.ok(digest.rows.length >= 8, 'one row per crew member');
  assert.equal(digest.totals.shippedThisWeek, 1);
  assert.equal(digest.totals.overdue, 1);
  assert.equal(digest.totals.blocked, 1);

  var fridley = digest.rows.filter(function(r) { return r.name === 'Fridley'; })[0];
  assert.equal(fridley.overdue, 1);
  assert.equal(fridley.blocked, 1);
});

// ---- rankCards ---------------------------------------------------------------

var POOL = [
  { id: '1', title: 'Ship the trailer', column_id: 'production', department: 'content', blocked: false, updated_at: daysAgo(1) },
  { id: '2', title: 'Trailer thumbnail', column_id: 'writing', department: 'design', blocked: true, updated_at: daysAgo(2) },
  { id: '3', title: 'Rework the intro', column_id: 'published', department: 'content', blocked: false, updated_at: daysAgo(3) },
  { id: '4', title: 'Fix the deploy script', column_id: 'production', department: 'engineering', blocked: false, updated_at: daysAgo(4) },
];

test('rankCards prefers a prefix match over a substring match', function() {
  var out = rankCards(POOL, 'trailer', 'any', 25);
  assert.equal(out[0].id, '2', 'Trailer thumbnail starts with the query');
  assert.equal(out[1].id, '1');
});

test('rankCards can match on department', function() {
  var out = rankCards(POOL, 'engineering', 'any', 25);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, '4');
});

test('rankCards drops non-matches entirely', function() {
  assert.equal(rankCards(POOL, 'zzzznothing', 'any', 25).length, 0);
});

test('an empty query returns everything, most recently touched first', function() {
  var out = rankCards(POOL, '', 'any', 25);
  assert.equal(out.length, 4);
  assert.equal(out[0].id, '1', 'touched one day ago');
  assert.equal(out[3].id, '4', 'touched four days ago');
});

test('the open filter hides finished cards', function() {
  var ids = rankCards(POOL, '', 'open', 25).map(function(c) { return c.id; });
  assert.ok(ids.indexOf('3') === -1, 'the published card is gone');
  assert.equal(ids.length, 3);
});

test('the blocked filter keeps only blocked, unfinished cards', function() {
  var out = rankCards(POOL, '', 'blocked', 25);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, '2');
});

test('rankCards respects the limit that Discord imposes', function() {
  assert.equal(rankCards(POOL, '', 'any', 2).length, 2);
});

test('rankCards survives a missing pool', function() {
  assert.deepEqual(rankCards(null, 'x', 'any', 25), []);
});

// ---- small card helpers ------------------------------------------------------

test('isKnownColumn accepts the pipeline and rejects anything else', function() {
  assert.equal(isKnownColumn('ideas'), true);
  assert.equal(isKnownColumn('PUBLISHED'), true);
  assert.equal(isKnownColumn('nonsense'), false);
  assert.equal(isKnownColumn(''), false);
  assert.equal(isKnownColumn(null), false);
});

test('assigneePatch writes both owner fields so the board cannot disagree', function() {
  assert.deepEqual(assigneePatch('Levitate'), { assignee: 'Levitate', assignees: ['Levitate'] });
  assert.deepEqual(assigneePatch(''), { assignee: '', assignees: [] });
  assert.deepEqual(assigneePatch(null), { assignee: '', assignees: [] });
});
