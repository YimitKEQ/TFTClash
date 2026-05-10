/**
 * standby.js — opt-in standby pool for tournaments. When a registered player
 * is DQ'd as a no-show, the oldest standby player is auto-promoted into a
 * real registration via the claim_standby_seat RPC (atomic, FOR UPDATE).
 */

import { supabase } from './supabase.js';

/**
 * Add a player to the standby pool for a tournament.
 * Returns { ok: boolean, reason?: string, position?: number }.
 */
export async function joinStandby(tournamentId, playerId, source) {
  if (!tournamentId || !playerId) return { ok: false, reason: 'missing-args' };

  // If already registered, no point standing by.
  var regRes = await supabase
    .from('registrations')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('player_id', playerId)
    .maybeSingle();
  if (regRes.data) return { ok: false, reason: 'already_registered' };

  var ins = await supabase
    .from('standby_pool')
    .upsert({ tournament_id: tournamentId, player_id: playerId, source: source || 'self' }, { onConflict: 'tournament_id,player_id' });
  if (ins.error) {
    console.warn('[standby] joinStandby insert failed: ' + ins.error.message);
    return { ok: false, reason: 'insert_failed' };
  }

  var pos = await standbyPosition(tournamentId, playerId);
  return { ok: true, position: pos };
}

export async function leaveStandby(tournamentId, playerId) {
  if (!tournamentId || !playerId) return { ok: false };
  var del = await supabase
    .from('standby_pool')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('player_id', playerId);
  if (del.error) {
    console.warn('[standby] leaveStandby failed: ' + del.error.message);
    return { ok: false };
  }
  return { ok: true };
}

export async function standbyPosition(tournamentId, playerId) {
  if (!tournamentId || !playerId) return null;
  var res = await supabase
    .from('standby_pool')
    .select('player_id,opted_in_at')
    .eq('tournament_id', tournamentId)
    .order('opted_in_at', { ascending: true });
  if (res.error || !res.data) return null;
  for (var i = 0; i < res.data.length; i++) {
    if (res.data[i].player_id === playerId) return i + 1;
  }
  return null;
}

export async function listStandby(tournamentId) {
  if (!tournamentId) return [];
  var res = await supabase
    .from('standby_pool')
    .select('player_id,opted_in_at,players(username,discord_user_id)')
    .eq('tournament_id', tournamentId)
    .order('opted_in_at', { ascending: true });
  if (res.error || !res.data) return [];
  return res.data.map(function(r) {
    return {
      playerId: r.player_id,
      optedInAt: r.opted_in_at,
      username: r.players ? r.players.username : null,
      discordUserId: r.players ? r.players.discord_user_id : null,
    };
  });
}

/**
 * Try to promote the oldest standby player into a real registration.
 * Returns { ok, promoted?: { playerId, username, discordUserId }, reason? }.
 *
 * Loops if a player turns out to already be registered (RPC returns
 * 'already_registered' and clears the row), so the next person in line gets
 * a chance.
 */
export async function promoteNextStandby(tournamentId, seatCap) {
  if (!tournamentId) return { ok: false, reason: 'missing-args' };

  // Up to 20 attempts so we never spin forever if data is weird.
  for (var attempt = 0; attempt < 20; attempt++) {
    var queue = await listStandby(tournamentId);
    if (!queue.length) return { ok: false, reason: 'empty' };

    var next = queue[0];
    var rpc = await supabase.rpc('claim_standby_seat', {
      p_tournament_id: tournamentId,
      p_player_id: next.playerId,
      p_seat_cap: typeof seatCap === 'number' ? seatCap : null,
    });
    if (rpc.error) {
      console.warn('[standby] claim_standby_seat error: ' + rpc.error.message);
      return { ok: false, reason: 'rpc_error' };
    }
    var status = rpc.data;
    if (status === 'promoted') {
      return {
        ok: true,
        promoted: { playerId: next.playerId, username: next.username, discordUserId: next.discordUserId },
      };
    }
    if (status === 'full' || status === 'tournament_missing') {
      return { ok: false, reason: status };
    }
    // 'already_registered' / 'not_on_standby' → loop to try the next person.
  }
  return { ok: false, reason: 'too_many_attempts' };
}
