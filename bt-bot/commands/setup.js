/**
 * /setup - build the BrosephTech HQ Discord layout.
 *
 * Ensures the "BrosephTech HQ" category exists (creating it if missing), then
 * creates every HQ channel inside that category with its topic set. Restricted
 * to members with Manage Server. The bot itself needs the Manage Channels
 * permission; if it is missing, the channel (or category) is reported as failed
 * and the user is told to grant it.
 *
 * Idempotent: an existing category or channel (matched by name) is never
 * duplicated. The category and channels are matched by name only.
 */

import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { HQ_CATEGORY, HQ_CHANNELS } from '../lib/hq.js';

export var data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Build the BrosephTech HQ category and channels')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

// Find an existing channel by name and type, or null.
function findByName(guild, name, type) {
  return guild.channels.cache.find(function(c) {
    return c.type === type && c.name === name;
  }) || null;
}

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  var guild = interaction.guild;
  if (!guild) {
    await interaction.editReply('Run this inside the server.');
    return;
  }

  var created = [];
  var existed = [];
  var failed = [];

  // 1. Ensure the HQ category exists.
  var category = findByName(guild, HQ_CATEGORY, ChannelType.GuildCategory);
  if (category) {
    existed.push(HQ_CATEGORY);
  } else {
    try {
      category = await guild.channels.create({
        name: HQ_CATEGORY,
        type: ChannelType.GuildCategory,
      });
      created.push(HQ_CATEGORY);
    } catch (e) {
      failed.push(HQ_CATEGORY);
    }
  }

  // 2. Ensure every HQ channel exists inside the category.
  // Without a category the channels would land at the top level, so bail out
  // of channel creation and let the user fix the permission first.
  if (category) {
    for (var i = 0; i < HQ_CHANNELS.length; i++) {
      var spec = HQ_CHANNELS[i];
      var found = findByName(guild, spec.name, ChannelType.GuildText);
      if (found) {
        existed.push('#' + spec.name);
        continue;
      }
      try {
        await guild.channels.create({
          name: spec.name,
          type: ChannelType.GuildText,
          parent: category.id,
          topic: spec.topic,
        });
        created.push('#' + spec.name);
      } catch (e) {
        failed.push('#' + spec.name);
      }
    }
  }

  var lines = [];
  if (created.length) lines.push('Created: ' + created.join(', '));
  if (existed.length) lines.push('Already there: ' + existed.join(', '));
  if (failed.length) lines.push('Could not create: ' + failed.join(', ') + ' (give the bot the Manage Channels permission, then run /setup again)');

  await interaction.editReply(lines.join('\n') || 'Nothing to do.');
}
