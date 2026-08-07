/**
 * /board - the board as a kanban.
 *
 * Each inline field is a pipeline column, left to right, so Discord lays the
 * board out as columns on its own. Rows carry a status dot rather than a
 * "[blocked]" suffix, and owners render as plain names rather than mention
 * pills: a pill is wide, and in a three-across inline field width is the whole
 * budget. This is a read-only snapshot, so nothing here should ping anyone.
 *
 * An optional department filter relabels every column with that department's
 * vocabulary (via hq.stageLabel) and tints the color strip to match.
 *
 * Copy rule: zero em or en dashes anywhere in user-facing strings.
 */

import { SlashCommandBuilder } from 'discord.js';
import { fetchCards, assigneesOf, isOverdue, staleDays, isDueSoon, isBlocked } from '../lib/board.js';
import { BT_DEPARTMENTS } from '../config/crew.js';
import { stageLabel, deptLabel, resolveDeptId } from '../lib/hq.js';
import {
  BRAND,
  COLOR,
  DOT,
  MARK,
  bar,
  baseEmbed,
  cardDot,
  clamp,
  deptColor,
  eyebrow,
  pack,
} from '../lib/ui.js';

// The pipeline columns, in board order. Archive is intentionally omitted from
// the kanban view (finished and parked work would only add noise).
var PIPELINE_COLUMNS = ['ideas', 'writing', 'production', 'review', 'published'];

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

// First owner only, as a plain short name. A kanban column is roughly a third
// of the embed wide, so a full comma-joined owner list would swamp the title.
function ownerText(card) {
  var owners = assigneesOf(card);
  if (!owners.length) return '';
  var extra = owners.length > 1 ? ' +' + (owners.length - 1) : '';
  return clamp(owners[0], 14) + extra;
}

function cardLine(card, ref) {
  var dot = cardDot({
    blocked: isBlocked(card),
    overdue: isOverdue(card, ref),
    stuck: staleDays(card, ref) > 0,
    dueSoon: isDueSoon(card, ref),
  });
  var owner = ownerText(card);
  return dot + ' ' + clamp(titleOf(card), 42) + (owner ? '\n`' + owner + '`' : '');
}

// Group the relevant cards into column id -> cards, keeping only the pipeline
// columns. An optional deptId filters to one department.
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

var DEPT_CHOICES = BT_DEPARTMENTS.map(function(dept) {
  return { name: dept.label, value: dept.id };
});

export var data = new SlashCommandBuilder()
  .setName('board')
  .setDescription('Show the board as a kanban view')
  .addStringOption(function(option) {
    return option
      .setName('department')
      .setDescription('Filter to one department (defaults to the whole board)')
      .addChoices.apply(option, DEPT_CHOICES);
  });

/**
 * The kanban card. Pure, so the preview renderer and the tests can build the
 * real thing without a Discord connection or a database.
 */
export function boardEmbed(cards, deptId, now) {
  var ref = now || new Date();
  var groups = groupByColumn(cards, deptId);
  var peak = PIPELINE_COLUMNS.reduce(function(m, col) { return Math.max(m, groups[col].length); }, 0);

  var fields = PIPELINE_COLUMNS.map(function(col) {
    var colCards = groups[col];
    return {
      name: eyebrow(labelFor(deptId, col), colCards.length),
      value: pack(colCards.map(function(card) { return cardLine(card, ref); }), { empty: '`' + bar(0, 1, 6) + '`' }),
      inline: true,
    };
  });

  // The funnel as one line, so the shape of the board reads before the detail.
  var flow = PIPELINE_COLUMNS.map(function(col) {
    return '`' + bar(groups[col].length, peak, 4) + '` ' + labelFor(deptId, col) + ' ' + groups[col].length;
  }).join('\n');

  var shown = PIPELINE_COLUMNS.reduce(function(sum, col) { return sum + groups[col].length; }, 0);
  var scope = deptId ? deptLabel(deptId) : 'all departments';

  var embed = baseEmbed({
    color: deptId ? deptColor(deptId) : COLOR.brand,
    author: BRAND.name + '  ' + MARK.arrow + '  board',
    title: deptId ? deptLabel(deptId) + ' pipeline' : 'The whole board',
    description: shown + ' card(s) in the pipeline (' + scope + ').\n' + flow,
    footer: DOT.danger + ' overdue   ' + DOT.warn + ' quiet   ' + DOT.soon + ' due soon   ' + MARK.blocked + ' blocked',
    timestamp: ref,
  });
  embed.addFields(fields);
  return embed;
}

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

  await interaction.editReply({ embeds: [boardEmbed(cards, deptId, new Date())] });
}
