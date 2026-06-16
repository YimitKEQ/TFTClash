/**
 * /mytasks - private view of the caller's own active / overdue / stuck cards.
 *
 * Maps the caller's Discord id back to a crew name via BT_CREW_DISCORD. If the
 * caller is not mapped, it explains how to get added rather than guessing.
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fetchCards, buildAccountability, staleDays } from '../lib/board.js';
import { crewNameForDiscordId } from '../config/crew.js';
import { EMBED_COLORS } from '../lib/embeds.js';

export var data = new SlashCommandBuilder()
  .setName('mytasks')
  .setDescription('Privately show your own active, overdue, and stuck cards');

function titleOf(card) {
  return (card && (card.title || card.name)) || 'Untitled card';
}

function listOrNone(cards, withStale) {
  if (!cards || cards.length === 0) return '_none_';
  return cards.slice(0, 15).map(function(c) {
    if (withStale) {
      var sd = staleDays(c);
      return '- ' + titleOf(c) + (sd > 0 ? ' (' + sd + 'd)' : '');
    }
    return '- ' + titleOf(c);
  }).join('\n');
}

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  var name = crewNameForDiscordId(interaction.user.id);
  if (!name) {
    return interaction.editReply({
      content:
        'I do not have you mapped to a board name yet, so I cannot look up your cards.\n' +
        'Ask whoever runs the bot to add you to BT_CREW_DISCORD as ' +
        '`"YourBoardName": "' + interaction.user.id + '"` and redeploy.',
    });
  }

  var cards;
  try {
    cards = await fetchCards();
  } catch (e) {
    return interaction.editReply({ content: 'Could not read the board right now. Try again shortly.' });
  }

  var accountability = buildAccountability(cards);
  var buckets = accountability.members[name] || { overdue: [], stuck: [], dueSoon: [], active: [] };

  var embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.brand)
    .setTitle('Your tasks, ' + name)
    .addFields(
      { name: 'Overdue (' + buckets.overdue.length + ')', value: listOrNone(buckets.overdue, false) },
      { name: 'Stuck (' + buckets.stuck.length + ')', value: listOrNone(buckets.stuck, true) },
      { name: 'Due soon (' + buckets.dueSoon.length + ')', value: listOrNone(buckets.dueSoon, false) },
      { name: 'All active (' + buckets.active.length + ')', value: listOrNone(buckets.active, false) }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
