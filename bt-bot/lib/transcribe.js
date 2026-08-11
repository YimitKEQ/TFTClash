/**
 * transcribe.js - turn a recorder manifest into one chronological, speaker
 * labelled transcript using a LOCAL whisper.cpp build (no cloud, no API key).
 *
 * Pipeline per speaker:
 *   per-user 48kHz stereo PCM  --ffmpeg-->  16kHz mono WAV  --whisper.cpp-->  JSON segments
 * Then every speaker's segments are mapped back to wall-clock time (using the
 * utterance timing the recorder captured) and merged into a single ordered
 * transcript like:
 *   [00:03] Fridley: the lobby builder double booked ten players
 *   [00:09] Kees: yeah we need to redraw round three
 *
 * Configure via .env:
 *   WHISPER_CMD    full path to the whisper.cpp executable (whisper-cli / main)
 *   WHISPER_MODEL  full path to a ggml model file (e.g. ggml-base.en.bin)
 *   WHISPER_LANG   language code, default "en" ("auto" to detect)
 *   WHISPER_TIMEOUT_MS  per-file transcription timeout, default 900000 (15 min)
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import { crewNameForDiscordId } from '../config/crew.js';

/**
 * Can this machine actually transcribe?
 *
 * This exists because of a real production failure: the VM's .env was copied
 * from a Windows desktop, so WHISPER_CMD pointed at "C:\tools\...\whisper-cli.exe"
 * on a Linux host. Nothing noticed. The bot would join the call, record the
 * whole meeting, and only discover it could not transcribe AFTER /record stop,
 * by which point everyone had hung up and the conversation was gone.
 *
 * Checking up front turns a lost meeting into a message before anyone starts
 * talking. Called at boot (logged) and by /record start (refuses).
 *
 * Returns { ok, reason, detail, hint }.
 */
export function transcriberStatus() {
  var cmd = process.env.WHISPER_CMD;
  var model = process.env.WHISPER_MODEL;

  if (!cmd || !model) {
    return {
      ok: false,
      reason: 'not configured',
      detail: 'WHISPER_CMD and WHISPER_MODEL are not both set.',
      hint: 'Set them in bt-bot/.env, then restart the bot. See docs/OPERATIONS.md.',
    };
  }

  // A bare command name is allowed (resolved off PATH by spawn). Anything that
  // looks like a path has to actually exist on THIS machine, which is what
  // catches a Windows path sitting in a Linux host's .env.
  var looksLikePath = cmd.indexOf('/') !== -1 || cmd.indexOf('\\') !== -1 || /^[A-Za-z]:/.test(cmd);
  if (looksLikePath && !fs.existsSync(cmd)) {
    var windowsPathOnPosix = /^[A-Za-z]:\\/.test(cmd) && path.sep === '/';
    return {
      ok: false,
      reason: 'transcriber missing',
      detail: 'WHISPER_CMD points at ' + cmd + ', which does not exist on this machine.'
        + (windowsPathOnPosix ? ' That is a Windows path, and this host is not Windows: the .env was almost certainly copied from a desktop.' : ''),
      hint: 'Install whisper.cpp on this host and point WHISPER_CMD at it, or run the bot where the binary lives.',
    };
  }

  if (!fs.existsSync(model)) {
    return {
      ok: false,
      reason: 'model missing',
      detail: 'WHISPER_MODEL points at ' + model + ', which does not exist on this machine.',
      hint: 'Download a ggml model onto this host and point WHISPER_MODEL at it.',
    };
  }

  if (!ffmpegPath) {
    return {
      ok: false,
      reason: 'ffmpeg missing',
      detail: 'ffmpeg-static did not resolve a binary.',
      hint: 'Run npm install in bt-bot on this host.',
    };
  }

  return { ok: true, reason: 'ready', detail: 'whisper.cpp reachable, model present, ffmpeg bundled.', hint: '' };
}

function run(cmd, args, timeoutMs) {
  return new Promise(function(resolve, reject) {
    var child;
    try {
      child = spawn(cmd, args, { windowsHide: true });
    } catch (e) {
      reject(new Error('Failed to launch ' + cmd + ': ' + ((e && e.message) || e)));
      return;
    }
    var stderr = '';
    var killed = false;
    var timer = setTimeout(function() {
      killed = true;
      try { child.kill('SIGKILL'); } catch (e) {}
    }, timeoutMs || 900000);
    child.stderr.on('data', function(d) { stderr += d.toString(); });
    child.on('error', function(e) {
      clearTimeout(timer);
      reject(new Error('Could not run ' + cmd + ': ' + ((e && e.message) || e)));
    });
    child.on('close', function(code) {
      clearTimeout(timer);
      if (killed) { reject(new Error(path.basename(String(cmd)) + ' timed out')); return; }
      if (code !== 0) { reject(new Error(path.basename(String(cmd)) + ' exited ' + code + ': ' + stderr.slice(-300))); return; }
      resolve();
    });
  });
}

// Bytes per second of the 16kHz mono 16-bit WAV this pipeline feeds whisper.
var WAV_BYTES_PER_SEC = 16000 * 1 * 2;

// Length in seconds of a WAV produced by pcmToWav, from its size on disk.
// Returns 0 when the file is missing or too small to hold any audio, so the
// caller can fall back rather than trusting a bogus zero.
export function wavSeconds(wavPath) {
  try {
    var bytes = fs.statSync(wavPath).size - 44; // 44 byte canonical WAV header
    if (!(bytes > 0)) return 0;
    return bytes / WAV_BYTES_PER_SEC;
  } catch (e) {
    return 0;
  }
}

// 48kHz stereo s16le PCM -> 16kHz mono WAV (what whisper.cpp expects).
async function pcmToWav(pcmPath, wavPath) {
  if (!ffmpegPath) throw new Error('ffmpeg-static is not installed');
  await run(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 's16le', '-ar', '48000', '-ac', '2', '-i', pcmPath,
    '-ar', '16000', '-ac', '1', wavPath,
  ], 600000); // up to 10 min - resampling a multi-hour file is still fast
}

// Run whisper.cpp and return its parsed segment list: [{ startSec, text }].
// audioSec lets long recordings get a proportionally longer timeout so a big
// meeting is never cut short mid-transcription.
async function whisperSegments(wavPath, outBase, audioSec) {
  var cmd = process.env.WHISPER_CMD;
  var model = process.env.WHISPER_MODEL;
  if (!cmd || !model) {
    throw new Error('Local whisper is not configured. Set WHISPER_CMD and WHISPER_MODEL in bt-bot/.env (see README).');
  }
  if (!fs.existsSync(model)) throw new Error('WHISPER_MODEL not found at ' + model);

  var lang = process.env.WHISPER_LANG || 'en';
  // Floor from env (default 15 min), but always allow ~4s of compute per second
  // of audio so long files finish even on a slow CPU.
  var floor = parseInt(process.env.WHISPER_TIMEOUT_MS, 10) || 900000;
  var timeout = Math.max(floor, Math.ceil((audioSec || 0) * 4000));

  // -oj writes <outBase>.json ; -of sets the output base path (no extension).
  await run(cmd, [
    '-m', model,
    '-f', wavPath,
    '-l', lang,
    '-oj',
    '-of', outBase,
  ], timeout);

  var jsonPath = outBase + '.json';
  if (!fs.existsSync(jsonPath)) throw new Error('whisper produced no JSON output');
  var parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  var rows = parsed && parsed.transcription ? parsed.transcription : [];
  return rows.map(function(r) {
    var fromMs = (r.offsets && typeof r.offsets.from === 'number') ? r.offsets.from : 0;
    return { startSec: fromMs / 1000, text: String(r.text || '').trim() };
  }).filter(function(s) { return s.text; });
}

// Map a file-relative second to wall-clock ms using the speaker's utterance
// index. The concatenated PCM removes silence, so utterances tile [0..total]
// contiguously and every segment falls inside exactly one utterance.
function fileSecToWallMs(speaker, sec) {
  var utts = speaker.utterances || [];
  for (var i = 0; i < utts.length; i++) {
    var u = utts[i];
    if (sec >= u.fileStartSec && sec < u.fileEndSec) {
      return u.wallStartMs + (sec - u.fileStartSec) * 1000;
    }
  }
  // Past the last utterance end (rounding): pin to the last utterance.
  if (utts.length) {
    var last = utts[utts.length - 1];
    return last.wallStartMs + Math.max(0, sec - last.fileStartSec) * 1000;
  }
  return sec * 1000;
}

function fmtClock(ms) {
  var s = Math.max(0, Math.floor(ms / 1000));
  var m = Math.floor(s / 60);
  var r = s % 60;
  return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
}

function displayName(speaker) {
  return crewNameForDiscordId(speaker.userId) || speaker.name || 'Speaker';
}

/**
 * Transcribe a recorder manifest. Returns:
 *   { transcript, byline, segments, speakers, engine }
 *   - transcript: one chronological "[mm:ss] Name: text" string (the thing fed
 *     to the task extractor and stored as raw notes)
 *   - byline: short "Kees, Fridley" list of who spoke
 *   - segments: [{ wallMs, name, text }] sorted by time
 */
export async function transcribeManifest(manifest) {
  var speakers = (manifest && manifest.speakers) || [];
  if (!speakers.length) {
    return { transcript: '', byline: '', segments: [], speakers: [], engine: 'whisper' };
  }

  var allSegments = [];
  var names = [];

  for (var i = 0; i < speakers.length; i++) {
    var sp = speakers[i];
    var wavPath = path.join(manifest.dir, sp.userId + '.wav');
    var outBase = path.join(manifest.dir, sp.userId);
    try {
      await pcmToWav(sp.pcmPath, wavPath);
    } catch (e) {
      console.warn('[transcribe] ffmpeg failed for ' + sp.userId + ': ' + ((e && e.message) || e));
      continue;
    }
    // Derive the length from the WAV actually on disk rather than from the
    // utterance bookkeeping. The 16kHz mono 16-bit file this pipeline produces
    // is exactly 32000 bytes per second, so this is ground truth, and it cannot
    // silently collapse to zero the way a missing utterance list can. A zero
    // there would drop the timeout to the 15 minute floor and cut a long
    // meeting off part way through.
    var audioSec = wavSeconds(wavPath);
    if (!audioSec) {
      var utts = sp.utterances || [];
      audioSec = utts.length ? utts[utts.length - 1].fileEndSec : 0;
    }
    var segs = await whisperSegments(wavPath, outBase, audioSec);
    if (!segs.length) continue;
    var name = displayName(sp);
    names.push(name);
    segs.forEach(function(s) {
      allSegments.push({ wallMs: fileSecToWallMs(sp, s.startSec), name: name, text: s.text });
    });
  }

  allSegments.sort(function(a, b) { return a.wallMs - b.wallMs; });

  var lines = allSegments.map(function(s) {
    return '[' + fmtClock(s.wallMs) + '] ' + s.name + ': ' + s.text;
  });

  return {
    transcript: lines.join('\n'),
    byline: names.join(', '),
    segments: allSegments,
    speakers: names,
    engine: 'whisper',
  };
}
