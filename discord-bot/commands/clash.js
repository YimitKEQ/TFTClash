import { SlashCommandBuilder } from 'discord.js';
import { clashInfoEmbed } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('clash')
  .setDescription('Show info about the next TFT Clash');

export async function execute(interaction) {
  await interaction.reply({ embeds: [clashInfoEmbed()] });
}
