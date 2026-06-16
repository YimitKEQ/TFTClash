/**
 * /board - render the BrosephTech board as a KANBAN view.
 *
 * The embed's inline fields are the pipeline columns in order (ideas, writing,
 * production, review, published; archive is omitted). Each field name is the
 * stage label plus a count, each value is a short bullet list of the card
 * titles in that column with owner and a blocked marker, truncated to fit
 * Discord limits.
 *
 * An optional department option filters the board to a single department and
 * relabels every column with that department's vocabulary (via hq.stageLabel)
 * and tints the embed with that department's color. With no department it shows
 * the whole board with default stage labels.
 *
 * Copy rule: zero em or en dashes anywhere in user-facing strings.
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fetchCards, assigneesOf } from '../lib/board.js';
import { EMBED_COLORS } from '../lib/embeds.js';
import { BT_DEPARTMENTS, mention } from '../config/crew.js';
import { stageLabel, deptLabel, resolveDeptId, DEPT_COLOR } from '../lib/hq.js';

// The pipeline columns, in board order. Archive is intentionally omitted from
// the kanban view (finished/parked work would only add noise).
var PIPELINE_COLUMNS = ['ideas', 'writing', 'production', 'review', 'published'];

// Discord hard limits we must respect.
var MAX_FIELD_VALUE = 1024;
var MUTED_EMPTY = '-';

// Default (no-department) stage labels, mirroring hq.js DEFAULT_STAGES so a
// whole-board view reads with neutral, generic column names.
var DEFAULT_STAGE_LABELS = {
  ideas: 'Backlog',
  writing: 'Planned',
  production: 'In Progress',
  review: 'Review',
  published: 'Done',
};

function columnOf(card) {
  return String((card && card.column_id) || '').toLowerCase();
}

function titleOf(card) {
  return (card && (card.title || card.name)) || 'Untitled card';
}

// The first owner of a card as a short bold display name (no real ping inside an
// embed; a /board view is a read-only snapshot, not a nudge).
function ownerText(card) {
  var owners = assigneesOf(card);
  if (!owners.length) return '';
  return owners.map(function(name) { return mention(name); }).join(', ');
}

// One bullet line for a card: title, owner (when known), blocked marker.
function cardLine(card) {
  var line = '- ' + titleOf(card);
  var owner = ownerText(card);
  if (owner) line += ' (' + owner + ')';
  if (card && card.blocked) line += ' [blocked]';
  return line;
}

// Pack whole lines into a single field value under the Discord cap. Never cuts a
// line mid-way; overflow is summarised as "+N more".
function packColumn(lines) {
  if (!lines.length) return MUTED_EMPTY;
  var kept = [];
  var used = 0;
  var overflow = 0;
  for (var i = 0; i < lines.length; i++) {
    var candidate = lines[i];
    var addLen = candidate.length + (kept.length ? 1 : 0);
    var remaining = lines.length - i;
    // Reserve room for a "+N more" note when more lines may follow.
    var reserve = remaining > 1 ? 16 : 0;
    if (used + addLen > MAX_FIELD_VALUE - reserve) {
      overflow = remaining;
      break;
    }
    kept.push(candidate);
    used += addLen;
  }
  if (overflow > 0) kept.push('+' + overflow + ' more');
  return kept.join('\n') || MUTED_EMPTY;
}

// Group the relevant cards into a map of column id -> array of cards, preserving
// only the pipeline columns. An optional deptId filters to one department.
function groupByColumn(cards, deptId) {
  var groups = {};
  PIPELINE_COLUMNS.forEach(function(col) { groups[col] = []; });
  (cards || []).forEach(function(card) {
    if (!card) return;
    if (deptId && resolveDeptId(card.department) !== deptId) return;
    var col = columnOf(card);
    if (groups[col]) groups[col].push(card);
  });
  return groups;
}

// Stage label for a column: department vocabulary when filtering, otherwise the
// neutral default label.
function labelFor(deptId, col) {
  if (deptId) return stageLabel(deptId, col);
  return DEFAULT_STAGE_LABELS[col] || col;
}

// Build the choices for the optional department option from the canonical list.
var DEPT_CHOICES = BT_DEPARTMENTS.map(function(dept) {
  return { name: dept.label, value: dept.id };
});

function colorForDept(deptId) {
  var hex = DEPT_COLOR[deptId];
  if (!hex) return EMBED_COLORS.brand;
  return parseInt(String(hex).replace('#', ''), 16);
}

export var data = new SlashCommandBuilder()
  .setName('board')
  .setDescription('Show the BrosephTech board as a kanban view')
  .addStringOption(function(option) {
    return option
      .setName('department')
      .setDescription('Filter to one department (defaults to the whole board)')
      .addChoices.apply(option, DEPT_CHOICES);
  });

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  var rawDept = interaction.options.getString('department');
  var deptId = rawDept ? resolveDeptId(rawDept) : null;

  var cards;
  try {
    cards = await fetchCards();
  } catch (e) {
    return interaction.editReply({ content: 'Could not read the board right now. Try again shortly.' });
  }

  var groups = groupByColumn(cards, deptId);

  var fields = PIPELINE_COLUMNS.map(function(col) {
    var colCards = groups[col];
    var lines = colCards.map(function(card) { return cardLine(card); });
    return {
      name: labelFor(deptId, col) + ' (' + colCards.length + ')',
      value: packColumn(lines),
      inline: true,
    };
  });

  var shown = deptId ? cards.filter(function(c) { return resolveDeptId(c && c.department) === deptId; }).length : cards.length;

  var title = deptId ? (deptLabel(deptId) + ' board') : 'BrosephTech board';
  var scope = deptId ? deptLabel(deptId) : 'all departments';

  var embed = new EmbedBuilder()
    .setColor(deptId ? colorForDept(deptId) : EMBED_COLORS.brand)
    .setTitle(title)
    .setDescription(shown + ' card(s) on the board (' + scope + '). Columns left to right are the pipeline.')
    .addFields(fields)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
