import { SlashCommandBuilder } from 'discord.js';
import { getTournamentState, getPlayerByDiscordId } from '../utils/data.js';
import { joinStandby, leaveStandby, listStandby, standbyPosition } from '../utils/standby.js';

export var data = new SlashCommandBuilder()
  .setName('standby')
  .setDescription('Join the standby pool for the current clash (auto-promoted if a seat opens up)')
  .addSubcommand(function(sub) { return sub.setName('join').setDescription('Add yourself to standby'); })
  .addSubcommand(function(sub) { return sub.setName('leave').setDescription('Remove yourself from standby'); })
  .addSubcommand(function(sub) { return sub.setName('status').setDescription('See your standby position'); })
  .addSubcommand(function(sub) { return sub.setName('list').setDescription('See the full standby queue'); });

async function activeTournamentId() {
  var ts = await getTournamentState();
  if (!ts) return null;
  return ts.dbTournamentId || ts.activeTournamentId || null;
}

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  var sub = interaction.options.getSubcommand();
  var tid = await activeTournamentId();
  if (!tid) return interaction.editReply('No active clash right now. Standby is only useful while one is open.');

  if (sub === 'list') {
    var queue = await listStandby(tid);
    if (!queue.length) return interaction.editReply('Standby queue is empty.');
    var lines = queue.slice(0, 25).map(function(s, i) {
      return (i + 1) + '. **' + (s.username || 'Unknown') + '**';
    });
    return interaction.editReply('**Standby queue (' + queue.length + '):**\n' + lines.join('\n'));
  }

  var player = await getPlayerByDiscordId(interaction.user.id);
  if (!player) return interaction.editReply('Link your account first: `/link account <username>`.');

  if (sub === 'join') {
    var res = await joinStandby(tid, player.id, 'discord');
    if (!res.ok) {
      if (res.reason === 'already_registered') return interaction.editReply('You\'re already registered for this clash — no need for standby.');
      return interaction.editReply('Could not add you to standby (' + (res.reason || 'unknown') + '). Try again or contact a host.');
    }
    return interaction.editReply('You\'re on standby for this clash at position **#' + (res.position || '?') + '**. We\'ll DM you if a seat opens up.');
  }

  if (sub === 'leave') {
    var rem = await leaveStandby(tid, player.id);
    if (!rem.ok) return interaction.editReply('Could not remove you from standby. Try again.');
    return interaction.editReply('Removed from the standby queue.');
  }

  if (sub === 'status') {
    var pos = await standbyPosition(tid, player.id);
    if (!pos) return interaction.editReply('You are not on standby. Use `/standby join` to opt in.');
    return interaction.editReply('You are at standby position **#' + pos + '**.');
  }
}
