/**
 * listeners.js — Supabase Realtime listeners for auto-posting to Discord.
 * Watches site_settings (tournament phase changes) and registrations.
 */

import { supabase } from './utils/supabase.js';
import { getTournamentState, getRegistrations } from './utils/data.js';
import { phaseChangeEmbed, newRegistrationEmbed } from './utils/embeds.js';
import { syncPlayerRoles } from './utils/roles.js';
import { createLobbyChannels, destroyLobbyChannels } from './utils/lobbies.js';
import { resolveChannel } from './utils/channels.js';

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

        // Get current registration count
        const ts = await getTournamentState();
        const clashNum = (ts && ts.clashNumber) || '?';
        const regs = await getRegistrations();
        const regCount = regs.length;

        const embed = newRegistrationEmbed(playerName, regCount, clashNum);
        const schedCh = ch('clash-schedule');
        if (schedCh) {
          await schedCh.send({ embeds: [embed] });
        }

        console.log('[listener] New registration: ' + playerName + ' (#' + regCount + ')');
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

  console.log('[listeners] Realtime subscriptions active');
}
