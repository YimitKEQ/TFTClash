/**
 * stt.js - hosted speech to text, used when the host cannot transcribe locally
 * in a sane amount of time.
 *
 * WHY THIS EXISTS, AND THE TRADE IT MAKES
 *
 * The fleet VM is 2 vCPU with 969 MB shared across three bots. Measured on real
 * speech, local whisper.cpp runs at 5.21x realtime on tiny.en and 9.65x on
 * base.en, so a 40 minute meeting is a multi hour job that takes both cores and
 * pushes the box into swap. That is not a tuning problem and no model size
 * fixes it.
 *
 * So when this is configured, audio LEAVES THE MACHINE: the per speaker track
 * is compressed and sent to a hosted transcription API. That is a real change
 * to the privacy properties of /record, and the user facing copy says so
 * plainly rather than quietly keeping the old promise. If that trade is not
 * acceptable, leave GROQ_API_KEY unset and the bot goes back to local whisper.
 *
 * Only the audio is sent. Nothing is stored by this module.
 *
 * Copy rule: zero em or en dashes anywhere in user-facing strings.
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

var API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

// whisper-large-v3-turbo is both faster and considerably more accurate than the
// base.en that would run locally, so this is an upgrade in quality as well as
// speed. Override with GROQ_STT_MODEL.
var DEFAULT_MODEL = 'whisper-large-v3-turbo';

// Stay well under the upload ceiling. Opus at 16 kbps mono is about 2 KB per
// second of speech, so 20 MB is roughly three hours: a single request covers
// any realistic meeting, and the chunker below is the safety net, not the norm.
var MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
var CHUNK_SECONDS = 600;

var REQUEST_TIMEOUT_MS = 180000;

export function hostedConfigured() {
  return !!(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim());
}

export function hostedModel() {
  return process.env.GROQ_STT_MODEL || DEFAULT_MODEL;
}

export function hostedStatus() {
  if (!hostedConfigured()) {
    return { ok: false, reason: 'not configured', detail: 'GROQ_API_KEY is not set.', hint: 'Set it in .env to send transcription to the hosted API.' };
  }
  if (!ffmpegPath) {
    return { ok: false, reason: 'ffmpeg missing', detail: 'ffmpeg-static did not resolve a binary.', hint: 'Run npm install on this host.' };
  }
  return {
    ok: true,
    reason: 'ready',
    detail: 'hosted transcription via ' + hostedModel() + '. Audio leaves this machine.',
    hint: '',
  };
}

// ---- audio prep --------------------------------------------------------------

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
    var timer = setTimeout(function() { killed = true; try { child.kill('SIGKILL'); } catch (e) {} }, timeoutMs || 600000);
    child.stderr.on('data', function(d) { stderr += d.toString(); });
    child.on('error', function(e) { clearTimeout(timer); reject(new Error('Could not run ' + cmd + ': ' + ((e && e.message) || e))); });
    child.on('close', function(code) {
      clearTimeout(timer);
      if (killed) { reject(new Error(path.basename(String(cmd)) + ' timed out')); return; }
      if (code !== 0) { reject(new Error(path.basename(String(cmd)) + ' exited ' + code + ': ' + stderr.slice(-300))); return; }
      resolve();
    });
  });
}

/**
 * Compress a 16kHz mono WAV to Ogg/Opus for upload.
 *
 * This matters: the raw WAV is 32 KB per second, so a 40 minute track is 76 MB
 * and would be rejected. Opus at 16 kbps is built for speech and drops the same
 * audio to a couple of megabytes with no meaningful accuracy cost.
 *
 * offsetSec/durationSec cut a single chunk when one is needed.
 */
async function toOpus(wavPath, outPath, offsetSec, durationSec) {
  if (!ffmpegPath) throw new Error('ffmpeg-static is not installed');
  var args = ['-hide_banner', '-loglevel', 'error', '-y'];
  if (offsetSec != null) args = args.concat(['-ss', String(offsetSec)]);
  args = args.concat(['-i', wavPath]);
  if (durationSec != null) args = args.concat(['-t', String(durationSec)]);
  args = args.concat(['-c:a', 'libopus', '-b:a', '16k', '-ac', '1', '-application', 'voip', outPath]);
  await run(ffmpegPath, args, 600000);
}

// ---- API ---------------------------------------------------------------------

async function postChunk(filePath, label) {
  var key = process.env.GROQ_API_KEY;
  var buf = fs.readFileSync(filePath);

  var form = new FormData();
  form.append('file', new Blob([buf]), path.basename(filePath));
  form.append('model', hostedModel());
  form.append('response_format', 'verbose_json');
  form.append('language', process.env.WHISPER_LANG === 'auto' ? '' : (process.env.WHISPER_LANG || 'en'));
  form.append('temperature', '0');

  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, REQUEST_TIMEOUT_MS);
  var res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key },
      body: form,
      signal: controller.signal,
    });
  } catch (e) {
    throw new Error('Hosted transcription request failed' + (label ? ' (' + label + ')' : '') + ': ' + ((e && e.message) || e));
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    var body = '';
    try { body = (await res.text()).slice(0, 300); } catch (e) {}
    // A key problem is worth naming precisely: it is the one failure an
    // operator can actually fix, and it looks identical to everything else.
    if (res.status === 401) throw new Error('Hosted transcription rejected the API key (401). Check GROQ_API_KEY.');
    if (res.status === 429) throw new Error('Hosted transcription is rate limited (429). Try again shortly.');
    throw new Error('Hosted transcription failed ' + res.status + (label ? ' (' + label + ')' : '') + ': ' + body);
  }

  var json = await res.json();
  var segs = Array.isArray(json.segments) ? json.segments : [];
  if (!segs.length && json.text) {
    // Some responses carry only the flat text; keep it rather than dropping it.
    return [{ startSec: 0, text: String(json.text).trim() }];
  }
  return segs.map(function(s) {
    return { startSec: Number(s.start) || 0, text: String(s.text || '').trim() };
  }).filter(function(s) { return s.text; });
}

/**
 * Transcribe one prepared WAV through the hosted API.
 * Returns [{ startSec, text }] in the same shape the local path produces, so
 * the caller does not care which engine ran.
 */
export async function transcribeHostedFile(wavPath, audioSec, tmpDir) {
  if (!hostedConfigured()) throw new Error('Hosted transcription is not configured (GROQ_API_KEY).');

  var dir = tmpDir || path.dirname(wavPath);
  var base = path.join(dir, path.basename(wavPath, path.extname(wavPath)));
  var whole = base + '.ogg';

  await toOpus(wavPath, whole);
  var size = fs.statSync(whole).size;

  if (size <= MAX_UPLOAD_BYTES) {
    try {
      return await postChunk(whole, null);
    } finally {
      try { fs.unlinkSync(whole); } catch (e) {}
    }
  }

  // Safety net for something enormous: cut it into chunks and shift each
  // chunk's timestamps back into the whole file's timeline.
  try { fs.unlinkSync(whole); } catch (e) {}
  var total = audioSec || 0;
  if (!(total > 0)) throw new Error('Audio is too large to upload and its length is unknown, so it cannot be split.');

  var out = [];
  for (var offset = 0; offset < total; offset += CHUNK_SECONDS) {
    var chunkPath = base + '.part' + Math.floor(offset / CHUNK_SECONDS) + '.ogg';
    await toOpus(wavPath, chunkPath, offset, CHUNK_SECONDS);
    try {
      var segs = await postChunk(chunkPath, 'chunk at ' + Math.round(offset / 60) + 'm');
      var shift = offset;
      segs.forEach(function(s) { out.push({ startSec: s.startSec + shift, text: s.text }); });
    } finally {
      try { fs.unlinkSync(chunkPath); } catch (e) {}
    }
  }
  return out;
}
