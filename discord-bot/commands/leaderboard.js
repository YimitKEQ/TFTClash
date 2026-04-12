import { SlashCommandBuilder } from 'discord.js';
import { leaderboardEmbed } from '../utils/embeds.js';
import { getStandings, getSeasonConfig } from '../utils/data.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Show the full TFT Clash season leaderboard (top 20)');

export async function execute(interaction) {
  await interaction.deferReply();
  const players = await getStandings(20);
  const season = await getSeasonConfig();
  await interaction.editReply({ embeds: [leaderboardEmbed(players, season)] });
}
