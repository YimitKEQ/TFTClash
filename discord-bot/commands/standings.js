import { SlashCommandBuilder } from 'discord.js';
import { standingsEmbed } from '../utils/embeds.js';
import { getStandings } from '../utils/data.js';

export const data = new SlashCommandBuilder()
  .setName('standings')
  .setDescription('Show current TFT Clash season standings');

export async function execute(interaction) {
  await interaction.deferReply();
  const players = await getStandings();
  await interaction.editReply({ embeds: [standingsEmbed(players)] });
}
