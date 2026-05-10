/**
 * clashLiveRole.js — single managed role that gates visibility of the
 * persistent /lobby channels during a live clash.
 *
 * Lifecycle: granted to every linked, active registrant when the tournament
 * goes live; revoked from everyone ~30 min after the tournament completes.
 * Channels persist between tournaments — only role membership cycles.
 */

import { supabase } from './supabase.js';

export var CLASH_LIVE_ROLE = 'Clash Live';

export async function ensureClashLiveRole(guild) {
  if (!guild) return null;
  var role = guild.roles.cache.find(function(r) { return r.name === CLASH_LIVE_ROLE; });
  if (role) return role;
  try {
    role = await guild.roles.create({
      name: CLASH_LIVE_ROLE,
      color: 0xC0392B,
      mentionable: false,
      reason: 'Gates visibility of persistent lobby channels during live clashes.',
    });
    console.log('[clashLive] created role');
    return role;
  } catch (e) {
    console.error('[clashLive] ensure failed: ' + ((e && e.message) || e));
    return null;
  }
}

async function fetchActiveDiscordIds(ts) {
  if (!ts) return [];
  var query = supabase.from('registrations').select('player_id, team_id, status');
  if (ts.dbTournamentId) query = query.eq('tournament_id', ts.dbTournamentId);
  var regs = await query;
  if (regs.error || !regs.data) return [];

  var rows = regs.data.filter(function(r) {
    var s = r.status || '';
    return s !== 'dropped' && s !== 'no_show' && s !== 'cancelled' && s !== 'declined';
  });
  var directPids = [];
  var teamIds = [];
  rows.forEach(function(r) {
    if (r.player_id) directPids.push(r.player_id);
    if (r.team_id) teamIds.push(r.team_id);
  });

  var teamPids = [];
  if (teamIds.length) {
    var memRes = await supabase
      .from('team_members')
      .select('player_id')
      .in('team_id', teamIds)
      .is('removed_at', null);
    if (memRes.data) memRes.data.forEach(function(m) { if (m.player_id) teamPids.push(m.player_id); });
  }

  var allPids = directPids.concat(teamPids);
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

export async function grantClashLiveToActive(guild, ts) {
  var role = await ensureClashLiveRole(guild);
  if (!role) return { added: 0, considered: 0 };
  var ids = await fetchActiveDiscordIds(ts);
  var added = 0;
  for (var i = 0; i < ids.length; i++) {
    var did = ids[i];
    var member = null;
    try { member = await guild.members.fetch(did); } catch (_e) { continue; }
    if (!member || member.roles.cache.has(role.id)) continue;
    try {
      await member.roles.add(role, 'Clash live: tournament participant');
      added++;
    } catch (e) {
      console.warn('[clashLive] add failed for ' + (member.user && member.user.tag) + ': ' + ((e && e.message) || e));
    }
  }
  console.log('[clashLive] granted to ' + added + '/' + ids.length + ' linked members');
  return { added: added, considered: ids.length };
}

export async function revokeAllClashLive(guild) {
  var role = await ensureClashLiveRole(guild);
  if (!role) return { removed: 0 };
  try { await guild.members.fetch(); } catch (_e) {}
  var holders = guild.members.cache.filter(function(m) { return m.roles.cache.has(role.id); });
  var removed = 0;
  for (var entry of holders) {
    var holder = entry[1];
    try {
      await holder.roles.remove(role, 'Clash live: tournament ended');
      removed++;
    } catch (e) {
      console.warn('[clashLive] remove failed for ' + (holder.user && holder.user.tag) + ': ' + ((e && e.message) || e));
    }
  }
  console.log('[clashLive] revoked from ' + removed + ' members');
  return { removed: removed };
}
