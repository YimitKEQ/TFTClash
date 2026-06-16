/**
 * /board - ephemeral summary of board health.
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fetchCards, buildAccountability } from '../lib/board.js';
import { EMBED_COLORS } from '../lib/embeds.js';

export var data = new SlashCommandBuilder()
  .setName('board')
  .setDescription('Show a quick health summary of the BrosephTech content board');

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  var cards;
  try {
    cards = await fetchCards();
  } catch (e) {
    return interaction.editReply({ content: 'Could not read the board right now. Try again shortly.' });
  }

  var accountability = buildAccountability(cards);
  var totals = accountability.totals;

  var deptLines = accountability.departments.map(function(d) {
    return '**' + d.label + '** - ' + d.active + ' active, ' + d.overdue + ' overdue, ' + d.stuck + ' stuck, ' + d.dueSoon + ' due soon';
  });

  var embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.brand)
    .setTitle('Board health')
    .setDescription(
      totals.cards + ' card(s) total. ' +
      totals.active + ' active, ' +
      totals.overdue + ' overdue, ' +
      totals.stuck + ' stuck, ' +
      totals.dueSoon + ' due soon.'
    )
    .addFields({
      name: 'By department',
      value: deptLines.length ? deptLines.join('\n') : 'No departments tracked.',
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
