/**
 * /scorecard [member] - ephemeral per-member accountability scorecard.
 *
 * With a member option, scores that crew member. Without one, scores the caller
 * (mapped via BT_CREW_DISCORD), or explains how to pick one when unmapped.
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fetchCards } from '../lib/board.js';
import { BT_CREW, crewNameForDiscordId, matchCrewName } from '../config/crew.js';
import { memberScorecard } from '../lib/scoring.js';
import { EMBED_COLORS } from '../lib/embeds.js';

var CREW_CHOICES = BT_CREW.map(function(m) { return { name: m.name, value: m.name }; });

export var data = new SlashCommandBuilder()
  .setName('scorecard')
  .setDescription('Show a crew member\'s accountability scorecard')
  .addStringOption(function(opt) {
    opt
      .setName('member')
      .setDescription('Crew member to score (defaults to you)')
      .setRequired(false);
    return opt.addChoices.apply(opt, CREW_CHOICES);
  });

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  var requested = interaction.options.getString('member');
  var name = requested ? matchCrewName(requested) : crewNameForDiscordId(interaction.user.id);

  if (!name) {
    if (requested) {
      return interaction.editReply({ content: 'I do not recognise "' + requested + '" as a crew member. Pick one from the list.' });
    }
    return interaction.editReply({
      content:
        'I do not have you mapped to a board name yet, so I cannot guess whose scorecard to show.\n' +
        'Pass the `member` option, or ask whoever runs the bot to add you to BT_CREW_DISCORD as ' +
        '`"YourBoardName": "' + interaction.user.id + '"` and redeploy.',
    });
  }

  var cards;
  try {
    cards = await fetchCards();
  } catch (e) {
    return interaction.editReply({ content: 'Could not read the board right now. Try again shortly.' });
  }

  var card = memberScorecard(cards, name);

  var embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.brand)
    .setTitle('Scorecard: ' + name)
    .addFields(
      { name: 'Shipped this week', value: String(card.shippedThisWeek), inline: true },
      { name: 'Active', value: String(card.active), inline: true },
      { name: 'Due soon', value: String(card.dueSoon), inline: true },
      { name: 'Overdue', value: String(card.overdue), inline: true },
      { name: 'Stuck', value: String(card.stuck), inline: true },
      { name: 'Blocked', value: String(card.blocked), inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
