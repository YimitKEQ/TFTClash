/**
 * top32-apply-cut.js - apply the Top-16 cut after Game 2 (this event's design
 * has a SINGLE cut after G2, no further cuts through G5). Survivors + 2 fresh
 * lobbies of 8 are hardcoded from the already-computed standings (see the SQL
 * ranking run alongside this). Updates the live-clash blob via the service-role
 * client (raw-SQL JSON writes corrupted this blob once before - do not repeat
 * that mistake, always go through supabase-js here).
 *
 * Usage: node discord-bot/scripts/top32-apply-cut.js
 */

import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TOURNAMENT_ID = '06894db4-3dd0-443d-932c-8bcffe768fab';

// Top 16 survivors, snake-seeded into 2 lobbies of 8 by current standings (rank 1-16).
const LOBBY_A = [
  '9ccc94af-766e-4224-a625-4cfe1a544b01', // yatora1
  '757634f7-ff6b-4bfb-a8b6-76754af98a7e', // ochimop
  '0ea5e4d0-dc21-49aa-a8dd-b60effefcff5', // RavingRaven
  '10433cb6-4aa3-4c9b-95ad-94bf62f960be', // Sacred Norris
  'a401ec93-5390-4a3f-93cd-367a250eb638', // ૮꒰˶ - ˕ -꒱ა
  '33e9a197-31c0-4833-a531-6f8317eaaf11', // BigClean
  '1283f064-2f26-4eb7-ad51-b5169009003d', // mibi
  '1ae7c787-21cd-4955-8eb7-8a3b273c15e8', // Kreivo
];
const LOBBY_B = [
  '7b0ad933-7043-46f8-9a9c-b1ec64c7c65b', // wondeR
  'b55542ae-c4fe-4423-aa8f-909c3fbb9f83', // Nike3
  '7357c8f6-df8f-4dac-a80c-be326cf3547d', // Lynx
  'c5eb39b3-f65b-4b1b-aa7e-e7f7ab489064', // Lava
  '71d534f6-6305-4523-bea1-d0dc781a6e71', // magoose
  '780f9a12-2e8c-486e-a90c-7931d0251911', // PortugueseBabe
  '02a9e190-c7fb-4ce2-bff7-aea0ea082330', // Kajuso
  '017599e4-ffdf-4ad1-b99f-3b9d9b6263ee', // Fitspire
];
const CUT = [
  '6f6babb3-4525-4c0a-a4da-014846d55364', // ThorThePaladin
  'f6eefc01-c233-40d1-914c-aaec8718aace', // KAIDO
  '02f9fa7a-92a7-45e8-9829-380001cf7580', // Nacht
  '14cd0e0c-dfdb-4174-98c3-3632f565a27b', // TeaTimePrime
];

async function main() {
  const { supabase } = await import('../utils/supabase.js');

  var stateRes = await supabase.from('site_settings').select('value').eq('key', 'tournament_state').single();
  if (stateRes.error || !stateRes.data) { console.error('[cut] state fetch failed:', stateRes.error && stateRes.error.message); process.exit(1); }
  var raw = stateRes.data.value;
  var ts = (typeof raw === 'string') ? JSON.parse(raw) : raw;

  var survivors = LOBBY_A.concat(LOBBY_B);
  var before = (ts.checkedInIds || []).length;

  ts.checkedInIds = survivors;
  ts.eliminatedIds = (ts.eliminatedIds || []).concat(CUT.filter(function(id) { return (ts.eliminatedIds || []).indexOf(id) === -1; }));
  ts.savedLobbies = [LOBBY_A, LOBBY_B];
  ts.lockedLobbies = [];

  console.log('[cut] before: ' + before + ' checked in -> after: ' + survivors.length + ' survivors, ' + CUT.length + ' cut, round=' + ts.round);

  var upd = await supabase.from('site_settings').upsert({ key: 'tournament_state', value: JSON.stringify(ts), updated_at: new Date().toISOString() });
  if (upd.error) { console.error('[cut] state update failed:', upd.error.message); process.exit(1); }

  console.log('[cut] applied. savedLobbies now 2x8. checkedInIds=' + ts.checkedInIds.length + ' eliminatedIds=' + ts.eliminatedIds.length);
  process.exit(0);
}

main().catch(function(e) { console.error('[cut] FATAL:', e); process.exit(1); });
