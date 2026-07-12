/**
 * top32-checkin-late.js - check in a late-arriving player mid-clash (after the
 * check-in window/phase has closed). Uses the service-role client because the
 * enforce_registration_lifecycle trigger blocks non-admin/service_role status
 * changes once the tournament is past check-in (phase=in_progress). Also adds
 * the player to the live-clash state blob's checkedInIds so they're picked up
 * by the NEXT lobby draw (does not touch already-built/locked rounds).
 *
 * Usage: node discord-bot/scripts/top32-checkin-late.js <player_id>
 */

import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TOURNAMENT_ID = '06894db4-3dd0-443d-932c-8bcffe768fab';
const PLAYER_ID = process.argv[2];

async function main() {
  if (!PLAYER_ID) { console.error('Usage: node top32-checkin-late.js <player_id>'); process.exit(1); }
  const { supabase } = await import('../utils/supabase.js');

  var regRes = await supabase
    .from('registrations')
    .update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
    .eq('tournament_id', TOURNAMENT_ID)
    .eq('player_id', PLAYER_ID)
    .select();
  if (regRes.error) { console.error('[checkin] registrations update failed:', regRes.error.message); process.exit(1); }
  console.log('[checkin] registrations status -> checked_in:', regRes.data.length ? 'ok' : 'no row matched');

  var stateRes = await supabase.from('site_settings').select('value').eq('key', 'tournament_state').single();
  if (stateRes.error || !stateRes.data) { console.error('[checkin] state fetch failed:', stateRes.error && stateRes.error.message); process.exit(1); }
  var raw = stateRes.data.value;
  var ts = (typeof raw === 'string') ? JSON.parse(raw) : raw;

  var checkedIn = ts.checkedInIds || [];
  if (checkedIn.indexOf(PLAYER_ID) === -1) checkedIn.push(PLAYER_ID);
  ts.checkedInIds = checkedIn;

  var upd = await supabase.from('site_settings').upsert({ key: 'tournament_state', value: JSON.stringify(ts), updated_at: new Date().toISOString() });
  if (upd.error) { console.error('[checkin] state update failed:', upd.error.message); process.exit(1); }

  console.log('[checkin] blob checkedInIds now has ' + checkedIn.length + ' players (round=' + ts.round + ', savedLobbies=' + (ts.savedLobbies || []).length + ' - left untouched, player joins next round\'s draw).');
  process.exit(0);
}

main().catch(function(e) { console.error('[checkin] FATAL:', e); process.exit(1); });
