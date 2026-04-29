import { SlashCommandBuilder } from 'discord.js';
import { profileEmbed } from '../utils/embeds.js';
import { getPlayer, getStandings, getSeasonConfig, getPlayerByDiscordId } from '../utils/data.js';
import { getLink } from '../utils/db.js';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('View a TFT Clash player profile')
  .addStringOption(function(opt) {
    return opt.setName('player')
      .setDescription('Player name (leave blank to view your own linked profile)')
      .setRequired(false);
  });

export async function execute(interaction) {
  await interaction.deferReply();

  let name = interaction.options.getString('player');

  // Fall back to linked account if no name given
  if (!name) {
    // Try discord_user_id link first
    const byDiscord = await getPlayerByDiscordId(interaction.user.id);
    if (byDiscord) {
      name = byDiscord.name;
    } else {
      const link = await getLink(interaction.user.id);
      if (!link) {
        return interaction.editReply('You have no linked account. Use `/link account <username>` or connect Discord on tftclash.com > Account.');
      }
      name = link.platform_name;
    }
  }

  const player = await getPlayer(name);
  if (!player) {
    return interaction.editReply('Player **' + name + '** not found. Check the spelling or use `/standings` to see all players.');
  }

  const standings = await getStandings(50);
  const season = await getSeasonConfig();
  await interaction.editReply({ embeds: [profileEmbed(player, standings, season)] });
}
