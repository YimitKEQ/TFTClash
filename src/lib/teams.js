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
    .select('id, name, tag, region, captain_player_id, logo_url, bio, invite_code, lineup_2v2, lineup_4v4, created_at, archived_at')
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
    .select('id, name, tag, region, captain_player_id, logo_url, bio, invite_code, lineup_2v2, lineup_4v4, created_at, archived_at')
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
    .select('id, name, tag, region, captain_player_id, logo_url, bio, invite_code, lineup_2v2, lineup_4v4, created_at, archived_at')
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
    .select('id, name, tag, region, captain_player_id, logo_url, bio, invite_code, lineup_2v2, lineup_4v4, created_at, archived_at')
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

  // Drop any open registrations for this team in tournaments that have not
  // yet completed. Otherwise the row keeps consuming a slot, blocks the
  // members from joining a different team for the same tournament (mig 100
  // collision check), and leaves stale lineup_player_ids in the system.
  var openRegRes = await supabase
    .from('registrations')
    .select('id, tournament_id, status, tournament:tournaments(phase)')
    .eq('team_id', teamId);
  if (openRegRes.error) throw openRegRes.error;
  var dropIds = (openRegRes.data || [])
    .filter(function(r) {
      var ph = r.tournament && r.tournament.phase;
      return ph === 'registration' || ph === 'check_in' || ph === 'upcoming';
    })
    .map(function(r) { return r.id; });
  if (dropIds.length > 0) {
    var dropRes = await supabase
      .from('registrations')
      .delete()
      .in('id', dropIds);
    if (dropRes.error) throw dropRes.error;
  }

  return teamRes.data;
}

// ─── Writes: tournament registration ────────────────────────────────────────

/**
 * Register a team for a tournament. Acts like an upsert keyed on
 * (tournament_id, team_id) but uses an explicit pre-check + insert/update
 * so it doesn't rely on Postgres being able to infer the partial unique
 * index `registrations_unique_team_per_tournament` from an ON CONFLICT
 * column list — which it can't, because partial indexes require the WHERE
 * predicate to be supplied explicitly and supabase-js has no way to do that.
 *
 * Returns the registration row.
 */
export async function registerTeamForTournament(input) {
  if (!input || !input.tournamentId || !input.teamId || !input.captainPlayerId) {
    throw new Error('tournamentId, teamId, captainPlayerId required.');
  }
  var existing = await supabase
    .from('registrations')
    .select('id, status')
    .eq('tournament_id', input.tournamentId)
    .eq('team_id', input.teamId)
    .maybeSingle();
  if (existing.error) throw existing.error;

  var payload = {
    tournament_id: input.tournamentId,
    team_id: input.teamId,
    player_id: input.captainPlayerId,
    status: input.status || 'registered'
  };

  if (existing.data) {
    var upd = await supabase
      .from('registrations')
      .update({ status: payload.status, player_id: payload.player_id })
      .eq('id', existing.data.id)
      .select('id, status, team_id')
      .single();
    if (upd.error) throw upd.error;
    return upd.data;
  }
  var ins = await supabase
    .from('registrations')
    .insert(payload)
    .select('id, status, team_id')
    .single();
  if (ins.error) throw ins.error;
  return ins.data;
}

/**
 * Captain-side wrapper that does both: register the team AND create RSVP rows
 * for every roster member, then fires bell notifications with deeplinks. This
 * is the preferred entry point from screens; it replaces direct calls to
 * registerTeamForTournament for team events.
 *
 * tournamentName + teamName are passed in so we can put nice copy in the bell
 * without requiring callers to await another fetch.
 */
export async function registerTeamWithRosterRsvps(teamId, tournamentId, tournamentName, teamName) {
  if (!teamId || !tournamentId) throw new Error('teamId and tournamentId required.');
  var rpc = await registerTeamWithRsvps(teamId, tournamentId);

  // Fire per-member RSVP notifications. We do this client-side rather than in
  // the RPC because notifications.insert needs auth.uid() context for RLS, and
  // a SECURITY DEFINER block would lose that. This is best-effort; failures
  // are swallowed so registration always returns success.
  try {
    var memRes = await supabase
      .from('team_members')
      .select('player_id, players!team_members_player_id_fkey(auth_user_id)')
      .eq('team_id', teamId)
      .is('removed_at', null);
    var rsvpsRes = await supabase
      .from('team_event_rsvps')
      .select('id, player_id, status')
      .eq('team_id', teamId)
      .eq('tournament_id', tournamentId);
    var rsvpByPid = {};
    ((rsvpsRes && rsvpsRes.data) || []).forEach(function(r) {
      rsvpByPid[r.player_id] = r;
    });
    var safeT = tournamentName || 'a tournament';
    var safeTeam = teamName || 'your team';
    var deepLink = '/teams';
    ((memRes && memRes.data) || []).forEach(function(m) {
      var rsvp = rsvpByPid[m.player_id];
      if (!rsvp || rsvp.status !== 'pending') return;
      var auth = m.players && m.players.auth_user_id;
      if (!auth) return;
      try {
        createNotification(
          auth,
          'Confirm: ' + safeT,
          safeTeam + ' is registered for ' + safeT + '. Tap to confirm you can play.',
          'group',
          deepLink
        );
      } catch (e) {}
    });
  } catch (e) {
    console.warn('registerTeamWithRosterRsvps notify step failed:', e);
  }

  return rpc;
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

  // Best-effort notification to the invitee. Deeplinks to /teams so they
  // can accept from the bell without having to find the tournament page first.
  var notifyTo = await playerAuthUserId(payload.invitee_player_id);
  if (notifyTo) {
    var teamRes = await supabase.from('teams').select('name').eq('id', payload.team_id).maybeSingle();
    var teamName = teamRes && teamRes.data ? teamRes.data.name : 'a team';
    createNotification(
      notifyTo,
      'Team invite',
      'You have been invited to join ' + teamName + '. Open the Teams page to accept.',
      'group_add',
      '/teams'
    );
  }

  return res.data;
}

export async function respondInvite(inviteId, action, playerId) {
  // action: 'accept' | 'decline' | 'cancel'
  if (!inviteId || !action) throw new Error('inviteId and action required.');
  var nowIso = new Date().toISOString();

  if (action === 'accept') {
    // Read first so we can fire captain notification with the right ids
    // even though the RPC handles the actual mutation atomically.
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

    // SECURITY DEFINER RPC - bypasses captain-only INSERT policy on
    // team_members. Roster triggers (single-active-membership, max-roster,
    // role guard) still fire on the underlying INSERT.
    var rpc = await supabase.rpc('accept_team_invite', { p_invite_id: inviteId });
    if (rpc.error) throw rpc.error;

    notifyCaptainOnInviteResponse(inv.data, 'accepted');

    var data = rpc.data || {};
    return {
      invite: data.invite || { id: inviteId, status: 'accepted' },
      member: data.member || null
    };
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

export async function setMemberRole(memberId, role, callerPlayerId) {
  if (['captain', 'main', 'sub'].indexOf(role) === -1) {
    throw new Error('Invalid role: ' + role);
  }
  // Client-side captain gate. The DB also rejects non-captain role changes
  // via trg_team_members_role_guard (migration 100), but failing fast here
  // gives a cleaner UX and avoids a roundtrip.
  if (callerPlayerId) {
    var memberRow = await supabase
      .from('team_members')
      .select('id, team_id')
      .eq('id', memberId)
      .maybeSingle();
    if (memberRow.error) throw memberRow.error;
    if (!memberRow.data) throw new Error('Member not found.');
    var teamRow = await supabase
      .from('teams')
      .select('captain_player_id')
      .eq('id', memberRow.data.team_id)
      .maybeSingle();
    if (teamRow.error) throw teamRow.error;
    if (!teamRow.data || String(teamRow.data.captain_player_id) !== String(callerPlayerId)) {
      throw new Error('Only the team captain can change member roles.');
    }
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
  // Optional caller-membership gate. When the caller passes their player_id
  // (or is_admin/is_service), we restrict broadcasting to teams the caller
  // belongs to. Defaults to "open" only when the call is server-trusted
  // (e.g. webhook) by passing options.allowAnyTeam = true.
  var callerPlayerId = options.callerPlayerId ? String(options.callerPlayerId) : null;
  var allowAnyTeam = options.allowAnyTeam === true;
  try {
    if (callerPlayerId && !allowAnyTeam) {
      var membership = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', teamId)
        .eq('player_id', callerPlayerId)
        .is('removed_at', null)
        .maybeSingle();
      if (membership.error || !membership.data) {
        console.warn('notifyTeamMembers: caller is not a member of', teamId);
        return;
      }
    }
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

// ─── Writes: invite codes ───────────────────────────────────────────────────

/**
 * Redeem a shareable team invite code. Idempotent: if the caller is already on
 * the team, returns success without inserting a duplicate. Triggers (single
 * active membership, max-roster, role guard) still fire on first acceptance.
 */
export async function acceptInviteByCode(code) {
  if (!code || !String(code).trim()) throw new Error('Invite code required.');
  var res = await supabase.rpc('accept_team_invite_by_code', { p_code: String(code).trim() });
  if (res.error) throw res.error;
  return res.data || {};
}

// ─── Writes: lineup presets ─────────────────────────────────────────────────

/**
 * Save a default lineup preset for the team. p_size = 2 for the Double Up
 * pair, 4 for the Squads starting four. Pass an empty array to clear.
 * Captain-only via DB RPC.
 */
export async function saveLineupPreset(teamId, size, lineupPlayerIds) {
  if (!teamId) throw new Error('teamId required.');
  if (size !== 2 && size !== 4) throw new Error('size must be 2 or 4.');
  var res = await supabase.rpc('update_team_lineup_preset', {
    p_team_id: teamId,
    p_size: size,
    p_lineup: lineupPlayerIds || []
  });
  if (res.error) throw res.error;
  return res.data || {};
}

// ─── Writes: tournament RSVPs ───────────────────────────────────────────────

/**
 * Captain-only. Registers the team for a tournament and creates an RSVP row
 * for every active roster member. Captain is auto-accepted; everyone else is
 * pending. Pair this with createNotification calls in the caller so each
 * roster member sees the RSVP in the notification bell.
 *
 * Returns { registration_id, team_id, tournament_id }.
 */
export async function registerTeamWithRsvps(teamId, tournamentId) {
  if (!teamId || !tournamentId) throw new Error('teamId and tournamentId required.');
  var res = await supabase.rpc('register_team_with_rsvps', {
    p_team_id: teamId,
    p_tournament_id: tournamentId
  });
  if (res.error) throw res.error;
  return res.data || {};
}

/**
 * Player responds to an RSVP. status must be 'accepted' or 'declined'.
 * Only the invited player can respond (enforced server-side).
 */
export async function respondTeamEventRsvp(rsvpId, status) {
  if (!rsvpId || !status) throw new Error('rsvpId and status required.');
  var res = await supabase.rpc('respond_team_event_rsvp', {
    p_rsvp_id: rsvpId,
    p_status: status
  });
  if (res.error) throw res.error;
  return res.data || {};
}

/**
 * List the RSVPs for a (team, tournament). Used in the captain dashboard so
 * captains see who has confirmed before they need to lock the lineup.
 */
export async function listTeamEventRsvps(teamId, tournamentId) {
  if (!teamId || !tournamentId) return [];
  var res = await supabase
    .from('team_event_rsvps')
    .select('id, team_id, tournament_id, player_id, status, responded_at, created_at')
    .eq('team_id', teamId)
    .eq('tournament_id', tournamentId);
  if (res.error) throw res.error;
  return res.data || [];
}

/**
 * List pending RSVPs for the calling player so the bell + Teams screen can
 * surface them. Joins to tournaments and teams for context (name, date).
 */
export async function listMyPendingRsvps(playerId) {
  if (!playerId) return [];
  var res = await supabase
    .from('team_event_rsvps')
    .select('id, team_id, tournament_id, status, created_at, teams!team_event_rsvps_team_id_fkey(id, name, tag), tournaments!team_event_rsvps_tournament_id_fkey(id, name, date, team_size, phase)')
    .eq('player_id', playerId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (res.error) throw res.error;
  return res.data || [];
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

// ─── Phase B: lineup swap, LFT board, ringers ───────────────────────────────

export async function swapTeamLineupPlayer(teamId, tournamentId, outPlayerId, inPlayerId) {
  if (!teamId || !tournamentId || !outPlayerId || !inPlayerId) {
    throw new Error('teamId, tournamentId, outPlayerId, inPlayerId all required.');
  }
  var res = await supabase.rpc('swap_team_lineup_player', {
    p_team_id: teamId,
    p_tournament_id: tournamentId,
    p_out_player_id: outPlayerId,
    p_in_player_id: inPlayerId
  });
  if (res.error) throw res.error;
  return res.data;
}

export async function listLftPosts(filter) {
  var q = supabase
    .from('lft_posts')
    .select('id, player_id, region, formats, message, created_at, expires_at, players!lft_posts_player_id_fkey(id, username, riot_id, region, profile_pic_url)')
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  if (filter && filter.region) q = q.eq('region', filter.region);
  if (filter && filter.format) q = q.contains('formats', [filter.format]);
  var res = await q;
  if (res.error) throw res.error;
  return res.data || [];
}

export async function getMyLftPost(playerId) {
  if (!playerId) return null;
  var res = await supabase
    .from('lft_posts')
    .select('id, player_id, region, formats, message, created_at, expires_at')
    .eq('player_id', playerId)
    .is('archived_at', null)
    .maybeSingle();
  if (res.error && res.error.code !== 'PGRST116') throw res.error;
  return res.data || null;
}

export async function upsertLftPost(input) {
  var region = (input && input.region) || 'EUW';
  var formats = (input && input.formats) || ['2v2', '4v4'];
  var message = (input && input.message) || '';
  var res = await supabase.rpc('upsert_lft_post', {
    p_region: region,
    p_formats: formats,
    p_message: message
  });
  if (res.error) throw res.error;
  return res.data;
}

export async function archiveMyLftPost(postId) {
  if (!postId) throw new Error('postId required.');
  var res = await supabase.rpc('archive_lft_post', { p_id: postId });
  if (res.error) throw res.error;
  return res.data;
}

export async function listTeamRingers(teamId, tournamentId) {
  if (!teamId) return [];
  var q = supabase
    .from('team_event_ringers')
    .select('id, team_id, tournament_id, player_id, status, message, created_at, responded_at, players!team_event_ringers_player_id_fkey(id, username, riot_id, region, profile_pic_url)')
    .eq('team_id', teamId);
  if (tournamentId) q = q.eq('tournament_id', tournamentId);
  var res = await q;
  if (res.error) throw res.error;
  return res.data || [];
}

export async function listMyRingerInvites(playerId) {
  if (!playerId) return [];
  var res = await supabase
    .from('team_event_ringers')
    .select('id, team_id, tournament_id, status, message, created_at, teams!team_event_ringers_team_id_fkey(id, name, tag, logo_url), tournaments!team_event_ringers_tournament_id_fkey(id, name, team_size, phase, scheduled_at)')
    .eq('player_id', playerId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (res.error) throw res.error;
  return res.data || [];
}

export async function inviteTeamRinger(teamId, tournamentId, playerId, message) {
  if (!teamId || !tournamentId || !playerId) {
    throw new Error('teamId, tournamentId, playerId required.');
  }
  var res = await supabase.rpc('invite_team_ringer', {
    p_team_id: teamId,
    p_tournament_id: tournamentId,
    p_player_id: playerId,
    p_message: message || ''
  });
  if (res.error) throw res.error;
  return res.data;
}

export async function respondTeamRingerInvite(ringerId, status) {
  if (!ringerId || !status) throw new Error('ringerId and status required.');
  var res = await supabase.rpc('respond_team_ringer_invite', {
    p_ringer_id: ringerId,
    p_status: status
  });
  if (res.error) throw res.error;
  return res.data;
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
