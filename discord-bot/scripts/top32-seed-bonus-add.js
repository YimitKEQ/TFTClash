/**
 * top32-seed-bonus-add.js - add a seeding bonus for a single player (e.g. a
 * top seed who checked in late). Additive: does not touch previously-granted
 * bonuses. Same mechanism as top32-seed-bonus.js (synthetic game_results row,
 * game_number=0, is_dnp=true, placement=8), via the service-role client.
 *
 * Usage: node discord-bot/scripts/top32-seed-bonus-add.js <player_id> <amount>
 */

import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TOURNAMENT_ID = '06894db4-3dd0-443d-932c-8bcffe768fab';
const PLAYER_ID = process.argv[2];
const AMOUNT = parseInt(process.argv[3], 10);

async function main() {
  if (!PLAYER_ID || !Number.isFinite(AMOUNT)) { console.error('Usage: node top32-seed-bonus-add.js <player_id> <amount>'); process.exit(1); }
  const { supabase } = await import('../utils/supabase.js');

  var row = {
    tournament_id: TOURNAMENT_ID,
    round_number: 0,
    game_number: 0,
    player_id: PLAYER_ID,
    placement: 8,
    points: AMOUNT,
    is_dnp: true,
  };

  var res = await supabase.from('game_results').upsert([row], { onConflict: 'tournament_id,game_number,player_id' }).select('player_id, points, players(username)');
  if (res.error) { console.error('[bonus] insert failed:', res.error.message); process.exit(1); }
  var r = res.data[0];
  console.log('[bonus] +' + r.points + ' granted to ' + (r.players ? r.players.username : r.player_id));
  process.exit(0);
}

main().catch(function(e) { console.error('[bonus] FATAL:', e); process.exit(1); });
