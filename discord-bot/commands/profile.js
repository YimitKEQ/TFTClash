import { SlashCommandBuilder } from 'discord.js';
import { profileEmbed } from '../utils/embeds.js';
import { getPlayer } from '../utils/data.js';
import { getLink } from '../utils/db.js';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('View a TFT Clash player profile')
  .addStringOption(opt =>
    opt.setName('player')
       .setDescription('Player name (leave blank to view your own linked profile)')
       .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();

  let name = interaction.options.getString('player');

  // Fall back to linked account if no name given
  if (!name) {
    const link = await getLink(interaction.user.id);
    if (!link) {
      return interaction.editReply('You have no linked account. Use `/link account <username>` or connect Discord on tft-clash.vercel.app → Account.');
    }
    name = link.platform_name;
  }

  const player = await getPlayer(name);
  if (!player) {
    return interaction.editReply(`Player **${name}** not found. Check the spelling or use \`/standings\` to see all players.`);
  }

  await interaction.editReply({ embeds: [profileEmbed(player)] });
}
