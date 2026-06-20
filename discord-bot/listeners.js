/**
 * listeners.js — Supabase Realtime listeners for auto-posting to Discord.
 * Watches site_settings (tournament phase changes) and registrations.
 */

import { supabase } from './utils/supabase.js';
import { getTournamentState, getRegistrations, getClashResults } from './utils/data.js';
import { phaseChangeEmbed, newRegistrationEmbed, newCustomRegistrationEmbed, newTeamRegistrationEmbed, resultsEmbed } from './utils/embeds.js';
import { syncPlayerRoles } from './utils/roles.js';
import { createLobbyChannels, announceClashEnd } from './utils/lobbies.js';
import {
  createTournamentChannels,
  createTournamentLobbyChannels,
  destroyTournamentChannels,
} from './utils/customTournamentChannels.js';
import {
  ensureTournamentRole,
  syncTournamentRoleMembers,
  destroyTournamentRole,
  findTournamentRole,
} from './utils/tournamentRoles.js';
import { resolveChannel } from './utils/channels.js';
import { mentionFor, sweepPreGameRole, buildNotifyPing } from './utils/notifyRoles.js';
import { sendCheckinNudge, clearCheckinNudge } from './utils/checkinNudge.js';
import { promoteNextStandby } from './utils/standby.js';

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
        const raw = payload.new && payload.new.value;
        const val = raw == null ? null : (typeof raw === 'string' ? JSON.parse(raw) : raw);
        if (!val || !val.phase) return;

        // Only fire on actual phase transitions
        if (val.phase === lastPhase) return;
        lastPhase = val.phase;

        const embed = phaseChangeEmbed(val.phase, val);

        // Post to clash-schedule and announcements
        const schedCh = ch('clash-schedule');
        const annCh = ch('announcements');

        // Opt-in only: ping Clash Notify + the "Fuck it ping me" catch-all on
        // registration + inprogress. Checkin gets no mention (channel post only) —
        // registered players already get a DM nudge via checkinNudge.js.
        var ping = buildNotifyPing(guild(), 'clash');
        var shouldPing = (val.phase === 'registration' || val.phase === 'inprogress');
        if (schedCh) {
          await schedCh.send({ content: (shouldPing && ping.content) ? (ping.content + ' ') : undefined, embeds: [embed], allowedMentions: { roles: shouldPing ? ping.roleIds : [] } });
        }
        if (annCh && shouldPing) {
          await annCh.send({ content: ping.content ? (ping.content + ' ') : undefined, embeds: [embed], allowedMentions: { roles: ping.roleIds } });
        }
        if (val.phase === 'complete') {
          sweepPreGameRole(guild()).catch(function(e) { console.warn('[listener] Pre-Game sweep failed: ' + ((e && e.message) || e)); });
        }

        // Phase 4: DM blast when check-in opens. Dedupe via site_settings so
        // a bot restart mid-window doesn't re-blast everyone.
        if (val.phase === 'checkin' && val.dbTournamentId) {
          sendCheckinNudge(client, { id: val.dbTournamentId, name: 'Clash #' + (val.clashNumber || '?') }, 'checkin').catch(function(e) {
            console.warn('[listener] checkin DM nudge failed: ' + ((e && e.message) || e));
          });
        }
        // Reset nudge dedupe when registration re-opens (admin reset).
        if (val.phase === 'registration' && val.dbTournamentId) {
          clearCheckinNudge(val.dbTournamentId, 'checkin').catch(function() {});
          clearCheckinNudge(val.dbTournamentId, 'pregame').catch(function() {});
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
          // Open-channels model: nothing to hide or revoke. Just post a GG
          // wrap-up in the hub. Lobby channels stay open for post-clash chat
          // and get reused (rosters refreshed) on the next clash.
          announceClashEnd(g, val).catch(function(e) {
            console.error('[listener] Clash end announce failed:', e.message);
          });
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
        if (!row) return;

        // Resolve tournament metadata: type, name, team_size
        // (clash_number isn't on tournaments; derive from name digits.)
        let tournamentType = 'season_clash';
        let tournamentName = null;
        let clashNum = '?';
        let teamSize = 1;
        if (row.tournament_id) {
          const { data: tour } = await supabase
            .from('tournaments')
            .select('type,name,team_size')
            .eq('id', row.tournament_id)
            .single();
          if (tour) {
            tournamentType = tour.type || 'season_clash';
            tournamentName = tour.name || null;
            teamSize = tour.team_size || 1;
            if (tournamentType === 'season_clash' && tour.name) clashNum = tour.name.replace(/\D+/g, '') || '?';
          }
        }
        if (clashNum === '?' && tournamentType === 'season_clash') {
          const ts = await getTournamentState();
          if (ts && ts.clashNumber) clashNum = ts.clashNumber;
        }

        const isSeasonClash = tournamentType === 'season_clash';
        const isTeamReg = !!(row.team_id && teamSize > 1);

        // Resolve display name (player or team)
        let displayName = 'Unknown';
        if (isTeamReg) {
          const { data: team } = await supabase
            .from('teams')
            .select('name,tag')
            .eq('id', row.team_id)
            .single();
          if (team) displayName = team.tag ? (team.name + ' [' + team.tag + ']') : team.name;
        } else if (row.player_id) {
          const { data: player } = await supabase
            .from('players')
            .select('username')
            .eq('id', row.player_id)
            .single();
          if (player && player.username) displayName = player.username;
        } else {
          return;
        }

        // Waitlist joins are registrations rows too (status='waitlisted') but
        // they are NOT seats - post a small note instead of the reg embed.
        if (row.status === 'waitlisted') {
          const wlRes = await supabase
            .from('registrations')
            .select('*', { count: 'exact', head: true })
            .eq('tournament_id', row.tournament_id)
            .eq('status', 'waitlisted');
          const wlPos = wlRes.count || 1;
          const wlSlug = (tournamentName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
          const wlTournamentCh = wlSlug ? (ch('registrations-' + wlSlug) || ch(wlSlug + '-registrations') || ch(wlSlug + '-general')) : null;
          const wlCh = wlTournamentCh || ch('clash-registrations') || ch('registrations') || ch('clash-schedule');
          if (wlCh) {
            await wlCh.send({
              content: '⏳ **' + displayName + '** joined the waitlist (position ' + wlPos + ')' + (isSeasonClash ? ' for Clash #' + clashNum : (tournamentName ? ' for ' + tournamentName : '')) + '. They will be auto-promoted when a seat opens.',
              allowedMentions: { parse: [] },
            });
          }
          console.log('[listener] Waitlist join: ' + displayName + ' (#' + wlPos + ')');
          return;
        }

        // Count only seated registrations (registered/checked_in) - waitlisted
        // rows live in the same table but must not inflate the seat count.
        let regCount = 0;
        if (row.tournament_id) {
          const countRes = await supabase
            .from('registrations')
            .select('*', { count: 'exact', head: true })
            .eq('tournament_id', row.tournament_id)
            .in('status', ['registered', 'checked_in']);
          if (countRes.error) console.error('[listener] count query failed:', countRes.error.message);
          regCount = countRes.count || 0;
        }
        if (!regCount) {
          if (isSeasonClash) {
            try {
              const regs = await getRegistrations();
              regCount = regs.length || 1;
            } catch (e) { regCount = 1; }
          } else {
            regCount = 1;
          }
        }

        // Pick the right embed
        let embed;
        if (isTeamReg) {
          embed = newTeamRegistrationEmbed(displayName, regCount, tournamentName, isSeasonClash, clashNum);
        } else if (isSeasonClash) {
          embed = newRegistrationEmbed(displayName, regCount, clashNum);
        } else {
          embed = newCustomRegistrationEmbed(displayName, regCount, tournamentName);
        }

        // Prefer a per-tournament category channel, then dedicated registrations, then schedule
        const slug = (tournamentName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
        const tournamentCh = slug ? (ch('registrations-' + slug) || ch(slug + '-registrations') || ch(slug + '-general')) : null;
        const targetCh = tournamentCh || ch('clash-registrations') || ch('registrations') || ch('clash-schedule');
        if (targetCh) await targetCh.send({ embeds: [embed] });

        console.log('[listener] New registration: ' + displayName + ' for "' + (tournamentName || 'unknown') + '" (' + regCount + ' total)');
      } catch (err) {
        console.error('[listener] registration error:', err);
      }
    })
    .subscribe();

  // ─── Custom tournament phase changes ─────────────────────────────────────────
  // Watches tournaments table for phase transitions on flash_tournament rows.
  // Auto-creates a Discord category + channels when registration opens, adds
  // per-lobby channels when the event goes in_progress, and schedules cleanup
  // when it completes.
  supabase
    .channel('bot_tournaments')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, async function(payload) {
      try {
        var row = payload.new || payload.old;
        if (!row || !row.id) return;
        if (row.type === 'season_clash') return;

        var prev = payload.old || {};
        var next = payload.new || {};
        var phasePrev = prev.phase || null;
        var phaseNext = next.phase || null;

        var g = guild();
        if (!g) return;

        // Open registration → ensure category + channels exist
        if (phaseNext && phaseNext !== phasePrev && (phaseNext === 'registration' || phaseNext === 'check_in')) {
          createTournamentChannels(g, next).then(function(res) {
            if (res && res.created) {
              console.log('[listener] Created Discord channels for tournament "' + (next.name || next.id) + '"');
            }
          }).catch(function(e) {
            console.error('[listener] createTournamentChannels failed:', e && e.message);
          });
        }

        // Check-in or in-progress → ensure tournament role exists + sync members
        if (phaseNext && phaseNext !== phasePrev && (phaseNext === 'check_in' || phaseNext === 'in_progress')) {
          syncTournamentRoleMembers(g, next).catch(function(e) {
            console.error('[listener] syncTournamentRoleMembers failed:', e && e.message);
          });
        }

        // In progress → create per-lobby channels for this tournament's lobbies
        if (phaseNext === 'in_progress' && phaseNext !== phasePrev) {
          try {
            var currentGame = next.current_round || 1;
            var lobbiesRes = await supabase
              .from('lobbies')
              .select('id, lobby_number, player_ids, host_player_id, game_number')
              .eq('tournament_id', next.id)
              .eq('game_number', currentGame)
              .order('lobby_number', { ascending: true });
            var lobbies = (lobbiesRes && lobbiesRes.data) || [];
            createTournamentLobbyChannels(g, next, lobbies).catch(function(e) {
              console.error('[listener] createTournamentLobbyChannels failed:', e && e.message);
            });
          } catch (e) {
            console.error('[listener] lobby fetch for tournament channels failed:', e && e.message);
          }
        }

        // Complete → schedule cleanup after 30 min so people can chat afterwards
        if (phaseNext === 'complete' && phaseNext !== phasePrev) {
          var tid = next.id;
          setTimeout(function() {
            destroyTournamentChannels(g, tid).catch(function(e) {
              console.error('[listener] destroyTournamentChannels failed:', e && e.message);
            });
            destroyTournamentRole(g, tid).catch(function(e) {
              console.error('[listener] destroyTournamentRole failed:', e && e.message);
            });
          }, 30 * 60 * 1000);
          console.log('[listener] Tournament "' + (next.name || tid) + '" channels and role will be cleaned up in 30 minutes');
        }

        // Tournament deleted → wipe channels + role immediately
        if (payload.eventType === 'DELETE' && payload.old && payload.old.id) {
          destroyTournamentChannels(g, payload.old.id).catch(function(e) {
            console.error('[listener] destroyTournamentChannels (delete) failed:', e && e.message);
          });
          destroyTournamentRole(g, payload.old.id).catch(function(e) {
            console.error('[listener] destroyTournamentRole (delete) failed:', e && e.message);
          });
        }
      } catch (err) {
        console.error('[listener] tournaments error:', err);
      }
    })
    .subscribe();

  // ─── Lobby inserts → ensure Discord channels exist ─────────────────────────
  // Catches the race where lobbies are inserted AFTER the tournament has
  // already transitioned to in_progress (e.g. admin start → manual seeding,
  // or admin reseed mid-event). Debounces per tournament so a batch of
  // INSERTs only triggers one channel-creation pass.
  var lobbyInsertTimers = {};
  supabase
    .channel('bot_lobby_inserts')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lobbies' }, function(payload) {
      try {
        var row = payload.new;
        if (!row || !row.tournament_id) return;
        var tid = row.tournament_id;
        if (lobbyInsertTimers[tid]) clearTimeout(lobbyInsertTimers[tid]);
        lobbyInsertTimers[tid] = setTimeout(async function() {
          delete lobbyInsertTimers[tid];
          try {
            var tRes = await supabase
              .from('tournaments')
              .select('id, name, type, phase, current_round')
              .eq('id', tid)
              .single();
            if (tRes.error || !tRes.data) return;
            var t = tRes.data;
            if (t.type === 'season_clash') return;
            if (t.phase !== 'in_progress' && t.phase !== 'check_in') return;

            var currentGame = t.current_round || 1;
            var lRes = await supabase
              .from('lobbies')
              .select('id, lobby_number, player_ids, host_player_id, game_number')
              .eq('tournament_id', tid)
              .eq('game_number', currentGame)
              .order('lobby_number', { ascending: true });
            var lobbies = (lRes && lRes.data) || [];
            if (lobbies.length === 0) return;

            var g = guild();
            if (!g) return;
            createTournamentLobbyChannels(g, t, lobbies).then(function(res) {
              if (res && res.created) {
                console.log('[listener] Created ' + res.created + ' Discord lobby channels for "' + (t.name || tid) + '"');
              }
            }).catch(function(e) {
              console.error('[listener] createTournamentLobbyChannels (insert) failed:', e && e.message);
            });
          } catch (e) {
            console.error('[listener] lobby insert handler failed:', e && e.message);
          }
        }, 1500);
      } catch (err) {
        console.error('[listener] lobby insert error:', err);
      }
    })
    .subscribe();

  // ─── Registration changes → re-sync tournament role membership ─────────────
  // Debounce per tournament so a flurry of check-ins / drops triggers one sync.
  var roleSyncTimers = {};
  supabase
    .channel('bot_registration_role_sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, function(payload) {
      try {
        var row = payload.new || payload.old;
        if (!row || !row.tournament_id) return;
        var tid = row.tournament_id;
        if (roleSyncTimers[tid]) clearTimeout(roleSyncTimers[tid]);
        roleSyncTimers[tid] = setTimeout(async function() {
          delete roleSyncTimers[tid];
          try {
            var tRes = await supabase
              .from('tournaments')
              .select('id, name, type, phase')
              .eq('id', tid)
              .single();
            if (tRes.error || !tRes.data) return;
            var t = tRes.data;
            if (t.type === 'season_clash') return;
            // Only sync when the role is actually relevant.
            if (t.phase !== 'check_in' && t.phase !== 'in_progress' && t.phase !== 'registration') return;
            var g = guild();
            if (!g) return;
            // Skip auto-create during 'registration' if the role doesn't exist yet —
            // we wait for check_in to materialize it. But re-sync if it already exists.
            if (t.phase === 'registration' && !findTournamentRole(g, t.id)) return;
            await syncTournamentRoleMembers(g, t);
          } catch (e) {
            console.error('[listener] registration role sync failed:', e && e.message);
          }
        }, 3000);
      } catch (err) {
        console.error('[listener] registration role sync error:', err);
      }
    })
    .subscribe();

  // ─── Registration DQ → promote next standby ──────────────────────────────
  // Fires when a registration transitions to disqualified=true (typically a
  // no-show). Pulls the oldest standby player via the claim_standby_seat RPC
  // (atomic, FOR UPDATE) and DMs both the demoted player and the promoted one.
  supabase
    .channel('bot_registration_dq')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'registrations' }, async function(payload) {
      try {
        var prev = payload.old || {};
        var next = payload.new || {};
        if (!next.tournament_id) return;

        // Waitlist promotion (status waitlisted → registered, via the
        // promote_next_waitlisted RPC): DM the player + drop a channel note.
        if (prev.status === 'waitlisted' && next.status === 'registered' && next.player_id) {
          try {
            var promoRes = await supabase
              .from('players')
              .select('username, discord_user_id')
              .eq('id', next.player_id)
              .single();
            var promoted = promoRes.data;
            var promoTRes = await supabase
              .from('tournaments')
              .select('name')
              .eq('id', next.tournament_id)
              .single();
            var promoTName = (promoTRes.data && promoTRes.data.name) || 'the active clash';
            if (promoted && promoted.discord_user_id) {
              try {
                var promoUser = await client.users.fetch(promoted.discord_user_id);
                await promoUser.send('🎟️ A seat opened up - you were promoted from the waitlist into **' + promoTName + '**! Head to the platform and check in before the window closes: https://tftclash.com/clash');
              } catch (dmErr) {
                console.warn('[listener] waitlist promotion DM failed: ' + ((dmErr && dmErr.message) || dmErr));
              }
            }
            var promoCh = ch('clash-registrations') || ch('registrations') || ch('clash-schedule');
            if (promoCh && promoted) {
              await promoCh.send({
                content: '🎟️ **' + (promoted.username || 'A player') + '** was promoted from the waitlist into ' + promoTName + '.',
                allowedMentions: { parse: [] },
              });
            }
            console.log('[listener] waitlist promotion announced: ' + (promoted && promoted.username));
          } catch (promoErr) {
            console.warn('[listener] waitlist promotion handler failed: ' + ((promoErr && promoErr.message) || promoErr));
          }
          return;
        }

        var becameDQ = !!next.disqualified && !prev.disqualified;
        if (!becameDQ) return;

        // Look up tournament cap (max_players if defined) so we don't
        // promote past it.
        var tRes = await supabase
          .from('tournaments')
          .select('id, name, max_players')
          .eq('id', next.tournament_id)
          .single();
        if (tRes.error || !tRes.data) return;
        var seatCap = tRes.data.max_players || null;

        var promo = await promoteNextStandby(next.tournament_id, seatCap);
        if (!promo.ok) {
          if (promo.reason && promo.reason !== 'empty') {
            console.log('[listener] standby promote skipped: ' + promo.reason);
          }
          return;
        }

        // DM the promoted player so they know to register/check in.
        if (promo.promoted && promo.promoted.discordUserId) {
          try {
            var user = await client.users.fetch(promo.promoted.discordUserId);
            await user.send('You were just promoted from standby into **' + (tRes.data.name || 'the active clash') + '**. Head to the platform and check in before the window closes.');
          } catch (e) {
            console.warn('[listener] standby promotion DM failed: ' + ((e && e.message) || e));
          }
        }
        console.log('[listener] standby promoted: ' + (promo.promoted && promo.promoted.username) + ' → tournament ' + next.tournament_id);
      } catch (err) {
        console.error('[listener] standby promotion error:', err);
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
