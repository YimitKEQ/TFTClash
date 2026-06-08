import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { supabase } from '../utils/supabase.js';
import { getPlayerByDiscordId } from '../utils/data.js';

// Staff-only soft-ban management (spec Section 2.6 / 8.10). A soft ban
// deprioritises a player to the waitlist for their next tournament; the web
// platform's registration trigger enforces the actual waitlisting. After the
// player sits out one tournament, the ban auto-lifts.
export var data = new SlashCommandBuilder()
  .setName('softban')
  .setDescription('Soft-ban management (staff only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(function (sub) {
    return sub.setName('add')
      .setDescription('Soft-ban a player (waitlisted next tournament)')
      .addUserOption(function (o) { return o.setName('player').setDescription('Player to soft-ban').setRequired(true); })
      .addStringOption(function (o) { return o.setName('reason').setDescription('Reason (shown to the player)').setRequired(false); });
  })
  .addSubcommand(function (sub) {
    return sub.setName('remove')
      .setDescription('Lift a player\'s soft ban')
      .addUserOption(function (o) { return o.setName('player').setDescription('Player to lift').setRequired(true); });
  })
  .addSubcommand(function (sub) {
    return sub.setName('list').setDescription('List everyone currently soft-banned');
  });

async function dmPlayer(interaction, discordUserId, text) {
  try {
    var user = await interaction.client.users.fetch(discordUserId);
    if (user) await user.send(text);
  } catch (e) {
    // DMs closed or fetch failed — non-fatal.
  }
}

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  var sub = interaction.options.getSubcommand();

  if (sub === 'list') {
    var listRes = await supabase
      .from('soft_bans')
      .select('player_id, reason, applied_at, players(username)')
      .eq('active', true)
      .order('applied_at', { ascending: true });
    if (listRes.error) return interaction.editReply('Could not load soft bans: ' + listRes.error.message);
    var rows = listRes.data || [];
    if (!rows.length) return interaction.editReply('No active soft bans.');
    var lines = rows.slice(0, 25).map(function (r, i) {
      var name = (r.players && r.players.username) || 'Unknown';
      return (i + 1) + '. **' + name + '**' + (r.reason ? ' - ' + r.reason : '');
    });
    return interaction.editReply('**Current soft bans (' + rows.length + '):**\n' + lines.join('\n'));
  }

  var targetUser = interaction.options.getUser('player');
  if (!targetUser) return interaction.editReply('No player specified.');
  var player = await getPlayerByDiscordId(targetUser.id);
  if (!player) return interaction.editReply('That Discord user is not linked to a TFT Clash account.');

  if (sub === 'add') {
    var reason = interaction.options.getString('reason') || null;
    var existing = await supabase.from('soft_bans').select('id').eq('player_id', player.id).eq('active', true).limit(1);
    if (existing.error) return interaction.editReply('Lookup failed: ' + existing.error.message);

    if (existing.data && existing.data.length) {
      var upd = await supabase.from('soft_bans').update({ reason: reason, applied_at: new Date().toISOString() }).eq('id', existing.data[0].id);
      if (upd.error) return interaction.editReply('Update failed: ' + upd.error.message);
    } else {
      var ins = await supabase.from('soft_bans').insert({ player_id: player.id, reason: reason, active: true });
      if (ins.error) return interaction.editReply('Soft-ban failed: ' + ins.error.message);
    }

    await dmPlayer(interaction, targetUser.id,
      'You\'ve been soft banned' + (reason ? ' for: ' + reason : '') + '. You\'ll be on the waitlist for the next tournament. After you sit that one out, it\'s lifted automatically.');
    return interaction.editReply('**' + player.name + '** has been soft-banned - they\'ll be waitlisted next time.');
  }

  if (sub === 'remove') {
    var rem = await supabase.from('soft_bans')
      .update({ active: false, lifted_at: new Date().toISOString(), lifted_reason: 'manual' })
      .eq('player_id', player.id).eq('active', true);
    if (rem.error) return interaction.editReply('Lift failed: ' + rem.error.message);
    await dmPlayer(interaction, targetUser.id, 'Your soft ban has been lifted. You\'re back to normal registration.');
    return interaction.editReply('**' + player.name + '**\'s soft ban has been lifted.');
  }
}
