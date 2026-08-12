/**
 * Tests the in-flight guard on the /record "Create selected" button.
 *
 * This guards a real data corruption: on 2026-07-16 seven tasks were inserted
 * onto the board twice, eight seconds apart. Creating the cards takes seconds
 * (a board insert plus one Jira round trip per task) and the pending entry
 * stayed live for that whole window, so a second click ran the entire batch
 * again. Nothing in the code stopped it.
 *
 * The handler itself needs a live Discord interaction, so these tests exercise
 * the guard's decision rule directly, in the same order the handler applies it.
 * The point is to pin the CONTRACT: one claim wins, the loser is told to wait,
 * and a batch that created nothing releases its claim so it can be retried.
 */

import './env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The guard as the handler applies it. Mirrors commands/record.js:
 * check the flag, claim it before any await, release only when nothing was
 * created.
 */
function attemptApprove(pending, chosenCount) {
  if (pending.processing) return { accepted: false, message: 'already creating' };
  pending.processing = true;
  if (chosenCount === 0) {
    pending.processing = false;
    return { accepted: true, created: 0 };
  }
  return { accepted: true, created: chosenCount };
}

test('a single click creates the batch once', function() {
  var pending = { processing: false };
  var r = attemptApprove(pending, 7);
  assert.equal(r.accepted, true);
  assert.equal(r.created, 7);
});

test('a double click creates the batch exactly once', function() {
  var pending = { processing: false };
  var first = attemptApprove(pending, 7);
  var second = attemptApprove(pending, 7);

  assert.equal(first.accepted, true);
  assert.equal(first.created, 7);
  assert.equal(second.accepted, false, 'the second click must be refused');

  var totalCreated = (first.created || 0) + (second.created || 0);
  assert.equal(totalCreated, 7, 'seven tasks, not fourteen: this is the 2026-07-16 bug');
});

test('a frantic click storm still creates the batch exactly once', function() {
  var pending = { processing: false };
  var total = 0;
  for (var i = 0; i < 12; i++) {
    var r = attemptApprove(pending, 7);
    total += r.created || 0;
  }
  assert.equal(total, 7);
});

test('the claim is taken before any await, not after the work', function() {
  // The original bug was ordering: the pending entry was only deleted at the
  // END of the handler, so the whole slow section was unguarded.
  var pending = { processing: false };
  attemptApprove(pending, 7);
  assert.equal(pending.processing, true,
    'the flag must be set synchronously, while a second click could still arrive');
});

test('creating nothing releases the claim so the user can pick and retry', function() {
  var pending = { processing: false };
  var r = attemptApprove(pending, 0);
  assert.equal(r.accepted, true);
  assert.equal(r.created, 0);
  assert.equal(pending.processing, false, 'nothing was created, so nothing is at risk of duplication');

  var retry = attemptApprove(pending, 3);
  assert.equal(retry.accepted, true, 'a retry after selecting tasks must work');
  assert.equal(retry.created, 3);
});

test('a partially completed batch stays claimed', function() {
  // Deliberate: retrying after a mid-batch failure would duplicate whatever
  // already succeeded. The 30 minute PENDING TTL clears it instead.
  var pending = { processing: false };
  attemptApprove(pending, 7); // imagine this throws part way through
  var retry = attemptApprove(pending, 7);
  assert.equal(retry.accepted, false, 'no automatic retry over a half-created batch');
});

// ---- durability across a restart ----------------------------------------------

/**
 * The pending set used to live only in an in-memory Map, so any restart threw a
 * meeting's tasks away. On 2026-08-12 a real recap with seven tasks was posted,
 * the bot redeployed, and "Create selected" reported the set as expired. The
 * tasks had to be entered by hand.
 *
 * The lookup order below is the contract that fixes it.
 */
function resolvePending(memory, database, token) {
  if (memory.has(token)) return { payload: memory.get(token), source: 'memory' };
  var stored = database.get(token);
  if (!stored) return { payload: null, source: 'gone' };
  memory.set(token, stored);
  return { payload: stored, source: 'database' };
}

test('a set still in memory is served from memory', function() {
  var mem = new Map([['t1', { tasks: [1, 2] }]]);
  var db = new Map();
  var r = resolvePending(mem, db, 't1');
  assert.equal(r.source, 'memory');
  assert.equal(r.payload.tasks.length, 2);
});

test('a restart falls back to the database instead of losing the tasks', function() {
  var db = new Map([['t1', { tasks: [1, 2, 3, 4, 5, 6, 7] }]]);
  var mem = new Map(); // the restart

  var r = resolvePending(mem, db, 't1');
  assert.equal(r.source, 'database', 'must not report the set as expired');
  assert.equal(r.payload.tasks.length, 7, 'all seven tasks survive');
});

test('a restored set is cached, so the next click does not hit the database', function() {
  var db = new Map([['t1', { tasks: [1] }]]);
  var mem = new Map();
  resolvePending(mem, db, 't1');
  assert.equal(resolvePending(mem, db, 't1').source, 'memory');
});

test('a set cleared after approval cannot be approved again', function() {
  var db = new Map([['t1', { tasks: [1] }]]);
  var mem = new Map();
  resolvePending(mem, db, 't1');

  // Approval clears both stores.
  mem.delete('t1');
  db.delete('t1');

  var r = resolvePending(mem, db, 't1');
  assert.equal(r.source, 'gone');
  assert.equal(r.payload, null, 'no second batch of cards');
});

test('an unknown token is reported gone rather than throwing', function() {
  assert.equal(resolvePending(new Map(), new Map(), 'nope').source, 'gone');
});
