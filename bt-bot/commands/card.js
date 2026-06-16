/**
 * /card add - create a board card straight from Discord using slash options.
 *
 * No modal: title, department, assignee, priority, and due date are all picked
 * inline. The card lands in the Ideas/Backlog column with a content_type
 * defaulted per department. Inserts via the service-role Supabase client.
 *
 * Copy rule: zero em or en dashes anywhere in user-facing strings.
 */

import { SlashCommandBuilder } from 'discord.js';
import { supabase } from '../lib/supabase.js';
import { BT_CREW, BT_DEPARTMENTS } from '../config/crew.js';

var DEPT_CHOICES = BT_DEPARTMENTS.map(function(d) { return { name: d.label, value: d.id }; });
var DEPT_LABEL = {};
BT_DEPARTMENTS.forEach(function(d) { DEPT_LABEL[d.id] = d.label; });

var CREW_CHOICES = BT_CREW.slice(0, 25).map(function(m) { return { name: m.name, value: m.name }; });

var PRIORITY_CHOICES = [
  { name: 'High', value: 'high' },
  { name: 'Medium', value: 'medium' },
  { name: 'Low', value: 'low' },
];

// Default work-type per department (mirrors the board's first option each).
var DEFAULT_TYPE = {
  content: 'short',
  engineering: 'feature',
  design: 'ui',
  marketing: 'campaign',
  ops: 'admin',
};

// Accept only a strict YYYY-MM-DD shape that is also a real calendar date.
// Returns the normalized string, or null when the input is empty or invalid.
function validateDate(value) {
  if (!value) return null;
  var raw = String(value).trim();
  if (!raw) return null;
  var match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  var year = Number(match[1]);
  var month = Number(match[2]);
  var day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  // Round-trip through Date to reject impossible dates like 2026-02-31.
  var d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return match[1] + '-' + match[2] + '-' + match[3];
}

export var data = new SlashCommandBuilder()
  .setName('card')
  .setDescription('Manage the BrosephTech content board')
  .addSubcommand(function(sub) {
    return sub
      .setName('add')
      .setDescription('Create a new board card in the Ideas column')
      .addStringOption(function(opt) {
        return opt
          .setName('title')
          .setDescription('What the card is about')
          .setRequired(true)
          .setMaxLength(140);
      })
      .addStringOption(function(opt) {
        return opt
          .setName('department')
          .setDescription('Which department owns this work')
          .setRequired(true)
          .addChoices.apply(opt, DEPT_CHOICES);
      })
      .addStringOption(function(opt) {
        return opt
          .setName('assignee')
          .setDescription('Who owns the card (optional)')
          .addChoices.apply(opt, CREW_CHOICES);
      })
      .addStringOption(function(opt) {
        return opt
          .setName('priority')
          .setDescription('Priority (default medium)')
          .addChoices.apply(opt, PRIORITY_CHOICES);
      })
      .addStringOption(function(opt) {
        return opt
          .setName('due')
          .setDescription('Due date as YYYY-MM-DD (optional)')
          .setMaxLength(10);
      });
  });

export async function execute(interaction) {
  var sub = interaction.options.getSubcommand();
  if (sub !== 'add') {
    return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  var title = String(interaction.options.getString('title') || '').trim().slice(0, 140);
  if (!title) {
    return interaction.editReply({ content: 'Give the card a title.' });
  }

  var department = interaction.options.getString('department');
  if (!DEPT_LABEL[department]) {
    return interaction.editReply({ content: 'Pick a known department.' });
  }

  var assignee = interaction.options.getString('assignee') || '';
  var priority = interaction.options.getString('priority') || 'medium';
  if (priority !== 'high' && priority !== 'medium' && priority !== 'low') {
    priority = 'medium';
  }

  var dueRaw = interaction.options.getString('due');
  var dueDate = validateDate(dueRaw);
  if (dueRaw && dueRaw.trim() && !dueDate) {
    return interaction.editReply({
      content: 'That due date did not look right. Use the format YYYY-MM-DD, for example 2026-06-30.',
    });
  }

  var row = {
    title: title,
    description: '',
    column_id: 'ideas',
    department: department,
    content_type: DEFAULT_TYPE[department] || 'short',
    assignee: assignee,
    assignees: assignee ? [assignee] : [],
    priority: priority,
    due_date: dueDate,
    links: [],
    blocked: false,
  };

  var res;
  try {
    res = await supabase.from('bt_content_cards').insert(row).select('id, title, department').single();
  } catch (e) {
    console.error('[card] insert threw: ' + ((e && e.message) || e));
    return interaction.editReply({ content: 'Could not save the card right now. Try again shortly.' });
  }
  if (res.error || !res.data) {
    console.error('[card] insert failed: ' + ((res.error && res.error.message) || 'unknown error'));
    return interaction.editReply({ content: 'Could not save the card right now. Try again shortly.' });
  }

  var lines = [];
  lines.push('Card created in **' + DEPT_LABEL[department] + '** (Ideas).');
  lines.push('**' + res.data.title + '**');
  lines.push('Priority: ' + priority + (assignee ? ', owner: ' + assignee : ', unassigned'));
  if (dueDate) lines.push('Due: ' + dueDate);

  await interaction.editReply({ content: lines.join('\n') });
}
