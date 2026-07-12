/**
 * top32-seed-bonus.js - grant the "points leaders" seeding bonus the players
 * asked for: top 5 checked-in seeds get +2, ranks 6-10 get +1. Recorded as a
 * synthetic game_results row (game_number=0, is_dnp=true, placement=8 so it
 * never counts as a win/top4) that adds only points. Uses the service-role
 * Supabase client so the players.season_pts refresh trigger is authorized.
 *
 * Usage: node discord-bot/scripts/top32-seed-bonus.js
 */

import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TOURNAMENT_ID = '06894db4-3dd0-443d-932c-8bcffe768fab';

// rank order among tonight's checked-in field, by season_pts.
const BONUS = [
  { name: 'RavingRaven',    id: '0ea5e4d0-dc21-49aa-a8dd-b60effefcff5', amt: 2 },
  { name: '૮꒰˶ - ˕ -꒱ა',    id: 'a401ec93-5390-4a3f-93cd-367a250eb638', amt: 2 },
  { name: 'Nike3',          id: 'b55542ae-c4fe-4423-aa8f-909c3fbb9f83', amt: 2 },
  { name: 'wondeR',         id: '7b0ad933-7043-46f8-9a9c-b1ec64c7c65b', amt: 2 },
  { name: 'Lynx',           id: '7357c8f6-df8f-4dac-a80c-be326cf3547d', amt: 2 },
  { name: 'magoose',        id: '71d534f6-6305-4523-bea1-d0dc781a6e71', amt: 1 },
  { name: 'Sacred Norris',  id: '10433cb6-4aa3-4c9b-95ad-94bf62f960be', amt: 1 },
  { name: 'BigClean',       id: '33e9a197-31c0-4833-a531-6f8317eaaf11', amt: 1 },
  { name: 'Nacht',          id: '02f9fa7a-92a7-45e8-9829-380001cf7580', amt: 1 },
  { name: 'mibi',           id: '1283f064-2f26-4eb7-ad51-b5169009003d', amt: 1 },
];

async function main() {
  const { supabase } = await import('../utils/supabase.js');

  var rows = BONUS.map(function(b) {
    return {
      tournament_id: TOURNAMENT_ID,
      round_number: 0,
      game_number: 0,
      player_id: b.id,
      placement: 8,
      points: b.amt,
      is_dnp: true,
    };
  });

  var res = await supabase.from('game_results').upsert(rows, { onConflict: 'tournament_id,game_number,player_id' }).select();
  if (res.error) { console.error('[bonus] insert failed:', res.error.message); process.exit(1); }
  console.log('[bonus] wrote ' + res.data.length + ' bonus rows.');

  var verify = await supabase
    .from('game_results')
    .select('player_id, points, players(username)')
    .eq('tournament_id', TOURNAMENT_ID)
    .eq('game_number', 0);
  if (verify.error) { console.error('[bonus] verify failed:', verify.error.message); process.exit(1); }
  verify.data
    .sort(function(a, b) { return b.points - a.points; })
    .forEach(function(r) { console.log('  +' + r.points + '  ' + (r.players ? r.players.username : r.player_id)); });

  console.log('[bonus] done.');
  process.exit(0);
}

main().catch(function(e) { console.error('[bonus] FATAL:', e); process.exit(1); });
