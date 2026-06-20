/**
 * lobbies.js — Open lobby channels under "🔴 LIVE CLASH". No roles, no gating.
 *
 * Philosophy: keep it dead simple. The bot just builds an open category that
 * the whole server can see, chat in, and spectate. There are NO per-lobby roles
 * and NO "Clash Live" visibility role -- anyone can read every lobby channel.
 *
 * Layout:
 *   🔴 LIVE CLASH                 (category, open to @everyone)
 *     📢-clash-hub                (read-only announce; bot/host post)
 *     💬-lobby-a … 💬-lobby-x     (open text chat, one per lobby)
 *     🎮 Lobby A … 🎮 Lobby X     (open voice, one per lobby)
 *
 * Public surface:
 *   setupLobbyRound(guild, ts)   — ensure open channels, prune extras, post rosters + hub board
 *   announceClashEnd(guild, ts)  — post a GG wrap-up in the hub (channels stay)
 *   closeLobbyRound(guild, ts)   — wrap up AND delete the category (manual teardown)
 *   clearLobbyChannels(guild)    — destructive: delete category + children
 *
 * Backwards-compat aliases for existing callers:
 *   createLobbyChannels  -> setupLobbyRound
 *   destroyLobbyChannels -> closeLobbyRound
 */

import { ChannelType, PermissionFlagsBits } from 'discord.js';

var CATEGORY_NAME = '🔴 LIVE CLASH';
var LEGACY_CATEGORY_NAMES = ['--- CLASH LIVE ---', 'CLASH LIVE'];
var HUB_NAME = '📢-clash-hub';
var LOBBY_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
var MAX_LOBBIES = LOBBY_LETTERS.length;

function letterFor(i) { return LOBBY_LETTERS[i] || String(i + 1); }
function lobbyTextName(i) { return '💬-lobby-' + letterFor(i).toLowerCase(); }
function lobbyVoiceName(i) { return '🎮 Lobby ' + letterFor(i); }

function hostRoleOf(guild) {
  return guild.roles.cache.find(function(r) { return r.name === 'Host'; }) || null;
}

// Fully open: anyone can view, chat, react, attach screenshots, and join voice.
function openOverwrites(guild, hostRole) {
  var ows = [{
    id: guild.roles.everyone.id,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
    ],
  }];
  if (hostRole) ows.push({
    id: hostRole.id,
    allow: [
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.MoveMembers,
      PermissionFlagsBits.MuteMembers,
    ],
  });
  return ows;
}

// Hub: everyone can read + react, but only the bot/host post announcements.
function hubOverwrites(guild, hostRole) {
  var ows = [{
    id: guild.roles.everyone.id,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AddReactions,
    ],
    deny: [
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.CreatePublicThreads,
      PermissionFlagsBits.CreatePrivateThreads,
    ],
  }];
  // Always let the bot itself post here, even if its send perm comes from
  // @everyone (which we just denied).
  ows.push({
    id: guild.client.user.id,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.EmbedLinks,
    ],
  });
  if (hostRole) ows.push({
    id: hostRole.id,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ManageMessages,
    ],
  });
  return ows;
}

function findCategory(guild) {
  return guild.channels.cache.find(function(c) {
    return c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME;
  }) || null;
}

async function ensureCategory(guild) {
  var hostRole = hostRoleOf(guild);
  var ows = openOverwrites(guild, hostRole);
  var category = findCategory(guild);
  if (category) {
    // Re-assert OPEN perms in case an old build left @everyone denied here.
    try { await category.permissionOverwrites.set(ows); } catch (_e) {}
    return { category: category, created: 0 };
  }
  category = await guild.channels.create({
    name: CATEGORY_NAME,
    type: ChannelType.GuildCategory,
    permissionOverwrites: ows,
  });
  return { category: category, created: 1 };
}

async function ensureHubChannel(guild, category) {
  var hostRole = hostRoleOf(guild);
  var ows = hubOverwrites(guild, hostRole);
  var existing = guild.channels.cache.find(function(c) {
    return c.type === ChannelType.GuildText && c.parentId === category.id && c.name === HUB_NAME;
  });
  if (existing) {
    try { await existing.permissionOverwrites.set(ows); } catch (_e) {}
    return { channel: existing, created: 0 };
  }
  var ch = await guild.channels.create({
    name: HUB_NAME,
    type: ChannelType.GuildText,
    parent: category.id,
    position: 0,
    topic: 'Live clash announcements - rounds, lobby list, results. Read-only.',
    permissionOverwrites: ows,
  });
  return { channel: ch, created: 1 };
}

async function ensureLobbyChannels(guild, n, category) {
  var hostRole = hostRoleOf(guild);
  var ows = openOverwrites(guild, hostRole);
  var created = 0;

  for (var i = 0; i < n; i++) {
    var textName = lobbyTextName(i);
    var voiceName = lobbyVoiceName(i);

    var existingText = guild.channels.cache.find(function(c) {
      return c.type === ChannelType.GuildText && c.parentId === category.id && c.name === textName;
    });
    if (existingText) {
      try { await existingText.permissionOverwrites.set(ows); } catch (_e) {}
    } else {
      try {
        await guild.channels.create({
          name: textName,
          type: ChannelType.GuildText,
          parent: category.id,
          topic: 'Lobby ' + letterFor(i) + ' chat. Drop your end-screen here when the game finishes.',
          permissionOverwrites: ows,
        });
        created++;
      } catch (e) {
        console.error('[lobbies] ensure text ' + textName + ' failed: ' + ((e && e.message) || e));
      }
    }

    var existingVoice = guild.channels.cache.find(function(c) {
      return c.type === ChannelType.GuildVoice && c.parentId === category.id && c.name === voiceName;
    });
    if (existingVoice) {
      try { await existingVoice.permissionOverwrites.set(ows); } catch (_e) {}
    } else {
      try {
        await guild.channels.create({
          name: voiceName,
          type: ChannelType.GuildVoice,
          parent: category.id,
          permissionOverwrites: ows,
        });
        created++;
      } catch (e) {
        console.error('[lobbies] ensure voice ' + voiceName + ' failed: ' + ((e && e.message) || e));
      }
    }
  }

  return { created: created };
}

// Delete lobby channels beyond the current clash's lobby count so the category
// always reflects this clash exactly (e.g. 16-lobby clash -> 8-lobby clash).
async function pruneExtraLobbies(guild, n, category) {
  var removed = 0;
  for (var i = n; i < MAX_LOBBIES; i++) {
    var names = [lobbyTextName(i), lobbyVoiceName(i)];
    for (var k = 0; k < names.length; k++) {
      var nm = names[k];
      var ch = guild.channels.cache.find(function(c) {
        return c.parentId === category.id && c.name === nm;
      });
      if (ch) {
        try { await ch.delete('Prune lobby beyond current clash size'); removed++; }
        catch (e) { console.warn('[lobbies] prune ' + nm + ' failed: ' + ((e && e.message) || e)); }
      }
    }
  }
  return removed;
}

function normalizeLobbies(ts) {
  // savedLobbies holds the actual rosters; lobbies is a fallback. lockedLobbies
  // is just an array of locked indices, so never use it as the roster source.
  if (ts && ts.savedLobbies && ts.savedLobbies.length) return ts.savedLobbies;
  if (ts && ts.lobbies && ts.lobbies.length) return ts.lobbies;
  return [];
}

function lobbyPlayerNames(lobby) {
  if (Array.isArray(lobby) && lobby[0] && lobby[0].name) {
    return lobby.map(function(p) { return p.name; }).filter(Boolean);
  }
  if (lobby && Array.isArray(lobby.players)) {
    return lobby.players.map(function(p) { return p && p.name; }).filter(Boolean);
  }
  return [];
}

async function unpinBotPins(ch, meId) {
  try {
    var pins = await ch.messages.fetchPinned();
    for (var entry of pins) {
      var pin = entry[1];
      if (pin.author && pin.author.id === meId) {
        try { await pin.unpin(); } catch (_e) {}
      }
    }
  } catch (_e) {}
}

async function postLobbyRosters(guild, lobbies, ts, category) {
  var meId = guild.client.user.id;
  for (var i = 0; i < lobbies.length; i++) {
    var name = lobbyTextName(i);
    var ch = guild.channels.cache.find(function(c) {
      return c.type === ChannelType.GuildText && c.parentId === category.id && c.name === name;
    });
    if (!ch) continue;

    await unpinBotPins(ch, meId);

    var letter = letterFor(i);
    var playerNames = lobbyPlayerNames(lobbies[i]);
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

async function postHubBoard(guild, ts, lobbies, category) {
  var hub = guild.channels.cache.find(function(c) {
    return c.type === ChannelType.GuildText && c.parentId === category.id && c.name === HUB_NAME;
  });
  if (!hub) return;

  var meId = guild.client.user.id;
  await unpinBotPins(hub, meId);

  var clashNo = (ts && ts.clashNumber) || '?';
  var total = (ts && ts.totalGames) || 4;
  var lines = [];
  lines.push('# 🔴 Clash #' + clashNo + ' is LIVE');
  lines.push('**' + lobbies.length + ' lobbies · ' + total + ' games** · everyone can watch and chat below.');
  lines.push('');
  for (var i = 0; i < lobbies.length; i++) {
    var name = lobbyTextName(i);
    var ch = guild.channels.cache.find(function(c) {
      return c.type === ChannelType.GuildText && c.parentId === category.id && c.name === name;
    });
    var count = lobbyPlayerNames(lobbies[i]).length;
    lines.push('**Lobby ' + letterFor(i) + '** ' + (ch ? '<#' + ch.id + '>' : '') + ' · ' + count + ' players');
  }
  lines.push('');
  lines.push('Players: check your lobby with `/lobby` · drop end-screens in your lobby channel.');
  lines.push('Live bracket + standings: https://tftclash.com/bracket');

  try {
    var msg = await hub.send({ content: lines.join('\n'), allowedMentions: { parse: [] } });
    try { await msg.pin(); } catch (_e) {}
  } catch (e) {
    console.warn('[lobbies] hub board post failed: ' + ((e && e.message) || e));
  }
}

export async function setupLobbyRound(guild, ts) {
  if (!guild || !ts) return { ok: false, reason: 'missing-args' };
  var lobbies = normalizeLobbies(ts);
  if (!lobbies.length) {
    console.log('[lobbies] setup: no lobbies in tournament state');
    return { ok: false, reason: 'no-lobbies' };
  }
  var n = Math.min(lobbies.length, MAX_LOBBIES);

  var cat = await ensureCategory(guild);
  var hub = await ensureHubChannel(guild, cat.category);
  var lob = await ensureLobbyChannels(guild, n, cat.category);
  var pruned = await pruneExtraLobbies(guild, n, cat.category);
  await postLobbyRosters(guild, lobbies, ts, cat.category);
  await postHubBoard(guild, ts, lobbies, cat.category);

  var created = cat.created + hub.created + lob.created;
  console.log('[lobbies] round setup ok (' + n + ' lobbies, +' + created + ' channels, -' + pruned + ' pruned)');
  return { ok: true, lobbies: n, created: created, pruned: pruned };
}

export async function announceClashEnd(guild, ts) {
  if (!guild) return { ok: false };
  var category = findCategory(guild);
  if (!category) return { ok: false, reason: 'no-category' };
  var hub = guild.channels.cache.find(function(c) {
    return c.type === ChannelType.GuildText && c.parentId === category.id && c.name === HUB_NAME;
  });
  if (!hub) return { ok: false, reason: 'no-hub' };

  var clashNo = (ts && ts.clashNumber) || '?';
  var body = [
    '# 🏁 Clash #' + clashNo + ' complete - GG!',
    'Thanks for playing. Full results + season standings: https://tftclash.com/results',
    'Lobby channels stay open - hang out, share clips, and we will see you next clash.',
  ].join('\n');
  try {
    await hub.send({ content: body, allowedMentions: { parse: [] } });
  } catch (e) {
    console.warn('[lobbies] end announce failed: ' + ((e && e.message) || e));
    return { ok: false };
  }
  return { ok: true };
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

// Manual teardown: wrap up in the hub, then delete the whole category.
export async function closeLobbyRound(guild, ts) {
  if (!guild) return { ok: false, destroyed: 0 };
  await announceClashEnd(guild, ts);
  var res = await clearLobbyChannels(guild);
  return { ok: true, destroyed: res.destroyed, removed: res.destroyed };
}

// Backwards-compat names so existing callers keep working with new semantics.
export var createLobbyChannels = setupLobbyRound;
export var destroyLobbyChannels = closeLobbyRound;
