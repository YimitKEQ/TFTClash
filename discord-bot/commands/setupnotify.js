import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { resolveChannel } from '../utils/channels.js';
import { postPanel, loadPanelMessageId, clearPanelMessageId } from '../utils/reactionRoles.js';
import { ensureNotifyRoles } from '../utils/notifyRoles.js';

export const data = new SlashCommandBuilder()
  .setName('setupnotify')
  .setDescription('Post the reaction-role notification panel (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption(function(opt) {
    return opt.setName('action').setDescription('post or clear').setRequired(false).addChoices(
      { name: 'post (default)', value: 'post' },
      { name: 'clear (forget panel)', value: 'clear' }
    );
  });

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  var action = interaction.options.getString('action') || 'post';
  var guild = interaction.guild;

  if (action === 'clear') {
    await clearPanelMessageId();
    return interaction.editReply('Panel reference cleared. Run `/setupnotify` to repost.');
  }

  // Ensure the 4 managed roles exist before posting
  var rolesRes = await ensureNotifyRoles(guild);
  if (!rolesRes.ok) {
    return interaction.editReply('Notify roles not OK: hierarchy=' + rolesRes.hierarchyOk + ' manage=' + rolesRes.manageOk + '. Move the bot role above the managed roles and grant Manage Roles, then retry.');
  }

  var ch = resolveChannel(guild, 'notifications');
  if (!ch) {
    return interaction.editReply('No #notifications channel found. Create one (or run `/layout apply` once Phase 2 ships) and retry.');
  }

  var existing = await loadPanelMessageId();
  if (existing) {
    return interaction.editReply('A panel is already registered (message ' + existing + '). Run `/setupnotify action:clear` first to forget it before reposting.');
  }

  var res = await postPanel(ch);
  return interaction.editReply('Panel posted in #' + ch.name + ' (message ' + res.messageId + '). Reactions are live.');
}
