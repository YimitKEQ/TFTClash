import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getPlayer, getStandings, getPlayerByDiscordId } from '../utils/data.js';

var PURPLE = 0x9B72CF;

export var data = new SlashCommandBuilder()
  .setName('compare')
  .setDescription('Head-to-head comparison between two players')
  .addStringOption(function(opt) {
    return opt.setName('player2').setDescription('Player to compare against').setRequired(true);
  })
  .addStringOption(function(opt) {
    return opt.setName('player1').setDescription('First player name (leave empty for yourself)').setRequired(false);
  });

function winIndicator(a, b) {
  if (a > b) return ' **>**';
  if (a < b) return '**<** ';
  return ' **=**';
}

export async function execute(interaction) {
  await interaction.deferReply();

  var name1 = interaction.options.getString('player1');
  var name2 = interaction.options.getString('player2');

  var p1;
  if (name1) {
    p1 = await getPlayer(name1);
  } else {
    p1 = await getPlayerByDiscordId(interaction.user.id);
  }

  var p2 = await getPlayer(name2);

  if (!p1) {
    return interaction.editReply('Could not find ' + (name1 || 'your linked account') + '. Use `/link account` first if comparing yourself.');
  }
  if (!p2) {
    return interaction.editReply('Could not find player "' + name2 + '".');
  }
  if (p1.name === p2.name) {
    return interaction.editReply('You cannot compare a player with themselves!');
  }

  var standings = await getStandings(50);
  var rank1 = standings.findIndex(function(s) { return s.name === p1.name; }) + 1;
  var rank2 = standings.findIndex(function(s) { return s.name === p2.name; }) + 1;

  var games1 = p1.games || 1;
  var games2 = p2.games || 1;
  var wr1 = Math.round((p1.wins / games1) * 100);
  var wr2 = Math.round((p2.wins / games2) * 100);
  var t4r1 = Math.round((p1.top4 / games1) * 100);
  var t4r2 = Math.round((p2.top4 / games2) * 100);
  var ppg1 = games1 > 0 ? (p1.pts / games1).toFixed(1) : '0.0';
  var ppg2 = games2 > 0 ? (p2.pts / games2).toFixed(1) : '0.0';

  // Score who "wins" more categories
  var score1 = 0;
  var score2 = 0;
  if (p1.pts > p2.pts) score1++; else if (p2.pts > p1.pts) score2++;
  if (p1.wins > p2.wins) score1++; else if (p2.wins > p1.wins) score2++;
  if (wr1 > wr2) score1++; else if (wr2 > wr1) score2++;
  if (t4r1 > t4r2) score1++; else if (t4r2 > t4r1) score2++;
  if (parseFloat(ppg1) > parseFloat(ppg2)) score1++; else if (parseFloat(ppg2) > parseFloat(ppg1)) score2++;

  var verdict;
  if (score1 > score2) {
    verdict = '**' + p1.name + '** takes the edge (' + score1 + '-' + score2 + ')';
  } else if (score2 > score1) {
    verdict = '**' + p2.name + '** takes the edge (' + score2 + '-' + score1 + ')';
  } else {
    verdict = 'Dead even! These two are neck and neck.';
  }

  var embed = new EmbedBuilder()
    .setColor(PURPLE)
    .setTitle('versus  ' + p1.name + '  vs  ' + p2.name)
    .setDescription(
      '```\n' +
      padRight(p1.name, 14) + '  STAT         ' + padRight(p2.name, 14) + '\n' +
      padRight('', 14, '-') + '  -----------  ' + padRight('', 14, '-') + '\n' +
      padStat(p1.pts, 14) + '  Points       ' + padStat(p2.pts, 14) + '\n' +
      padStat(p1.wins, 14) + '  Wins         ' + padStat(p2.wins, 14) + '\n' +
      padStat(p1.top4, 14) + '  Top 4s       ' + padStat(p2.top4, 14) + '\n' +
      padStat(wr1 + '%', 14) + '  Win Rate     ' + padStat(wr2 + '%', 14) + '\n' +
      padStat(t4r1 + '%', 14) + '  Top 4 Rate   ' + padStat(t4r2 + '%', 14) + '\n' +
      padStat(ppg1, 14) + '  Pts/Game     ' + padStat(ppg2, 14) + '\n' +
      padStat(p1.games, 14) + '  Games        ' + padStat(p2.games, 14) + '\n' +
      padStat(p1.rank, 14) + '  Rank         ' + padStat(p2.rank, 14) + '\n' +
      padStat(rank1 ? '#' + rank1 : '-', 14) + '  Standing     ' + padStat(rank2 ? '#' + rank2 : '-', 14) + '\n' +
      '```'
    )
    .addFields({ name: 'Verdict', value: verdict })
    .setFooter({ text: 'TFT Clash - Head to Head' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

function padRight(str, len, ch) {
  str = '' + str;
  ch = ch || ' ';
  while (str.length < len) str = str + ch;
  return str;
}

function padStat(val, len) {
  var s = '' + val;
  while (s.length < len) s = s + ' ';
  return s;
}
