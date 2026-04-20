/**
 * listeners.js — Supabase Realtime listeners for auto-posting to Discord.
 * Watches site_settings (tournament phase changes) and registrations.
 */

import { supabase } from './utils/supabase.js';
import { getTournamentState, getRegistrations, getClashResults } from './utils/data.js';
import { phaseChangeEmbed, newRegistrationEmbed, resultsEmbed } from './utils/embeds.js';
import { syncPlayerRoles } from './utils/roles.js';
import { createLobbyChannels, destroyLobbyChannels } from './utils/lobbies.js';
import { resolveChannel } from './utils/channels.js';

var PTS = { 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 };

/** Aggregate raw game_results rows into final placements (sum of points across games). */
function aggregatePlacements(rows) {
  var totals = {};
  rows.forEach(function(r) {
    if (!totals[r.name]) totals[r.name] = { name: r.name, total: 0 };
    totals[r.name].total += (PTS[r.place] || 0);
  });
  return Object.values(totals)
    .sort(function(a, b) { return b.total - a.total; })
    .map(function(p, i) { return { name: p.name, place: i + 1 }; });
}

async function autoPostResults(guild, clashNumber) {
  if (!guild || !clashNumber) return;
  var rows = await getClashResults(clashNumber);
  if (!rows || rows.length === 0) return;
  var placements = aggregatePlacements(rows);
  if (placements.length === 0) return;
  var channel = resolveChannel(guild, 'results') || resolveChannel(guild, 'announcements');
  if (!channel) return;
  try {
    await channel.send({ embeds: [resultsEmbed(clashNumber, placements)] });
    console.log('[listener] Auto-posted results for Clash #' + clashNumber);
  } catch (err) {
    console.error('[listener] auto-results error:', err && err.message);
  }
}

let lastPhase = null;

/**
 * Starts all realtime listeners. Call once after client is ready.
 * @param {import('discord.js').Client} client
 */
export function startListeners(client) {
  const guild = function() { return client.guilds.cache.get(process.env.GUILD_ID); };
  const ch = function(name) { return resolveChannel(guild(), name); };

  // ─── Tournament phase changes ────────────────────────────────────────────────
  supabase
    .channel('bot_site_settings')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings', filter: 'key=eq.tournament_state' }, async function(payload) {
      try {
        const val = payload.new && payload.new.value ? JSON.parse(payload.new.value) : null;
        if (!val || !val.phase) return;

        // Only fire on actual phase transitions
        if (val.phase === lastPhase) return;
        lastPhase = val.phase;

        const embed = phaseChangeEmbed(val.phase, val);

        // Post to clash-schedule and announcements
        const schedCh = ch('clash-schedule');
        const annCh = ch('announcements');

        if (schedCh) {
          const mention = val.phase === 'inprogress' ? '@everyone ' : val.phase === 'checkin' ? '@here ' : '';
          await schedCh.send({ content: mention || undefined, embeds: [embed] });
        }
        if (annCh && (val.phase === 'registration' || val.phase === 'inprogress')) {
          await annCh.send({ embeds: [embed] });
        }

        // Auto lobby channels
        var g = guild();
        if (g && val.phase === 'inprogress') {
          createLobbyChannels(g, val).catch(function(e) {
            console.error('[listener] Lobby channel creation failed:', e.message);
          });
        }
        if (g && val.phase === 'complete') {
          // Auto-post results once results are ready (give admin a minute to publish)
          var clashNum = val.clashNumber || null;
          if (clashNum) {
            setTimeout(function() {
              autoPostResults(g, clashNum).catch(function(e) {
                console.error('[listener] auto-results failed:', e && e.message);
              });
            }, 60 * 1000);
          }
          // Delay cleanup by 30 min so players can chat after the clash
          setTimeout(function() {
            destroyLobbyChannels(g).catch(function(e) {
              console.error('[listener] Lobby channel cleanup failed:', e.message);
            });
          }, 30 * 60 * 1000);
          console.log('[listener] Lobby channels will be cleaned up in 30 minutes');
        }

        console.log('[listener] Phase changed to: ' + val.phase);
      } catch (err) {
        console.error('[listener] site_settings error:', err);
      }
    })
    .subscribe();

  // ─── New registrations ───────────────────────────────────────────────────────
  supabase
    .channel('bot_registrations')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'registrations' }, async function(payload) {
      try {
        const row = payload.new;
        if (!row || !row.player_id) return;

        // Look up player name
        const { data: player } = await supabase
          .from('players')
          .select('username')
          .eq('id', row.player_id)
          .single();

        const playerName = (player && player.username) || 'Unknown';

        // Resolve clash number from the tournament that owns this registration
        let clashNum = '?';
        if (row.tournament_id) {
          const { data: tour } = await supabase
            .from('tournaments')
            .select('clash_number,name')
            .eq('id', row.tournament_id)
            .single();
          if (tour) {
            clashNum = tour.clash_number || (tour.name ? tour.name.replace(/\D+/g, '') : '?') || '?';
          }
        }
        if (clashNum === '?') {
          const ts = await getTournamentState();
          if (ts && ts.clashNumber) clashNum = ts.clashNumber;
        }

        // Count registrations directly off the tournament_id from the inserted row.
        // Avoids the broken getRegistrations() lookup chain that returned 0.
        let regCount = 0;
        if (row.tournament_id) {
          const countRes = await supabase
            .from('registrations')
            .select('*', { count: 'exact', head: true })
            .eq('tournament_id', row.tournament_id);
          if (countRes.error) {
            console.error('[listener] count query failed:', countRes.error.message);
          }
          regCount = countRes.count || 0;
        } else {
          console.warn('[listener] registration row has no tournament_id, using fallback');
        }
        if (!regCount) {
          // Fallback to the legacy helper if the direct count failed
          try {
            const regs = await getRegistrations();
            regCount = regs.length || 1;
          } catch (e) {
            regCount = 1;
          }
        }

        const embed = newRegistrationEmbed(playerName, regCount, clashNum);
        // Prefer a dedicated registrations channel, fall back to clash-schedule
        const targetCh = ch('clash-registrations') || ch('registrations') || ch('clash-schedule');
        if (targetCh) {
          await targetCh.send({ embeds: [embed] });
        }

        console.log('[listener] New registration: ' + playerName + ' (' + regCount + ' total)');
      } catch (err) {
        console.error('[listener] registration error:', err);
      }
    })
    .subscribe();

  // ─── Game results published ──────────────────────────────────────────────────
  supabase
    .channel('bot_game_results')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_results' }, async function(payload) {
      try {
        // We only log this — the actual results embed is posted via /post-results or auto after publish
        const row = payload.new;
        console.log('[listener] Game result recorded: player ' + row.player_id + ' placed ' + row.placement);
      } catch (err) {
        console.error('[listener] game_results error:', err);
      }
    })
    .subscribe();

  // ─── Player rank/data changes → role sync ─────────────────────────────────
  supabase
    .channel('bot_player_changes')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players' }, async function(payload) {
      try {
        var player = payload.new;
        if (!player || !player.discord_user_id) return;

        // Only sync if rank changed
        var oldRank = payload.old ? payload.old.rank : null;
        if (oldRank && oldRank === player.rank) return;

        var g = guild();
        if (!g) return;

        var result = await syncPlayerRoles(g, player);
        if (result.added && (result.added.length || result.removed.length)) {
          console.log('[listener] Role sync for ' + player.username + ': +[' + result.added.join(',') + '] -[' + result.removed.join(',') + ']');
        }
      } catch (err) {
        console.error('[listener] player role sync error:', err);
      }
    })
    .subscribe();

  // ─── Subscription changes → tier role sync ───────────────────────────────
  supabase
    .channel('bot_subscription_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_subscriptions' }, async function(payload) {
      try {
        var sub = payload.new;
        if (!sub || !sub.user_id) return;

        // Find the player with this auth_user_id
        var res = await supabase
          .from('players')
          .select('id,username,rank,auth_user_id,discord_user_id')
          .eq('auth_user_id', sub.user_id)
          .single();

        if (res.error || !res.data || !res.data.discord_user_id) return;

        var g = guild();
        if (!g) return;

        var result = await syncPlayerRoles(g, res.data);
        if (result.added && (result.added.length || result.removed.length)) {
          console.log('[listener] Tier sync for ' + res.data.username + ': +[' + result.added.join(',') + '] -[' + result.removed.join(',') + ']');
        }
      } catch (err) {
        console.error('[listener] subscription sync error:', err);
      }
    })
    .subscribe();

  console.log('[listeners] Realtime subscriptions active (build: reg-count-fix v2)');
}
