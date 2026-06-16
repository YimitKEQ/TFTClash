/**
 * /meeting - capture a meeting into the board.
 *
 * Flow: the command opens a modal where you paste the meeting notes (or a rough
 * transcript). On submit, the bot summarizes the meeting and extracts action
 * items into board cards, then posts a recap. Uses the Claude API when
 * ANTHROPIC_API_KEY is set, otherwise a built-in rule-based parser.
 */

import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
} from 'discord.js';

import { BT_DEPARTMENTS } from '../config/crew.js';
import { analyzeMeeting } from '../lib/extract.js';
import { createCardsFromTasks, recordMeeting } from '../lib/board.js';
import { resolveChannel } from '../lib/channels.js';

var DEPT_CHOICES = BT_DEPARTMENTS.map(function(d) { return { name: d.label, value: d.id }; });
var DEPT_LABEL = {};
BT_DEPARTMENTS.forEach(function(d) { DEPT_LABEL[d.id] = d.label; });

export var data = new SlashCommandBuilder()
  .setName('meeting')
  .setDescription('Capture a meeting into board cards (summary + action items)')
  .addStringOption(function(opt) {
    return opt
      .setName('department')
      .setDescription('Pin every task to one department (leave empty to auto-classify per task)')
      .addChoices.apply(opt, DEPT_CHOICES);
  });

export async function execute(interaction) {
  var dept = interaction.options.getString('department') || 'auto';

  var modal = new ModalBuilder()
    .setCustomId('meeting:create:' + dept)
    .setTitle('Capture a meeting');

  var titleInput = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('Meeting title')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. Barontactics weekly sync')
    .setRequired(true)
    .setMaxLength(120);

  var notesInput = new TextInputBuilder()
    .setCustomId('notes')
    .setLabel('Notes or transcript')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Paste the meeting notes, decisions, and action items here...')
    .setRequired(true)
    .setMaxLength(4000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(notesInput)
  );

  await interaction.showModal(modal);
}

// Handles the modal submission (routed from index.js).
export async function handleModal(interaction) {
  await interaction.deferReply();

  var parts = String(interaction.customId || '').split(':');
  var deptArg = parts[2] || 'auto';
  var forcedDept = deptArg === 'auto' ? null : deptArg;

  var title = interaction.fields.getTextInputValue('title');
  var notes = interaction.fields.getTextInputValue('notes');

  var analysis = await analyzeMeeting(notes, forcedDept);
  var tasks = analysis.tasks || [];

  var created = [];
  try {
    created = await createCardsFromTasks(tasks, { meetingTitle: title });
  } catch (e) {
    console.error('[meeting] createCardsFromTasks failed: ' + ((e && e.message) || e));
    await interaction.editReply('Could not create cards from that meeting right now. The notes were not saved. Try again shortly.');
    return;
  }

  await recordMeeting({
    title: title,
    summary: analysis.summary,
    raw_notes: notes,
    created_by: interaction.user ? interaction.user.tag : '',
    tasks_created: created.length,
  });

  var engineNote = analysis.engine === 'ai' ? 'AI summary' : 'Auto summary (no AI key set)';

  var embed = new EmbedBuilder()
    .setColor(0x5BA3DB)
    .setTitle('Meeting captured: ' + title)
    .setTimestamp(new Date());

  if (analysis.summary) {
    embed.setDescription(analysis.summary.slice(0, 1024));
  }

  if (created.length === 0) {
    embed.addFields({ name: 'Tasks', value: 'No clear action items were found, so no cards were created. Add bullet points or "TODO" lines and try again.' });
  } else {
    var lines = created.slice(0, 20).map(function(c) {
      var label = DEPT_LABEL[c.department] || c.department || 'Content';
      return '- ' + c.title + '  (' + label + ')';
    });
    if (created.length > 20) lines.push('...and ' + (created.length - 20) + ' more');
    embed.addFields({ name: created.length + ' card(s) created in Ideas/Backlog', value: lines.join('\n').slice(0, 1024) });
  }

  embed.setFooter({ text: engineNote + ' - BrosephTech' });

  await interaction.editReply({ embeds: [embed] });

  // Also drop the recap in the dedicated meetings channel, unless we are already
  // in it, so #bt-meetings becomes the running log of captured meetings.
  try {
    var guild = interaction.guild;
    var meetingsName = process.env.BT_MEETINGS_CHANNEL || 'bt-meetings';
    var channel = guild ? resolveChannel(guild, meetingsName) : null;
    if (channel && channel.id !== interaction.channelId) {
      await channel.send({ embeds: [embed] });
    }
  } catch (e) {
    console.warn('[meeting] could not post recap to meetings channel: ' + ((e && e.message) || e));
  }
}
