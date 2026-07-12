/**
 * gf-fix-game4.js - correct a data-entry swap: Game 4 was locked with
 * yatora1=1st, wondeR=2nd, but the real in-game result was the reverse
 * (wondeR won). Swaps their placement+points for game_number=4 only,
 * leaving everyone else untouched. Uses the service-role client since the
 * refresh_player_stats trigger on game_results needs service_role/admin to
 * touch players.season_pts downstream.
 *
 * Usage: node discord-bot/scripts/gf-fix-game4.js
 */

import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TOURNAMENT_ID = 'ff4fa34e-4c90-4e35-a3e7-d686e16e4600';
const YATORA1 = '9ccc94af-766e-4224-a625-4cfe1a544b01';
const WONDER = '7b0ad933-7043-46f8-9a9c-b1ec64c7c65b';

async function main() {
  const { supabase } = await import('../utils/supabase.js');

  var u1 = await supabase.from('game_results')
    .update({ placement: 2, points: 7 })
    .eq('tournament_id', TOURNAMENT_ID).eq('game_number', 4).eq('player_id', YATORA1);
  if (u1.error) { console.error('[fix] yatora1 update failed:', u1.error.message); process.exit(1); }

  var u2 = await supabase.from('game_results')
    .update({ placement: 1, points: 8 })
    .eq('tournament_id', TOURNAMENT_ID).eq('game_number', 4).eq('player_id', WONDER);
  if (u2.error) { console.error('[fix] wondeR update failed:', u2.error.message); process.exit(1); }

  console.log('[fix] swapped: wondeR now 1st (8pts), yatora1 now 2nd (7pts) for Game 4');

  var verify = await supabase
    .from('game_results')
    .select('placement, points, players(username)')
    .eq('tournament_id', TOURNAMENT_ID).eq('game_number', 4)
    .order('placement');
  verify.data.forEach(function(r) { console.log('  ' + r.placement + '. ' + r.players.username + ' (' + r.points + 'pts)'); });

  process.exit(0);
}

main().catch(function(e) { console.error('[fix] FATAL:', e); process.exit(1); });
