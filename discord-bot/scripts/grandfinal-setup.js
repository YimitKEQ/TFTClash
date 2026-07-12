/**
 * grandfinal-setup.js - stand up tomorrow's Grand Final: register the 8
 * finalists from tonight's Top 32 Playoffs, and write a clean live-clash
 * state blob configured for CHECKMATE finals (first to 20 finals points,
 * then win a game to clinch). Uses the service-role client exclusively for
 * the blob write (JSON.stringify, matching the app's own format) - raw SQL
 * text-merges corrupted this exact blob once already today, not repeating
 * that mistake.
 *
 * Usage: node discord-bot/scripts/grandfinal-setup.js
 */

import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TOURNAMENT_ID = 'ff4fa34e-4c90-4e35-a3e7-d686e16e4600';
const CLASH_TIMESTAMP = '2026-07-12T15:00:00.000Z'; // 17:00 CEST

const FINALISTS = [
  { name: 'wondeR', id: '7b0ad933-7043-46f8-9a9c-b1ec64c7c65b' },
  { name: 'yatora1', id: '9ccc94af-766e-4224-a625-4cfe1a544b01' },
  { name: 'Sacred Norris', id: '10433cb6-4aa3-4c9b-95ad-94bf62f960be' },
  { name: 'RavingRaven', id: '0ea5e4d0-dc21-49aa-a8dd-b60effefcff5' },
  { name: 'Lynx', id: '7357c8f6-df8f-4dac-a80c-be326cf3547d' },
  { name: 'Nike3', id: 'b55542ae-c4fe-4423-aa8f-909c3fbb9f83' },
  { name: 'PortugueseBabe', id: '780f9a12-2e8c-486e-a90c-7931d0251911' },
  { name: 'magoose', id: '71d534f6-6305-4523-bea1-d0dc781a6e71' },
];

async function main() {
  const { supabase } = await import('../utils/supabase.js');

  var regRows = FINALISTS.map(function(f) { return { tournament_id: TOURNAMENT_ID, player_id: f.id, status: 'registered' }; });
  var regRes = await supabase.from('registrations').upsert(regRows, { onConflict: 'tournament_id,player_id' }).select();
  if (regRes.error) { console.error('[gf-setup] registrations failed:', regRes.error.message); process.exit(1); }
  console.log('[gf-setup] registered ' + regRes.data.length + ' finalists');

  // Confirm every finalist has a resolvable discord_user_id (should already,
  // backfilled + verified during tonight's event).
  var pRes = await supabase.from('players').select('id, username, discord_user_id').in('id', FINALISTS.map(function(f) { return f.id; }));
  if (pRes.error) { console.error('[gf-setup] player lookup failed:', pRes.error.message); process.exit(1); }
  pRes.data.forEach(function(p) { console.log('  ' + p.username + ': discord=' + (p.discord_user_id || 'MISSING')); });

  var ts = {
    phase: 'checkin',
    dbTournamentId: TOURNAMENT_ID,
    activeTournamentId: TOURNAMENT_ID,
    clashNumber: 6,
    clashName: 'Grand Final',
    clashTimestamp: CLASH_TIMESTAMP,
    registeredIds: FINALISTS.map(function(f) { return f.id; }),
    checkedInIds: [],
    waitlistIds: [],
    lobbies: [],
    lockedLobbies: [],
    savedLobbies: [],
    lockedPlacements: {},
    roundHistory: {},
    roundLobbies: {},
    eliminatedIds: [],
    finalsStartRound: 1, // pre-set explicitly - don't rely on the client useEffect auto-detecting a single 8-player lobby
    round: 1,
    maxPlayers: 8,
    roundCount: 1,
    totalGames: 1, // open-ended: performRoundAdvance auto-extends this every round until checkCheckmateWinner finds a champion
    cutLine: 0,
    cutAfterGame: 0,
    cutMode: 'threshold', // no cuts - all 8 play until someone clinches
    ladderStartSize: 0,
    finalsMode: 'checkmate',
    finalsThreshold: 20,
    checkinWindowMins: 30,
    formatPreset: 'custom',
    seedingMethod: 'snake',
    prizePool: [],
    isFinale: true,
    rulesOverride: 'Checkmate finals: reach 20+ cumulative points, then WIN a game to clinch the title. Being at 20+ is not enough on its own - you must place 1st in a game while at/above the threshold.',
  };

  var upd = await supabase.from('site_settings').upsert({ key: 'tournament_state', value: JSON.stringify(ts), updated_at: new Date().toISOString() });
  if (upd.error) { console.error('[gf-setup] blob write failed:', upd.error.message); process.exit(1); }
  console.log('[gf-setup] blob written: checkmate mode, threshold=20, checkin window tomorrow 16:30-17:00 CEST, clash at 17:00 CEST');

  process.exit(0);
}

main().catch(function(e) { console.error('[gf-setup] FATAL:', e); process.exit(1); });
