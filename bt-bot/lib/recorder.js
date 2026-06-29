/**
 * recorder.js - record a Discord voice channel into per-speaker PCM on disk.
 *
 * Why per-speaker, re-subscribed streams: Discord's voice receiver ends a
 * subscription after a short silence (EndBehaviorType.AfterSilence). A naive
 * recorder subscribes once and therefore captures only the FIRST utterance,
 * then goes quiet for the rest of the call - exactly the "it cuts off a long
 * convo" bug. Here we resubscribe every time a user starts speaking again and
 * append each utterance to that user's single PCM file, so the whole
 * conversation is captured no matter how many pauses there are.
 *
 * Audio shape written to disk: signed 16-bit little-endian PCM, 48 kHz, stereo
 * (the native output of prism's opus decoder). transcribe.js downmixes/resamples
 * to 16 kHz mono WAV for whisper.cpp.
 *
 * Each utterance also records its wall-clock start (ms since recording began)
 * and its byte offset in the user's file, so transcribe.js can interleave every
 * speaker's segments back into one chronological transcript.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  joinVoiceChannel,
  EndBehaviorType,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} from '@discordjs/voice';
import prism from 'prism-media';

// PCM constants for the decoder output.
var SAMPLE_RATE = 48000;
var CHANNELS = 2;
var BYTES_PER_SAMPLE = 2;
var BYTES_PER_SEC = SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE; // 192000

// How long a speaker must be silent before the current utterance stream ends.
// We resubscribe on the next "start", so this only controls utterance chunking,
// never the overall recording length.
var SILENCE_MS = 1000;

// guildId -> session. One active recording per guild.
var sessions = new Map();

export function isRecording(guildId) {
  return sessions.has(guildId);
}

export function getSession(guildId) {
  return sessions.get(guildId) || null;
}

function ensureUser(session, userId) {
  var u = session.users.get(userId);
  if (u) return u;
  var pcmPath = path.join(session.dir, userId + '.pcm');
  u = {
    userId: userId,
    name: userId, // resolved asynchronously below
    pcmPath: pcmPath,
    stream: fs.createWriteStream(pcmPath),
    bytes: 0,
    active: false,
    utterances: [],
  };
  session.users.set(userId, u);
  // Resolve a friendly display name without blocking the audio path.
  resolveName(session.guild, userId).then(function(name) {
    if (name) u.name = name;
  }).catch(function() {});
  return u;
}

async function resolveName(guild, userId) {
  try {
    var m = guild.members.cache.get(userId) || (await guild.members.fetch(userId));
    if (m) return m.displayName || (m.user && m.user.username) || userId;
  } catch (e) {}
  return userId;
}

function onSpeakingStart(session, userId) {
  // Ignore the bot itself.
  if (session.botId && userId === session.botId) return;
  var u = ensureUser(session, userId);
  if (u.active) return; // already capturing this user's current utterance
  u.active = true;

  var utt = {
    wallStartMs: Date.now() - session.startMs,
    fileStartByte: u.bytes,
    fileEndByte: u.bytes,
  };

  var opusStream;
  try {
    opusStream = session.receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: SILENCE_MS },
    });
  } catch (e) {
    u.active = false;
    return;
  }

  var decoder = new prism.opus.Decoder({ rate: SAMPLE_RATE, channels: CHANNELS, frameSize: 960 });
  var pcm = opusStream.pipe(decoder);

  pcm.on('data', function(chunk) {
    u.bytes += chunk.length;
  });
  // Append this utterance to the user's single file; never close the file here
  // so the next utterance keeps appending to the same continuous track.
  pcm.pipe(u.stream, { end: false });

  function finish() {
    if (!u.active) return;
    u.active = false;
    utt.fileEndByte = u.bytes;
    // Only keep utterances that actually carried audio.
    if (utt.fileEndByte > utt.fileStartByte) u.utterances.push(utt);
  }

  pcm.on('end', finish);
  pcm.on('error', function() { finish(); });
  opusStream.on('error', function() { finish(); });
}

/**
 * Start recording the given voice channel.
 * Returns the session object. Throws if the guild is already recording.
 */
export async function startRecording(opts) {
  var o = opts || {};
  var guild = o.guild;
  var voiceChannel = o.voiceChannel;
  if (!guild || !voiceChannel) throw new Error('startRecording needs guild and voiceChannel');
  if (sessions.has(guild.id)) throw new Error('Already recording in this server');

  var sessionId = String(Date.now()) + '-' + guild.id;
  var dir = path.join(os.tmpdir(), 'bt-rec', sessionId);
  fs.mkdirSync(dir, { recursive: true });

  var connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false, // must hear to receive audio
    selfMute: true,  // the bot never plays anything
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
  } catch (e) {
    try { connection.destroy(); } catch (e2) {}
    fs.rmSync(dir, { recursive: true, force: true });
    throw new Error('Could not connect to the voice channel (timed out). Check the bot has Connect permission.');
  }

  var session = {
    id: sessionId,
    guild: guild,
    guildId: guild.id,
    botId: (guild.members.me && guild.members.me.id) || (o.client && o.client.user && o.client.user.id) || null,
    channelId: voiceChannel.id,
    channelName: voiceChannel.name,
    textChannelId: o.textChannelId || null,
    startedBy: o.startedBy || '',
    dir: dir,
    startMs: Date.now(),
    connection: connection,
    receiver: connection.receiver,
    users: new Map(),
  };

  session.receiver.speaking.on('start', function(userId) {
    try { onSpeakingStart(session, userId); } catch (e) {}
  });

  // If the connection drops unexpectedly, tear the session down so a later
  // /record stop does not hang. The transcript of whatever we captured is lost
  // in that edge case, which is acceptable for a dropped connection.
  connection.on(VoiceConnectionStatus.Disconnected, function() {
    if (sessions.get(guild.id) === session) {
      try { connection.destroy(); } catch (e) {}
      sessions.delete(guild.id);
    }
  });

  sessions.set(guild.id, session);
  return session;
}

/**
 * Stop recording and flush every speaker's file.
 * Returns a manifest:
 *   { sessionId, dir, durationMs, channelName, speakers: [
 *       { userId, name, pcmPath, sampleRate, channels,
 *         utterances: [{ wallStartMs, fileStartSec, fileEndSec }] }
 *   ] }
 * The caller owns `dir` and should delete it after transcription.
 */
export async function stopRecording(guildId) {
  var session = sessions.get(guildId);
  if (!session) throw new Error('Not recording in this server');
  sessions.delete(guildId);

  var durationMs = Date.now() - session.startMs;

  // Stop receiving and leave the channel.
  try { session.connection.destroy(); } catch (e) {}

  // Flush and close every per-user file.
  var speakers = [];
  var users = Array.from(session.users.values());
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    await new Promise(function(resolve) {
      u.stream.end(function() { resolve(); });
    });
    if (u.bytes <= 0) continue; // no audio captured for this user
    var utterances = u.utterances.map(function(x) {
      return {
        wallStartMs: x.wallStartMs,
        fileStartSec: x.fileStartByte / BYTES_PER_SEC,
        fileEndSec: x.fileEndByte / BYTES_PER_SEC,
      };
    });
    speakers.push({
      userId: u.userId,
      name: u.name,
      pcmPath: u.pcmPath,
      sampleRate: SAMPLE_RATE,
      channels: CHANNELS,
      utterances: utterances,
    });
  }

  return {
    sessionId: session.id,
    dir: session.dir,
    durationMs: durationMs,
    channelId: session.channelId,
    channelName: session.channelName,
    speakers: speakers,
  };
}

// Best-effort: stop a recording without building a manifest (e.g. on shutdown).
export function abortRecording(guildId) {
  var session = sessions.get(guildId);
  if (!session) return;
  sessions.delete(guildId);
  try { session.connection.destroy(); } catch (e) {}
  try { fs.rmSync(session.dir, { recursive: true, force: true }); } catch (e) {}
}

// Re-export for callers that already have a connection (not used internally).
export { getVoiceConnection };
