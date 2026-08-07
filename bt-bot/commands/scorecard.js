/**
 * /scorecard [member] - one crew member's accountability standing.
 *
 * Leads with a standing and a plain-language verdict rather than six bare
 * counters, so the card is usable as a nudge instead of as a stat dump. With a
 * member option it scores that person; without one it scores the caller
 * (mapped via BT_CREW_DISCORD).
 *
 * Copy rule: zero em or en dashes anywhere in user-facing strings.
 */

import { SlashCommandBuilder } from 'discord.js';
import { fetchCards } from '../lib/board.js';
import { BT_CREW, crewNameForDiscordId, matchCrewName } from '../config/crew.js';
import { memberScorecard, accountabilityStanding } from '../lib/scoring.js';
import {
  BRAND,
  DOT,
  MARK,
  bar,
  baseEmbed,
  eyebrow,
} from '../lib/ui.js';

var CREW_CHOICES = BT_CREW.map(function(m) { return { name: m.name, value: m.name }; });

var ROLE_BY_NAME = {};
BT_CREW.forEach(function(m) { ROLE_BY_NAME[m.name] = m.role; });

export var data = new SlashCommandBuilder()
  .setName('scorecard')
  .setDescription('Show a crew member\'s accountability standing')
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
        '`"YourBoardName": "' + interaction.user.id + '"` and restart.',
    });
  }

  var cards;
  try {
    cards = await fetchCards();
  } catch (e) {
    return interaction.editReply({ content: 'Could not read the board right now. Try again shortly.' });
  }

  await interaction.editReply({ embeds: [scorecardEmbed(name, cards, new Date())] });
}

/**
 * The standing card. Pure, so the preview renderer and the tests can build the
 * real thing without a Discord connection or a database.
 */
export function scorecardEmbed(name, cards, now) {
  var card = memberScorecard(cards, name, now);
  var standing = accountabilityStanding(card);
  var role = ROLE_BY_NAME[name];

  var embed = baseEmbed({
    color: standing.color,
    author: BRAND.name + '  ' + MARK.arrow + '  standing' + (role ? '  ' + MARK.arrow + '  ' + role : ''),
    title: name + '  ' + MARK.arrow + '  ' + standing.band,
    description: '`' + bar(standing.score, 100, 16) + '`  ' + standing.score + '/100\n' + standing.verdict,
    footer: 'Shipped counts the last 7 days  ' + MARK.arrow + '  /mytasks for the actual cards',
  });

  embed.addFields(
    { name: eyebrow('Shipped 7d'), value: (card.shippedThisWeek ? MARK.shipped + ' ' : '') + card.shippedThisWeek, inline: true },
    { name: eyebrow('Active'), value: String(card.active), inline: true },
    { name: eyebrow('Due soon'), value: (card.dueSoon ? DOT.soon + ' ' : '') + card.dueSoon, inline: true },
    { name: eyebrow('Overdue'), value: (card.overdue ? DOT.danger + ' ' : '') + card.overdue, inline: true },
    { name: eyebrow('Gone quiet'), value: (card.stuck ? DOT.warn + ' ' : '') + card.stuck, inline: true },
    { name: eyebrow('Blocked'), value: (card.blocked ? MARK.blocked + ' ' : '') + card.blocked, inline: true }
  );

  return embed;
}
