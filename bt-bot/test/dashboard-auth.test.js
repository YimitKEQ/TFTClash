/**
 * Tests for the dashboard's auth primitives and for what the public /docs mount
 * is allowed to contain.
 *
 * This is a boring critical path in the truest sense: it is the only thing
 * between the internet and the whole board, every meeting transcript, and every
 * recap. The failure mode is silent by definition. Nobody gets an alert when a
 * shared token turns out to be guessable or when a runbook is readable without
 * one.
 */

import './env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { tokenMatches, lockoutState, recordFailure, clearFailures } from '../web/server.js';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var DOCS = path.join(__dirname, '..', 'docs');

// ---- token comparison --------------------------------------------------------

test('the right token matches', function() {
  assert.equal(tokenMatches('s3cret-token-value', 's3cret-token-value'), true);
});

test('a wrong token of the same length does not match', function() {
  assert.equal(tokenMatches('aaaaaaaaaaaaaaaaaa', 's3cret-token-value'), false);
});

test('a matching prefix does not match, and does not throw on the length gap', function() {
  // timingSafeEqual throws on unequal buffer lengths, and an uncaught throw here
  // would be both a crash and a length oracle.
  assert.equal(tokenMatches('s3cret', 's3cret-token-value'), false);
  assert.equal(tokenMatches('s3cret-token-value-and-then-some', 's3cret-token-value'), false);
});

test('an empty or missing token never matches, even against an empty secret', function() {
  assert.equal(tokenMatches('', 's3cret-token-value'), false);
  assert.equal(tokenMatches(null, 's3cret-token-value'), false);
  assert.equal(tokenMatches(undefined, 's3cret-token-value'), false);
  assert.equal(tokenMatches('', ''), false, 'an unset DASHBOARD_TOKEN must not let everyone in');
  assert.equal(tokenMatches('anything', ''), false);
});

// ---- brute force throttle ----------------------------------------------------

var NOW = 1000000;

test('an unknown client starts clean', function() {
  var store = new Map();
  assert.deepEqual(lockoutState(store, '1.2.3.4', NOW), { locked: false, fails: 0 });
});

test('failures accumulate but do not lock before the limit', function() {
  var store = new Map();
  for (var i = 0; i < 7; i++) recordFailure(store, '1.2.3.4', NOW);
  var state = lockoutState(store, '1.2.3.4', NOW);
  assert.equal(state.locked, false);
  assert.equal(state.fails, 7);
});

test('the eighth failure locks the client out', function() {
  var store = new Map();
  for (var i = 0; i < 8; i++) recordFailure(store, '1.2.3.4', NOW);
  var state = lockoutState(store, '1.2.3.4', NOW);
  assert.equal(state.locked, true);
  assert.ok(state.retryAfter > 0);
});

test('the lockout expires on its own', function() {
  var store = new Map();
  for (var i = 0; i < 8; i++) recordFailure(store, '1.2.3.4', NOW);
  assert.equal(lockoutState(store, '1.2.3.4', NOW + 16 * 60 * 1000).locked, false);
});

test('a slow trickle of failures never locks anyone out', function() {
  // The window resets, which is deliberate: the throttle exists to stop a fast
  // brute force, not to punish someone who fat-fingers the token twice a week.
  var store = new Map();
  for (var i = 0; i < 20; i++) recordFailure(store, '1.2.3.4', NOW + i * 11 * 60 * 1000);
  assert.equal(lockoutState(store, '1.2.3.4', NOW + 20 * 11 * 60 * 1000).locked, false);
});

test('one client being locked out does not affect another', function() {
  var store = new Map();
  for (var i = 0; i < 8; i++) recordFailure(store, '1.2.3.4', NOW);
  assert.equal(lockoutState(store, '1.2.3.4', NOW).locked, true);
  assert.equal(lockoutState(store, '5.6.7.8', NOW).locked, false);
});

test('a successful login clears the failure count', function() {
  var store = new Map();
  for (var i = 0; i < 5; i++) recordFailure(store, '1.2.3.4', NOW);
  clearFailures(store, '1.2.3.4');
  assert.deepEqual(lockoutState(store, '1.2.3.4', NOW), { locked: false, fails: 0 });
});

// ---- what /docs is allowed to expose ----------------------------------------

function filesUnder(dir) {
  var out = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function(entry) {
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(filesUnder(full));
    else out.push(full);
  });
  return out;
}

test('the public docs tree contains no internal runbook', function() {
  // web/server.js serves docs/ with NO token. OPERATIONS.md lived here and
  // published the VM name, the GCP project, every port and the ssh command to
  // anyone who guessed the URL. Internal runbooks belong in ops/.
  var names = filesUnder(DOCS).map(function(f) { return path.basename(f).toLowerCase(); });
  ['operations.md', 'runbook.md', 'deploy.md', 'infra.md'].forEach(function(banned) {
    assert.equal(names.indexOf(banned), -1, banned + ' must not sit in the publicly served docs/ tree');
  });
});

test('no publicly served doc leaks the host, the project, or a credential', function() {
  // A filled-in credential is `NAME=` followed immediately by a real value.
  // `NAME=` with nothing after it is a documentation placeholder and is fine,
  // which is exactly what docs/cheatsheet.html has; the negative lookahead stops
  // the value half of the pattern running on into the NEXT variable's name.
  function assigned(name) {
    return new RegExp(name + '=(?![A-Z][A-Z0-9_]*=)[^\\s<>"\']{8,}');
  }
  var LEAKS = [
    { pattern: /merethbot-vm/i, what: 'the VM name' },
    { pattern: /merethbot-falkreath/i, what: 'the GCP project id' },
    { pattern: /us-central1-a/i, what: 'the VM zone' },
    { pattern: /gcloud compute ssh/i, what: 'the ssh command' },
    { pattern: /\b100\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, what: 'a tailnet address' },
    { pattern: assigned('SUPABASE_SERVICE_ROLE_KEY'), what: 'the service role key' },
    { pattern: assigned('DASHBOARD_TOKEN'), what: 'the dashboard token' },
    { pattern: assigned('JIRA_API_TOKEN'), what: 'the Jira token' },
    { pattern: assigned('ANTHROPIC_API_KEY'), what: 'the Anthropic key' },
    { pattern: assigned('BT_DISCORD_TOKEN'), what: 'the Discord bot token' },
  ];
  var textLike = /\.(md|html|txt|json|js|css|svg)$/i;

  filesUnder(DOCS).filter(function(f) { return textLike.test(f); }).forEach(function(file) {
    var body = fs.readFileSync(file, 'utf8');
    LEAKS.forEach(function(leak) {
      assert.equal(
        leak.pattern.test(body),
        false,
        path.relative(DOCS, file) + ' exposes ' + leak.what + ', and docs/ is served without a token'
      );
    });
  });
});

test('the ops runbook still exists, just outside the served tree', function() {
  var ops = path.join(__dirname, '..', 'ops', 'OPERATIONS.md');
  assert.ok(fs.existsSync(ops), 'ops/OPERATIONS.md should exist');
  assert.ok(fs.readFileSync(ops, 'utf8').length > 500, 'and still have its content');
});
