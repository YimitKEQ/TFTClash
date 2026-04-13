import { SlashCommandBuilder } from 'discord.js';
import { getTournamentState, getPlayerByDiscordId } from '../utils/data.js';
import { getLink } from '../utils/db.js';
import { supabase } from '../utils/supabase.js';

export var data = new SlashCommandBuilder()
  .setName('dispute')
  .setDescription('File a dispute for a round you are in')
  .addIntegerOption(function(option) {
    return option
      .setName('round')
      .setDescription('The round number being disputed')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(8);
  })
  .addStringOption(function(option) {
    return option
      .setName('reason')
      .setDescription('What happened')
      .setRequired(true)
      .setMaxLength(500);
  });

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  var round = interaction.options.getInteger('round');
  var reason = interaction.options.getString('reason');

  if (!reason || reason.trim().length < 4) {
    return interaction.editReply('Please provide a real reason (at least 4 characters).');
  }

  var ts = await getTournamentState();
  if (!ts) {
    return interaction.editReply('No tournament state available.');
  }

  var tournamentId = ts.dbTournamentId || ts.id || null;
  if (!tournamentId) {
    return interaction.editReply('Tournament is not fully set up yet. File disputes on the website instead.');
  }

  // Always derive player from Discord user - never accept player_id from input.
  var player = await getPlayerByDiscordId(interaction.user.id);
  if (!player) {
    var link = await getLink(interaction.user.id);
    if (!link) {
      return interaction.editReply('Link your account first with `/link account <username>`.');
    }
    var pRes = await supabase
      .from('players')
      .select('id,username')
      .ilike('username', link.platform_name)
      .single();
    if (!pRes.data) {
      return interaction.editReply('Could not find your linked player profile.');
    }
    player = { id: pRes.data.id, name: pRes.data.username };
  }

  // Schema: disputes has (tournament_id, lobby_id, game_number, player_id, reason, status, created_at)
  // The Discord side does not know the DB lobby UUID, so we leave lobby_id null and store
  // the round as game_number (which is what the table tracks per-round).
  var insertRes = await supabase
    .from('disputes')
    .insert({
      tournament_id: tournamentId,
      player_id: player.id,
      game_number: round,
      reason: reason.trim() + ' [filed via Discord]',
      status: 'open',
      created_at: new Date().toISOString(),
    });

  if (insertRes.error) {
    console.error('[dispute] insert error:', insertRes.error);
    return interaction.editReply('Failed to file dispute. Try again or contact an admin directly.');
  }

  return interaction.editReply('Dispute filed for Clash #' + (ts.clashNumber || '?') + ', Round ' + round + '. An admin will review shortly.');
}
