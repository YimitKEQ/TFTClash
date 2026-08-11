/**
 * recover-meeting.js - rebuild a meeting whose transcription failed.
 *
 *   node scripts/recover-meeting.js /tmp/bt-rec/<session-dir> [--title "Weekly sync"] [--dry]
 *
 * /record now keeps the raw audio when transcription fails, because that audio
 * is the only copy of the conversation. This turns it back into a transcript, a
 * recap and tasks, and posts the recap to the meetings channel.
 *
 * What it cannot do: recover exact wall clock alignment. The live pipeline
 * carries an utterance map that says where each speaker's concatenated audio
 * sits on the real timeline, and that map lives in memory, so it dies with the
 * failed run. Speaker order WITHIN a track is exact; interleaving BETWEEN
 * tracks is approximate. The recap says so rather than pretending otherwise.
 *
 * Posts over the REST API rather than logging in, so it never opens a second
 * gateway session and can never make the live feed double post.
 *
 * Copy rule: zero em or en dashes anywhere in user-facing strings.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

import { transcribeHostedFile, hostedConfigured, hostedModel } from '../lib/stt.js';
import { crewNameForDiscordId } from '../config/crew.js';
import { analyzeMeeting } from '../lib/extract.js';
import { recordMeeting } from '../lib/board.js';

var BYTES_PER_SEC_PCM = 48000 * 2 * 2; // 48kHz stereo s16le, what the recorder writes

function arg(name, fallback) {
  var i = process.argv.indexOf('--' + name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
var DRY = process.argv.indexOf('--dry') !== -1;

function run(cmd, args) {
  return new Promise(function(resolve, reject) {
    var child = spawn(cmd, args, { windowsHide: true });
    var err = '';
    child.stderr.on('data', function(d) { err += d.toString(); });
    child.on('error', reject);
    child.on('close', function(code) {
      if (code !== 0) reject(new Error(path.basename(String(cmd)) + ' exited ' + code + ': ' + err.slice(-200)));
      else resolve();
    });
  });
}

function fmtClock(sec) {
  var s = Math.max(0, Math.floor(sec));
  var m = Math.floor(s / 60);
  return (m < 10 ? '0' : '') + m + ':' + ((s % 60) < 10 ? '0' : '') + (s % 60);
}

async function main() {
  var dir = process.argv[2];
  if (!dir || !fs.existsSync(dir)) {
    console.error('Usage: node scripts/recover-meeting.js <session-dir> [--title "..."] [--dry]');
    process.exit(1);
  }
  if (!hostedConfigured()) {
    console.error('This needs hosted transcription (GROQ_API_KEY). Local whisper on this host is far too slow for a recovery run.');
    process.exit(1);
  }

  var pcms = fs.readdirSync(dir).filter(function(f) { return f.endsWith('.pcm'); });
  if (!pcms.length) { console.error('No .pcm tracks in ' + dir); process.exit(1); }

  console.log('Recovering ' + pcms.length + ' track(s) from ' + dir);
  console.log('Engine: ' + hostedModel() + ' (audio is uploaded)');

  var all = [];
  var names = [];

  for (var i = 0; i < pcms.length; i++) {
    var userId = path.basename(pcms[i], '.pcm');
    var pcmPath = path.join(dir, pcms[i]);
    var seconds = fs.statSync(pcmPath).size / BYTES_PER_SEC_PCM;
    var name = crewNameForDiscordId(userId) || ('Speaker ' + userId.slice(-4));
    names.push(name);
    console.log('  ' + name + ': ' + Math.round(seconds) + 's of speech');

    var wavPath = path.join(dir, userId + '.wav');
    await run(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 's16le', '-ar', '48000', '-ac', '2', '-i', pcmPath,
      '-ar', '16000', '-ac', '1', wavPath,
    ]);

    var segs = await transcribeHostedFile(wavPath, seconds, dir);
    console.log('    ' + segs.length + ' segment(s)');
    segs.forEach(function(s) { all.push({ sec: s.startSec, name: name, text: s.text }); });
    try { fs.unlinkSync(wavPath); } catch (e) {}
  }

  all.sort(function(a, b) { return a.sec - b.sec; });
  var transcript = all.map(function(s) { return '[' + fmtClock(s.sec) + '] ' + s.name + ': ' + s.text; }).join('\n');

  if (!transcript) { console.error('Nothing was recognised in any track.'); process.exit(1); }
  console.log('Transcript: ' + transcript.length + ' characters, ' + all.length + ' segments');

  var title = arg('title', 'Recovered meeting ' + new Date().toISOString().split('T')[0]);
  var analysis = await analyzeMeeting(transcript, null);
  console.log('Summary: ' + String(analysis.summary || '').slice(0, 160));
  console.log('Suggested tasks: ' + (analysis.tasks || []).length);

  if (DRY) {
    console.log('\n--- dry run, nothing saved or posted ---');
    console.log(transcript.slice(0, 1200));
    return;
  }

  var recap = Object.assign({}, analysis.recap, { tasks: [] });
  var meeting = await recordMeeting({
    title: title,
    summary: analysis.summary,
    raw_notes: transcript,
    created_by: 'recovery',
    tasks_created: 0,
    recap: recap,
  });
  console.log('Saved meeting: ' + (meeting && meeting.id));

  // Post the recap over REST so no second gateway session is opened.
  var token = process.env.BT_DISCORD_TOKEN;
  var guild = process.env.BT_GUILD_ID;
  var wanted = (process.env.BT_MEETINGS_CHANNEL || 'bt-meetings').toLowerCase();
  var chRes = await fetch('https://discord.com/api/v10/guilds/' + guild + '/channels', { headers: { Authorization: 'Bot ' + token } });
  var channels = await chRes.json();
  var ch = (channels || []).find(function(c) { return c.type === 0 && String(c.name).toLowerCase() === wanted; });
  if (!ch) { console.warn('Meetings channel not found, transcript saved but not posted.'); return; }

  var body = '# ' + title + '\n\n## Summary\n' + (analysis.summary || '') + '\n\n## Full transcript\n' + transcript + '\n';
  var form = new FormData();
  form.append('payload_json', JSON.stringify({
    content: '**Recovered meeting: ' + title + '**\n'
      + (analysis.recap && analysis.recap.tldr ? analysis.recap.tldr + '\n' : '')
      + '\n*This meeting failed to transcribe when it was recorded and was rebuilt from the saved audio. '
      + 'Speaker order within each person is exact; the interleaving between speakers is approximate, because the '
      + 'wall clock alignment did not survive the original failure.*',
    allowed_mentions: { parse: [] },
  }));
  form.append('files[0]', new Blob([Buffer.from(body, 'utf8')]), 'recovered-transcript.md');

  var post = await fetch('https://discord.com/api/v10/channels/' + ch.id + '/messages', {
    method: 'POST',
    headers: { Authorization: 'Bot ' + token },
    body: form,
  });
  console.log(post.ok ? 'Posted recap to #' + ch.name : 'Post failed ' + post.status + ' ' + (await post.text()).slice(0, 200));
}

main().catch(function(e) {
  console.error('Recovery failed: ' + ((e && e.message) || e));
  process.exit(1);
});
