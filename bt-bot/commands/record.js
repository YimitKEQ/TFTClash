/**
 * /record - record the voice channel you are in, then turn the conversation
 * into suggested board + Jira tasks you approve.
 *
 * Subcommands:
 *   /record start         join your current voice channel and start capturing
 *   /record stop [title]  leave, transcribe (local whisper.cpp), and post the
 *                         AI-suggested tasks with an approve/discard control
 *   /record status        is a recording running, for how long, who has spoken
 *   /record jiracheck     verify the Jira Cloud credentials + project
 *
 * Flow on stop: record -> whisper transcript -> Claude task extraction ->
 * pick which tasks are real -> create board cards AND Jira issues.
 */

import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} from 'discord.js';

import fs from 'fs';
import { startRecording, stopRecording, isRecording, getSession } from '../lib/recorder.js';
import { transcribeManifest, transcriberStatus, realtimeFactor, estimateTranscription } from '../lib/transcribe.js';
import { hostedConfigured } from '../lib/stt.js';
import { analyzeMeeting } from '../lib/extract.js';
import { createCardsFromTasks, recordMeeting } from '../lib/board.js';
import { logVoiceSession, updateVoiceSession, savePending, loadPending, clearPending } from '../lib/voiceLog.js';
import { createIssue, jiraConfigured, jiraMissingHint, checkJira } from '../lib/jira.js';
import { pairByTitle, linkPairs } from '../lib/jiraSync.js';
import { postJiraSync } from '../scheduler.js';
import { resolveChannel } from '../lib/channels.js';
import { BT_DEPARTMENTS } from '../config/crew.js';
import {
  BRAND,
  COLOR,
  DOT,
  MARK,
  baseEmbed,
  eyebrow,
  pack,
} from '../lib/ui.js';

var DEPT_LABEL = {};
BT_DEPARTMENTS.forEach(function(d) { DEPT_LABEL[d.id] = d.label; });

// Priority reads as a dot in a list, the same vocabulary the board uses.
var PRIORITY_DOT = { high: DOT.danger, medium: DOT.soon, low: DOT.ok };
function priorityDot(p) {
  return PRIORITY_DOT[String(p || 'medium').toLowerCase()] || DOT.soon;
}

// token -> { tasks, transcript, summary, meetingTitle, byline, createdBy, selected, engine }
var PENDING = new Map();
var PENDING_TTL_MS = 30 * 60 * 1000;

function clamp(s, n) {
  var v = String(s == null ? '' : s);
  return v.length > n ? v.slice(0, n - 3) + '...' : v;
}

/**
 * Hold a suggestion set in memory AND on the session row.
 *
 * The in-memory map is only a cache now. It used to be the sole store, which
 * meant any restart silently destroyed a meeting's tasks: the recap sat in
 * Discord, the bot redeployed, and "Create selected" reported the set as
 * expired with no way to get the tasks back. The durable copy is what makes
 * approving hours or days later work.
 */
function rememberPending(token, payload) {
  PENDING.set(token, payload);
  setTimeout(function() { PENDING.delete(token); }, PENDING_TTL_MS);
  savePending(payload.voiceSessionId, token, payload).catch(function(e) {
    console.warn('[record] could not persist the pending set: ' + ((e && e.message) || e));
  });
}

// Build a downloadable full-transcript file so the Discord preview never loses
// anything. Returns an AttachmentBuilder.
function transcriptFile(meetingTitle, summary, transcript) {
  var body = '# ' + meetingTitle + '\n\n'
    + (summary ? '## Summary\n' + summary + '\n\n' : '')
    + '## Full transcript\n' + (transcript || '(empty)') + '\n';
  var safe = String(meetingTitle || 'meeting').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'meeting';
  return new AttachmentBuilder(Buffer.from(body, 'utf8'), { name: safe + '-transcript.md' });
}

function bulletList(items, max) {
  var arr = Array.isArray(items) ? items.slice(0, max) : [];
  var lines = arr.map(function(s) { return '- ' + clamp(String(s), 180); });
  return lines.length ? clamp(lines.join('\n'), 1024) : '';
}

// The persistent, skimmable recap card posted to #bt-meetings.
// p = { recap, byline, meetingTitle, engine, durationSeconds }
// res = { cards, jiraResults, jiraOn }
function buildRecapEmbed(p, res) {
  var r = p.recap || {};
  var mins = Math.max(1, Math.round((p.durationSeconds || 0) / 60));
  var jiraMade = (res.jiraResults || []).filter(function(x) { return x.key; }).length;

  var embed = baseEmbed({
    color: COLOR.success,
    author: BRAND.name + '  ' + MARK.arrow + '  meeting recap',
    title: MARK.live + '  ' + clamp(p.meetingTitle, 200),
    description: clamp(r.tldr || 'No summary.', 1400),
    footer: (p.engine === 'ai' ? 'AI recap' : 'Auto recap, no AI key set')
      + '  ' + MARK.arrow + '  ' + (hostedConfigured() ? 'transcribed by a hosted API' : 'transcribed locally with whisper.cpp')
      + '  ' + MARK.arrow + '  full transcript attached',
  });

  embed.addFields(
    { name: eyebrow('Length'), value: mins + 'm', inline: true },
    { name: eyebrow('Spoke'), value: clamp(p.byline || 'unknown', 200), inline: true },
    { name: eyebrow('Tasks'), value: String((res.cards || []).length) + (res.jiraOn ? ' (' + jiraMade + ' in Jira)' : ''), inline: true }
  );

  var decisions = bulletList(r.decisions, 6);
  if (decisions) embed.addFields({ name: eyebrow('Decisions'), value: decisions });

  var next = bulletList(r.next_steps, 6);
  if (next) embed.addFields({ name: eyebrow('Next steps'), value: next });

  var blockers = bulletList(r.blockers, 5);
  if (blockers) embed.addFields({ name: eyebrow('Blockers'), value: blockers });

  var cardLines = (res.cards || []).map(function(c) {
    return DOT.ok + ' ' + clamp(c.title, 84) + '  ' + MARK.arrow + '  ' + (DEPT_LABEL[c.department] || c.department || 'Content');
  });
  if (cardLines.length) embed.addFields({ name: eyebrow('Board cards', cardLines.length), value: pack(cardLines) });

  if (res.jiraOn) {
    var jLines = (res.jiraResults || []).map(function(x) {
      if (x.key) return '[' + x.key + '](' + x.url + ')  ' + clamp(x.title, 70);
      return MARK.blocked + ' failed  ' + clamp(x.title, 70);
    });
    if (jLines.length) embed.addFields({ name: eyebrow('Jira', jLines.length), value: pack(jLines) });
  }

  return embed;
}

/**
 * A Discord interaction token is only valid for 15 minutes. Transcribing a real
 * meeting routinely runs longer than that, and when it does every editReply
 * fails with 50027 "Invalid Webhook Token" and the person who ran the command
 * gets nothing at all: not the result, not even the error.
 *
 * That is exactly what happened on 2026-08-11. A 35 minute recording timed out,
 * and the message saying so could not be delivered either, so the meeting
 * vanished in silence.
 *
 * respond() delivers the message either way: through the interaction while the
 * token is alive, otherwise as a normal channel message addressed to whoever
 * asked. Never throws, because losing the RESULT is bad but losing the
 * explanation as well is worse.
 */
var INTERACTION_TOKEN_MS = 15 * 60 * 1000;
var TOKEN_SAFETY_MS = 60 * 1000; // stop trusting the token a minute early

function tokenAlive(interaction) {
  return (Date.now() - interaction.createdTimestamp) < (INTERACTION_TOKEN_MS - TOKEN_SAFETY_MS);
}

function asPayload(payload) {
  return typeof payload === 'string' ? { content: payload } : payload;
}

async function respond(interaction, payload) {
  var body = asPayload(payload);

  if (tokenAlive(interaction)) {
    try {
      return await interaction.editReply(body);
    } catch (e) {
      // 50027 is the expired token. Anything else is worth knowing about, but
      // still must not stop us reaching the user.
      if (!e || e.code !== 50027) {
        console.warn('[record] editReply failed (' + ((e && e.code) || '?') + '), falling back to the channel: ' + ((e && e.message) || e));
      }
    }
  }

  try {
    var channel = interaction.channel;
    if (!channel || typeof channel.send !== 'function') {
      console.error('[record] no channel available to deliver the result');
      return null;
    }
    var who = interaction.user ? '<@' + interaction.user.id + '> ' : '';
    var fallback = Object.assign({}, body);
    fallback.content = who + (body.content || 'Your recording finished.');
    fallback.allowedMentions = { users: interaction.user ? [interaction.user.id] : [] };
    return await channel.send(fallback);
  } catch (e2) {
    console.error('[record] could not deliver the result at all: ' + ((e2 && e2.message) || e2));
    return null;
  }
}

// Post the recap to the meetings channel (best-effort, never throws).
async function postRecap(interaction, embed, file) {
  try {
    if (!interaction.guild) return;
    var name = process.env.BT_MEETINGS_CHANNEL || 'bt-meetings';
    var ch = resolveChannel(interaction.guild, name);
    if (ch) await ch.send({ embeds: [embed], files: file ? [file] : [] });
  } catch (e) {
    console.warn('[record] could not post recap to meetings channel: ' + ((e && e.message) || e));
  }
}

// customId prefixes this command answers to (see the router in index.js).
export var componentIds = ['rec'];

export var data = new SlashCommandBuilder()
  .setName('record')
  .setDescription('Record a voice meeting and turn it into board + Jira tasks')
  .addSubcommand(function(s) {
    return s.setName('start').setDescription('Start recording the voice channel you are in');
  })
  .addSubcommand(function(s) {
    return s.setName('stop')
      .setDescription('Stop, transcribe, and suggest tasks')
      .addStringOption(function(o) {
        return o.setName('title').setDescription('Meeting title (optional)').setMaxLength(120);
      });
  })
  .addSubcommand(function(s) {
    return s.setName('status').setDescription('Show the current recording status');
  })
  .addSubcommand(function(s) {
    return s.setName('jiracheck').setDescription('Verify the Jira Cloud connection');
  })
  .addSubcommand(function(s) {
    return s.setName('jirasync').setDescription('Pull Jira status changes onto the board right now');
  });

export async function execute(interaction) {
  var sub = interaction.options.getSubcommand();
  if (sub === 'start') return startCmd(interaction);
  if (sub === 'stop') return stopCmd(interaction);
  if (sub === 'status') return statusCmd(interaction);
  if (sub === 'jiracheck') return jiraCheckCmd(interaction);
  if (sub === 'jirasync') return jiraSyncCmd(interaction);
}

async function startCmd(interaction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'Run this in a server.', ephemeral: true });
    return;
  }
  if (isRecording(interaction.guild.id)) {
    await interaction.reply({ content: 'Already recording in this server. Use /record stop first.', ephemeral: true });
    return;
  }
  var member = interaction.member;
  var voice = member && member.voice ? member.voice.channel : null;
  if (!voice) {
    await interaction.reply({ content: 'Join a voice channel first, then run /record start.', ephemeral: true });
    return;
  }

  // Refuse BEFORE the meeting rather than failing after it. Recording an hour
  // long call and only then discovering this host cannot transcribe loses the
  // conversation outright, which is exactly what used to happen in production.
  var stt = transcriberStatus();
  if (!stt.ok) {
    var blockedEmbed = baseEmbed({
      color: COLOR.danger,
      author: BRAND.name + '  ' + MARK.arrow + '  recording unavailable',
      title: MARK.blocked + '  Cannot transcribe on this host',
      description: 'Not starting a recording that could not be turned into a transcript. Your meeting would have been lost after everyone hung up.',
      footer: 'Nothing was recorded',
    });
    blockedEmbed.addFields(
      { name: eyebrow('Problem'), value: stt.detail },
      { name: eyebrow('Fix'), value: stt.hint },
      { name: eyebrow('Meanwhile'), value: 'Run the meeting, then capture it with `/meeting` and paste the notes. You still get a recap and tasks, just without the audio.' }
    );
    await interaction.reply({ embeds: [blockedEmbed], ephemeral: true });
    return;
  }

  await interaction.deferReply();
  try {
    await startRecording({
      client: interaction.client,
      guild: interaction.guild,
      voiceChannel: voice,
      textChannelId: interaction.channelId,
      startedBy: interaction.user ? interaction.user.tag : '',
    });
  } catch (e) {
    await interaction.editReply('Could not start recording: ' + ((e && e.message) || e));
    return;
  }

  var embed = baseEmbed({
    color: COLOR.live,
    author: BRAND.name + '  ' + MARK.arrow + '  recording',
    title: MARK.live + '  ' + voice.name,
    description: 'Capturing the conversation. Everyone who speaks is recorded on their own track, so a pause never cuts the call short.\nRun `/record stop` when you are done.',
    // The footer must state what actually happens to the audio on THIS host.
    // Claiming it stays local while it is being uploaded would be the single
    // most damaging thing this bot could say.
    footer: hostedConfigured()
      ? 'Transcribed by a hosted API  ' + MARK.arrow + '  audio is sent off this machine, then deleted'
      : 'Transcribed locally  ' + MARK.arrow + '  audio never leaves this machine and is deleted after',
  });

  // Say up front how long this host takes. Transcription here runs at several
  // times realtime, so a long call is a multi hour job that competes with
  // everything else on the box. Finding that out after the meeting is too late
  // to do anything about it.
  var factor = hostedConfigured() ? null : realtimeFactor();
  if (factor && factor >= 2) {
    var perHour = estimateTranscription(3600);
    embed.addFields({
      name: eyebrow('Before you start'),
      value: 'Transcribing on this host runs at roughly **' + factor.toFixed(1) + 'x realtime**, so an hour of call is '
        + (perHour ? perHour.text : 'a long job') + ' of processing, and it competes with the other bots on this machine.\n'
        + 'For a long meeting, `/meeting` with pasted notes gives the same recap and the same tasks instantly.',
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function statusCmd(interaction) {
  var session = interaction.guild ? getSession(interaction.guild.id) : null;
  if (!session) {
    // Report the transcriber here too, so "why is /record not working" is one
    // command away instead of a log dive on the host.
    var stt = transcriberStatus();
    var line = stt.ok
      ? 'Not recording right now. Use `/record start`.'
      : 'Not recording, and `/record start` is currently blocked: ' + stt.detail + '\n' + stt.hint;
    await interaction.reply({ content: line, ephemeral: true });
    return;
  }
  var mins = Math.floor((Date.now() - session.startMs) / 60000);
  var secs = Math.floor(((Date.now() - session.startMs) % 60000) / 1000);
  var speakers = Array.from(session.users.values()).map(function(u) { return u.name; });
  var prefix = session.dropped
    ? ((session.timedOut ? 'Hit the 4h safety cap' : 'Voice connection dropped') + ' - audio is safe, run /record stop to save it.\n')
    : '';
  await interaction.reply({
    content: prefix + 'Recording ' + session.channelName + ' for ' + mins + 'm ' + secs + 's. '
      + (speakers.length ? ('Heard: ' + speakers.join(', ')) : 'No one has spoken yet.'),
    ephemeral: true,
  });
}

async function jiraCheckCmd(interaction) {
  await interaction.deferReply({ ephemeral: true });
  var r = await checkJira();
  await interaction.editReply((r.ok ? 'Jira OK: ' : 'Jira not ready: ') + r.detail);
}

// Run the sync on demand instead of waiting for the ten minute cron. The cron
// only announces moves; this always answers, including "nothing changed", so
// the person who just dragged a ticket gets a straight yes or no.
async function jiraSyncCmd(interaction) {
  await interaction.deferReply({ ephemeral: true });
  var r = await postJiraSync(interaction.client);

  if (r.skipped) {
    await interaction.editReply('Sync skipped: ' + r.reason);
    return;
  }
  if (!r.ok) {
    await interaction.editReply('Sync failed: ' + r.reason);
    return;
  }

  var parts = ['Checked ' + r.checked + ' linked card(s).'];
  if (r.moved) parts.push('Moved ' + r.moved + ' to match Jira (posted in the standup channel).');
  else parts.push('Nothing to move, the board already matches Jira.');
  if (r.stamped) parts.push(r.stamped + ' card(s) took their first Jira baseline.');
  if (r.missing && r.missing.length) parts.push(r.missing.length + ' card(s) point at an issue that no longer exists: ' + r.missing.join(', ') + '.');
  if (r.errors && r.errors.length) parts.push(r.errors.length + ' write(s) failed, check the logs.');

  await interaction.editReply(parts.join(' '));
}

async function stopCmd(interaction) {
  if (!interaction.guild || !isRecording(interaction.guild.id)) {
    await interaction.reply({ content: 'Not recording in this server.', ephemeral: true });
    return;
  }
  await interaction.deferReply();

  var manifest;
  try {
    manifest = await stopRecording(interaction.guild.id);
  } catch (e) {
    await interaction.editReply('Could not stop recording: ' + ((e && e.message) || e));
    return;
  }

  if (!manifest.speakers.length) {
    cleanupDir(manifest.dir);
    await interaction.editReply('Stopped. No audio was captured (no one spoke, or the bot could not hear). Nothing to transcribe.');
    return;
  }

  var titleOpt = interaction.options.getString('title');
  var meetingTitle = titleOpt || (manifest.channelName + ' - ' + new Date().toISOString().split('T')[0]);

  var earlyNote = manifest.timedOut ? '(Note: hit the 4h cap - transcribing what was captured.) '
    : (manifest.dropped ? '(Note: the voice connection dropped earlier - transcribing what was captured.) ' : '');
  await interaction.editReply(earlyNote + 'Stopped. Transcribing ' + manifest.speakers.length + ' track(s) locally, this can take a moment...');

  var tr;
  try {
    tr = await transcribeManifest(manifest);
  } catch (e) {
    // The audio is deliberately NOT deleted on a transcription failure: it is
    // the only copy of the meeting, and a failure here is usually a timeout
    // that a rerun or a smaller model could still get through. cleanupDir on
    // the success path still removes it as soon as there is a transcript.
    await respond(interaction, 'Transcription failed: ' + ((e && e.message) || e)
      + '\nThe raw audio is still on the host at `' + manifest.dir + '`, so the meeting is recoverable. '
      + 'See docs/OPERATIONS.md section 4.');
    return;
  }
  // Audio and intermediate files are no longer needed once transcribed.
  cleanupDir(manifest.dir);

  if (!tr.transcript) {
    await respond(interaction, 'Transcribed, but no speech was recognized. Nothing to suggest.');
    return;
  }

  await respond(interaction, 'Transcribed ' + manifest.speakers.length + ' track(s). Summarizing with AI, almost there...');
  var analysis = await analyzeMeeting(tr.transcript, null);
  var tasks = (analysis.tasks || []).slice(0, 25);
  var durationSeconds = Math.round(manifest.durationMs / 1000);

  // Log the recording to bt_voice_sessions so it shows in the dashboard history.
  var aiEngine = analysis.engine === 'ai' ? (process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5') : 'rule-based';
  var voiceSessionId = await logVoiceSession({
    guildId: interaction.guild.id,
    channelId: manifest.channelId,
    channelName: manifest.channelName,
    status: 'transcribed',
    requestedBy: interaction.user ? interaction.user.tag : '',
    startedAt: new Date(Date.now() - manifest.durationMs).toISOString(),
    endedAt: new Date().toISOString(),
    durationSeconds: Math.round(manifest.durationMs / 1000),
    transcript: tr.transcript,
    segments: tr.segments,
    summary: analysis.summary || '',
    sttEngine: 'whisper.cpp',
    aiEngine: aiEngine,
  });

  var file = transcriptFile(meetingTitle, analysis.summary, tr.transcript);
  var noAiNote = analysis.engine !== 'ai'
    ? '\n\n*No AI key set - using basic extraction. Set `ANTHROPIC_API_KEY` in the bot .env for proper summaries and cleaner tasks.*'
    : '';

  if (!tasks.length) {
    var noTaskEmbed = baseEmbed({
      color: COLOR.brand,
      author: BRAND.name + '  ' + MARK.arrow + '  meeting captured',
      title: MARK.live + '  ' + clamp(meetingTitle, 200),
      description: clamp((analysis.recap.tldr || analysis.summary || 'No summary.') + noAiNote, 2000),
      footer: 'No clear action items found  ' + MARK.arrow + '  full recap posted to #'
        + (process.env.BT_MEETINGS_CHANNEL || 'bt-meetings'),
    });
    var storedRecap0 = Object.assign({}, analysis.recap, { tasks: [] });
    var mtg0 = await recordMeeting({ title: meetingTitle, summary: analysis.summary, raw_notes: tr.transcript, created_by: interaction.user ? interaction.user.tag : '', tasks_created: 0, recap: storedRecap0 });
    await updateVoiceSession(voiceSessionId, { status: 'transcribed', tasksCreated: 0, meetingId: mtg0 && mtg0.id });
    await respond(interaction, { content: '', embeds: [noTaskEmbed], files: [file] });
    var recapEmbed0 = buildRecapEmbed({ recap: analysis.recap, byline: tr.byline, meetingTitle: meetingTitle, engine: analysis.engine, durationSeconds: durationSeconds }, { cards: [], jiraResults: [], jiraOn: false });
    await postRecap(interaction, recapEmbed0, file);
    return;
  }

  var token = interaction.id;
  rememberPending(token, {
    tasks: tasks,
    transcript: tr.transcript,
    summary: analysis.summary || '',
    recap: analysis.recap,
    durationSeconds: durationSeconds,
    meetingTitle: meetingTitle,
    byline: tr.byline,
    createdBy: interaction.user ? interaction.user.tag : '',
    selected: null, // null => all selected by default
    engine: analysis.engine,
    voiceSessionId: voiceSessionId,
  });

  var payload = buildSuggestionMessage(token, PENDING.get(token));
  // Delivered through respond(): on a long meeting the interaction token is
  // already dead by the time we get here, and this is the message that carries
  // the task pick list, so losing it loses the whole point of the recording.
  await respond(interaction, Object.assign({ content: '' }, payload, { files: [file] }));
}

// Build the embed + select + buttons for a pending suggestion set.
//
// The 900 character transcript preview that used to sit in the middle of this
// card is gone: the complete transcript is attached to the same message as a
// file, so the preview was pure noise between the summary and the thing the
// reader actually has to act on.
function buildSuggestionMessage(token, p) {
  var selectedSet = p.selected; // null or Set of index strings
  var taskLines = p.tasks.map(function(t, i) {
    var on = !selectedSet || selectedSet.has(String(i));
    var dept = DEPT_LABEL[t.department] || t.department || 'Content';
    var who = t.assignee ? ('  ' + MARK.arrow + '  ' + t.assignee) : '';
    return (on ? '`[x]` ' : '`[ ]` ') + priorityDot(t.priority) + ' ' + clamp(t.title, 84)
      + '  ' + MARK.arrow + '  ' + dept + who;
  });

  var aiNote = p.engine !== 'ai'
    ? '\n\n*Basic extraction, no AI key set. Set `ANTHROPIC_API_KEY` for real summaries.*'
    : '';

  var embed = baseEmbed({
    color: COLOR.brand,
    author: BRAND.name + '  ' + MARK.arrow + '  meeting captured',
    title: MARK.live + '  ' + clamp(p.meetingTitle, 200),
    description: clamp((p.summary || 'No summary.') + aiNote, 1400),
    footer: 'Tick the real ones, then Create selected  ' + MARK.arrow + '  recap posts to #'
      + (process.env.BT_MEETINGS_CHANNEL || 'bt-meetings'),
  });

  if (p.byline) embed.addFields({ name: eyebrow('Spoke'), value: clamp(p.byline, 200) });
  embed.addFields({ name: eyebrow('Suggested tasks', p.tasks.length), value: pack(taskLines) });

  var options = p.tasks.map(function(t, i) {
    var dept = DEPT_LABEL[t.department] || t.department || 'Content';
    return {
      label: clamp(t.title, 95) || ('Task ' + (i + 1)),
      description: clamp(dept + ' - ' + (t.priority || 'medium') + (t.assignee ? (' - ' + t.assignee) : ''), 95),
      value: String(i),
      default: !selectedSet || selectedSet.has(String(i)),
    };
  });

  var select = new StringSelectMenuBuilder()
    .setCustomId('rec:select:' + token)
    .setPlaceholder('Choose which tasks to create')
    .setMinValues(0)
    .setMaxValues(options.length)
    .addOptions(options);

  var approve = new ButtonBuilder()
    .setCustomId('rec:approve:' + token)
    .setLabel('Create selected')
    .setStyle(ButtonStyle.Success);
  var discard = new ButtonBuilder()
    .setCustomId('rec:discard:' + token)
    .setLabel('Discard')
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(select),
      new ActionRowBuilder().addComponents(approve, discard),
    ],
  };
}

// Routed from index.js for any customId starting "rec:".
export async function handleComponent(interaction) {
  var parts = String(interaction.customId || '').split(':');
  var action = parts[1];
  var token = parts[2];
  var p = PENDING.get(token);

  // Whether THIS interaction has been acknowledged. Deliberately a local, not a
  // field on the cached payload: the payload outlives the interaction, so
  // storing it there would make the next click think it had already been
  // acknowledged when it had not.
  var acked = false;
  async function ack() {
    if (acked) return;
    try {
      await interaction.deferUpdate();
      acked = true;
    } catch (e) {
      console.warn('[record] deferUpdate failed: ' + ((e && e.message) || e));
    }
  }
  async function tell(content) {
    var body = { content: content, ephemeral: true };
    if (acked) return interaction.followUp(body).catch(function() {});
    return interaction.reply(body).catch(function() {});
  }

  if (!p) {
    // Not in memory. That almost always means the bot restarted since the recap
    // was posted, which used to be fatal: the tasks were simply gone and the
    // only "fix" was to record the meeting again, which is impossible after it
    // happened. Load the durable copy instead.
    //
    // Discord wants an acknowledgement within three seconds and this is a
    // database round trip, so acknowledge FIRST and then look it up.
    await ack();

    p = await loadPending(token);
    if (!p) {
      await tell('I cannot find that suggestion set any more, so those tasks were not created.\n'
        + 'It was most likely already created, or discarded. Re-run `/record` for a new meeting, '
        + 'or add them by hand with `/card add`.');
      return;
    }

    console.log('[record] restored a pending set from the database after a restart ("'
      + p.meetingTitle + '", ' + p.tasks.length + ' task(s))');
    PENDING.set(token, p);
  }

  if (action === 'select') {
    p.selected = new Set(interaction.values || []);
    await ack();
    return;
  }

  if (action === 'discard') {
    PENDING.delete(token);
    await updateVoiceSession(p.voiceSessionId, { status: 'discarded', pending: null });
    if (acked) {
      await interaction.editReply({ content: 'Discarded. No tasks created.', embeds: [], components: [] }).catch(function() {});
    } else {
      await interaction.update({ content: 'Discarded. No tasks created.', embeds: [], components: [] }).catch(function() {});
    }
    return;
  }

  if (action === 'approve') {
    // Claim the token BEFORE any await. Creating the cards takes seconds (a
    // board insert plus one Jira round trip per task), and until this guard
    // existed the pending entry stayed live for that whole window, so a second
    // click ran the entire batch again. That is exactly how the board ended up
    // with seven tasks duplicated eight seconds apart on 2026-07-16.
    if (p.processing) {
      await tell('Already creating those tasks, give it a moment. Do not click again.');
      return;
    }
    p.processing = true;

    await ack();
    var indices = p.selected ? Array.from(p.selected) : p.tasks.map(function(_, i) { return String(i); });
    var chosen = indices
      .map(function(i) { return p.tasks[parseInt(i, 10)]; })
      .filter(Boolean);

    if (!chosen.length) {
      // Nothing was created, so release the claim and let them pick and retry.
      // A failure PART WAY through creation deliberately stays claimed: retrying
      // would duplicate whatever already succeeded, and the 30 minute PENDING
      // TTL clears it anyway.
      p.processing = false;
      await interaction.followUp({ content: 'No tasks selected, nothing created.', ephemeral: true }).catch(function() {});
      return;
    }

    // 1) Board cards.
    var cards = [];
    try {
      cards = await createCardsFromTasks(chosen, { meetingTitle: p.meetingTitle });
    } catch (e) {
      console.error('[record] board insert failed: ' + ((e && e.message) || e));
    }

    // 2) Jira issues.
    var jiraResults = [];
    var jiraOn = jiraConfigured();
    if (jiraOn) {
      for (var i = 0; i < chosen.length; i++) {
        var t = chosen[i];
        try {
          var issue = await createIssue(t, { meetingTitle: p.meetingTitle, summary: p.summary });
          jiraResults.push({ title: t.title, key: issue.key, url: issue.url });
        } catch (e2) {
          jiraResults.push({ title: t.title, error: (e2 && e2.message) || String(e2) });
        }
      }
    }

    // 2b) Link each card to the issue made from the same task, so a status
    // change in Jira can flow back onto the board later. Matching is by title
    // and only accepts unambiguous pairs (see pairByTitle), so two tasks with
    // the same title in one meeting stay unlinked rather than cross wired.
    // A freshly created issue always sits in the project's first status, which
    // is the 'new' category, so that is the baseline linkPairs records.
    if (jiraOn && cards.length) {
      try {
        var madeIssues = jiraResults.filter(function(r) { return r.key; }).map(function(r) {
          return { key: r.key, summary: r.title, url: r.url, category: 'new' };
        });
        var paired = pairByTitle(cards, madeIssues);
        var linkRes = await linkPairs(paired.pairs);
        console.log('[record] linked ' + linkRes.linked + '/' + madeIssues.length + ' card(s) to Jira'
          + (paired.ambiguous.length ? ' (' + paired.ambiguous.length + ' ambiguous title(s) skipped)' : ''));
        if (linkRes.failed.length) {
          console.warn('[record] link failures: ' + linkRes.failed.map(function(f) { return f.key + ' (' + f.error + ')'; }).join(', '));
        }
      } catch (linkErr) {
        // A missing link only costs the automatic status sync. The card and the
        // issue both exist, so never fail the capture over it.
        console.warn('[record] Jira linking skipped: ' + ((linkErr && linkErr.message) || linkErr));
      }
    }

    // 3) Log the meeting (with the recap + created tasks) and finalize the
    // voice session record for the dashboard.
    var storedRecap = Object.assign({}, p.recap, { tasks: chosen });
    var mtg = await recordMeeting({
      title: p.meetingTitle,
      summary: p.summary,
      raw_notes: p.transcript,
      created_by: p.createdBy,
      tasks_created: chosen.length,
      recap: storedRecap,
    }).catch(function() { return null; });

    await updateVoiceSession(p.voiceSessionId, {
      status: 'completed',
      tasksCreated: chosen.length,
      cardIds: cards.map(function(c) { return c.id; }),
      meetingId: mtg && mtg.id,
    });

    PENDING.delete(token);
    await clearPending(p.voiceSessionId);
    console.log('[record] created ' + chosen.length + ' task(s) from "' + p.meetingTitle + '"'
      + (jiraOn ? ' (' + jiraResults.filter(function(r) { return r.key; }).length + ' in Jira)' : ''));

    var resultEmbed = baseEmbed({
      color: COLOR.success,
      author: BRAND.name + '  ' + MARK.arrow + '  tasks created',
      title: MARK.shipped + '  ' + chosen.length + ' task' + (chosen.length === 1 ? '' : 's') + ' from ' + clamp(p.meetingTitle, 160),
      footer: 'Full recap posted to #' + (process.env.BT_MEETINGS_CHANNEL || 'bt-meetings'),
    });

    var boardLines = chosen.map(function(t) {
      return priorityDot(t.priority) + ' ' + clamp(t.title, 84) + '  ' + MARK.arrow + '  ' + (DEPT_LABEL[t.department] || t.department || 'Content');
    });
    resultEmbed.addFields({ name: eyebrow('Board cards', cards.length), value: pack(boardLines) });

    if (jiraOn) {
      var jLines = jiraResults.map(function(r) {
        if (r.key) return '[' + r.key + '](' + r.url + ')  ' + clamp(r.title, 70);
        return MARK.blocked + ' failed  ' + clamp(r.title, 70) + ': ' + clamp(r.error, 80);
      });
      resultEmbed.addFields({ name: eyebrow('Jira', jLines.length), value: pack(jLines) });
    } else {
      resultEmbed.addFields({ name: eyebrow('Jira'), value: 'Skipped, not configured: ' + jiraMissingHint() });
    }

    await interaction.editReply({ content: '', embeds: [resultEmbed], components: [] }).catch(function() {});

    // Post the persistent recap card to the meetings channel.
    var recapEmbed = buildRecapEmbed(p, { cards: cards, jiraResults: jiraResults, jiraOn: jiraOn });
    await postRecap(interaction, recapEmbed, transcriptFile(p.meetingTitle, p.summary, p.transcript));
    return;
  }
}

function cleanupDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
}
