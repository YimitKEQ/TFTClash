import { SlashCommandBuilder } from 'discord.js';
import { getTournamentState, getPlayerByDiscordId } from '../utils/data.js';
import { getLink } from '../utils/db.js';
import { supabase } from '../utils/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('checkin')
  .setDescription('Check in for the current TFT Clash');

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const ts = await getTournamentState();
  if (!ts || ts.phase !== 'checkin') {
    const phase = ts ? ts.phase : 'idle';
    if (phase === 'registration') {
      return interaction.editReply('Check-in has not started yet. The clash is still in the registration phase.');
    }
    if (phase === 'inprogress') {
      return interaction.editReply('The clash is already in progress. Too late to check in.');
    }
    return interaction.editReply('Check-in is not currently open. Use `/clash` to see the current status.');
  }

  const tournamentId = ts.dbTournamentId || null;
  if (!tournamentId) {
    return interaction.editReply('Check-in is not fully set up yet. Try checking in on the website.');
  }

  // Find the player linked to this Discord user
  let player = await getPlayerByDiscordId(interaction.user.id);
  if (!player) {
    const link = await getLink(interaction.user.id);
    if (!link) {
      return interaction.editReply('You need to link your TFT Clash account first. Use `/link account <username>`.');
    }
    const { data: pData } = await supabase
      .from('players')
      .select('id,username')
      .ilike('username', link.platform_name)
      .single();
    if (!pData) {
      return interaction.editReply('Could not find your linked player profile.');
    }
    player = { id: pData.id, name: pData.username };
  }

  // Check if registered
  const { data: reg } = await supabase
    .from('registrations')
    .select('id,status')
    .eq('player_id', player.id)
    .eq('tournament_id', tournamentId)
    .maybeSingle();

  if (!reg) {
    return interaction.editReply('You are not registered for Clash #' + (ts.clashNumber || '?') + '. Use `/register` first.');
  }

  if (reg.status === 'checked_in') {
    return interaction.editReply('You are already checked in for Clash #' + (ts.clashNumber || '?') + '. See you in the lobby!');
  }

  // Update status to checked_in
  const { error } = await supabase
    .from('registrations')
    .update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
    .eq('id', reg.id);

  if (error) {
    console.error('[checkin] DB error:', error);
    return interaction.editReply('Failed to check in. Please try again or check in at tftclash.com.');
  }

  await interaction.editReply('✅ **Checked in!** You are confirmed for Clash #' + (ts.clashNumber || '?') + '. Good luck, ' + player.name + '!');
}
