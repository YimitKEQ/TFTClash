/**
 * /blocked - ephemeral list of every currently blocked active card.
 *
 * Cards in the published or archive columns are ignored (the work is done).
 * Results are grouped by department, each line names the owner(s) and how many
 * days the card has sat untouched in its current column.
 *
 * Copy rule: zero em or en dashes anywhere in user-facing strings.
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fetchCards, staleDays, assigneesOf } from '../lib/board.js';
import { BT_DEPARTMENTS, mention } from '../config/crew.js';
import { EMBED_COLORS } from '../lib/embeds.js';

var DONE_COLUMNS = ['published', 'archive'];

var DEPT_LABEL = {};
BT_DEPARTMENTS.forEach(function(d) { DEPT_LABEL[d.id] = d.label; });

export var data = new SlashCommandBuilder()
  .setName('blocked')
  .setDescription('Show every blocked card that still needs unblocking');

function titleOf(card) {
  return (card && (card.title || card.name)) || 'Untitled card';
}

function isDone(card) {
  return DONE_COLUMNS.indexOf(String((card && card.column_id) || '').toLowerCase()) !== -1;
}

function ownersText(card) {
  var owners = assigneesOf(card);
  if (!owners.length) return '*unassigned*';
  return owners.map(function(name) { return mention(name); }).join(', ');
}

function deptKey(card) {
  return String((card && card.department) || '').toLowerCase();
}

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  var cards;
  try {
    cards = await fetchCards();
  } catch (e) {
    return interaction.editReply({ content: 'Could not read the board right now. Try again shortly.' });
  }

  var blocked = (Array.isArray(cards) ? cards : []).filter(function(card) {
    return card && card.blocked === true && !isDone(card);
  });

  if (blocked.length === 0) {
    var clean = new EmbedBuilder()
      .setColor(EMBED_COLORS.brand)
      .setTitle('Nothing blocked')
      .setDescription('No active card is flagged as blocked right now. Keep it rolling.')
      .setTimestamp();
    return interaction.editReply({ embeds: [clean] });
  }

  // Group the blocked cards by department id, keeping an "other" bucket for any
  // card whose department is unknown so nothing is silently dropped.
  var groups = {};
  blocked.forEach(function(card) {
    var key = DEPT_LABEL[deptKey(card)] ? deptKey(card) : 'other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(card);
  });

  var orderedKeys = BT_DEPARTMENTS.map(function(d) { return d.id; });
  if (groups.other) orderedKeys.push('other');

  var embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.warn)
    .setTitle('Blocked cards (' + blocked.length + ')')
    .setDescription('These are flagged as blocked and need someone to unstick them.')
    .setTimestamp();

  orderedKeys.forEach(function(key) {
    var list = groups[key];
    if (!list || !list.length) return;
    var label = key === 'other' ? 'Other' : DEPT_LABEL[key];
    var lines = list.map(function(card) {
      var sd = staleDays(card);
      var stuckText = sd > 0 ? ' (' + sd + 'd stuck)' : '';
      return '- **' + titleOf(card) + '** (' + ownersText(card) + ')' + stuckText;
    });
    embed.addFields({ name: label + ' (' + list.length + ')', value: lines.join('\n').slice(0, 1024) });
  });

  await interaction.editReply({ embeds: [embed] });
}
