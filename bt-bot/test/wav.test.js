/**
 * Tests for wavSeconds, which decides how long whisper is allowed to run.
 *
 * The transcription timeout is max(floor, audioSec * 4000). If audioSec comes
 * back as 0 the timeout silently collapses to the 15 minute floor, and a real
 * meeting gets killed part way through with "whisper-cli timed out". That is
 * the failure seen on 2026-08-11.
 *
 * Deriving the length from the WAV on disk removes the dependency on utterance
 * bookkeeping being correct, so these tests pin the byte maths and, more
 * importantly, that a missing or truncated file returns 0 rather than a
 * confident wrong answer.
 */

import './env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { wavSeconds } from '../lib/transcribe.js';

var TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-wav-'));

// The pipeline always produces 16kHz mono 16-bit: 32000 bytes per second,
// after a 44 byte canonical header.
function writeWav(name, seconds) {
  var p = path.join(TMP, name);
  fs.writeFileSync(p, Buffer.alloc(44 + Math.round(seconds * 32000)));
  return p;
}

test('a one second file measures one second', function() {
  assert.equal(wavSeconds(writeWav('one.wav', 1)), 1);
});

test('a long meeting measures correctly', function() {
  // 40 minutes, the length that actually matters here.
  assert.equal(wavSeconds(writeWav('long.wav', 2400)), 2400);
});

test('fractional lengths are not rounded away', function() {
  assert.ok(Math.abs(wavSeconds(writeWav('frac.wav', 7.5)) - 7.5) < 0.001);
});

test('a missing file returns 0 so the caller can fall back', function() {
  assert.equal(wavSeconds(path.join(TMP, 'does-not-exist.wav')), 0);
});

test('a header-only file returns 0 rather than a negative length', function() {
  var p = path.join(TMP, 'headeronly.wav');
  fs.writeFileSync(p, Buffer.alloc(44));
  assert.equal(wavSeconds(p), 0);
});

test('a truncated file smaller than the header returns 0', function() {
  var p = path.join(TMP, 'stub.wav');
  fs.writeFileSync(p, Buffer.alloc(10));
  assert.equal(wavSeconds(p), 0, 'must not report a negative duration');
});

test('the derived length gives a long meeting a real timeout budget', function() {
  // This is the whole point. The timeout is max(900000, audioSec * 4000).
  // A 40 minute track must not fall back to the 15 minute floor.
  var seconds = wavSeconds(writeWav('budget.wav', 2400));
  var timeout = Math.max(900000, Math.ceil(seconds * 4000));
  assert.equal(timeout, 9600000, '40 minutes of audio gets 160 minutes of budget');
  assert.ok(timeout > 900000, 'and is not capped at the floor');
});

test('a zero length reading leaves the floor in charge', function() {
  var timeout = Math.max(900000, Math.ceil(0 * 4000));
  assert.equal(timeout, 900000);
});
