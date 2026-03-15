import { SlashCommandBuilder } from 'discord.js';
import { linkAccount, getLink, unlinkAccount } from '../utils/db.js';
import { getPlayer } from '../utils/data.js';

export const data = new SlashCommandBuilder()
  .setName('link')
  .setDescription('Link your Discord account to your TFT Clash profile')
  .addSubcommand(sub =>
    sub.setName('account')
       .setDescription('Link to a TFT Clash username')
       .addStringOption(opt =>
         opt.setName('username')
            .setDescription('Your TFT Clash username (e.g. Levitate)')
            .setRequired(true)
       )
  )
  .addSubcommand(sub =>
    sub.setName('remove')
       .setDescription('Unlink your TFT Clash account')
  )
  .addSubcommand(sub =>
    sub.setName('status')
       .setDescription('Check your current link status')
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'account') {
    await interaction.deferReply({ ephemeral: true });
    const username = interaction.options.getString('username');
    const player = await getPlayer(username);

    if (!player) {
      return interaction.editReply(`No player named **${username}** found on TFT Clash. Check your username at tft-clash.vercel.app`);
    }

    await linkAccount(interaction.user.id, interaction.user.tag, player.name);

    return interaction.editReply(`Linked! Your Discord is now connected to **${player.name}** on TFT Clash.\nUse \`/profile\` to see your stats.`);
  }

  if (sub === 'remove') {
    await interaction.deferReply({ ephemeral: true });
    const existing = await getLink(interaction.user.id);
    if (!existing) {
      return interaction.editReply('You have no linked account.');
    }
    await unlinkAccount(interaction.user.id);
    return interaction.editReply(`Unlinked **${existing.platform_name}** from your Discord.`);
  }

  if (sub === 'status') {
    await interaction.deferReply({ ephemeral: true });
    const link = await getLink(interaction.user.id);
    if (!link) {
      return interaction.editReply('No linked account. Use `/link account <username>` to connect, or link via tft-clash.vercel.app → Account → Connect Discord.');
    }
    const date = new Date(link.linked_at).toLocaleDateString();
    return interaction.editReply(`Linked to **${link.platform_name}** since ${date}.`);
  }
}
