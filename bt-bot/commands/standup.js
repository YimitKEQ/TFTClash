/**
 * /standup - post the standup to the configured channel now.
 * Restricted to members with the Manage Guild permission.
 */

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { postStandup } from '../scheduler.js';

export var data = new SlashCommandBuilder()
  .setName('standup')
  .setDescription('Post the BrosephTech standup to the standup channel right now')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  // Defence in depth: also check at runtime in case the default perms are overridden.
  if (!interaction.memberPermissions || !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: 'You need the Manage Server permission to post the standup.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });
  var ok = await postStandup(interaction.client);
  if (ok) {
    await interaction.editReply({ content: 'Standup posted to the standup channel.' });
  } else {
    await interaction.editReply({ content: 'Could not post the standup. Check that the standup channel exists and the bot can post there.' });
  }
}
