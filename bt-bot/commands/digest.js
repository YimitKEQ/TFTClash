/**
 * /digest - post the weekly accountability digest to the standup channel now.
 * Restricted to members with the Manage Guild permission.
 */

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { postDigest } from '../lib/scoring.js';

export var data = new SlashCommandBuilder()
  .setName('digest')
  .setDescription('Post the BrosephTech weekly digest to the standup channel right now')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  // Defence in depth: also check at runtime in case the default perms are overridden.
  if (!interaction.memberPermissions || !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: 'You need the Manage Server permission to post the digest.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });
  var ok = await postDigest(interaction.client);
  if (ok) {
    await interaction.editReply({ content: 'Weekly digest posted to the standup channel.' });
  } else {
    await interaction.editReply({ content: 'Could not post the digest. Check that the standup channel exists and the bot can post there.' });
  }
}
