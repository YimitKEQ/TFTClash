/**
 * top32-close-blob.js - flip the live-clash state blob's phase to 'complete'
 * so the bot's existing realtime automation fires (autoPostResults after 60s,
 * GG wrap-up in the hub, eventual role/channel cleanup) - the same thing that
 * happens when a host clicks "Finalize" in the live UI. The DB itself was
 * already finalized directly (top32-finalize.js); this just closes the loop
 * for the bot-side automation.
 *
 * Usage: node discord-bot/scripts/top32-close-blob.js
 */

import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const { supabase } = await import('../utils/supabase.js');
  var stateRes = await supabase.from('site_settings').select('value').eq('key', 'tournament_state').single();
  if (stateRes.error || !stateRes.data) { console.error('[close] state fetch failed:', stateRes.error && stateRes.error.message); process.exit(1); }
  var raw = stateRes.data.value;
  var ts = (typeof raw === 'string') ? JSON.parse(raw) : raw;

  ts.phase = 'complete';

  var upd = await supabase.from('site_settings').upsert({ key: 'tournament_state', value: JSON.stringify(ts), updated_at: new Date().toISOString() });
  if (upd.error) { console.error('[close] update failed:', upd.error.message); process.exit(1); }
  console.log('[close] blob phase -> complete (clashNumber=' + ts.clashNumber + '). Bot auto-results should fire within 60s.');
  process.exit(0);
}

main().catch(function(e) { console.error('[close] FATAL:', e); process.exit(1); });
