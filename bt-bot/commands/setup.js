/**
 * /setup - create the BrosephTech channels the bot uses.
 *
 * Creates (if missing): #bt-standup, #bt-meetings, and one channel per
 * department. Restricted to members with Manage Server. The bot itself needs
 * the Manage Channels permission; if it is missing, the channel is reported as
 * failed and the user is told to grant it.
 */

import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { BT_DEPARTMENTS } from '../config/crew.js';

var CHANNELS = ['bt-standup', 'bt-meetings'].concat(
  BT_DEPARTMENTS.map(function(d) { return 'bt-' + d.id; })
);

export var data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Create the BrosephTech channels the bot uses')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

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

  for (var i = 0; i < CHANNELS.length; i++) {
    var name = CHANNELS[i];
    var found = guild.channels.cache.find(function(c) {
      return c.type === ChannelType.GuildText && c.name === name;
    });
    if (found) {
      existed.push(name);
      continue;
    }
    try {
      await guild.channels.create({ name: name, type: ChannelType.GuildText });
      created.push(name);
    } catch (e) {
      failed.push(name);
    }
  }

  function tag(names) {
    return names.map(function(n) { return '#' + n; }).join(', ');
  }

  var lines = [];
  if (created.length) lines.push('Created: ' + tag(created));
  if (existed.length) lines.push('Already there: ' + tag(existed));
  if (failed.length) lines.push('Could not create: ' + tag(failed) + ' (give the bot the Manage Channels permission, then run /setup again)');

  await interaction.editReply(lines.join('\n') || 'Nothing to do.');
}
