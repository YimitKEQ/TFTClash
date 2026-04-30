/**
 * Teams data layer for the 4v4 ("Squads") format.
 *
 * Maps to migration 085_squads_teams.sql tables: teams, team_members, team_invites.
 * All writes assume the caller is authenticated and have player_id resolution
 * via the captain check on RLS policies. Soft-delete on disband (archived_at)
 * and on member removal (removed_at) keeps tournament history intact.
 *
 * Roles: 'captain' (1 per team), 'main' (regular roster), 'sub' (bench).
 * Active roster cap = 6 (4 main + 2 sub) enforced by DB trigger.
 */
import { supabase } from './supabase.js';
import { createNotification } from './notifications.js';

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function listTeams(filter) {
  var q = supabase
    .from('teams')
    .select('id, name, tag, region, captain_player_id, logo_url, bio, created_at, archived_at')
    .order('created_at', { ascending: false });

  if (!filter || filter.includeArchived !== true) {
    q = q.is('archived_at', null);
  }
  if (filter && filter.region) {
    q = q.eq('region', filter.region);
  }
  var res = await q;
  if (res.error) throw res.error;
  return res.data || [];
}

export async function getTeamWithRoster(teamId) {
  if (!teamId) return null;
  var teamRes = await supabase
    .from('teams')
    .select('id, name, tag, region, captain_player_id, logo_url, bio, created_at, archived_at')
    .eq('id', teamId)
    .maybeSingle();
  if (teamRes.error) throw teamRes.error;
  if (!teamRes.data) return null;

  var membersRes = await supabase
    .from('team_members')
    .select('id, player_id, role, joined_at, removed_at, removed_reason')
    .eq('team_id', teamId)
    .is('removed_at', null)
    .order('joined_at', { ascending: true });
  if (membersRes.error) throw membersRes.error;

  var playerIds = (membersRes.data || []).map(function(m) { return m.player_id; });
  var playersById = {};
  if (playerIds.length) {
    var playersRes = await supabase
      .from('players')
      .select('id, username, riot_id, region, rank, profile_pic_url')
      .in('id', playerIds);
    if (playersRes.error) throw playersRes.error;
    (playersRes.data || []).forEach(function(p) { playersById[p.id] = p; });
  }

  var members = (membersRes.data || []).map(function(m) {
    return Object.assign({}, m, { player: playersById[m.player_id] || null });
  });

  return Object.assign({}, teamRes.data, { members: members });
}

export async function getMyTeam(playerId) {
  if (!playerId) return null;
  var memRes = await supabase
    .from('team_members')
    .select('team_id, role')
    .eq('player_id', playerId)
    .is('removed_at', null)
    .maybeSingle();
  if (memRes.error) throw memRes.error;
  if (!memRes.data) return null;
  return getTeamWithRoster(memRes.data.team_id);
}

export async function listMyInvites(playerId) {
  if (!playerId) return [];
  var res = await supabase
    .from('team_invites')
    .select('id, team_id, inviter_player_id, status, message, expires_at, created_at')
    .eq('invitee_player_id', playerId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (res.error) throw res.error;
  return res.data || [];
}

export async function listTeamSentInvites(teamId) {
  if (!teamId) return [];
  var res = await supabase
    .from('team_invites')
    .select('id, team_id, invitee_player_id, inviter_player_id, status, message, expires_at, created_at')
    .eq('team_id', teamId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (res.error) throw res.error;
  var rows = res.data || [];
  if (rows.length === 0) return rows;
  var ids = rows.map(function(r){ return r.invitee_player_id; });
  var pRes = await supabase
    .from('players')
    .select('id, username, riot_id, region, rank')
    .in('id', ids);
  if (pRes.error) return rows;
  var byId = {};
  (pRes.data || []).forEach(function(p){ byId[p.id] = p; });
  return rows.map(function(r){ return Object.assign({}, r, { invitee: byId[r.invitee_player_id] || null }); });
}

export async function getTeamTournamentHistory(teamId) {
  if (!teamId) return [];
  var regsRes = await supabase
    .from('registrations')
    .select('id, status, lineup_player_ids, tournament:tournaments!registrations_tournament_id_fkey(id, name, phase, team_size, date, status)')
    .eq('team_id', teamId)
    .order('id', { ascending: false });
  if (regsRes.error) throw regsRes.error;
  var regs = regsRes.data || [];
  if (regs.length === 0) return [];
  var tIds = regs.map(function(r){ return r.tournament && r.tournament.id; }).filter(Boolean);
  if (tIds.length === 0) return regs.map(function(r){ return Object.assign({}, r, { totalPts: 0 }); });
  var gRes = await supabase
    .from('game_results')
    .select('tournament_id, points')
    .eq('team_id', teamId)
    .in('tournament_id', tIds);
  if (gRes.error) return regs.map(function(r){ return Object.assign({}, r, { totalPts: 0 }); });
  var ptsByT = {};
  (gRes.data || []).forEach(function(g){
    if (!g.tournament_id) return;
    ptsByT[g.tournament_id] = (ptsByT[g.tournament_id] || 0) + (g.points || 0);
  });
  return regs.map(function(r){
    var tid = r.tournament && r.tournament.id;
    return Object.assign({}, r, { totalPts: tid ? (ptsByT[tid] || 0) : 0 });
  });
}

// ─── Writes: team lifecycle ─────────────────────────────────────────────────

export async function createTeam(input) {
  var payload = {
    name: String(input.name || '').trim(),
    tag: input.tag ? String(input.tag).trim().slice(0, 6) : null,
    region: input.region || 'EUW',
    captain_player_id: input.captainPlayerId,
    logo_url: input.logoUrl || null,
    bio: input.bio || ''
  };
  if (!payload.name) throw new Error('Team name is required.');
  if (!payload.captain_player_id) throw new Error('Captain player id is required.');

  var res = await supabase
    .from('teams')
    .insert(payload)
    .select('id, name, tag, region, captain_player_id, logo_url, bio, created_at, archived_at')
    .single();
  if (res.error) throw res.error;
  return res.data;
}

export async function updateTeamProfile(teamId, patch) {
  var allowed = {};
  if (patch.name !== undefined)    allowed.name    = String(patch.name).trim();
  if (patch.tag !== undefined)     allowed.tag     = patch.tag ? String(patch.tag).trim().slice(0, 6) : null;
  if (patch.region !== undefined)  allowed.region  = patch.region;
  if (patch.logoUrl !== undefined) allowed.logo_url = patch.logoUrl;
  if (patch.bio !== undefined)     allowed.bio     = patch.bio || '';
  if (Object.keys(allowed).length === 0) return null;

  var res = await supabase
    .from('teams')
    .update(allowed)
    .eq('id', teamId)
    .select('id, name, tag, region, captain_player_id, logo_url, bio, created_at, archived_at')
    .single();
  if (res.error) throw res.error;
  return res.data;
}

export async function disbandTeam(teamId, reason) {
  // Soft-delete: archive the team. Active members get removed_at stamped so
  // their cooldown starts. We do this in two steps because we don't have a
  // transaction primitive client-side; the captain trigger blocks captain
  // self-removal so we archive the team first, then remove members.
  var nowIso = new Date().toISOString();
  var teamRes = await supabase
    .from('teams')
    .update({ archived_at: nowIso })
    .eq('id', teamId)
    .select('id, captain_player_id')
    .single();
  if (teamRes.error) throw teamRes.error;

  var memRes = await supabase
    .from('team_members')
    .update({ removed_at: nowIso, removed_reason: reason || 'team_disbanded' })
    .eq('team_id', teamId)
    .is('removed_at', null);
  if (memRes.error) throw memRes.error;

  // Cancel any pending invites - they cannot be accepted into an archived team.
  var inviteRes = await supabase
    .from('team_invites')
    .update({ status: 'cancelled' })
    .eq('team_id', teamId)
    .eq('status', 'pending');
  if (inviteRes.error) throw inviteRes.error;

  return teamRes.data;
}

// ─── Writes: invites ────────────────────────────────────────────────────────

export async function sendInvite(input) {
  var payload = {
    team_id: input.teamId,
    invitee_player_id: input.inviteePlayerId,
    inviter_player_id: input.inviterPlayerId,
    message: input.message || ''
  };
  if (!payload.team_id || !payload.invitee_player_id || !payload.inviter_player_id) {
    throw new Error('Missing team / invitee / inviter id on sendInvite.');
  }

  var res = await supabase
    .from('team_invites')
    .insert(payload)
    .select('id, team_id, invitee_player_id, inviter_player_id, status, message, expires_at, created_at')
    .single();
  if (res.error) throw res.error;

  // Best-effort notification to the invitee.
  var notifyTo = await playerAuthUserId(payload.invitee_player_id);
  if (notifyTo) {
    var teamRes = await supabase.from('teams').select('name').eq('id', payload.team_id).maybeSingle();
    var teamName = teamRes && teamRes.data ? teamRes.data.name : 'a team';
    createNotification(
      notifyTo,
      'Team invite',
      'You\'ve been invited to ' + teamName + '.',
      'group_add'
    );
  }

  return res.data;
}

export async function respondInvite(inviteId, action, playerId) {
  // action: 'accept' | 'decline' | 'cancel'
  if (!inviteId || !action) throw new Error('inviteId and action required.');
  var nowIso = new Date().toISOString();

  if (action === 'accept') {
    var inv = await supabase
      .from('team_invites')
      .select('id, team_id, invitee_player_id, inviter_player_id, status')
      .eq('id', inviteId)
      .single();
    if (inv.error) throw inv.error;
    if (inv.data.status !== 'pending') throw new Error('Invite is no longer pending.');
    if (playerId && inv.data.invitee_player_id !== playerId) {
      throw new Error('Only the invitee can accept.');
    }

    var addRes = await supabase
      .from('team_members')
      .insert({ team_id: inv.data.team_id, player_id: inv.data.invitee_player_id, role: 'main' })
      .select('id, team_id, player_id, role, joined_at')
      .single();
    if (addRes.error) throw addRes.error;

    var statusRes = await supabase
      .from('team_invites')
      .update({ status: 'accepted', responded_at: nowIso })
      .eq('id', inviteId);
    if (statusRes.error) throw statusRes.error;

    // Notify the captain that their invitee accepted.
    notifyCaptainOnInviteResponse(inv.data, 'accepted');

    return { invite: { id: inviteId, status: 'accepted' }, member: addRes.data };
  }

  var newStatus = action === 'cancel' ? 'cancelled' : 'declined';
  var beforeRes = await supabase
    .from('team_invites')
    .select('id, team_id, invitee_player_id, inviter_player_id, status')
    .eq('id', inviteId)
    .maybeSingle();
  var res = await supabase
    .from('team_invites')
    .update({ status: newStatus, responded_at: nowIso })
    .eq('id', inviteId)
    .select('id, status')
    .single();
  if (res.error) throw res.error;
  if (beforeRes && beforeRes.data && action === 'decline') {
    notifyCaptainOnInviteResponse(beforeRes.data, 'declined');
  }
  return { invite: res.data, member: null };
}

// ─── Writes: roster management ──────────────────────────────────────────────

export async function setMemberRole(memberId, role) {
  if (['captain', 'main', 'sub'].indexOf(role) === -1) {
    throw new Error('Invalid role: ' + role);
  }
  var res = await supabase
    .from('team_members')
    .update({ role: role })
    .eq('id', memberId)
    .select('id, team_id, player_id, role')
    .single();
  if (res.error) throw res.error;
  return res.data;
}

export async function transferCaptaincy(teamId, fromMemberId, toMemberId) {
  // Two-step: demote old captain to 'main', promote new member, update teams row.
  var demote = await supabase
    .from('team_members')
    .update({ role: 'main' })
    .eq('id', fromMemberId)
    .select('id, player_id, team_id')
    .single();
  if (demote.error) throw demote.error;

  var promote = await supabase
    .from('team_members')
    .update({ role: 'captain' })
    .eq('id', toMemberId)
    .select('id, player_id, team_id')
    .single();
  if (promote.error) throw promote.error;

  var teamRes = await supabase
    .from('teams')
    .update({ captain_player_id: promote.data.player_id })
    .eq('id', teamId)
    .select('id, captain_player_id')
    .single();
  if (teamRes.error) throw teamRes.error;

  return { team: teamRes.data, newCaptainMemberId: toMemberId };
}

export async function leaveTeam(memberId, reason) {
  var nowIso = new Date().toISOString();
  var res = await supabase
    .from('team_members')
    .update({ removed_at: nowIso, removed_reason: reason || 'left_voluntarily' })
    .eq('id', memberId)
    .select('id, team_id, player_id, removed_at')
    .single();
  if (res.error) throw res.error;
  return res.data;
}

export async function kickMember(memberId, reason) {
  // Look up the member first so we can notify them after the row update.
  var memRes = await supabase
    .from('team_members')
    .select('id, team_id, player_id')
    .eq('id', memberId)
    .maybeSingle();
  var result = await leaveTeam(memberId, reason || 'kicked');
  if (memRes && memRes.data) {
    var teamRes = await supabase.from('teams').select('name').eq('id', memRes.data.team_id).maybeSingle();
    var teamName = teamRes && teamRes.data ? teamRes.data.name : 'your team';
    var authId = await playerAuthUserId(memRes.data.player_id);
    if (authId) {
      createNotification(
        authId,
        'Removed from team',
        'You were removed from ' + teamName + '.',
        'person_remove'
      );
    }
  }
  return result;
}

/**
 * Send a notification to every active member of a team. Used for tournament
 * registration, check-in, lineup changes, and admin overrides — anything where
 * the team as a whole should hear about it, not just the captain.
 *
 * options: { excludePlayerIds?: string[] } — omit specific player IDs (e.g.
 * suppress sending to the actor, or to non-starters).
 */
export async function notifyTeamMembers(teamId, title, body, icon, options) {
  if (!teamId || !title) return;
  options = options || {};
  var exclude = (options.excludePlayerIds || []).map(String);
  try {
    var memRes = await supabase
      .from('team_members')
      .select('player_id, players(auth_user_id)')
      .eq('team_id', teamId)
      .is('removed_at', null);
    if (memRes.error || !memRes.data) return;
    memRes.data.forEach(function(m) {
      if (!m.player_id) return;
      if (exclude.indexOf(String(m.player_id)) !== -1) return;
      var auth = m.players && m.players.auth_user_id;
      if (!auth) return;
      try {
        createNotification(auth, title, body, icon || 'group');
      } catch (e) {}
    });
  } catch (err) {
    console.warn('notifyTeamMembers failed:', err);
  }
}

// ─── Internals ──────────────────────────────────────────────────────────────

async function notifyCaptainOnInviteResponse(invite, outcome) {
  if (!invite || !invite.team_id || !invite.inviter_player_id) return;
  try {
    var teamRes = await supabase.from('teams').select('name').eq('id', invite.team_id).maybeSingle();
    var inviteeRes = await supabase.from('players').select('username').eq('id', invite.invitee_player_id).maybeSingle();
    var captainAuth = await playerAuthUserId(invite.inviter_player_id);
    if (!captainAuth) return;
    var teamName = teamRes && teamRes.data ? teamRes.data.name : 'your team';
    var inviteeName = inviteeRes && inviteeRes.data ? inviteeRes.data.username : 'A player';
    var verb = outcome === 'accepted' ? 'accepted' : 'declined';
    var icon = outcome === 'accepted' ? 'check_circle' : 'cancel';
    createNotification(
      captainAuth,
      'Invite ' + verb,
      inviteeName + ' ' + verb + ' the invite to ' + teamName + '.',
      icon
    );
  } catch (err) {
    console.warn('notifyCaptainOnInviteResponse failed:', err);
  }
}

async function playerAuthUserId(playerId) {
  if (!playerId) return null;
  var res = await supabase
    .from('players')
    .select('auth_user_id')
    .eq('id', playerId)
    .maybeSingle();
  if (res.error) return null;
  return res.data ? res.data.auth_user_id : null;
}
