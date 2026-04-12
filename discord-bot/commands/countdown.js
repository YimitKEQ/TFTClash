import { SlashCommandBuilder } from 'discord.js';
import { countdownEmbed } from '../utils/embeds.js';
import { getTournamentState, getSeasonConfig } from '../utils/data.js';

export const data = new SlashCommandBuilder()
  .setName('countdown')
  .setDescription('Show the countdown to the next TFT Clash');

export async function execute(interaction) {
  await interaction.deferReply();
  const ts = await getTournamentState();
  const season = await getSeasonConfig();
  await interaction.editReply({ embeds: [countdownEmbed(ts, season)] });
}
