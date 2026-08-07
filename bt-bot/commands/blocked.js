/**
 * /blocked - every currently blocked active card, grouped by department.
 *
 * Cards in the published or archive columns are ignored (the work is done).
 * Each row names the owner and how long the card has sat untouched.
 *
 * This previously cut each department's list with a raw .slice(0, 1024), which
 * can sever a mention mid-token and render as a broken "<@1234" fragment. It
 * now uses the shared packer, which only ever drops whole lines and always says
 * how many it dropped.
 *
 * Copy rule: zero em or en dashes anywhere in user-facing strings.
 */

import { SlashCommandBuilder } from 'discord.js';
import { fetchCards, staleDays, assigneesOf, isOverdue } from '../lib/board.js';
import { BT_DEPARTMENTS, mention } from '../config/crew.js';
import {
  BRAND,
  COLOR,
  DOT,
  MARK,
  baseEmbed,
  clamp,
  eyebrow,
  pack,
  rel,
} from '../lib/ui.js';

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

function blockedLine(card, ref) {
  var bits = [MARK.blocked + ' **' + clamp(titleOf(card), 66) + '**', ownersText(card)];
  var sd = staleDays(card, ref);
  if (sd > 0) bits.push('stuck ' + sd + 'd');
  if (isOverdue(card, ref) && card.due_date) bits.push(DOT.danger + ' due ' + rel(card.due_date));
  return bits.join('  ' + MARK.arrow + '  ');
}

/**
 * The blocked card. Pure, so the preview renderer and the tests can build the
 * real thing without a Discord connection or a database.
 */
export function blockedListEmbed(cards, now) {
  var ref = now || new Date();
  var blocked = (Array.isArray(cards) ? cards : []).filter(function(card) {
    return card && card.blocked === true && !isDone(card);
  });

  if (blocked.length === 0) {
    var clean = baseEmbed({
      color: COLOR.success,
      author: BRAND.name + '  ' + MARK.arrow + '  blocked',
      title: DOT.ok + '  Nothing is blocked',
      description: 'No active card is waiting on anything. Keep it rolling.',
      footer: BRAND.name,
      timestamp: ref,
    });
    return clean;
  }

  // Group by department, keeping an "other" bucket so an unrecognised
  // department can never silently drop a blocked card from the list.
  var groups = {};
  blocked.forEach(function(card) {
    var key = DEPT_LABEL[deptKey(card)] ? deptKey(card) : 'other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(card);
  });

  var orderedKeys = BT_DEPARTMENTS.map(function(d) { return d.id; });
  if (groups.other) orderedKeys.push('other');

  var oldest = blocked.reduce(function(max, c) { return Math.max(max, staleDays(c, ref)); }, 0);

  var embed = baseEmbed({
    color: COLOR.danger,
    author: BRAND.name + '  ' + MARK.arrow + '  blocked',
    title: blocked.length + ' card' + (blocked.length === 1 ? '' : 's') + ' cannot move',
    description: 'A blocked card burns time without anyone noticing. Unblock it, or write down what it is waiting on.'
      + (oldest > 0 ? '\nThe oldest has been sitting for ' + oldest + ' days.' : ''),
    footer: 'Use /card unblock once it is cleared',
    timestamp: ref,
  });

  orderedKeys.forEach(function(key) {
    var list = groups[key];
    if (!list || !list.length) return;
    var label = key === 'other' ? 'Other' : DEPT_LABEL[key];
    embed.addFields({
      name: eyebrow(label, list.length),
      value: pack(list.map(function(card) { return blockedLine(card, ref); })),
    });
  });

  return embed;
}

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  var cards;
  try {
    cards = await fetchCards();
  } catch (e) {
    return interaction.editReply({ content: 'Could not read the board right now. Try again shortly.' });
  }

  await interaction.editReply({ embeds: [blockedListEmbed(cards, new Date())] });
}
