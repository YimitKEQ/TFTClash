import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { resultsEmbed } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('post-results')
  .setDescription('Post clash results (Host/Admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addIntegerOption(opt =>
    opt.setName('clash').setDescription('Clash number').setRequired(true)
  )
  // Accept up to 8 placements as "Name:Place" strings e.g. "Levitate:1"
  .addStringOption(opt =>
    opt.setName('placements')
       .setDescription('Results as comma-separated Name:Place pairs (e.g. Levitate:1,Uri:2,...)')
       .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const clashNum = interaction.options.getInteger('clash');
  const raw = interaction.options.getString('placements');

  let placements;
  try {
    placements = raw.split(',').map(entry => {
      const [name, place] = entry.trim().split(':');
      if (!name || !place || isNaN(Number(place))) throw new Error();
      return { name: name.trim(), place: Number(place.trim()) };
    });
  } catch {
    return interaction.editReply('Bad format. Use `Name:Place` pairs separated by commas, e.g. `Levitate:1,Uri:2,Ole:3`');
  }

  const embed = resultsEmbed(clashNum, placements);

  // Find the results channel and post there too
  const resultsChannel = interaction.guild.channels.cache.find(c => c.name === 'results');
  if (resultsChannel && resultsChannel.id !== interaction.channelId) {
    await resultsChannel.send({ embeds: [embed] });
    await interaction.editReply(`Results posted to <#${resultsChannel.id}>`);
  } else {
    await interaction.editReply({ embeds: [embed] });
  }
}
