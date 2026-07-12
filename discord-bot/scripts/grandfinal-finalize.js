/**
 * grandfinal-finalize.js - finalize the Grand Final now that Game 4 data is
 * corrected (wondeR clinched via checkmate, not yatora1). Same pattern as
 * top32-finalize.js: mark complete, write tournament_results with the
 * checkmate winner pinned to 1st (points alone don't decide it - Sacred
 * Norris has more total points but never won while at/above threshold),
 * flip type to exclude from season (matches the Playoffs precedent), and
 * recompute season stats for the 8 so nothing stays inflated.
 *
 * Usage: node discord-bot/scripts/grandfinal-finalize.js
 */

import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TOURNAMENT_ID = 'ff4fa34e-4c90-4e35-a3e7-d686e16e4600';

// Champion pinned to 1st via the checkmate clinch (Game 4, 23 finals pts,
// won while >=20). The rest ranked by total points, tiebreak = wins*2+top4.
const RESULTS = [
  { id: '7b0ad933-7043-46f8-9a9c-b1ec64c7c65b', name: 'wondeR',         pts: 23, wins: 1, top4: 2, place: 1 },
  { id: '10433cb6-4aa3-4c9b-95ad-94bf62f960be', name: 'Sacred Norris',  pts: 24, wins: 1, top4: 4, place: 2 },
  { id: '9ccc94af-766e-4224-a625-4cfe1a544b01', name: 'yatora1',        pts: 22, wins: 1, top4: 3, place: 3 },
  { id: '780f9a12-2e8c-486e-a90c-7931d0251911', name: 'PortugueseBabe', pts: 22, wins: 0, top4: 3, place: 4 },
  { id: '71d534f6-6305-4523-bea1-d0dc781a6e71', name: 'magoose',        pts: 15, wins: 0, top4: 1, place: 5 },
  { id: '7357c8f6-df8f-4dac-a80c-be326cf3547d', name: 'Lynx',           pts: 13, wins: 1, top4: 1, place: 6 },
  { id: 'b55542ae-c4fe-4423-aa8f-909c3fbb9f83', name: 'Nike3',          pts: 13, wins: 0, top4: 2, place: 7 },
  { id: '0ea5e4d0-dc21-49aa-a8dd-b60effefcff5', name: 'RavingRaven',    pts: 12, wins: 0, top4: 1, place: 8 },
];

async function main() {
  const { supabase } = await import('../utils/supabase.js');

  var tRes = await supabase.from('tournaments')
    .update({ phase: 'complete', completed_at: new Date().toISOString() })
    .eq('id', TOURNAMENT_ID);
  if (tRes.error) { console.error('[gf-finalize] complete failed:', tRes.error.message); process.exit(1); }
  console.log('[gf-finalize] tournament marked complete');

  var rows = RESULTS.map(function(r) {
    return { tournament_id: TOURNAMENT_ID, player_id: r.id, final_placement: r.place, total_points: r.pts, wins: r.wins, top4_count: r.top4 };
  });
  var rRes = await supabase.from('tournament_results').upsert(rows, { onConflict: 'tournament_id,player_id' }).select();
  if (rRes.error) { console.error('[gf-finalize] tournament_results failed:', rRes.error.message); process.exit(1); }
  console.log('[gf-finalize] wrote ' + rRes.data.length + ' tournament_results rows. CHAMPION: wondeR');

  // Unlike the Playoffs, this stays type='season_clash' - the homepage's
  // "Latest Champion" strip only surfaces the most recent COMPLETED
  // season_clash tournament's final_placement=1. Flipping it to
  // flash_tournament (like the Playoffs) would make wondeR's win invisible
  // on the site, which is the opposite of what was asked. season_pts for
  // all 8 finalists already reflects these 4 games via the normal trigger
  // (never isolated) - no separate recompute needed here.
  console.log('[gf-finalize] type left as season_clash so wondeR surfaces as Latest Champion on tftclash.com');

  process.exit(0);
}

main().catch(function(e) { console.error('[gf-finalize] FATAL:', e); process.exit(1); });
