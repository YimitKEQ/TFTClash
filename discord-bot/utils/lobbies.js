/**
 * lobbies.js — Auto-create/destroy Discord channels for tournament lobbies.
 * Creates a temp category "CLASH LIVE" with text + voice per lobby.
 * Permission-locked to lobby players only (requires discord_user_id link).
 */

import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { supabase } from './supabase.js';

var CATEGORY_NAME = '--- CLASH LIVE ---';
var LOBBY_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * Create lobby channels for the current tournament.
 * Reads lobbies from tournament_state in site_settings.
 * @param {import('discord.js').Guild} guild
 * @param {object} ts - Tournament state object
 */
export async function createLobbyChannels(guild, ts) {
  if (!guild || !ts) return { created: 0 };

  // Get lobbies from tournament state
  var lobbies = ts.lockedLobbies || ts.savedLobbies || [];
  if (!lobbies.length) {
    console.log('[lobbies] No lobbies found in tournament state');
    return { created: 0 };
  }

  // Clean up any existing lobby channels first
  await destroyLobbyChannels(guild);

  // Fetch player discord IDs for permission locking
  var allPlayerIds = [];
  lobbies.forEach(function(lobby) {
    if (lobby.player_ids) {
      allPlayerIds = allPlayerIds.concat(lobby.player_ids);
    } else if (Array.isArray(lobby)) {
      lobby.forEach(function(p) {
        if (p.id) allPlayerIds.push(p.id);
      });
    }
  });

  // Batch fetch discord user IDs
  var playerDiscordMap = {};
  if (allPlayerIds.length) {
    var res = await supabase
      .from('players')
      .select('id,discord_user_id')
      .in('id', allPlayerIds)
      .not('discord_user_id', 'is', null);
    if (res.data) {
      res.data.forEach(function(p) {
        playerDiscordMap[p.id] = p.discord_user_id;
      });
    }
  }

  // Create the category
  var hostRole = guild.roles.cache.find(function(r) { return r.name === 'Host'; });
  var category = await guild.channels.create({
    name: CATEGORY_NAME,
    type: ChannelType.GuildCategory,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      hostRole ? { id: hostRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] } : null,
    ].filter(Boolean),
  });

  var created = 0;

  for (var i = 0; i < lobbies.length; i++) {
    var lobby = lobbies[i];
    var letter = LOBBY_LETTERS[i] || ('' + (i + 1));
    var lobbyName = 'lobby-' + letter.toLowerCase();

    // Get player IDs for this lobby
    var playerIds = [];
    if (lobby.player_ids) {
      playerIds = lobby.player_ids;
    } else if (Array.isArray(lobby)) {
      playerIds = lobby.map(function(p) { return p.id; }).filter(Boolean);
    }

    // Build permission overwrites for this lobby
    var overwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    ];

    if (hostRole) {
      overwrites.push({
        id: hostRole.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
      });
    }

    // Add each lobby player
    playerIds.forEach(function(pid) {
      var discordId = playerDiscordMap[pid];
      if (discordId) {
        overwrites.push({
          id: discordId,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
        });
      }
    });

    // Create text channel
    try {
      var textCh = await guild.channels.create({
        name: '💬-' + lobbyName,
        type: ChannelType.GuildText,
        parent: category.id,
        topic: 'Lobby ' + letter + ' - Clash #' + (ts.clashNumber || '?') + ' - Good luck!',
        permissionOverwrites: overwrites,
      });

      // Pin a welcome message with lobby info
      var playerNames = [];
      if (Array.isArray(lobby) && lobby[0] && lobby[0].name) {
        playerNames = lobby.map(function(p) { return p.name; });
      }
      var welcomeMsg = '**Lobby ' + letter + '** - Clash #' + (ts.clashNumber || '?') + '\n\n';
      if (playerNames.length) {
        welcomeMsg += 'Players: ' + playerNames.join(', ') + '\n\n';
      }
      welcomeMsg += 'Good luck! This channel will be removed after the clash ends.';
      var msg = await textCh.send(welcomeMsg);
      await msg.pin().catch(function() {});

      created++;
    } catch (e) {
      console.error('[lobbies] Failed to create text channel for lobby ' + letter + ':', e.message);
    }

    // Create voice channel
    try {
      await guild.channels.create({
        name: '🎮 Lobby ' + letter,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: overwrites,
      });
    } catch (e) {
      console.error('[lobbies] Failed to create voice channel for lobby ' + letter + ':', e.message);
    }
  }

  console.log('[lobbies] Created ' + created + ' lobby channels (' + lobbies.length + ' lobbies)');
  return { created: created, category: category.name };
}

/**
 * Destroy all lobby channels (category + children).
 * @param {import('discord.js').Guild} guild
 */
export async function destroyLobbyChannels(guild) {
  if (!guild) return { destroyed: 0 };

  var category = guild.channels.cache.find(function(c) {
    return c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME;
  });

  if (!category) return { destroyed: 0 };

  var destroyed = 0;

  // Delete all children first
  var children = guild.channels.cache.filter(function(c) { return c.parentId === category.id; });
  for (var _ref of children) {
    var ch = _ref[1];
    try {
      await ch.delete('Clash ended - lobby cleanup');
      destroyed++;
    } catch (e) {
      console.error('[lobbies] Failed to delete channel ' + ch.name + ':', e.message);
    }
  }

  // Delete the category
  try {
    await category.delete('Clash ended - lobby cleanup');
  } catch (e) {
    console.error('[lobbies] Failed to delete category:', e.message);
  }

  console.log('[lobbies] Destroyed ' + destroyed + ' lobby channels');
  return { destroyed: destroyed };
}
