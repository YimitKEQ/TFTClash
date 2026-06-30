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
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} from 'discord.js';

import fs from 'fs';
import { startRecording, stopRecording, isRecording, getSession } from '../lib/recorder.js';
import { transcribeManifest } from '../lib/transcribe.js';
import { analyzeMeeting } from '../lib/extract.js';
import { createCardsFromTasks, recordMeeting } from '../lib/board.js';
import { logVoiceSession, updateVoiceSession } from '../lib/voiceLog.js';
import { createIssue, jiraConfigured, jiraMissingHint, checkJira } from '../lib/jira.js';
import { resolveChannel } from '../lib/channels.js';
import { BT_DEPARTMENTS } from '../config/crew.js';

var DEPT_LABEL = {};
BT_DEPARTMENTS.forEach(function(d) { DEPT_LABEL[d.id] = d.label; });

// token -> { tasks, transcript, summary, meetingTitle, byline, createdBy, selected, engine }
var PENDING = new Map();
var PENDING_TTL_MS = 30 * 60 * 1000;

function clamp(s, n) {
  var v = String(s == null ? '' : s);
  return v.length > n ? v.slice(0, n - 3) + '...' : v;
}

function rememberPending(token, payload) {
  PENDING.set(token, payload);
  setTimeout(function() { PENDING.delete(token); }, PENDING_TTL_MS);
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
  var embed = new EmbedBuilder()
    .setColor(0x34D399)
    .setTitle(clamp('🎙 Recap: ' + p.meetingTitle, 240))
    .setDescription(clamp(r.tldr || 'No summary.', 1400));

  var decisions = bulletList(r.decisions, 6);
  if (decisions) embed.addFields({ name: '✅ Decisions', value: decisions });

  var next = bulletList(r.next_steps, 6);
  if (next) embed.addFields({ name: '➡️ Next steps', value: next });

  embed.addFields(
    { name: 'Duration', value: mins + 'm', inline: true },
    { name: 'Spoke', value: clamp(p.byline || '-', 200), inline: true },
    { name: 'Tasks', value: String((res.cards || []).length)
        + (res.jiraOn ? (' (' + (res.jiraResults || []).filter(function(x) { return x.key; }).length + ' Jira)') : ''),
      inline: true }
  );

  var blockers = bulletList(r.blockers, 5);
  if (blockers) embed.addFields({ name: '🚧 Blockers', value: blockers });

  var cardLines = (res.cards || []).map(function(c) {
    var dept = DEPT_LABEL[c.department] || c.department || 'Content';
    return '- ' + clamp(c.title, 90) + '  (' + dept + ')';
  });
  if (cardLines.length) embed.addFields({ name: '📋 Board cards', value: clamp(cardLines.join('\n'), 1024) });

  if (res.jiraOn) {
    var jLines = (res.jiraResults || []).map(function(x) {
      if (x.key) return '- [' + x.key + '](' + x.url + ') ' + clamp(x.title, 70);
      return '- (failed) ' + clamp(x.title, 70);
    });
    if (jLines.length) embed.addFields({ name: '🔗 Jira', value: clamp(jLines.join('\n'), 1024) });
  }

  embed.setFooter({ text: (p.engine === 'ai' ? 'AI recap' : 'Auto recap (no AI key)') + ' • whisper.cpp • BrosephTech' })
    .setTimestamp(new Date());
  return embed;
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
  });

export async function execute(interaction) {
  var sub = interaction.options.getSubcommand();
  if (sub === 'start') return startCmd(interaction);
  if (sub === 'stop') return stopCmd(interaction);
  if (sub === 'status') return statusCmd(interaction);
  if (sub === 'jiracheck') return jiraCheckCmd(interaction);
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

  var embed = new EmbedBuilder()
    .setColor(0xE05B5B)
    .setTitle('Recording: ' + voice.name)
    .setDescription('Capturing the conversation. Everyone who speaks is recorded on their own track. Run /record stop when you are done.')
    .setFooter({ text: 'Local transcription - audio never leaves this machine' })
    .setTimestamp(new Date());
  await interaction.editReply({ embeds: [embed] });
}

async function statusCmd(interaction) {
  var session = interaction.guild ? getSession(interaction.guild.id) : null;
  if (!session) {
    await interaction.reply({ content: 'Not recording right now. Use /record start.', ephemeral: true });
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
    cleanupDir(manifest.dir);
    await interaction.editReply('Transcription failed: ' + ((e && e.message) || e));
    return;
  } finally {
    // Audio + intermediate files are no longer needed once transcribed.
    cleanupDir(manifest.dir);
  }

  if (!tr.transcript) {
    await interaction.editReply('Transcribed, but no speech was recognized. Nothing to suggest.');
    return;
  }

  await interaction.editReply('Transcribed ' + manifest.speakers.length + ' track(s). Summarizing with AI, almost there...');
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
    var noTaskEmbed = new EmbedBuilder()
      .setColor(0x5BA3DB)
      .setTitle('Meeting captured: ' + meetingTitle)
      .setDescription(clamp((analysis.recap.tldr || analysis.summary || 'No summary.') + noAiNote, 2000))
      .setFooter({ text: 'No clear action items found - full recap posted to #bt-meetings' });
    var storedRecap0 = Object.assign({}, analysis.recap, { tasks: [] });
    var mtg0 = await recordMeeting({ title: meetingTitle, summary: analysis.summary, raw_notes: tr.transcript, created_by: interaction.user ? interaction.user.tag : '', tasks_created: 0, recap: storedRecap0 });
    await updateVoiceSession(voiceSessionId, { status: 'transcribed', tasksCreated: 0, meetingId: mtg0 && mtg0.id });
    await interaction.editReply({ content: '', embeds: [noTaskEmbed], files: [file] });
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
  await interaction.editReply(Object.assign({ content: '' }, payload, { files: [file] }));
}

// Build the embed + select + buttons for a pending suggestion set.
function buildSuggestionMessage(token, p) {
  var selectedSet = p.selected; // null or Set of index strings
  var taskLines = p.tasks.map(function(t, i) {
    var on = !selectedSet || selectedSet.has(String(i));
    var dept = DEPT_LABEL[t.department] || t.department || 'Content';
    var who = t.assignee ? (' - ' + t.assignee) : '';
    return (on ? '`x` ' : '`  ` ') + clamp(t.title, 90) + '  (' + dept + ', ' + (t.priority || 'medium') + who + ')';
  });

  var aiNote = p.engine !== 'ai'
    ? '\n\n*Basic extraction (no AI key). Full transcript attached below.*'
    : '';
  var embed = new EmbedBuilder()
    .setColor(0x5BA3DB)
    .setTitle('Meeting captured: ' + clamp(p.meetingTitle, 200))
    .setDescription(clamp((p.summary || 'No summary.') + aiNote, 1400));
  if (p.byline) embed.addFields({ name: 'Spoke', value: clamp(p.byline, 200) });
  embed.addFields({ name: 'Transcript (preview - full file attached)', value: clamp(p.transcript, 900) || '-' });
  embed.addFields({ name: 'Suggested tasks (' + p.tasks.length + ')', value: clamp(taskLines.join('\n'), 1024) });
  embed.setFooter({ text: (p.engine === 'ai' ? 'AI suggestions' : 'Basic suggestions (set ANTHROPIC_API_KEY)') + ' - pick the real ones, then Create. Full recap posts to #' + (process.env.BT_MEETINGS_CHANNEL || 'bt-meetings') });

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

  if (!p) {
    await interaction.reply({ content: 'This suggestion set expired. Run /record again.', ephemeral: true }).catch(function() {});
    return;
  }

  if (action === 'select') {
    p.selected = new Set(interaction.values || []);
    await interaction.deferUpdate().catch(function() {});
    return;
  }

  if (action === 'discard') {
    PENDING.delete(token);
    await updateVoiceSession(p.voiceSessionId, { status: 'discarded' });
    await interaction.update({ content: 'Discarded. No tasks created.', embeds: [], components: [] }).catch(function() {});
    return;
  }

  if (action === 'approve') {
    await interaction.deferUpdate().catch(function() {});
    var indices = p.selected ? Array.from(p.selected) : p.tasks.map(function(_, i) { return String(i); });
    var chosen = indices
      .map(function(i) { return p.tasks[parseInt(i, 10)]; })
      .filter(Boolean);

    if (!chosen.length) {
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

    var resultEmbed = new EmbedBuilder()
      .setColor(0x34D399)
      .setTitle('Created ' + chosen.length + ' task(s): ' + clamp(p.meetingTitle, 180))
      .setTimestamp(new Date());

    var boardLines = chosen.map(function(t) {
      var dept = DEPT_LABEL[t.department] || t.department || 'Content';
      return '- ' + clamp(t.title, 90) + '  (' + dept + ')';
    });
    resultEmbed.addFields({ name: cards.length + ' board card(s)', value: clamp(boardLines.join('\n'), 1024) });

    if (jiraOn) {
      var jLines = jiraResults.map(function(r) {
        if (r.key) return '- [' + r.key + '](' + r.url + ') ' + clamp(r.title, 70);
        return '- (failed) ' + clamp(r.title, 70) + ': ' + clamp(r.error, 80);
      });
      resultEmbed.addFields({ name: 'Jira issues', value: clamp(jLines.join('\n'), 1024) });
    } else {
      resultEmbed.addFields({ name: 'Jira', value: 'Skipped (not configured: ' + jiraMissingHint() + ')' });
    }
    resultEmbed.addFields({ name: 'Recap', value: 'Posted the full recap to #' + (process.env.BT_MEETINGS_CHANNEL || 'bt-meetings') + '.' });

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
