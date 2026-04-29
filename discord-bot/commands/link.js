import { SlashCommandBuilder } from 'discord.js';
import { linkAccount, getLink, unlinkAccount } from '../utils/db.js';
import { getPlayer } from '../utils/data.js';
import { syncPlayerRoles } from '../utils/roles.js';
import { supabase } from '../utils/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('link')
  .setDescription('Link your Discord account to your TFT Clash profile')
  .addSubcommand(function(sub) {
    return sub.setName('account')
      .setDescription('Link to a TFT Clash username')
      .addStringOption(function(opt) {
        return opt.setName('username')
          .setDescription('Your TFT Clash username (e.g. Levitate)')
          .setRequired(true);
      });
  })
  .addSubcommand(function(sub) {
    return sub.setName('remove')
      .setDescription('Unlink your TFT Clash account');
  })
  .addSubcommand(function(sub) {
    return sub.setName('status')
      .setDescription('Check your current link status');
  });

export async function execute(interaction) {
  var sub = interaction.options.getSubcommand();

  if (sub === 'account') {
    await interaction.deferReply({ ephemeral: true });
    var username = interaction.options.getString('username');
    var player = await getPlayer(username);

    if (!player) {
      return interaction.editReply('No player named **' + username + '** found on TFT Clash. Check your username at tftclash.com');
    }

    await linkAccount(interaction.user.id, interaction.user.tag, player.name);

    // Sync roles after linking
    try {
      var fullPlayer = await supabase
        .from('players')
        .select('id,username,rank,auth_user_id,discord_user_id')
        .eq('discord_user_id', interaction.user.id)
        .single();

      if (fullPlayer.data && interaction.guild) {
        var result = await syncPlayerRoles(interaction.guild, fullPlayer.data);
        var roleMsg = '';
        if (result.added && result.added.length) {
          roleMsg = '\nRoles synced: **' + result.added.join(', ') + '**';
        }
        return interaction.editReply('Linked! Your Discord is now connected to **' + player.name + '** on TFT Clash.' + roleMsg + '\nUse `/profile` to see your stats.');
      }
    } catch (e) {
      console.error('[link] Role sync after link failed:', e.message);
    }

    return interaction.editReply('Linked! Your Discord is now connected to **' + player.name + '** on TFT Clash.\nUse `/profile` to see your stats.');
  }

  if (sub === 'remove') {
    await interaction.deferReply({ ephemeral: true });
    var existing = await getLink(interaction.user.id);
    if (!existing) {
      return interaction.editReply('You have no linked account.');
    }
    await unlinkAccount(interaction.user.id);
    return interaction.editReply('Unlinked **' + existing.platform_name + '** from your Discord.');
  }

  if (sub === 'status') {
    await interaction.deferReply({ ephemeral: true });
    var link = await getLink(interaction.user.id);
    if (!link) {
      return interaction.editReply('No linked account. Use `/link account <username>` to connect, or link via tftclash.com > Account > Connect Discord.');
    }
    return interaction.editReply('Linked to **' + link.platform_name + '**. Your roles are synced automatically.');
  }
}
