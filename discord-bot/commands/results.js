import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { resultsEmbed } from '../utils/embeds.js';
import { getClashResults, getTournamentState } from '../utils/data.js';

export const data = new SlashCommandBuilder()
  .setName('post-results')
  .setDescription('Post clash results from the database (Host/Admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addIntegerOption(function(opt) {
    return opt.setName('clash').setDescription('Clash number (defaults to current)').setRequired(false);
  })
  .addIntegerOption(function(opt) {
    return opt.setName('game').setDescription('Game number (defaults to all games combined)').setRequired(false);
  });

export async function execute(interaction) {
  await interaction.deferReply();

  const ts = await getTournamentState();
  const clashNum = interaction.options.getInteger('clash') || (ts && ts.clashNumber) || null;
  const gameNum = interaction.options.getInteger('game') || null;

  if (!clashNum) {
    return interaction.editReply('No clash number provided and no active tournament found.');
  }

  let results = await getClashResults(clashNum);
  if (!results || results.length === 0) {
    return interaction.editReply('No results found for Clash #' + clashNum + '. Make sure results have been published on the platform.');
  }

  // Filter by game number if specified
  if (gameNum) {
    results = results.filter(function(r) { return r.gameNumber === gameNum; });
  }

  // If multiple games, aggregate by total points
  const gameNums = [];
  results.forEach(function(r) {
    if (gameNums.indexOf(r.gameNumber) === -1) gameNums.push(r.gameNumber);
  });

  let placements;
  if (gameNums.length > 1 && !gameNum) {
    // Aggregate: sum PTS across games per player
    const PTS = { 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 };
    const totals = {};
    results.forEach(function(r) {
      if (!totals[r.name]) totals[r.name] = { name: r.name, totalPts: 0 };
      totals[r.name].totalPts += (PTS[r.place] || 0);
    });
    const sorted = Object.values(totals).sort(function(a, b) { return b.totalPts - a.totalPts; });
    placements = sorted.map(function(p, i) { return { name: p.name, place: i + 1 }; });
  } else {
    placements = results.map(function(r) { return { name: r.name, place: r.place }; });
  }

  const embed = resultsEmbed(clashNum, placements);

  // Find the results channel and post there too
  const resultsChannel = interaction.guild.channels.cache.find(function(c) { return c.name === 'results'; });
  if (resultsChannel && resultsChannel.id !== interaction.channelId) {
    await resultsChannel.send({ embeds: [embed] });
    await interaction.editReply('Results for Clash #' + clashNum + ' posted to <#' + resultsChannel.id + '>');
  } else {
    await interaction.editReply({ embeds: [embed] });
  }
}
