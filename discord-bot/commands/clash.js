import { SlashCommandBuilder } from 'discord.js';
import { clashInfoEmbed } from '../utils/embeds.js';
import { getTournamentState, getSeasonConfig, getRegistrations } from '../utils/data.js';

export const data = new SlashCommandBuilder()
  .setName('clash')
  .setDescription('Show info about the next TFT Clash');

export async function execute(interaction) {
  await interaction.deferReply();
  const ts = await getTournamentState();
  const season = await getSeasonConfig();
  const regs = await getRegistrations();
  await interaction.editReply({ embeds: [clashInfoEmbed(ts, season, regs.length)] });
}
