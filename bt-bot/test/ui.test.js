/**
 * Tests for lib/ui.js, the shared presentation layer.
 *
 * These are worth having because every embed in the bot goes through them: a
 * regression in pack() silently corrupts a mention in four different commands
 * at once, which is exactly the bug the shared helper was written to kill.
 */

import './env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bar,
  cardDot,
  clamp,
  delta,
  DOT,
  eyebrow,
  health,
  MARK,
  pack,
  pct,
  rel,
  shortDue,
  spark,
  ts,
} from '../lib/ui.js';

test('clamp leaves short strings alone and ellipsises long ones', function() {
  assert.equal(clamp('hello', 10), 'hello');
  assert.equal(clamp('hello', 5), 'hello');
  assert.equal(clamp('hello world', 8), 'hello...');
  assert.equal(clamp(null, 5), '');
  assert.equal(clamp(undefined, 5), '');
});

test('bar fills proportionally and never exceeds its width', function() {
  assert.equal(bar(0, 10, 10), '░░░░░░░░░░');
  assert.equal(bar(10, 10, 10), '██████████');
  assert.equal(bar(5, 10, 10), '█████░░░░░');
  assert.equal(bar(5, 10, 10).length, 10);
  assert.equal(bar(3, 7, 12).length, 12);
});

test('bar never renders real work as an empty track', function() {
  // One card out of a hundred rounds to zero blocks, which would read as
  // "nothing here". A single block is the honest floor.
  assert.equal(bar(1, 100, 10), '█░░░░░░░░░');
});

test('bar survives a zero or negative maximum', function() {
  assert.equal(bar(5, 0, 6), '░░░░░░');
  assert.equal(bar(5, -1, 6), '░░░░░░');
  assert.equal(bar(-5, 10, 6), '░░░░░░');
});

test('spark maps a series onto the block ramp', function() {
  assert.equal(spark([]), '');
  assert.equal(spark([5]), '', 'a single point has no shape to draw');
  assert.equal(spark([3, 3, 3]), '▁▁▁', 'a flat series sits on the baseline');
  var s = spark([1, 2, 3, 4]);
  assert.equal(s.length, 4);
  assert.equal(s[0], '▁');
  assert.equal(s[3], '█');
});

test('pack keeps whole lines and reports the overflow', function() {
  assert.equal(pack(['a', 'b', 'c']), 'a\nb\nc');
  assert.equal(pack([]), '*nothing here*');
  assert.equal(pack([], { empty: 'none' }), 'none');
});

test('pack never severs a mention mid token', function() {
  // The bug this replaced: a raw slice(0, 1024) could cut "<@1234567890>" in
  // half and render a broken fragment in the channel.
  var mentions = [];
  for (var i = 0; i < 200; i++) mentions.push('<@1000000000000000' + i + '> owns a card with a reasonably long title');
  var out = pack(mentions);
  assert.ok(out.length <= 1024, 'stays under the Discord field cap');
  out.split('\n').forEach(function(line) {
    if (line.indexOf('<@') === -1) return;
    assert.ok(line.indexOf('>') > line.indexOf('<@'), 'every mention is closed: ' + line);
  });
  assert.ok(/and \d+ more/.test(out), 'says how many lines were dropped');
});

test('pack drops empty entries rather than emitting blank lines', function() {
  assert.equal(pack(['a', '', null, 'b']), 'a\nb');
});

test('eyebrow uppercases and appends a count only when given one', function() {
  assert.equal(eyebrow('needs attention'), 'NEEDS ATTENTION');
  assert.equal(eyebrow('needs attention', 4), 'NEEDS ATTENTION  4');
  assert.equal(eyebrow('blocked', 0), 'BLOCKED  0');
});

test('pct rounds and treats a zero total as complete', function() {
  assert.equal(pct(1, 4), 25);
  assert.equal(pct(1, 3), 33);
  assert.equal(pct(0, 0), 0);
  assert.equal(pct(5, 0), 0);
});

test('delta shows direction and sign, and no-change explicitly', function() {
  assert.ok(delta(120, 100).indexOf('+20') !== -1);
  assert.ok(delta(120, 100).indexOf(MARK.up) === 0);
  assert.ok(delta(80, 100).indexOf('-20') !== -1);
  assert.ok(delta(80, 100).indexOf(MARK.down) === 0);
  assert.equal(delta(100, 100), MARK.flat + ' no change');
  assert.equal(delta(null, 100), '');
  assert.equal(delta(100, null), '');
});

test('ts emits a native Discord timestamp and ignores junk', function() {
  var d = new Date('2026-08-07T12:00:00Z');
  assert.equal(ts(d, 'R'), '<t:' + Math.floor(d.getTime() / 1000) + ':R>');
  assert.equal(rel(d), ts(d, 'R'));
  assert.equal(ts(null), '');
  assert.equal(ts('not a date'), '');
});

test('shortDue reads in plain words relative to a fixed now', function() {
  var now = new Date('2026-08-07T12:00:00Z');
  assert.equal(shortDue('2026-08-07T12:00:00Z', now), 'today');
  assert.equal(shortDue('2026-08-10T12:00:00Z', now), 'in 3d');
  assert.equal(shortDue('2026-08-04T12:00:00Z', now), '3d late');
  assert.equal(shortDue(null, now), '');
});

test('health escalates worst first', function() {
  assert.equal(health({ active: 5, overdue: 1 }).level, 'danger');
  assert.equal(health({ active: 5, blocked: 1 }).level, 'danger');
  assert.equal(health({ active: 5, stuck: 1 }).level, 'warn');
  assert.equal(health({ active: 5, dueSoon: 1 }).level, 'soon');
  assert.equal(health({ active: 5 }).level, 'ok');
});

test('health counts at-risk as cards, not as a sum of flags', function() {
  // One card that is overdue AND stuck AND blocked is one unhealthy card, not
  // three. Without the clamp, healthy would go negative and the meter would
  // render backwards.
  var h = health({ active: 1, overdue: 1, stuck: 1, blocked: 1 });
  assert.equal(h.atRisk, 1);
  assert.equal(h.healthy, 0);
  assert.ok(h.ratio >= 0 && h.ratio <= 1);
});

test('health on an empty board says so rather than claiming success', function() {
  var h = health({ active: 0 });
  assert.equal(h.level, 'ok');
  assert.equal(h.verdict, 'Board is empty');
});

test('cardDot picks the worst state present', function() {
  assert.equal(cardDot({ blocked: true, overdue: true, stuck: true }), MARK.blocked);
  assert.equal(cardDot({ overdue: true, stuck: true }), DOT.danger);
  assert.equal(cardDot({ stuck: true, dueSoon: true }), DOT.warn);
  assert.equal(cardDot({ dueSoon: true }), DOT.soon);
  assert.equal(cardDot({}), DOT.ok);
});
