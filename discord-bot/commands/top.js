import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getStandings, getSeasonConfig } from '../utils/data.js';

var GOLD = 0xE8A838;

var RANK_ICON = {
  Challenger: '(star)', Grandmaster: '(fire)', Master: '(purple)',
  Diamond: '(gem)', Platinum: '(leaf)', Gold: '(star)', Iron: '(nut)',
};

export var data = new SlashCommandBuilder()
  .setName('top')
  .setDescription('Quick top 3 snapshot');

export async function execute(interaction) {
  var players = await getStandings(3);
  var season = await getSeasonConfig();

  if (players.length === 0) {
    return interaction.reply({ content: 'No standings data yet.', ephemeral: true });
  }

  var medals = ['', '1st', '2nd', '3rd'];
  var lines = players.map(function(p, i) {
    var medal = i === 0 ? '👑' : i === 1 ? '🥈' : '🥉';
    var bar = '`' + '█'.repeat(Math.min(Math.round((p.pts / Math.max(players[0].pts, 1)) * 10), 10)) +
              '░'.repeat(10 - Math.min(Math.round((p.pts / Math.max(players[0].pts, 1)) * 10), 10)) + '`';
    return medal + ' **' + p.name + '** - ' + p.pts + ' pts  ' + bar + '\n   ' + p.wins + 'W / ' + p.top4 + ' Top4 / ' + p.games + ' games';
  });

  var seasonName = (season && season.name) || 'Season 1';

  var embed = new EmbedBuilder()
    .setColor(GOLD)
    .setTitle('Top 3 - ' + seasonName)
    .setDescription(lines.join('\n\n'))
    .setFooter({ text: 'Use /standings for full leaderboard' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
