/**
 * lobbies.js — Persistent lobby channels, role-gated.
 *
 * Channels live under "🔴 LIVE CLASH" forever. Visibility is controlled by
 * the "Clash Live" role (clashLiveRole.js) — granted to participants when a
 * clash starts, revoked when it ends. No per-user permission overwrites
 * (Discord caps at ~100 per channel — old model broke at 128p × 16 lobbies).
 *
 * Public surface:
 *   setupLobbyRound(guild, ts)   — ensure channels, grant role, pin roster
 *   closeLobbyRound(guild)       — revoke role only (channels persist)
 *   clearLobbyChannels(guild)    — destructive: delete category + children
 *
 * Backwards-compat aliases for existing callers:
 *   createLobbyChannels  -> setupLobbyRound
 *   destroyLobbyChannels -> closeLobbyRound
 */

import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { ensureClashLiveRole, grantClashLiveToActive, revokeAllClashLive } from './clashLiveRole.js';

var CATEGORY_NAME = '🔴 LIVE CLASH';
var LEGACY_CATEGORY_NAMES = ['--- CLASH LIVE ---', 'CLASH LIVE'];
var LOBBY_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function letterFor(i) { return LOBBY_LETTERS[i] || String(i + 1); }
function lobbyTextName(i) { return '💬-lobby-' + letterFor(i).toLowerCase(); }
function lobbyVoiceName(i) { return '🎮 Lobby ' + letterFor(i); }

function buildOverwrites(guild, clashRole, hostRole) {
  var ows = [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }];
  if (clashRole) ows.push({
    id: clashRole.id,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
    ],
  });
  if (hostRole) ows.push({
    id: hostRole.id,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
      PermissionFlagsBits.MoveMembers,
    ],
  });
  return ows;
}

async function ensureCategory(guild) {
  var clashRole = await ensureClashLiveRole(guild);
  var hostRole = guild.roles.cache.find(function(r) { return r.name === 'Host'; });
  var ows = buildOverwrites(guild, clashRole, hostRole);

  var category = guild.channels.cache.find(function(c) {
    return c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME;
  });

  if (category) {
    // Re-sync overwrites in case the role was just created or perms drifted.
    try { await category.permissionOverwrites.set(ows); } catch (_e) {}
    return category;
  }

  return await guild.channels.create({
    name: CATEGORY_NAME,
    type: ChannelType.GuildCategory,
    permissionOverwrites: ows,
  });
}

async function ensureLobbyChannels(guild, n) {
  if (!guild || !n) return { ensured: 0 };
  var category = await ensureCategory(guild);
  var ensured = 0;

  for (var i = 0; i < n; i++) {
    var textName = lobbyTextName(i);
    var voiceName = lobbyVoiceName(i);

    var existingText = guild.channels.cache.find(function(c) {
      return c.type === ChannelType.GuildText && c.parentId === category.id && c.name === textName;
    });
    if (!existingText) {
      try {
        await guild.channels.create({
          name: textName,
          type: ChannelType.GuildText,
          parent: category.id,
          topic: 'Lobby ' + letterFor(i) + ' chat. Drop your end-screen here when the game finishes.',
        });
        ensured++;
      } catch (e) {
        console.error('[lobbies] ensure text ' + textName + ' failed: ' + ((e && e.message) || e));
      }
    }

    var existingVoice = guild.channels.cache.find(function(c) {
      return c.type === ChannelType.GuildVoice && c.parentId === category.id && c.name === voiceName;
    });
    if (!existingVoice) {
      try {
        await guild.channels.create({
          name: voiceName,
          type: ChannelType.GuildVoice,
          parent: category.id,
        });
      } catch (e) {
        console.error('[lobbies] ensure voice ' + voiceName + ' failed: ' + ((e && e.message) || e));
      }
    }
  }

  return { ensured: ensured, category: category.name };
}

async function postLobbyRosters(guild, lobbies, ts) {
  var category = guild.channels.cache.find(function(c) {
    return c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME;
  });
  if (!category) return;

  for (var i = 0; i < lobbies.length; i++) {
    var name = lobbyTextName(i);
    var ch = guild.channels.cache.find(function(c) {
      return c.type === ChannelType.GuildText && c.parentId === category.id && c.name === name;
    });
    if (!ch) continue;

    // Unpin previous roster posts so the channel doesn't accumulate them.
    try {
      var pins = await ch.messages.fetchPinned();
      var meId = guild.client.user.id;
      for (var entry of pins) {
        var pin = entry[1];
        if (pin.author && pin.author.id === meId) {
          try { await pin.unpin(); } catch (_e) {}
        }
      }
    } catch (_e) {}

    var lobby = lobbies[i];
    var letter = letterFor(i);
    var playerNames = [];
    if (Array.isArray(lobby) && lobby[0] && lobby[0].name) {
      playerNames = lobby.map(function(p) { return p.name; });
    } else if (lobby && Array.isArray(lobby.players)) {
      playerNames = lobby.players.map(function(p) { return p && p.name; }).filter(Boolean);
    }

    var body = '**Lobby ' + letter + '** - Clash #' + ((ts && ts.clashNumber) || '?') + '\n\n';
    if (playerNames.length) body += 'Players: ' + playerNames.join(', ') + '\n\n';
    body += 'Drop your end-screen screenshot here when your game finishes - keeps results honest. GL HF.';

    try {
      var msg = await ch.send({ content: body, allowedMentions: { roles: [], users: [], parse: [] } });
      try { await msg.pin(); } catch (_e) {}
    } catch (e) {
      console.warn('[lobbies] roster post failed for ' + name + ': ' + ((e && e.message) || e));
    }
  }
}

export async function setupLobbyRound(guild, ts) {
  if (!guild || !ts) return { ok: false, reason: 'missing-args' };
  var lobbies = ts.lockedLobbies || ts.savedLobbies || [];
  if (!lobbies.length) {
    console.log('[lobbies] setup: no lobbies in tournament state');
    return { ok: false, reason: 'no-lobbies' };
  }
  var ens = await ensureLobbyChannels(guild, lobbies.length);
  var role = await grantClashLiveToActive(guild, ts);
  await postLobbyRosters(guild, lobbies, ts);
  console.log('[lobbies] round setup ok (' + lobbies.length + ' lobbies, +' + (role.added || 0) + ' role grants)');
  return { ok: true, lobbies: lobbies.length, ensured: ens.ensured, granted: role.added || 0 };
}

export async function closeLobbyRound(guild) {
  if (!guild) return { ok: false };
  var res = await revokeAllClashLive(guild);
  return { ok: true, removed: res.removed };
}

export async function clearLobbyChannels(guild) {
  if (!guild) return { destroyed: 0 };
  var matches = guild.channels.cache.filter(function(c) {
    if (c.type !== ChannelType.GuildCategory) return false;
    if (c.name === CATEGORY_NAME) return true;
    return LEGACY_CATEGORY_NAMES.indexOf(c.name) !== -1;
  });
  if (matches.size === 0) return { destroyed: 0 };
  var destroyed = 0;
  for (var catEntry of matches) {
    var category = catEntry[1];
    var children = guild.channels.cache.filter(function(c) { return c.parentId === category.id; });
    for (var childEntry of children) {
      var ch = childEntry[1];
      try { await ch.delete('Force clear lobby channels'); destroyed++; }
      catch (e) { console.error('[lobbies] delete ' + ch.name + ' failed: ' + e.message); }
    }
    try { await category.delete('Force clear lobby category'); }
    catch (e) { console.error('[lobbies] delete category ' + category.name + ' failed: ' + e.message); }
  }
  return { destroyed: destroyed };
}

// Backwards-compat names so existing callers keep working with new semantics.
export var createLobbyChannels = setupLobbyRound;
export var destroyLobbyChannels = closeLobbyRound;
