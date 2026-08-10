/**
 * Tests for the transcriber preflight.
 *
 * This guards a real production failure: the VM's .env was copied from a
 * Windows desktop, so WHISPER_CMD pointed at "C:\tools\...\whisper-cli.exe" on
 * a Linux host. Nothing checked, so the bot recorded an entire meeting and only
 * failed at transcription, after everyone had left the call.
 */

import './env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'url';

import { transcriberStatus } from '../lib/transcribe.js';

// A file that definitely exists on whatever machine runs the suite.
var SELF = fileURLToPath(import.meta.url);

function withEnv(values, fn) {
  var saved = {};
  Object.keys(values).forEach(function(k) {
    saved[k] = process.env[k];
    if (values[k] === null) delete process.env[k];
    else process.env[k] = values[k];
  });
  try {
    return fn();
  } finally {
    Object.keys(saved).forEach(function(k) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
  }
}

test('unconfigured whisper is reported, not assumed working', function() {
  withEnv({ WHISPER_CMD: null, WHISPER_MODEL: null }, function() {
    var s = transcriberStatus();
    assert.equal(s.ok, false);
    assert.equal(s.reason, 'not configured');
    assert.ok(s.hint.length > 0, 'tells the operator what to do');
  });
});

test('a Windows path on a non-Windows host is caught and named', function() {
  // Deliberately a path that exists on no machine. The obvious fixture (the
  // real production value) passes on the Windows dev box, where whisper IS
  // installed there, which would make this test lie depending on who ran it.
  withEnv({
    WHISPER_CMD: 'C:\\definitely-not-installed\\whisper.cpp\\whisper-cli.exe',
    WHISPER_MODEL: SELF,
  }, function() {
    var s = transcriberStatus();
    if (process.platform === 'win32') {
      // On Windows the path is merely absent, which is still a refusal.
      assert.equal(s.ok, false);
      assert.equal(s.reason, 'transcriber missing');
      return;
    }
    assert.equal(s.ok, false);
    assert.equal(s.reason, 'transcriber missing');
    assert.ok(s.detail.indexOf('Windows path') !== -1,
      'names the actual cause so the fix is obvious: ' + s.detail);
  });
});

test('a missing model is caught even when the binary is fine', function() {
  withEnv({ WHISPER_CMD: SELF, WHISPER_MODEL: SELF + '.nope' }, function() {
    var s = transcriberStatus();
    assert.equal(s.ok, false);
    assert.equal(s.reason, 'model missing');
  });
});

test('a bare command name is allowed, since spawn resolves it off PATH', function() {
  withEnv({ WHISPER_CMD: 'whisper-cli', WHISPER_MODEL: SELF }, function() {
    var s = transcriberStatus();
    assert.equal(s.ok, true, 'a PATH lookup is the operator\'s choice, not an error');
  });
});

test('a fully present setup reports ready', function() {
  withEnv({ WHISPER_CMD: SELF, WHISPER_MODEL: SELF }, function() {
    var s = transcriberStatus();
    assert.equal(s.ok, true);
    assert.equal(s.reason, 'ready');
  });
});
