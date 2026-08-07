/**
 * Tests for lib/board.js, the card classification engine.
 *
 * This is the boring critical path: every nudge, ping, standup and dashboard
 * number in the bot is derived from these four predicates. Getting "stuck"
 * wrong by a day means pinging the whole crew about work that is fine.
 *
 * Every case pins an explicit `now` so the suite cannot drift with the clock.
 */

import './env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  assigneesOf,
  buildAccountability,
  isBlocked,
  isDueSoon,
  isOverdue,
  staleDays,
} from '../lib/board.js';

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

// ---- isOverdue ---------------------------------------------------------------

test('isOverdue only fires on a past due date for unfinished work', function() {
  assert.equal(isOverdue(card({ due_date: daysAgo(1) }), NOW), true);
  assert.equal(isOverdue(card({ due_date: daysAhead(1) }), NOW), false);
  assert.equal(isOverdue(card({ due_date: null }), NOW), false, 'no date means never overdue');
});

test('a finished card is never overdue', function() {
  assert.equal(isOverdue(card({ due_date: daysAgo(30), column_id: 'published' }), NOW), false);
  assert.equal(isOverdue(card({ due_date: daysAgo(30), column_id: 'archive' }), NOW), false);
});

test('isOverdue tolerates junk input', function() {
  assert.equal(isOverdue(null, NOW), false);
  assert.equal(isOverdue(card({ due_date: 'not a date' }), NOW), false);
});

// ---- staleDays ---------------------------------------------------------------

test('staleDays stays silent below the five day threshold', function() {
  assert.equal(staleDays(card({ column_changed_at: daysAgo(4) }), NOW), 0);
  assert.equal(staleDays(card({ column_changed_at: daysAgo(5) }), NOW), 5);
  assert.equal(staleDays(card({ column_changed_at: daysAgo(12) }), NOW), 12);
});

test('staleDays falls back through the timestamp columns', function() {
  var noColumnStamp = { column_id: 'production', updated_at: daysAgo(9) };
  assert.equal(staleDays(noColumnStamp, NOW), 9);

  var onlyCreated = { column_id: 'production', created_at: daysAgo(11) };
  assert.equal(staleDays(onlyCreated, NOW), 11);

  assert.equal(staleDays({ column_id: 'production' }, NOW), 0, 'no timestamp at all is not stuck');
});

test('a finished card is never stuck', function() {
  assert.equal(staleDays(card({ column_id: 'published', column_changed_at: daysAgo(60) }), NOW), 0);
});

// ---- isDueSoon ---------------------------------------------------------------

test('isDueSoon covers the next two days and nothing else', function() {
  assert.equal(isDueSoon(card({ due_date: daysAhead(0) }), NOW), true);
  assert.equal(isDueSoon(card({ due_date: daysAhead(2) }), NOW), true);
  assert.equal(isDueSoon(card({ due_date: daysAhead(3) }), NOW), false);
});

test('an overdue card is overdue, not due soon', function() {
  var c = card({ due_date: daysAgo(1) });
  assert.equal(isOverdue(c, NOW), true);
  assert.equal(isDueSoon(c, NOW), false);
});

// ---- isBlocked ---------------------------------------------------------------

test('isBlocked needs the flag and unfinished work', function() {
  assert.equal(isBlocked(card({ blocked: true })), true);
  assert.equal(isBlocked(card({ blocked: false })), false);
  assert.equal(isBlocked(card({ blocked: true, column_id: 'published' })), false);
  assert.equal(isBlocked(card({ blocked: 'yes' })), false, 'only a real boolean counts');
  assert.equal(isBlocked(null), false);
});

// ---- assigneesOf -------------------------------------------------------------

test('assigneesOf prefers the array and falls back to the single field', function() {
  assert.deepEqual(assigneesOf({ assignees: ['A', 'B'] }), ['A', 'B']);
  assert.deepEqual(assigneesOf({ assignees: [], assignee: 'A' }), ['A']);
  assert.deepEqual(assigneesOf({ assignee: 'A' }), ['A']);
  assert.deepEqual(assigneesOf({}), []);
  assert.deepEqual(assigneesOf(null), []);
});

test('assigneesOf strips empty entries', function() {
  assert.deepEqual(assigneesOf({ assignees: ['A', '', null, 'B'] }), ['A', 'B']);
});

// ---- buildAccountability -----------------------------------------------------

test('buildAccountability totals every dimension including blocked', function() {
  var cards = [
    card({ id: '1', due_date: daysAgo(2) }),                                  // overdue
    card({ id: '2', column_changed_at: daysAgo(9) }),                         // stuck
    card({ id: '3', due_date: daysAhead(1) }),                                // due soon
    card({ id: '4', blocked: true }),                                         // blocked
    card({ id: '5', column_id: 'published' }),                                // done
  ];
  var acc = buildAccountability(cards, NOW);

  assert.equal(acc.totals.cards, 5);
  assert.equal(acc.totals.active, 4, 'published does not count as active');
  assert.equal(acc.totals.overdue, 1);
  assert.equal(acc.totals.stuck, 1);
  assert.equal(acc.totals.dueSoon, 1);
  assert.equal(acc.totals.blocked, 1);
});

test('buildAccountability seeds every known crew member', function() {
  var acc = buildAccountability([], NOW);
  assert.ok(acc.members.Levitate, 'a crew member with no cards still appears');
  assert.deepEqual(acc.members.Levitate.active, []);
  assert.deepEqual(acc.members.Levitate.blocked, []);
});

test('buildAccountability files a card under every one of its owners', function() {
  var cards = [card({ id: '1', assignees: ['Levitate', 'Fridley'], due_date: daysAgo(1) })];
  var acc = buildAccountability(cards, NOW);
  assert.equal(acc.members.Levitate.overdue.length, 1);
  assert.equal(acc.members.Fridley.overdue.length, 1);
  assert.equal(acc.totals.overdue, 1, 'but the board total counts the card once');
});

test('buildAccountability tallies per department', function() {
  var cards = [
    card({ id: '1', department: 'engineering', due_date: daysAgo(1) }),
    card({ id: '2', department: 'design' }),
    card({ id: '3', department: 'engineering', blocked: true }),
  ];
  var acc = buildAccountability(cards, NOW);
  var eng = acc.departments.filter(function(d) { return d.id === 'engineering'; })[0];
  var design = acc.departments.filter(function(d) { return d.id === 'design'; })[0];

  assert.equal(eng.total, 2);
  assert.equal(eng.overdue, 1);
  assert.equal(eng.blocked, 1);
  assert.equal(design.total, 1);
  assert.equal(design.overdue, 0);
});

test('buildAccountability survives an empty or junk card list', function() {
  assert.equal(buildAccountability([], NOW).totals.cards, 0);
  assert.equal(buildAccountability(null, NOW).totals.cards, 0);
  assert.equal(buildAccountability(undefined, NOW).totals.active, 0);
});
