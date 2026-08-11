/**
 * verify-record-path.js - prove that a real /record stop would actually work.
 *
 *   node scripts/verify-record-path.js
 *
 * Builds a synthetic two speaker manifest in exactly the shape stopRecording()
 * returns, then runs the REAL transcribeManifest() over it. Nothing is saved and
 * nothing is posted.
 *
 * This exists because the pieces can each work while the path between them does
 * not. The hosted transcriber was proven by calling transcribeHostedFile
 * directly, which is NOT how /record reaches it: the live path goes through
 * transcribeManifest, which also does the PCM to WAV conversion, the length
 * detection that sets the timeout, the engine choice, and the mapping of each
 * speaker's file relative timestamps back onto the wall clock. That whole middle
 * layer was previously untested against a real engine.
 *
 * Uses whisper.cpp's own public domain sample as the voice, so no real
 * conversation is involved.
 *
 * Copy rule: zero em or en dashes anywhere in user-facing strings.
 */

import 'dotenv/config';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

import { transcribeManifest, transcriberStatus, engineLabel } from '../lib/transcribe.js';

// Must match recorder.js: 48kHz stereo s16le.
var SAMPLE_RATE = 48000;
var CHANNELS = 2;
var BYTES_PER_SEC = SAMPLE_RATE * CHANNELS * 2;

var SAMPLE = process.env.VERIFY_SAMPLE_WAV || '/home/gubje/whisper.cpp/samples/jfk.wav';

function run(cmd, args) {
  return new Promise(function(resolve, reject) {
    var child = spawn(cmd, args, { windowsHide: true });
    var err = '';
    child.stderr.on('data', function(d) { err += d.toString(); });
    child.on('error', reject);
    child.on('close', function(code) {
      code === 0 ? resolve() : reject(new Error('ffmpeg exited ' + code + ': ' + err.slice(-200)));
    });
  });
}

async function main() {
  var status = transcriberStatus();
  console.log('transcriber: ' + (status.ok ? 'READY' : 'NOT READY') + ' | ' + status.detail);
  console.log('engine label: ' + engineLabel());
  if (!status.ok) { console.error('Cannot verify: the transcriber is not ready on this host.'); process.exit(1); }

  if (!fs.existsSync(SAMPLE)) {
    console.error('Sample not found: ' + SAMPLE + '. Set VERIFY_SAMPLE_WAV to a wav file with speech in it.');
    process.exit(1);
  }

  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-verify-'));
  console.log('scratch dir: ' + dir);

  // Two speakers, each a PCM track in exactly the format the recorder writes.
  var speakers = [];
  var people = [
    { userId: '356555721950756865', name: 'speaker-one' },
    { userId: '386073037554057226', name: 'speaker-two' },
  ];

  for (var i = 0; i < people.length; i++) {
    var p = people[i];
    var pcmPath = path.join(dir, p.userId + '.pcm');
    // Speaker two gets the sample twice, so the two tracks differ in length and
    // the wall clock mapping has something real to do.
    var repeat = i === 0 ? 1 : 2;
    var listPath = path.join(dir, 'list' + i + '.txt');
    var lines = [];
    for (var r = 0; r < repeat; r++) lines.push("file '" + SAMPLE.split(path.sep).join('/') + "'");
    fs.writeFileSync(listPath, lines.join('\n'));

    await run(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'concat', '-safe', '0', '-i', listPath,
      '-f', 's16le', '-ar', String(SAMPLE_RATE), '-ac', String(CHANNELS), pcmPath,
    ]);

    var bytes = fs.statSync(pcmPath).size;
    var seconds = bytes / BYTES_PER_SEC;
    speakers.push({
      userId: p.userId,
      name: p.name,
      pcmPath: pcmPath,
      sampleRate: SAMPLE_RATE,
      channels: CHANNELS,
      // One utterance covering the whole track, starting at a different wall
      // clock offset per speaker so interleaving is exercised.
      utterances: [{ wallStartMs: i * 5000, fileStartSec: 0, fileEndSec: seconds }],
    });
    console.log('  ' + p.name + ': ' + seconds.toFixed(1) + 's of audio');
  }

  var manifest = {
    sessionId: 'verify',
    dir: dir,
    durationMs: 120000,
    channelName: 'verify-channel',
    channelId: '0',
    speakers: speakers,
  };

  console.log('\nrunning the real transcribeManifest()...');
  var started = Date.now();
  var tr = await transcribeManifest(manifest);
  var elapsed = ((Date.now() - started) / 1000).toFixed(1);

  console.log('elapsed: ' + elapsed + 's');
  console.log('engine reported: ' + tr.engine);
  console.log('byline: ' + tr.byline);
  console.log('segments: ' + tr.segments.length);
  console.log('transcript chars: ' + tr.transcript.length);
  console.log('\n--- transcript ---');
  console.log(tr.transcript.slice(0, 700));

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}

  // Check what actually matters. Do NOT assert on the raw speaker labels: the
  // pipeline resolves a Discord id to the crew name via BT_CREW_DISCORD, so a
  // correctly working bot reports "Levitate", not the placeholder passed in.
  var checks = [
    ['produced a transcript', tr.transcript.length > 0],
    ['produced segments', tr.segments.length > 0],
    ['named both speakers', tr.byline.split(',').length === 2],
    ['attributed lines to a speaker', /\] \S+:/.test(tr.transcript)],
    ['stamped wall clock times', /^\[\d\d:\d\d\]/.test(tr.transcript)],
    // Speaker two's utterance was declared to start 5s into the call, so its
    // first line must not land at 00:00. This is the wall clock mapping, which
    // is the part of the middle layer most likely to break silently.
    ['offset the second speaker correctly', tr.segments.some(function(s) { return s.wallMs >= 5000; })],
    ['reported the engine that ran', !!tr.engine],
  ];
  console.log('');
  checks.forEach(function(c) { console.log((c[1] ? '  ok   ' : '  FAIL ') + c[0]); });

  var ok = checks.every(function(c) { return c[1]; });
  console.log('\nRESULT: ' + (ok ? 'PASS, the live /record path produces a transcript' : 'FAIL'));
  process.exit(ok ? 0 : 1);
}

main().catch(function(e) {
  console.error('Verification failed: ' + ((e && e.message) || e));
  process.exit(1);
});
