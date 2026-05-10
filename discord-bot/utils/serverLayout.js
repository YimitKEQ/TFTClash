/**
 * serverLayout.js — improvement-only audit of the existing Discord guild.
 *
 * No DESIRED_LAYOUT, no creation. The previous version added categories /
 * channels the host never wanted. This module now describes what's there
 * and flags duplicates / orphans so they can be cleaned up in place.
 *
 * Public surface:
 *   scanGuild(guild)               -> { categories: [{name, channels:[]}], orphans: [] }
 *   findDuplicates(guild)          -> [{ name, channels:[{id,name,parentName}] }]
 *   cleanupOrphanDuplicates(guild) -> { deleted: [], skipped: [], errors: [] }
 *
 * Per-tournament + lobby categories are excluded from audits because they're
 * owned by other modules (customTournamentChannels.js, lobbies.js).
 */

import { ChannelType } from 'discord.js';

export var TOURNAMENT_CATEGORY_PATTERN = /🏆\s.*#[a-f0-9]{6,}/i;
export var LIVE_CLASH_CATEGORY = '🔴 LIVE CLASH';

function isOwnedCategory(name) {
  if (!name) return false;
  if (TOURNAMENT_CATEGORY_PATTERN.test(name)) return true;
  if (name === LIVE_CLASH_CATEGORY) return true;
  if (/CLASH\s*LIVE/i.test(name)) return true;
  return false;
}

function isTextLike(t) {
  return t === ChannelType.GuildText || t === ChannelType.GuildForum || t === ChannelType.GuildAnnouncement;
}

function normName(s) {
  if (!s) return '';
  // Strip common decorations + emoji + lowercase. Used for duplicate detection.
  return String(s)
    .replace(/[\u{1F000}-\u{1FFFF}\u2000-\u27FF\u2900-\u297F\u2B00-\u2BFF\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[─\-\s\.\u00B7\u2022\uFF65・]/g, '')
    .toLowerCase();
}

/**
 * Read-only snapshot of the guild grouped by category. Includes orphans
 * (text/forum channels with no parentId).
 */
export function scanGuild(guild) {
  if (!guild) return { categories: [], orphans: [], hidden: 0 };

  var byParent = {};
  var orphans = [];
  var hiddenCategoryCount = 0;

  // First pass: collect categories
  for (var pair of guild.channels.cache) {
    var ch = pair[1];
    if (ch.type !== ChannelType.GuildCategory) continue;
    if (isOwnedCategory(ch.name)) { hiddenCategoryCount += 1; continue; }
    byParent[ch.id] = { id: ch.id, name: ch.name, position: ch.position, channels: [] };
  }

  // Second pass: assign children
  for (var pair2 of guild.channels.cache) {
    var ch2 = pair2[1];
    if (!isTextLike(ch2.type)) continue;
    if (!ch2.parentId) {
      orphans.push({ id: ch2.id, name: ch2.name, type: ch2.type });
      continue;
    }
    var bucket = byParent[ch2.parentId];
    if (!bucket) continue; // parent is a hidden owned category
    bucket.channels.push({ id: ch2.id, name: ch2.name, type: ch2.type, position: ch2.position });
  }

  var categories = Object.values(byParent).sort(function(a, b) { return a.position - b.position; });
  categories.forEach(function(c) {
    c.channels.sort(function(a, b) { return a.position - b.position; });
  });

  return { categories: categories, orphans: orphans, hidden: hiddenCategoryCount };
}

/**
 * Find channels that share a normalized name (case/emoji-insensitive).
 * Returns one entry per duplicate group.
 */
export function findDuplicates(guild) {
  if (!guild) return [];
  var groups = {};
  for (var pair of guild.channels.cache) {
    var ch = pair[1];
    if (!isTextLike(ch.type)) continue;
    var key = normName(ch.name);
    if (!key) continue;
    if (!groups[key]) groups[key] = [];
    var parentName = null;
    if (ch.parentId) {
      var parent = guild.channels.cache.get(ch.parentId);
      if (parent) parentName = parent.name;
    }
    groups[key].push({ id: ch.id, name: ch.name, parentName: parentName, parentId: ch.parentId || null });
  }
  var dupes = [];
  Object.keys(groups).forEach(function(k) {
    if (groups[k].length > 1) dupes.push({ name: groups[k][0].name, channels: groups[k] });
  });
  return dupes;
}

/**
 * Delete channels that are duplicates of an already-categorized channel AND
 * have no parent category themselves (orphans). Conservative — only removes
 * the orphan copy when a categorized twin exists.
 */
export async function cleanupOrphanDuplicates(guild) {
  var result = { deleted: [], skipped: [], errors: [] };
  if (!guild) {
    result.errors.push('no guild');
    return result;
  }
  var dupes = findDuplicates(guild);
  for (var group of dupes) {
    var orphan = group.channels.find(function(c) { return !c.parentId; });
    var anchored = group.channels.find(function(c) { return !!c.parentId; });
    if (!orphan || !anchored) {
      result.skipped.push({ name: group.name, reason: 'no orphan/anchor split' });
      continue;
    }
    try {
      var ch = guild.channels.cache.get(orphan.id);
      if (!ch) { result.skipped.push({ name: group.name, reason: 'cache miss' }); continue; }
      await ch.delete('TFT Clash bot — /layout cleanup-orphans (duplicate of #' + anchored.name + ')');
      result.deleted.push({ name: orphan.name, id: orphan.id });
    } catch (e) {
      result.errors.push(orphan.name + ': ' + ((e && e.message) || e));
    }
  }
  return result;
}
