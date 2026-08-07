/**
 * /mytasks - a private, personal to-do card.
 *
 * Leads with the single next thing to do rather than with four equal-weight
 * buckets, because a personal list is only useful if it answers "what now".
 * Maps the caller's Discord id back to a crew name via BT_CREW_DISCORD, and
 * explains how to get added rather than guessing when they are unmapped.
 *
 * Copy rule: zero em or en dashes anywhere in user-facing strings.
 */

import { SlashCommandBuilder } from 'discord.js';
import { fetchCards, buildAccountability, staleDays, isOverdue, isBlocked } from '../lib/board.js';
import { crewNameForDiscordId } from '../config/crew.js';
import { deptLabel } from '../lib/hq.js';
import {
  BRAND,
  COLOR,
  DOT,
  MARK,
  baseEmbed,
  cardDot,
  clamp,
  eyebrow,
  health,
  pack,
  rel,
} from '../lib/ui.js';

export var data = new SlashCommandBuilder()
  .setName('mytasks')
  .setDescription('Privately show your own active, overdue, and stuck cards');

function titleOf(card) {
  return (card && (card.title || card.name)) || 'Untitled card';
}

// One row: status dot, title, department, and why it is here.
function line(card, ref, reason) {
  var dot = cardDot({
    blocked: isBlocked(card),
    overdue: isOverdue(card, ref),
    stuck: staleDays(card, ref) > 0,
    dueSoon: false,
  });
  var bits = [dot + ' **' + clamp(titleOf(card), 70) + '**', deptLabel(card && card.department)];
  if (reason) bits.push(reason);
  return bits.join('  ' + MARK.arrow + '  ');
}

// The one card to pick up first: blocked, then most overdue, then stalest.
function nextUp(buckets, ref) {
  var pool = (buckets.blocked || []).concat(buckets.overdue || [], buckets.stuck || [], buckets.dueSoon || []);
  if (!pool.length) return null;
  var best = pool[0];
  var bestScore = -1;
  pool.forEach(function(c) {
    var score = 0;
    if (isBlocked(c)) score += 1000;
    if (isOverdue(c, ref)) score += 500;
    score += staleDays(c, ref);
    if (score > bestScore) { bestScore = score; best = c; }
  });
  return best;
}

/**
 * The personal card. Pure, so the preview renderer and the tests can build the
 * real thing without a Discord connection or a database.
 */
export function myTasksEmbed(name, cards, now) {
  var ref = now || new Date();
  var accountability = buildAccountability(cards, ref);
  var buckets = accountability.members[name] || { overdue: [], stuck: [], dueSoon: [], active: [], blocked: [] };

  var mine = {
    active: buckets.active.length,
    overdue: buckets.overdue.length,
    stuck: buckets.stuck.length,
    dueSoon: buckets.dueSoon.length,
    blocked: buckets.blocked.length,
  };
  var h = health(mine);
  var first = nextUp(buckets, ref);

  var embed = baseEmbed({
    color: h.color,
    author: BRAND.name + '  ' + MARK.arrow + '  your board',
    title: name + ', ' + (mine.active === 0 ? 'you have nothing active' : h.verdict.toLowerCase()),
    description: first
      ? '**Start here**\n' + line(first, ref, first.due_date ? 'due ' + rel(first.due_date) : '')
      : DOT.ok + ' Nothing needs you right now. ' + mine.active + ' active card(s) all moving.',
    footer: 'Only you can see this  ' + MARK.arrow + '  /card done to close one out',
    timestamp: ref,
  });

  if (buckets.blocked.length) {
    embed.addFields({
      name: eyebrow('Blocked', buckets.blocked.length),
      value: pack(buckets.blocked.map(function(c) { return line(c, ref, 'needs unblocking'); })),
    });
  }
  if (buckets.overdue.length) {
    embed.addFields({
      name: eyebrow('Overdue', buckets.overdue.length),
      value: pack(buckets.overdue.map(function(c) { return line(c, ref, c.due_date ? 'due ' + rel(c.due_date) : 'past due'); })),
    });
  }
  if (buckets.stuck.length) {
    embed.addFields({
      name: eyebrow('Gone quiet', buckets.stuck.length),
      value: pack(buckets.stuck.map(function(c) { return line(c, ref, 'untouched ' + staleDays(c, ref) + 'd'); })),
    });
  }
  if (buckets.dueSoon.length) {
    embed.addFields({
      name: eyebrow('Due soon', buckets.dueSoon.length),
      value: pack(buckets.dueSoon.map(function(c) { return line(c, ref, c.due_date ? 'due ' + rel(c.due_date) : 'soon'); })),
    });
  }

  // The full active list only when it adds something the buckets above did not.
  var flagged = {};
  buckets.blocked.concat(buckets.overdue, buckets.stuck, buckets.dueSoon).forEach(function(c) {
    flagged[String(c.id || titleOf(c))] = true;
  });
  var restOfActive = buckets.active.filter(function(c) { return !flagged[String(c.id || titleOf(c))]; });
  if (restOfActive.length) {
    embed.addFields({
      name: eyebrow('Also on your plate', restOfActive.length),
      value: pack(restOfActive.map(function(c) { return line(c, ref, c.due_date ? 'due ' + rel(c.due_date) : ''); })),
    });
  }

  if (!buckets.active.length) {
    embed.addFields({ name: eyebrow('Active'), value: 'Nothing assigned to you. Grab something from `/board`.' });
  }

  embed.setColor(mine.active === 0 ? COLOR.neutral : h.color);
  return embed;
}

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  var name = crewNameForDiscordId(interaction.user.id);
  if (!name) {
    return interaction.editReply({
      content:
        'I do not have you mapped to a board name yet, so I cannot look up your cards.\n' +
        'Ask whoever runs the bot to add you to BT_CREW_DISCORD as ' +
        '`"YourBoardName": "' + interaction.user.id + '"` and restart.',
    });
  }

  var cards;
  try {
    cards = await fetchCards();
  } catch (e) {
    return interaction.editReply({ content: 'Could not read the board right now. Try again shortly.' });
  }

  await interaction.editReply({ embeds: [myTasksEmbed(name, cards, new Date())] });
}
