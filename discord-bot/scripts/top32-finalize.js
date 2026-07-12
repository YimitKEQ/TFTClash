/**
 * top32-finalize.js - finalize the Top 32 Playoffs:
 *  1. Mark the tournament complete.
 *  2. Write tournament_results for all 20 entrants (final_placement 1-20).
 *  3. Flip type -> flash_tournament so tonight is excluded from the season
 *     (decision locked with the user: this is an off-season playoff).
 *  4. Recompute season_pts/wins/top4/games/avg_placement for every affected
 *     player, mirroring refresh_player_stats() (mig 112) exactly, now that
 *     the type flip makes it naturally exclude tonight's game_results.
 * All via the service-role client (players_guard_managed_cols blocks direct
 * season_pts writes from non-service/non-admin callers).
 *
 * Usage: node discord-bot/scripts/top32-finalize.js
 */

import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TOURNAMENT_ID = '06894db4-3dd0-443d-932c-8bcffe768fab';

// Final ranking 1-20 (computed from game_results: bonus + G1-G5, tiebreak chain).
const RESULTS = [
  { id: '7b0ad933-7043-46f8-9a9c-b1ec64c7c65b', name: 'wondeR',          pts: 33, wins: 2, top4: 4, place: 1 },
  { id: '9ccc94af-766e-4224-a625-4cfe1a544b01', name: 'yatora1',         pts: 32, wins: 3, top4: 4, place: 2 },
  { id: '10433cb6-4aa3-4c9b-95ad-94bf62f960be', name: 'Sacred Norris',   pts: 31, wins: 0, top4: 5, place: 3 },
  { id: '0ea5e4d0-dc21-49aa-a8dd-b60effefcff5', name: 'RavingRaven',     pts: 31, wins: 0, top4: 5, place: 4 },
  { id: '7357c8f6-df8f-4dac-a80c-be326cf3547d', name: 'Lynx',            pts: 30, wins: 0, top4: 5, place: 5 },
  { id: 'b55542ae-c4fe-4423-aa8f-909c3fbb9f83', name: 'Nike3',           pts: 28, wins: 0, top4: 3, place: 6 },
  { id: '780f9a12-2e8c-486e-a90c-7931d0251911', name: 'PortugueseBabe',  pts: 27, wins: 2, top4: 3, place: 7 },
  { id: '71d534f6-6305-4523-bea1-d0dc781a6e71', name: 'magoose',         pts: 27, wins: 2, top4: 2, place: 8 },
  { id: '33e9a197-31c0-4833-a531-6f8317eaaf11', name: 'BigClean',        pts: 26, wins: 1, top4: 3, place: 9 },
  { id: '017599e4-ffdf-4ad1-b99f-3b9d9b6263ee', name: 'Fitspire',        pts: 23, wins: 1, top4: 3, place: 10 },
  { id: 'c5eb39b3-f65b-4b1b-aa7e-e7f7ab489064', name: 'Lava',            pts: 22, wins: 0, top4: 2, place: 11 },
  { id: 'a401ec93-5390-4a3f-93cd-367a250eb638', name: '૮꒰˶ - ˕ -꒱ა',     pts: 22, wins: 0, top4: 2, place: 12 },
  { id: '757634f7-ff6b-4bfb-a8b6-76754af98a7e', name: 'ochimop',         pts: 22, wins: 1, top4: 2, place: 13 },
  { id: '02a9e190-c7fb-4ce2-bff7-aea0ea082330', name: 'Kajuso',          pts: 21, wins: 0, top4: 2, place: 14 },
  { id: '1ae7c787-21cd-4955-8eb7-8a3b273c15e8', name: 'Kreivo',          pts: 20, wins: 0, top4: 2, place: 15 },
  { id: '1283f064-2f26-4eb7-ad51-b5169009003d', name: 'mibi',            pts: 15, wins: 0, top4: 1, place: 16 },
  { id: '6f6babb3-4525-4c0a-a4da-014846d55364', name: 'ThorThePaladin',  pts: 7,  wins: 0, top4: 0, place: 17 },
  { id: 'f6eefc01-c233-40d1-914c-aaec8718aace', name: 'KAIDO',           pts: 7,  wins: 0, top4: 0, place: 18 },
  { id: '02f9fa7a-92a7-45e8-9829-380001cf7580', name: 'Nacht',           pts: 7,  wins: 0, top4: 0, place: 19 },
  { id: '14cd0e0c-dfdb-4174-98c3-3632f565a27b', name: 'TeaTimePrime',    pts: 6,  wins: 0, top4: 0, place: 20 },
];
const TOP8_IDS = RESULTS.slice(0, 8).map(function(r) { return r.id; });

async function main() {
  const { supabase } = await import('../utils/supabase.js');

  // 1. Mark complete.
  var tRes = await supabase.from('tournaments')
    .update({ phase: 'complete', completed_at: new Date().toISOString() })
    .eq('id', TOURNAMENT_ID);
  if (tRes.error) { console.error('[finalize] complete failed:', tRes.error.message); process.exit(1); }
  console.log('[finalize] tournament marked complete');

  // 2. tournament_results.
  var rows = RESULTS.map(function(r) {
    return { tournament_id: TOURNAMENT_ID, player_id: r.id, final_placement: r.place, total_points: r.pts, wins: r.wins, top4_count: r.top4 };
  });
  var rRes = await supabase.from('tournament_results').upsert(rows, { onConflict: 'tournament_id,player_id' }).select();
  if (rRes.error) { console.error('[finalize] tournament_results failed:', rRes.error.message); process.exit(1); }
  console.log('[finalize] wrote ' + rRes.data.length + ' tournament_results rows');

  // 3. Exclude from season: flip type. Season-scoped queries (leaderboard,
  // player enrich) filter on type='season_clash', so this alone stops future
  // reads from counting tonight - but existing players.season_pts/etc need
  // an explicit recompute (step 4) since they were already bumped live.
  var flip = await supabase.from('tournaments').update({ type: 'flash_tournament' }).eq('id', TOURNAMENT_ID);
  if (flip.error) { console.error('[finalize] type flip failed:', flip.error.message); process.exit(1); }
  console.log('[finalize] type -> flash_tournament (excluded from season going forward)');

  // 4. Recompute season stats for every affected player, mirroring
  // refresh_player_stats() (mig 112) exactly, now correctly excluding tonight.
  var affectedIds = RESULTS.map(function(r) { return r.id; });
  var recomputed = 0;
  for (var i = 0; i < affectedIds.length; i++) {
    var pid = affectedIds[i];
    var grRes = await supabase
      .from('game_results')
      .select('points, placement, is_dnp, tournaments!inner(type)')
      .eq('player_id', pid)
      .eq('tournaments.type', 'season_clash');
    if (grRes.error) { console.error('[finalize] recompute fetch failed for ' + pid + ':', grRes.error.message); continue; }
    var rows2 = (grRes.data || []).filter(function(g) { return !g.is_dnp; });
    var games = rows2.length;
    var totalPts = (grRes.data || []).reduce(function(s, g) { return s + (g.points || 0); }, 0);
    var wins = rows2.filter(function(g) { return g.placement === 1; }).length;
    var top4 = rows2.filter(function(g) { return g.placement <= 4; }).length;
    var avgPlacement = games ? Math.round((rows2.reduce(function(s, g) { return s + g.placement; }, 0) / games) * 10) / 10 : 0;

    var pRow = await supabase.from('players').select('points_adjustment').eq('id', pid).single();
    var adj = (pRow.data && pRow.data.points_adjustment) || 0;

    var upd = await supabase.from('players').update({
      season_pts: totalPts + adj, wins: wins, top4: top4, games: games, avg_placement: avgPlacement,
    }).eq('id', pid);
    if (upd.error) { console.error('[finalize] recompute update failed for ' + pid + ':', upd.error.message); continue; }
    recomputed++;
  }
  console.log('[finalize] recomputed season stats for ' + recomputed + '/' + affectedIds.length + ' players (tonight excluded)');

  console.log('[finalize] TOP 8: ' + RESULTS.slice(0, 8).map(function(r) { return r.name; }).join(', '));
  console.log('[finalize] done.');
  process.exit(0);
}

main().catch(function(e) { console.error('[finalize] FATAL:', e); process.exit(1); });
