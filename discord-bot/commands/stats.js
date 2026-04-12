import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getStandings, getSeasonConfig, getPlayerCount } from '../utils/data.js';

var PURPLE = 0x9B72CF;
var GOLD = 0xE8A838;

export var data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('Community stats and fun superlatives for the season');

export async function execute(interaction) {
  await interaction.deferReply();

  var players = await getStandings(50);
  var season = await getSeasonConfig();
  var totalPlayers = await getPlayerCount();

  if (!players.length) {
    return interaction.editReply('No player data available yet.');
  }

  var seasonName = (season && season.name) || 'Season 1';
  var currentClash = (season && season.currentClash) || 0;

  // Calculate superlatives
  var totalPts = 0;
  var totalWins = 0;
  var totalGames = 0;
  var totalTop4 = 0;
  var mostWins = players[0];
  var mostTop4 = players[0];
  var bestWinRate = null;
  var bestPPG = null;
  var ironMan = players[0]; // most games played
  var consistent = null; // highest top4 rate

  players.forEach(function(p) {
    totalPts += p.pts;
    totalWins += p.wins;
    totalGames += p.games;
    totalTop4 += p.top4;

    if (p.wins > mostWins.wins) mostWins = p;
    if (p.top4 > mostTop4.top4) mostTop4 = p;
    if (p.games > ironMan.games) ironMan = p;

    if (p.games >= 3) {
      var wr = p.wins / p.games;
      var t4r = p.top4 / p.games;
      var ppg = p.pts / p.games;

      if (!bestWinRate || wr > bestWinRate.rate) {
        bestWinRate = { name: p.name, rate: wr, pct: Math.round(wr * 100) };
      }
      if (!bestPPG || ppg > bestPPG.ppg) {
        bestPPG = { name: p.name, ppg: ppg };
      }
      if (!consistent || t4r > consistent.rate) {
        consistent = { name: p.name, rate: t4r, pct: Math.round(t4r * 100) };
      }
    }
  });

  var avgPPG = totalGames > 0 ? (totalPts / totalGames).toFixed(1) : '0';

  var superlatives = [];
  superlatives.push('**Most Wins:** ' + mostWins.name + ' (' + mostWins.wins + ' wins)');
  superlatives.push('**Most Top 4s:** ' + mostTop4.name + ' (' + mostTop4.top4 + ')');
  if (bestWinRate) superlatives.push('**Best Win Rate:** ' + bestWinRate.name + ' (' + bestWinRate.pct + '%)');
  if (consistent) superlatives.push('**Most Consistent:** ' + consistent.name + ' (' + consistent.pct + '% top 4 rate)');
  if (bestPPG) superlatives.push('**Highest PPG:** ' + bestPPG.name + ' (' + bestPPG.ppg.toFixed(1) + ' pts/game)');
  superlatives.push('**Iron Man:** ' + ironMan.name + ' (' + ironMan.games + ' games played)');

  var embed = new EmbedBuilder()
    .setColor(GOLD)
    .setTitle('Community Stats - ' + seasonName)
    .setDescription(
      '**Overview**\n' +
      '> Total Players: **' + totalPlayers + '**\n' +
      '> Clashes Played: **' + currentClash + '**\n' +
      '> Total Games: **' + totalGames + '**\n' +
      '> Total Points Awarded: **' + totalPts + '**\n' +
      '> Average Points/Game: **' + avgPPG + '**\n\n' +
      '**Superlatives**\n' +
      superlatives.join('\n')
    )
    .setFooter({ text: 'TFT Clash - Min 3 games for rate stats' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
