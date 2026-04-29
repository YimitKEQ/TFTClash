/**
 * roles.js — Discord role sync engine.
 * Syncs rank roles, tier roles, and special roles from Supabase to Discord.
 */

import { supabase } from './supabase.js';

// ─── Role definitions ────────────────────────────────────────────────────────

var RANK_ROLES = ['Challenger', 'Grandmaster', 'Master', 'Diamond', 'Platinum', 'Gold', 'Iron'];
var TIER_ROLES = ['Pro', 'Host'];
var SPECIAL_ROLES = ['Season Champion'];

// All managed roles (bot will add/remove these)
var ALL_MANAGED = [].concat(RANK_ROLES, TIER_ROLES, SPECIAL_ROLES);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findRole(guild, name) {
  return guild.roles.cache.find(function(r) { return r.name === name; });
}

/**
 * Add a role, swallowing 50013 (Missing Permissions) so one bad role
 * doesn't abort the whole sync. Returns true if applied, false otherwise.
 */
async function safeAddRole(member, role, reason) {
  try {
    await member.roles.add(role, reason);
    return true;
  } catch (e) {
    var msg = (e && e.message) || String(e);
    console.warn('[roles] add ' + role.name + ' for ' + (member.user && member.user.tag) + ' failed: ' + msg);
    return false;
  }
}

async function safeRemoveRole(member, role, reason) {
  try {
    await member.roles.remove(role, reason);
    return true;
  } catch (e) {
    var msg = (e && e.message) || String(e);
    console.warn('[roles] remove ' + role.name + ' for ' + (member.user && member.user.tag) + ' failed: ' + msg);
    return false;
  }
}

/**
 * Get a player's subscription tier from user_subscriptions.
 * Returns 'free', 'pro', or 'host'.
 */
async function getPlayerTier(authUserId) {
  if (!authUserId) return 'free';
  var res = await supabase
    .from('user_subscriptions')
    .select('tier,status,current_period_end')
    .eq('user_id', authUserId)
    .limit(1);
  if (res.error || !res.data || !res.data.length) return 'free';
  var sub = res.data[0];
  if (sub.status !== 'active') return 'free';
  if (sub.current_period_end) {
    var grace = 3 * 24 * 60 * 60 * 1000;
    if (new Date(sub.current_period_end).getTime() + grace < Date.now()) return 'free';
  }
  return sub.tier || 'free';
}

/**
 * Check if a player is the season champion.
 */
async function isSeasonChampion(username) {
  try {
    var standings = await supabase
      .from('players')
      .select('username')
      .order('season_pts', { ascending: false })
      .limit(1);
    if (standings.data && standings.data.length && standings.data[0].username === username) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

// ─── Core sync function ──────────────────────────────────────────────────────

/**
 * Sync a single player's Discord roles based on their DB state.
 * @param {import('discord.js').Guild} guild
 * @param {object} player - Player row from DB (needs: username, rank, auth_user_id, discord_user_id)
 * @returns {object} Result with changes made
 */
export async function syncPlayerRoles(guild, player) {
  if (!guild || !player) return { skipped: true, reason: 'missing guild or player' };

  // Find the Discord member
  var discordId = player.discord_user_id;
  if (!discordId) return { skipped: true, reason: 'no discord link for ' + player.username };

  var member;
  try {
    member = await guild.members.fetch(discordId);
  } catch (e) {
    return { skipped: true, reason: player.username + ' not in guild' };
  }

  var changes = { added: [], removed: [], player: player.username };

  // ── Rank role ──────────────────────────────────────────────────────────────
  var targetRank = player.rank || 'Iron';
  // Normalize: if rank isn't in our list, default to closest
  if (RANK_ROLES.indexOf(targetRank) === -1) targetRank = 'Iron';

  for (var i = 0; i < RANK_ROLES.length; i++) {
    var rankName = RANK_ROLES[i];
    var role = findRole(guild, rankName);
    if (!role) continue;

    if (rankName === targetRank) {
      if (!member.roles.cache.has(role.id)) {
        if (await safeAddRole(member, role, 'Rank sync: ' + targetRank)) changes.added.push(rankName);
      }
    } else {
      if (member.roles.cache.has(role.id)) {
        if (await safeRemoveRole(member, role, 'Rank sync: no longer ' + rankName)) changes.removed.push(rankName);
      }
    }
  }

  // ── Tier role (Pro / Host) ─────────────────────────────────────────────────
  var tier = await getPlayerTier(player.auth_user_id);

  var proRole = findRole(guild, 'Pro');
  var hostRole = findRole(guild, 'Host');

  if (tier === 'pro') {
    if (proRole && !member.roles.cache.has(proRole.id)) {
      if (await safeAddRole(member, proRole, 'Tier sync: Pro subscriber')) changes.added.push('Pro');
    }
    if (hostRole && member.roles.cache.has(hostRole.id)) {
      if (await safeRemoveRole(member, hostRole, 'Tier sync: downgraded from Host')) changes.removed.push('Host');
    }
  } else if (tier === 'host') {
    if (hostRole && !member.roles.cache.has(hostRole.id)) {
      if (await safeAddRole(member, hostRole, 'Tier sync: Host subscriber')) changes.added.push('Host');
    }
    // Host gets Pro perks too
    if (proRole && !member.roles.cache.has(proRole.id)) {
      if (await safeAddRole(member, proRole, 'Tier sync: Host includes Pro')) changes.added.push('Pro');
    }
  } else {
    // Free tier — remove paid roles
    if (proRole && member.roles.cache.has(proRole.id)) {
      if (await safeRemoveRole(member, proRole, 'Tier sync: no longer Pro')) changes.removed.push('Pro');
    }
    if (hostRole && member.roles.cache.has(hostRole.id)) {
      if (await safeRemoveRole(member, hostRole, 'Tier sync: no longer Host')) changes.removed.push('Host');
    }
  }

  // ── Season Champion ────────────────────────────────────────────────────────
  var championRole = findRole(guild, 'Season Champion');
  if (championRole) {
    var isChamp = await isSeasonChampion(player.username);
    if (isChamp && !member.roles.cache.has(championRole.id)) {
      if (await safeAddRole(member, championRole, 'Season Champion: #1 in standings')) changes.added.push('Season Champion');
    } else if (!isChamp && member.roles.cache.has(championRole.id)) {
      if (await safeRemoveRole(member, championRole, 'Season Champion: no longer #1')) changes.removed.push('Season Champion');
    }
  }

  // ── Ensure Player role ─────────────────────────────────────────────────────
  var playerRole = findRole(guild, 'Player');
  if (playerRole && !member.roles.cache.has(playerRole.id)) {
    if (await safeAddRole(member, playerRole, 'Auto: linked player')) changes.added.push('Player');
  }

  return changes;
}

/**
 * Sync ALL linked players in the guild.
 * @param {import('discord.js').Guild} guild
 * @returns {object[]} Array of sync results
 */
export async function syncAllRoles(guild) {
  if (!guild) return [];

  // Fetch all players with discord links
  var res = await supabase
    .from('players')
    .select('id,username,rank,auth_user_id,discord_user_id')
    .not('discord_user_id', 'is', null);

  if (res.error || !res.data) {
    console.error('[roles] Failed to fetch players:', res.error);
    return [];
  }

  var results = [];
  for (var i = 0; i < res.data.length; i++) {
    try {
      var result = await syncPlayerRoles(guild, res.data[i]);
      results.push(result);
      if (result.added && (result.added.length || result.removed.length)) {
        console.log('[roles] ' + result.player + ': +[' + result.added.join(',') + '] -[' + result.removed.join(',') + ']');
      }
    } catch (e) {
      console.error('[roles] Error syncing ' + res.data[i].username + ':', e.message);
      results.push({ player: res.data[i].username, error: e.message });
    }
  }

  return results;
}

/**
 * Manually assign a role to a Discord member.
 * @param {import('discord.js').Guild} guild
 * @param {string} memberId - Discord user ID
 * @param {string} roleName - Role name to assign
 * @param {boolean} remove - If true, remove instead of add
 */
export async function manualRoleAssign(guild, memberId, roleName, remove) {
  if (!guild) throw new Error('Guild not found');

  var member;
  try {
    member = await guild.members.fetch(memberId);
  } catch (e) {
    throw new Error('Member not found in guild');
  }

  var role = findRole(guild, roleName);
  if (!role) throw new Error('Role "' + roleName + '" not found');

  if (remove) {
    await member.roles.remove(role, 'Manual removal via dashboard');
    console.log('[roles] Manual: removed ' + roleName + ' from ' + member.user.tag);
    return { action: 'removed', role: roleName, member: member.user.tag };
  } else {
    await member.roles.add(role, 'Manual assignment via dashboard');
    console.log('[roles] Manual: assigned ' + roleName + ' to ' + member.user.tag);
    return { action: 'assigned', role: roleName, member: member.user.tag };
  }
}

/**
 * Get all guild members with their current managed roles.
 * @param {import('discord.js').Guild} guild
 */
export async function getMemberRoles(guild) {
  if (!guild) return [];

  await guild.members.fetch();

  var members = guild.members.cache.map(function(m) {
    if (m.user.bot) return null;
    var roles = m.roles.cache
      .filter(function(r) { return ALL_MANAGED.indexOf(r.name) !== -1; })
      .map(function(r) { return r.name; });
    return {
      id: m.id,
      tag: m.user.tag,
      displayName: m.displayName,
      roles: roles,
      avatar: m.user.displayAvatarURL({ size: 32 }),
    };
  }).filter(Boolean);

  return members;
}

export { RANK_ROLES, TIER_ROLES, SPECIAL_ROLES, ALL_MANAGED };
