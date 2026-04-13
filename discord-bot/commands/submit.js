import { SlashCommandBuilder } from 'discord.js';
import { getTournamentState, getPlayerByDiscordId } from '../utils/data.js';
import { getLink } from '../utils/db.js';
import { supabase } from '../utils/supabase.js';

export var data = new SlashCommandBuilder()
  .setName('submit')
  .setDescription('Submit your placement for the current round')
  .addIntegerOption(function(option) {
    return option
      .setName('placement')
      .setDescription('Your placement (1-8)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(8);
  });

// Helper: normalize a lobby entry from tournament_state JSON to a list of player ids.
function extractPlayerIds(lobby) {
  if (!lobby) return [];
  if (Array.isArray(lobby.player_ids)) return lobby.player_ids.slice();
  if (Array.isArray(lobby.playerIds)) return lobby.playerIds.slice();
  if (Array.isArray(lobby.players)) {
    return lobby.players.map(function(p) {
      return typeof p === 'object' && p !== null ? p.id : p;
    }).filter(function(v) { return v !== undefined && v !== null; });
  }
  if (Array.isArray(lobby)) {
    return lobby.map(function(p) { return p && p.id; }).filter(Boolean);
  }
  return [];
}

// Helper: resolve the lobby this player is assigned to (1-indexed).
function findMyLobbyNumber(lobbies, playerId) {
  if (!Array.isArray(lobbies) || !playerId) return null;
  for (var i = 0; i < lobbies.length; i++) {
    var ids = extractPlayerIds(lobbies[i]);
    for (var j = 0; j < ids.length; j++) {
      if (String(ids[j]) === String(playerId)) return i + 1;
    }
  }
  return null;
}

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  var placement = interaction.options.getInteger('placement');
  if (!placement || placement < 1 || placement > 8) {
    return interaction.editReply('Placement must be between 1 and 8.');
  }

  var ts = await getTournamentState();
  if (!ts || ts.phase !== 'inprogress') {
    return interaction.editReply('No active round to submit for. Use `/clash` to see tournament status.');
  }

  var tournamentId = ts.dbTournamentId || ts.id || null;
  if (!tournamentId) {
    return interaction.editReply('Tournament is not fully set up yet. Submit on the website instead.');
  }

  // Always derive player from the caller's Discord user - never accept from input.
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

  // Determine the player's lobby from tournament_state (same logic the web app uses).
  var lobbiesList = ts.lockedLobbies || ts.savedLobbies || ts.lobbies || [];
  var lobbyNumber = findMyLobbyNumber(lobbiesList, player.id);
  if (!lobbyNumber) {
    return interaction.editReply('You are not assigned to a lobby for Clash #' + (ts.clashNumber || '?') + '. Cannot submit.');
  }

  var currentRound = ts.round || 1;

  // Upsert into pending_results. Unique key: (tournament_id, round, player_id).
  var upsertRes = await supabase
    .from('pending_results')
    .upsert({
      tournament_id: tournamentId,
      round: currentRound,
      lobby_number: lobbyNumber,
      player_id: player.id,
      placement: placement,
      status: 'pending',
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'tournament_id,round,player_id' });

  if (upsertRes.error) {
    console.error('[submit] upsert error:', upsertRes.error);
    return interaction.editReply('Failed to submit placement. Try again or submit on the website.');
  }

  return interaction.editReply('Submitted placement **' + placement + '** for Round ' + currentRound + '. An admin will verify shortly.');
}
