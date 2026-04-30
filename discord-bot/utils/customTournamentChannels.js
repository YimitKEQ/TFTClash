/**
 * customTournamentChannels.js
 * Auto-create / auto-destroy a Discord category with chat channels for a
 * specific custom tournament. Category is named after the tournament; child
 * channels are general / registrations / check-in plus per-lobby channels
 * once lobbies are assigned.
 *
 * The tournament_id is stored as a marker on the category topic so we can
 * find an existing category for re-entry without colliding with other
 * tournaments that share a similar name.
 */

import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { supabase } from './supabase.js';

var TOURNAMENT_TOPIC_PREFIX = 'tft-clash:tournament:';

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'tournament';
}

function categoryNameFor(tournament) {
  var label = tournament && tournament.name ? tournament.name : 'TOURNAMENT';
  return ('🏆 ' + String(label).toUpperCase()).slice(0, 95);
}

function topicMarkerFor(tournamentId) {
  return TOURNAMENT_TOPIC_PREFIX + String(tournamentId);
}

function findCategoryFor(guild, tournamentId) {
  if (!guild || !tournamentId) return null;
  var marker = topicMarkerFor(tournamentId);
  return guild.channels.cache.find(function(c) {
    return c.type === ChannelType.GuildCategory && c.topic && c.topic.indexOf(marker) === 0;
  }) || null;
}

/**
 * Create the tournament category + chat channels (general, registrations,
 * check-in). Idempotent: if the category already exists, returns it without
 * recreating.
 *
 * @param {import('discord.js').Guild} guild
 * @param {object} tournament - { id, name, type, host_role_id? }
 * @returns {Promise<{ category, created: boolean }>}
 */
export async function createTournamentChannels(guild, tournament) {
  if (!guild || !tournament || !tournament.id) return { category: null, created: false };

  var existing = findCategoryFor(guild, tournament.id);
  if (existing) return { category: existing, created: false };

  var slug = slugify(tournament.name);
  var hostRole = guild.roles.cache.find(function(r) { return r.name === 'Host'; });

  var basePerms = [
    { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
  ];
  if (hostRole) {
    basePerms.push({
      id: hostRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.MentionEveryone,
      ],
    });
  }

  var category;
  try {
    category = await guild.channels.create({
      name: categoryNameFor(tournament),
      type: ChannelType.GuildCategory,
      topic: topicMarkerFor(tournament.id) + ' :: auto-managed by TFT Clash bot',
      permissionOverwrites: basePerms,
    });
  } catch (e) {
    console.error('[customTournamentChannels] Failed to create category:', e && e.message);
    return { category: null, created: false };
  }

  var spec = [
    { name: '📣-' + slug + '-general', topic: 'General chat for ' + (tournament.name || 'the tournament') + '.' },
    { name: '📝-' + slug + '-registrations', topic: 'Registration announcements for ' + (tournament.name || 'the tournament') + '.' },
    { name: '✅-' + slug + '-check-in', topic: 'Check-in updates for ' + (tournament.name || 'the tournament') + '.' },
  ];

  for (var i = 0; i < spec.length; i++) {
    try {
      await guild.channels.create({
        name: spec[i].name.slice(0, 95),
        type: ChannelType.GuildText,
        parent: category.id,
        topic: spec[i].topic,
      });
    } catch (e) {
      console.error('[customTournamentChannels] child channel ' + spec[i].name + ' failed:', e && e.message);
    }
  }

  console.log('[customTournamentChannels] Category created for "' + (tournament.name || tournament.id) + '"');
  return { category: category, created: true };
}

/**
 * Create per-lobby chat + voice channels under the tournament category.
 * Skips lobbies that already have a channel named "lobby-X" under this
 * category so the call is safe to retry.
 *
 * @param {import('discord.js').Guild} guild
 * @param {object} tournament - { id, name }
 * @param {Array<object>} lobbies - rows from public.lobbies for this tournament
 * @returns {Promise<{ created: number }>}
 */
export async function createTournamentLobbyChannels(guild, tournament, lobbies) {
  if (!guild || !tournament || !tournament.id) return { created: 0 };
  if (!Array.isArray(lobbies) || lobbies.length === 0) return { created: 0 };

  var category = findCategoryFor(guild, tournament.id);
  if (!category) {
    var made = await createTournamentChannels(guild, tournament);
    category = made.category;
  }
  if (!category) return { created: 0 };

  var hostRole = guild.roles.cache.find(function(r) { return r.name === 'Host'; });

  var allPlayerIds = [];
  lobbies.forEach(function(lobby) {
    if (Array.isArray(lobby.player_ids)) allPlayerIds = allPlayerIds.concat(lobby.player_ids);
  });

  var playerDiscordMap = {};
  if (allPlayerIds.length) {
    var res = await supabase
      .from('players')
      .select('id,discord_user_id')
      .in('id', allPlayerIds)
      .not('discord_user_id', 'is', null);
    if (res.data) {
      res.data.forEach(function(p) { playerDiscordMap[p.id] = p.discord_user_id; });
    }
  }

  var created = 0;
  var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  for (var i = 0; i < lobbies.length; i++) {
    var lobby = lobbies[i];
    var letter = letters[i] || ('' + (i + 1));
    var lobbySlug = 'lobby-' + letter.toLowerCase();
    var existing = guild.channels.cache.find(function(c) {
      return c.parentId === category.id && c.name && c.name.indexOf(lobbySlug) !== -1;
    });
    if (existing) continue;

    var overwrites = [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }];
    if (hostRole) {
      overwrites.push({
        id: hostRole.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
        ],
      });
    }

    var ids = Array.isArray(lobby.player_ids) ? lobby.player_ids : [];
    ids.forEach(function(pid) {
      var did = playerDiscordMap[pid];
      if (did) {
        overwrites.push({
          id: did,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
          ],
        });
      }
    });

    try {
      var textCh = await guild.channels.create({
        name: ('💬-' + lobbySlug).slice(0, 95),
        type: ChannelType.GuildText,
        parent: category.id,
        topic: 'Lobby ' + letter + ' chat for ' + (tournament.name || 'tournament') + '.',
        permissionOverwrites: overwrites,
      });
      var welcome = '**Lobby ' + letter + '** - ' + (tournament.name || 'Tournament') + '\nGood luck! This channel auto-cleans up after the tournament ends.';
      try {
        var msg = await textCh.send(welcome);
        await msg.pin().catch(function() {});
      } catch (_e) {}
      created++;
    } catch (e) {
      console.error('[customTournamentChannels] lobby text channel ' + lobbySlug + ' failed:', e && e.message);
    }

    try {
      await guild.channels.create({
        name: ('🎮 Lobby ' + letter).slice(0, 95),
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: overwrites,
      });
    } catch (e) {
      console.error('[customTournamentChannels] lobby voice channel ' + lobbySlug + ' failed:', e && e.message);
    }
  }

  console.log('[customTournamentChannels] Lobby channels: created ' + created + ' for "' + (tournament.name || tournament.id) + '"');
  return { created: created };
}

/**
 * Destroy the tournament category and all child channels.
 *
 * @param {import('discord.js').Guild} guild
 * @param {string} tournamentId
 * @returns {Promise<{ destroyed: number }>}
 */
export async function destroyTournamentChannels(guild, tournamentId) {
  if (!guild || !tournamentId) return { destroyed: 0 };
  var category = findCategoryFor(guild, tournamentId);
  if (!category) return { destroyed: 0 };

  var destroyed = 0;
  var children = guild.channels.cache.filter(function(c) { return c.parentId === category.id; });
  for (var entry of children) {
    var child = entry[1];
    try {
      await child.delete('Tournament ended - cleanup');
      destroyed++;
    } catch (e) {
      console.error('[customTournamentChannels] Failed to delete ' + child.name + ':', e && e.message);
    }
  }
  try {
    await category.delete('Tournament ended - cleanup');
  } catch (e) {
    console.error('[customTournamentChannels] Failed to delete category:', e && e.message);
  }
  console.log('[customTournamentChannels] Destroyed ' + destroyed + ' channels for tournament ' + tournamentId);
  return { destroyed: destroyed };
}
