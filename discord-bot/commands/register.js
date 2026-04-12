import { SlashCommandBuilder } from 'discord.js';
import { registrationConfirmEmbed } from '../utils/embeds.js';
import { getTournamentState, getPlayerByDiscordId, getRegistrations } from '../utils/data.js';
import { getLink } from '../utils/db.js';
import { supabase } from '../utils/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('register')
  .setDescription('Register for the current TFT Clash');

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const ts = await getTournamentState();
  if (!ts || (ts.phase !== 'registration' && ts.phase !== 'checkin')) {
    return interaction.editReply('Registration is not currently open. Use `/clash` to see the current status.');
  }

  // Find the player linked to this Discord user
  let player = await getPlayerByDiscordId(interaction.user.id);
  if (!player) {
    const link = await getLink(interaction.user.id);
    if (!link) {
      return interaction.editReply('You need to link your TFT Clash account first. Use `/link account <username>` or connect Discord at tft-clash.vercel.app > Account.');
    }
    // Fetch full player data
    const { data: pData } = await supabase
      .from('players')
      .select('*')
      .ilike('username', link.platform_name)
      .single();
    if (!pData) {
      return interaction.editReply('Could not find your linked player profile. Try `/link account <username>` again.');
    }
    player = { id: pData.id, name: pData.username, riotId: pData.riot_id_eu || pData.riot_id || '' };
  }

  // Check if player has a Riot ID
  if (!player.riotId && !player.riotIdEu) {
    return interaction.editReply('You need to set your Riot ID before registering. Go to tft-clash.vercel.app > Account and add your Riot ID.');
  }

  // Check if already registered
  const { data: existing } = await supabase
    .from('registrations')
    .select('id')
    .eq('player_id', player.id)
    .eq('clash_number', ts.clashNumber)
    .single();

  if (existing) {
    return interaction.editReply('You are already registered for Clash #' + ts.clashNumber + '! Use `/clash` to see the event info.');
  }

  // Register
  const { error } = await supabase
    .from('registrations')
    .insert({ player_id: player.id, clash_number: ts.clashNumber, status: 'registered' });

  if (error) {
    console.error('[register] DB error:', error);
    return interaction.editReply('Failed to register. Please try again or register at tft-clash.vercel.app.');
  }

  const regs = await getRegistrations();
  const embed = registrationConfirmEmbed(player.name, ts.clashNumber, regs.length);
  await interaction.editReply({ embeds: [embed] });
}
