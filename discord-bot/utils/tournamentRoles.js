/**
 * tournamentRoles.js — Per-tournament Discord role management.
 *
 * Each non-season tournament gets its own mentionable role at check_in/in_progress.
 * The role is auto-assigned to every linked, non-dropped registrant (including
 * team members for team tournaments) and removed when the tournament completes.
 *
 * Use the role mention instead of @everyone so only relevant players get pinged.
 */

import { supabase } from './supabase.js';

function shortIdFor(tournamentId) {
  return String(tournamentId || '').replace(/-/g, '').slice(-8);
}

function roleMarkerFor(tournamentId) {
  return '#' + shortIdFor(tournamentId);
}

export function tournamentRoleNameFor(tournament) {
  var label = tournament && tournament.name ? tournament.name : 'Tournament';
  var marker = roleMarkerFor(tournament && tournament.id);
  var suffix = ' ' + marker;
  // Discord role name max is 100 chars; leave a little slack.
  var maxLabel = 90 - suffix.length;
  var safeLabel = String(label).slice(0, maxLabel);
  return ('🏆 ' + safeLabel + suffix).slice(0, 95);
}

export function findTournamentRole(guild, tournamentId) {
  if (!guild || !tournamentId) return null;
  var marker = roleMarkerFor(tournamentId);
  return guild.roles.cache.find(function(r) {
    return r.name && r.name.indexOf(marker) !== -1;
  }) || null;
}

export async function ensureTournamentRole(guild, tournament) {
  if (!guild || !tournament || !tournament.id) return null;
  var existing = findTournamentRole(guild, tournament.id);
  if (existing) return existing;
  try {
    var role = await guild.roles.create({
      name: tournamentRoleNameFor(tournament),
      color: 0xE8A838,
      mentionable: true,
      reason: 'Tournament role for "' + (tournament.name || tournament.id) + '"',
    });
    console.log('[tournamentRoles] Created role for "' + (tournament.name || tournament.id) + '"');
    return role;
  } catch (e) {
    console.error('[tournamentRoles] Failed to create role:', e && e.message);
    return null;
  }
}

/**
 * Returns the set of Discord user IDs that should currently hold the tournament
 * role: any linked player whose registration is still active (not dropped /
 * no_show / cancelled), including team members for team registrations.
 */
async function fetchActiveDiscordIds(tournamentId) {
  var regsRes = await supabase
    .from('registrations')
    .select('player_id, team_id, status')
    .eq('tournament_id', tournamentId);
  if (regsRes.error || !regsRes.data) return [];

  var rows = regsRes.data.filter(function(r) {
    var s = r.status || '';
    return s !== 'dropped' && s !== 'no_show' && s !== 'cancelled' && s !== 'declined';
  });

  var directPids = [];
  var teamIds = [];
  rows.forEach(function(r) {
    if (r.player_id) directPids.push(r.player_id);
    if (r.team_id) teamIds.push(r.team_id);
  });

  var teamMemberPids = [];
  if (teamIds.length) {
    var memRes = await supabase
      .from('team_members')
      .select('player_id')
      .in('team_id', teamIds)
      .is('removed_at', null);
    if (memRes.data) {
      memRes.data.forEach(function(m) { if (m.player_id) teamMemberPids.push(m.player_id); });
    }
  }

  var allPids = directPids.concat(teamMemberPids);
  if (allPids.length === 0) return [];

  var pRes = await supabase
    .from('players')
    .select('id, discord_user_id')
    .in('id', allPids)
    .not('discord_user_id', 'is', null);
  if (pRes.error || !pRes.data) return [];

  var dids = {};
  pRes.data.forEach(function(p) { if (p.discord_user_id) dids[p.discord_user_id] = true; });
  return Object.keys(dids);
}

/**
 * Reconcile role membership: add the role to every active linked registrant,
 * remove it from anyone holding it who no longer belongs.
 */
export async function syncTournamentRoleMembers(guild, tournament) {
  if (!guild || !tournament || !tournament.id) return { added: 0, removed: 0, skipped: true };
  var role = await ensureTournamentRole(guild, tournament);
  if (!role) return { added: 0, removed: 0, skipped: true };

  var desiredIds = await fetchActiveDiscordIds(tournament.id);
  var desiredSet = {};
  desiredIds.forEach(function(d) { desiredSet[d] = true; });

  var added = 0;
  var removed = 0;

  for (var i = 0; i < desiredIds.length; i++) {
    var did = desiredIds[i];
    var member = null;
    try {
      member = await guild.members.fetch(did);
    } catch (_e) {
      continue;
    }
    if (!member || member.roles.cache.has(role.id)) continue;
    try {
      await member.roles.add(role, 'Tournament participant: ' + (tournament.name || tournament.id));
      added++;
    } catch (e) {
      console.warn('[tournamentRoles] add failed for ' + (member.user && member.user.tag) + ': ' + (e && e.message));
    }
  }

  try { await guild.members.fetch(); } catch (_e) {}
  var holders = guild.members.cache.filter(function(m) { return m.roles.cache.has(role.id); });
  for (var entry of holders) {
    var holder = entry[1];
    if (desiredSet[holder.id]) continue;
    try {
      await holder.roles.remove(role, 'No longer registered for tournament');
      removed++;
    } catch (e) {
      console.warn('[tournamentRoles] remove failed for ' + (holder.user && holder.user.tag) + ': ' + (e && e.message));
    }
  }

  console.log('[tournamentRoles] Sync for "' + (tournament.name || tournament.id) + '": +' + added + ' / -' + removed);
  return { added: added, removed: removed };
}

export async function destroyTournamentRole(guild, tournamentId) {
  if (!guild || !tournamentId) return { destroyed: false };
  var role = findTournamentRole(guild, tournamentId);
  if (!role) return { destroyed: false };
  try {
    await role.delete('Tournament ended - cleanup');
    console.log('[tournamentRoles] Destroyed role for tournament ' + tournamentId);
    return { destroyed: true };
  } catch (e) {
    console.error('[tournamentRoles] Failed to delete role:', e && e.message);
    return { destroyed: false };
  }
}
