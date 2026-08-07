/**
 * /card - create and drive a board card without leaving Discord.
 *
 *   /card add       create a card in the Ideas column
 *   /card done      move a card to Published
 *   /card move      move a card to any column
 *   /card block     flag a card as blocked, with a reason
 *   /card unblock   clear the flag
 *   /card assign    hand a card to someone
 *
 * Every subcommand that acts on an existing card takes a `card` option backed
 * by autocomplete, so nobody has to paste a uuid. The autocomplete is filtered
 * per subcommand: /card done only offers open cards, /card unblock only offers
 * blocked ones.
 *
 * Copy rule: zero em or en dashes anywhere in user-facing strings.
 */

import { SlashCommandBuilder } from 'discord.js';
import { supabase } from '../lib/supabase.js';
import { BT_CREW, BT_DEPARTMENTS } from '../config/crew.js';
import { deptLabel, stageLabel } from '../lib/hq.js';
import {
  COLUMNS,
  addComment,
  assigneePatch,
  getCard,
  invalidateCards,
  isKnownColumn,
  searchCards,
  updateCard,
} from '../lib/cards.js';
import {
  BRAND,
  COLOR,
  DOT,
  MARK,
  baseEmbed,
  clamp,
  deptColor,
  eyebrow,
  rel,
  shortDue,
} from '../lib/ui.js';

var DEPT_CHOICES = BT_DEPARTMENTS.map(function(d) { return { name: d.label, value: d.id }; });
var DEPT_LABEL = {};
BT_DEPARTMENTS.forEach(function(d) { DEPT_LABEL[d.id] = d.label; });

var CREW_CHOICES = BT_CREW.slice(0, 25).map(function(m) { return { name: m.name, value: m.name }; });

var PRIORITY_CHOICES = [
  { name: 'High', value: 'high' },
  { name: 'Medium', value: 'medium' },
  { name: 'Low', value: 'low' },
];

var COLUMN_CHOICES = COLUMNS.map(function(c) { return { name: c.label, value: c.id }; });

// Default work-type per department (mirrors the board's first option each).
var DEFAULT_TYPE = {
  content: 'short',
  engineering: 'feature',
  design: 'ui',
  marketing: 'campaign',
  ops: 'admin',
};

// Which cards each subcommand should offer in autocomplete.
var AUTOCOMPLETE_FILTER = {
  done: 'open',
  move: 'any',
  block: 'open',
  unblock: 'blocked',
  assign: 'open',
};

/**
 * Accept only a strict YYYY-MM-DD shape that is also a real calendar date.
 * Returns the normalized string, or null when the input is empty or invalid.
 */
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

function cardOption(opt) {
  return opt
    .setName('card')
    .setDescription('Start typing the card title')
    .setRequired(true)
    .setAutocomplete(true);
}

export var data = new SlashCommandBuilder()
  .setName('card')
  .setDescription('Create and drive cards on the board')
  .addSubcommand(function(sub) {
    return sub
      .setName('add')
      .setDescription('Create a new board card in the Ideas column')
      .addStringOption(function(opt) {
        return opt.setName('title').setDescription('What the card is about').setRequired(true).setMaxLength(140);
      })
      .addStringOption(function(opt) {
        return opt.setName('department').setDescription('Which department owns this work').setRequired(true)
          .addChoices.apply(opt, DEPT_CHOICES);
      })
      .addStringOption(function(opt) {
        return opt.setName('assignee').setDescription('Who owns the card (optional)').addChoices.apply(opt, CREW_CHOICES);
      })
      .addStringOption(function(opt) {
        return opt.setName('priority').setDescription('Priority (default medium)').addChoices.apply(opt, PRIORITY_CHOICES);
      })
      .addStringOption(function(opt) {
        return opt.setName('due').setDescription('Due date as YYYY-MM-DD (optional)').setMaxLength(10);
      });
  })
  .addSubcommand(function(sub) {
    return sub.setName('done').setDescription('Mark a card as published')
      .addStringOption(cardOption);
  })
  .addSubcommand(function(sub) {
    return sub.setName('move').setDescription('Move a card to another column')
      .addStringOption(cardOption)
      .addStringOption(function(opt) {
        return opt.setName('column').setDescription('Where it goes').setRequired(true).addChoices.apply(opt, COLUMN_CHOICES);
      });
  })
  .addSubcommand(function(sub) {
    return sub.setName('block').setDescription('Flag a card as blocked')
      .addStringOption(cardOption)
      .addStringOption(function(opt) {
        return opt.setName('reason').setDescription('What is it waiting on').setMaxLength(280);
      });
  })
  .addSubcommand(function(sub) {
    return sub.setName('unblock').setDescription('Clear the blocked flag on a card')
      .addStringOption(cardOption)
      .addStringOption(function(opt) {
        return opt.setName('note').setDescription('How it got unblocked (optional)').setMaxLength(280);
      });
  })
  .addSubcommand(function(sub) {
    return sub.setName('assign').setDescription('Hand a card to someone')
      .addStringOption(cardOption)
      .addStringOption(function(opt) {
        return opt.setName('member').setDescription('Who owns it now (leave empty to unassign)').addChoices.apply(opt, CREW_CHOICES);
      });
  });

// ---- autocomplete ------------------------------------------------------------

export async function autocomplete(interaction) {
  var sub = interaction.options.getSubcommand(false);
  var focused = interaction.options.getFocused(true);
  if (!focused || focused.name !== 'card') {
    return interaction.respond([]).catch(function() {});
  }

  var cards = await searchCards(focused.value, AUTOCOMPLETE_FILTER[sub] || 'any', 25);
  var choices = cards.map(function(c) {
    // Autocomplete option names are plain text: Discord renders no markup and
    // caps them at 100 characters, so state goes in words, not glyphs.
    var flags = [];
    if (c.blocked) flags.push('blocked');
    if (c.due_date) flags.push(shortDue(c.due_date));
    var suffix = ' [' + deptLabel(c.department) + (flags.length ? ', ' + flags.join(', ') : '') + ']';
    return {
      name: clamp(String(c.title || 'Untitled'), 100 - suffix.length) + suffix,
      value: String(c.id),
    };
  });
  await interaction.respond(choices).catch(function() {});
}

// ---- shared reply shell ------------------------------------------------------

function cardEmbed(opts) {
  var card = opts.card;
  var embed = baseEmbed({
    color: opts.color != null ? opts.color : deptColor(card.department),
    author: BRAND.name + '  ' + MARK.arrow + '  ' + opts.action,
    title: clamp(card.title || 'Untitled card', 240),
    description: opts.description || '',
    footer: opts.footer || (deptLabel(card.department) + '  ' + MARK.arrow + '  ' + stageLabel(card.department, card.column_id)),
  });
  var owner = card.assignee || (Array.isArray(card.assignees) && card.assignees[0]) || '';
  embed.addFields(
    { name: eyebrow('Stage'), value: stageLabel(card.department, card.column_id), inline: true },
    { name: eyebrow('Owner'), value: owner || '*unassigned*', inline: true },
    { name: eyebrow('Due'), value: card.due_date ? rel(card.due_date) : 'no date', inline: true }
  );
  return embed;
}

// Load the target card and reject a stale or bogus id with a readable message
// instead of a raw database error.
async function loadTarget(interaction) {
  var id = interaction.options.getString('card');
  var card;
  try {
    card = await getCard(id);
  } catch (e) {
    await interaction.editReply({ content: (e && e.message) || 'Could not read that card.' });
    return null;
  }
  if (!card) {
    await interaction.editReply({ content: 'I could not find that card. It may have been deleted. Start typing again and pick from the list.' });
    return null;
  }
  return card;
}

function actorOf(interaction) {
  return interaction.user ? (interaction.user.globalName || interaction.user.username || interaction.user.tag) : 'someone';
}

// ---- subcommands -------------------------------------------------------------

export async function execute(interaction) {
  var sub = interaction.options.getSubcommand();
  if (sub === 'add') return addCmd(interaction);

  await interaction.deferReply({ ephemeral: true });
  if (sub === 'done') return doneCmd(interaction);
  if (sub === 'move') return moveCmd(interaction);
  if (sub === 'block') return blockCmd(interaction);
  if (sub === 'unblock') return unblockCmd(interaction);
  if (sub === 'assign') return assignCmd(interaction);
  return interaction.editReply({ content: 'Unknown subcommand.' });
}

async function addCmd(interaction) {
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
      content: 'That due date did not look right. Use the format YYYY-MM-DD, for example 2026-08-30.',
    });
  }

  var row = Object.assign({
    title: title,
    description: '',
    column_id: 'ideas',
    department: department,
    content_type: DEFAULT_TYPE[department] || 'short',
    priority: priority,
    due_date: dueDate,
    links: [],
    blocked: false,
  }, assigneePatch(assignee));

  var res;
  try {
    res = await supabase.from('bt_content_cards').insert(row).select('*').single();
  } catch (e) {
    console.error('[card] insert threw: ' + ((e && e.message) || e));
    return interaction.editReply({ content: 'Could not save the card right now. Try again shortly.' });
  }
  if (res.error || !res.data) {
    console.error('[card] insert failed: ' + ((res.error && res.error.message) || 'unknown error'));
    return interaction.editReply({ content: 'Could not save the card right now. Try again shortly.' });
  }
  invalidateCards();

  var embed = cardEmbed({
    card: res.data,
    action: 'card created',
    description: 'Added to ' + deptLabel(department) + ' in Ideas. It is already live on the board and in the feed.',
  });
  embed.addFields({ name: eyebrow('Priority'), value: priority, inline: true });

  await interaction.editReply({ embeds: [embed] });
}

async function doneCmd(interaction) {
  var card = await loadTarget(interaction);
  if (!card) return;

  if (String(card.column_id).toLowerCase() === 'published') {
    return interaction.editReply({ embeds: [cardEmbed({
      card: card,
      action: 'already done',
      color: COLOR.neutral,
      description: 'This card is already published. Nothing changed.',
    })] });
  }

  var updated;
  try {
    updated = await updateCard(card.id, { column_id: 'published', blocked: false }, card);
  } catch (e) {
    return interaction.editReply({ content: (e && e.message) || 'Could not update that card.' });
  }

  await interaction.editReply({ embeds: [cardEmbed({
    card: updated,
    action: 'shipped',
    color: COLOR.success,
    description: MARK.shipped + ' Moved to Published. The win is already posted in the wins channel.',
  })] });
}

async function moveCmd(interaction) {
  var column = String(interaction.options.getString('column') || '').toLowerCase();
  if (!isKnownColumn(column)) {
    return interaction.editReply({ content: 'That is not a column on this board.' });
  }
  var card = await loadTarget(interaction);
  if (!card) return;

  if (String(card.column_id).toLowerCase() === column) {
    return interaction.editReply({ embeds: [cardEmbed({
      card: card,
      action: 'no change',
      color: COLOR.neutral,
      description: 'The card is already in ' + stageLabel(card.department, column) + '.',
    })] });
  }

  var from = stageLabel(card.department, card.column_id);
  var updated;
  try {
    updated = await updateCard(card.id, { column_id: column }, card);
  } catch (e) {
    return interaction.editReply({ content: (e && e.message) || 'Could not update that card.' });
  }

  await interaction.editReply({ embeds: [cardEmbed({
    card: updated,
    action: 'moved',
    description: from + '  ' + MARK.arrow + '  **' + stageLabel(updated.department, column) + '**\nThe staleness clock restarts from now.',
  })] });
}

async function blockCmd(interaction) {
  var card = await loadTarget(interaction);
  if (!card) return;
  var reason = String(interaction.options.getString('reason') || '').trim();

  var updated;
  try {
    updated = await updateCard(card.id, { blocked: true }, card);
  } catch (e) {
    return interaction.editReply({ content: (e && e.message) || 'Could not update that card.' });
  }

  if (reason) {
    await addComment(card.id, actorOf(interaction), 'Blocked: ' + reason);
  }

  await interaction.editReply({ embeds: [cardEmbed({
    card: updated,
    action: 'blocked',
    color: COLOR.danger,
    description: MARK.blocked + ' Flagged as blocked.'
      + (reason ? '\n**Waiting on:** ' + clamp(reason, 280) : '\nNo reason given. Add one with `/card block reason:` so the daily sweep is useful.'),
    footer: 'The owner gets pinged in the blocked channel',
  })] });
}

async function unblockCmd(interaction) {
  var card = await loadTarget(interaction);
  if (!card) return;

  if (!card.blocked) {
    return interaction.editReply({ embeds: [cardEmbed({
      card: card,
      action: 'not blocked',
      color: COLOR.neutral,
      description: 'This card was not blocked. Nothing changed.',
    })] });
  }

  var note = String(interaction.options.getString('note') || '').trim();
  var updated;
  try {
    updated = await updateCard(card.id, { blocked: false }, card);
  } catch (e) {
    return interaction.editReply({ content: (e && e.message) || 'Could not update that card.' });
  }

  if (note) {
    await addComment(card.id, actorOf(interaction), 'Unblocked: ' + note);
  }

  await interaction.editReply({ embeds: [cardEmbed({
    card: updated,
    action: 'unblocked',
    color: COLOR.success,
    description: DOT.ok + ' Clear to move again.' + (note ? '\n' + clamp(note, 280) : ''),
  })] });
}

async function assignCmd(interaction) {
  var card = await loadTarget(interaction);
  if (!card) return;

  var member = interaction.options.getString('member') || '';
  var previous = card.assignee || (Array.isArray(card.assignees) && card.assignees[0]) || '';

  var updated;
  try {
    updated = await updateCard(card.id, assigneePatch(member), card);
  } catch (e) {
    return interaction.editReply({ content: (e && e.message) || 'Could not update that card.' });
  }

  var description = member
    ? (previous ? previous + '  ' + MARK.arrow + '  **' + member + '**' : 'Now owned by **' + member + '**')
    : 'Unassigned. Nobody owns this card, so nobody will be nudged about it.';

  await interaction.editReply({ embeds: [cardEmbed({
    card: updated,
    action: member ? 'reassigned' : 'unassigned',
    color: member ? undefined : COLOR.warn,
    description: description,
  })] });
}
