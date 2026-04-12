/**
 * listeners.js — Supabase Realtime listeners for auto-posting to Discord.
 * Watches site_settings (tournament phase changes) and registrations.
 */

import { supabase } from './utils/supabase.js';
import { getTournamentState, getRegistrations } from './utils/data.js';
import { phaseChangeEmbed, newRegistrationEmbed } from './utils/embeds.js';

let lastPhase = null;

/**
 * Starts all realtime listeners. Call once after client is ready.
 * @param {import('discord.js').Client} client
 */
export function startListeners(client) {
  const guild = function() { return client.guilds.cache.get(process.env.GUILD_ID); };
  const ch = function(name) {
    const g = guild();
    return g ? g.channels.cache.find(function(c) { return c.name.includes(name); }) : null;
  };

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

  console.log('[listeners] Realtime subscriptions active');
}
