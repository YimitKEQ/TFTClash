/**
 * checkinNudge.js — when a tournament transitions to phase=check_in (or
 * "checkin"), DM every registered player who hasn't checked in yet so they
 * don't no-show. Idempotent per (tournament_id, kind) — site_settings stores
 * the dedupe set so a bot restart mid-window doesn't re-blast everyone.
 *
 * The DM links them back to the platform; we don't try to do interactive
 * check-in over DM (button state would race with the website).
 */

import { EmbedBuilder } from 'discord.js';
import { supabase } from './supabase.js';
import { runAll } from './dmQueue.js';

var SETTING_KEY = 'checkin_nudges';

async function loadNudgeSet() {
  var res = await supabase.from('site_settings').select('value').eq('key', SETTING_KEY).single();
  if (res.error || !res.data) return {};
  try {
    var parsed = typeof res.data.value === 'string' ? JSON.parse(res.data.value) : res.data.value;
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (e) {
    return {};
  }
}

async function saveNudgeSet(map) {
  await supabase.from('site_settings').upsert({ key: SETTING_KEY, value: map }, { onConflict: 'key' });
}

function dedupeKey(tournamentId, kind) {
  return tournamentId + ':' + (kind || 'checkin');
}

function buildEmbed(tournamentName, kind) {
  var title = kind === 'pregame' ? 'Last call — clash starts soon' : 'Check-in is open';
  var color = kind === 'pregame' ? 0xC0392B : 0x3498DB;
  var line = kind === 'pregame'
    ? 'You\'re registered for **' + (tournamentName || 'an upcoming clash') + '** and the lobby starts in a few minutes.\n\nIf you haven\'t already, hit Check In on the website right now or you\'ll be DQ\'d for a no-show.'
    : 'Check-in just opened for **' + (tournamentName || 'an upcoming clash') + '**.\n\nHead to the platform and tap Check In within the window — miss it and you\'re a no-show.';
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(line)
    .setFooter({ text: 'TFT Clash — opt out: /notify unsubscribe kind:clash' })
    .setTimestamp();
}

/**
 * Send a check-in DM blast for a tournament. Returns
 *   { sent, skipped, failed } counts.
 *
 * @param {import('discord.js').Client} client
 * @param {object} tournament - { id, name }
 * @param {('checkin'|'pregame')} kind
 */
export async function sendCheckinNudge(client, tournament, kind) {
  if (!client || !tournament || !tournament.id) return { sent: 0, skipped: 0, failed: 0 };
  var key = dedupeKey(tournament.id, kind);

  var nudges = await loadNudgeSet();
  if (nudges[key]) {
    console.log('[checkinNudge] already sent for ' + key + ' — skipping');
    return { sent: 0, skipped: 0, failed: 0 };
  }

  // Pull registered-but-not-checked-in players with a discord_user_id.
  var regRes = await supabase
    .from('registrations')
    .select('player_id,status,checked_in_at,disqualified,players(discord_user_id,username)')
    .eq('tournament_id', tournament.id);
  if (regRes.error) {
    console.error('[checkinNudge] registrations query failed: ' + regRes.error.message);
    return { sent: 0, skipped: 0, failed: 0 };
  }
  var rows = regRes.data || [];
  var targets = rows.filter(function(r) {
    if (!r.players || !r.players.discord_user_id) return false;
    if (r.disqualified) return false;
    if (r.checked_in_at) return false;
    if (r.status && r.status !== 'registered' && r.status !== 'pending') return false;
    return true;
  });
  if (!targets.length) {
    // Mark dedupe anyway so we don't reissue empty queries on reboot.
    nudges[key] = { sent: 0, at: new Date().toISOString() };
    await saveNudgeSet(nudges).catch(function() {});
    return { sent: 0, skipped: 0, failed: 0 };
  }

  var embed = buildEmbed(tournament.name, kind);
  var results = await runAll(targets, async function(t) {
    var user = await client.users.fetch(t.players.discord_user_id).catch(function() { return null; });
    if (!user) throw new Error('user-fetch-failed');
    return user.send({ embeds: [embed] });
  });

  var sent = 0, failed = 0, skipped = 0;
  results.forEach(function(r) {
    if (r.ok) sent += 1;
    else failed += 1;
  });

  nudges[key] = { sent: sent, failed: failed, at: new Date().toISOString() };
  try { await saveNudgeSet(nudges); } catch (e) {
    console.warn('[checkinNudge] dedupe persist failed: ' + ((e && e.message) || e));
  }

  console.log('[checkinNudge] ' + key + ' — sent=' + sent + ' failed=' + failed);
  return { sent: sent, skipped: skipped, failed: failed };
}

/**
 * Clear the dedupe entry for a (tournament, kind). Used when a tournament
 * gets reset back to registration so a re-opened check-in can re-blast.
 */
export async function clearCheckinNudge(tournamentId, kind) {
  if (!tournamentId) return;
  var nudges = await loadNudgeSet();
  delete nudges[dedupeKey(tournamentId, kind)];
  await saveNudgeSet(nudges).catch(function() {});
}
