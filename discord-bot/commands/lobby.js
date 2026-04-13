import { SlashCommandBuilder } from 'discord.js';
import { getTournamentState, getPlayerByDiscordId } from '../utils/data.js';
import { getLink } from '../utils/db.js';
import { supabase } from '../utils/supabase.js';

export var data = new SlashCommandBuilder()
  .setName('lobby')
  .setDescription('Show your current lobby assignment for the active TFT Clash');

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

  var ts = await getTournamentState();
  if (!ts || (ts.phase !== 'inprogress' && ts.phase !== 'checkin')) {
    return interaction.editReply('There is no active tournament right now. Use `/clash` to see the next clash.');
  }

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

  var lobbies = ts.lockedLobbies || ts.savedLobbies || ts.lobbies || [];
  var lobbyNumber = findMyLobbyNumber(lobbies, player.id);

  if (!lobbyNumber) {
    return interaction.editReply('You are not assigned to a lobby for Clash #' + (ts.clashNumber || '?') + '. Did you check in? Use `/checkin`.');
  }

  var myLobby = lobbies[lobbyNumber - 1];
  var opponentIds = extractPlayerIds(myLobby).filter(function(id) {
    return String(id) !== String(player.id);
  });

  var opponentNames = [];
  if (opponentIds.length) {
    var opRes = await supabase
      .from('players')
      .select('id,username')
      .in('id', opponentIds);
    if (opRes.data) {
      opponentNames = opRes.data.map(function(p) { return p.username; }).filter(Boolean);
    }
  }

  var roundLabel = ts.round ? String(ts.round) : '1';
  var lines = [
    '**Clash #' + (ts.clashNumber || '?') + '** - Round ' + roundLabel,
    '**Lobby:** ' + lobbyNumber,
    '**Opponents:** ' + (opponentNames.length ? opponentNames.join(', ') : 'Unknown'),
  ];

  if (myLobby && myLobby.lobby_code) {
    lines.push('**Lobby code:** `' + myLobby.lobby_code + '`');
  }

  return interaction.editReply(lines.join('\n'));
}
