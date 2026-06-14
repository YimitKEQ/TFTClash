import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { resolveChannel } from '../utils/channels.js';
import { postPanel, loadPanelMessageId, clearPanelMessageId } from '../utils/reactionRoles.js';
import { ensureNotifyRoles } from '../utils/notifyRoles.js';

export const data = new SlashCommandBuilder()
  .setName('setupnotify')
  .setDescription('Post the self-serve role / notification panel (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption(function(opt) {
    return opt.setName('action').setDescription('post or clear').setRequired(false).addChoices(
      { name: 'post (default)', value: 'post' },
      { name: 'clear (forget panel)', value: 'clear' }
    );
  })
  .addChannelOption(function(opt) {
    return opt.setName('channel').setDescription('Where to post the panel (defaults to #roles / #notifications, created if missing)').addChannelTypes(ChannelType.GuildText).setRequired(false);
  });

// Resolve the target channel for the role panel. Preference order:
//   1. explicitly passed channel
//   2. an existing #roles / #get-roles / #notifications channel
//   3. a freshly created #roles channel (needs ManageChannels)
async function resolveOrCreateRolesChannel(guild, explicit) {
  if (explicit) return explicit;
  var existing = resolveChannel(guild, 'roles') || resolveChannel(guild, 'notifications');
  if (existing) return existing;
  var me = guild.members.me;
  if (!me || !me.permissions.has(PermissionFlagsBits.ManageChannels)) return null;
  try {
    return await guild.channels.create({
      name: 'roles',
      type: ChannelType.GuildText,
      topic: 'Pick your roles - opt in to the pings you want.',
      reason: 'TFT Clash bot - role selection channel',
    });
  } catch (e) {
    console.error('[setupnotify] channel create failed: ' + ((e && e.message) || e));
    return null;
  }
}

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  var action = interaction.options.getString('action') || 'post';
  var explicit = interaction.options.getChannel('channel');
  var guild = interaction.guild;

  if (action === 'clear') {
    await clearPanelMessageId();
    return interaction.editReply('Panel reference cleared. Run `/setupnotify` to repost.');
  }

  // Ensure the managed roles exist (incl. the "Fuck it ping me" catch-all).
  var rolesRes = await ensureNotifyRoles(guild);
  if (!rolesRes.ok) {
    return interaction.editReply('Notify roles not OK: hierarchy=' + rolesRes.hierarchyOk + ' manage=' + rolesRes.manageOk + '. Move the bot role above the managed roles and grant Manage Roles, then retry.');
  }

  var ch = await resolveOrCreateRolesChannel(guild, explicit);
  if (!ch) {
    return interaction.editReply('No target channel found and I could not create one. Create a #roles channel (or pass channel:) and grant me Manage Channels, then retry.');
  }

  var existingMsg = await loadPanelMessageId();
  if (existingMsg) {
    return interaction.editReply('A panel is already registered (message ' + existingMsg + '). Run `/setupnotify action:clear` first to forget it before reposting.');
  }

  var res = await postPanel(ch);
  return interaction.editReply('Role panel posted in <#' + ch.id + '> (message ' + res.messageId + '). Reactions are live - including the "Fuck it ping me" catch-all.');
}
