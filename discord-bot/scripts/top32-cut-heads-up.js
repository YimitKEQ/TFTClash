/**
 * top32-cut-heads-up.js - reminder ping in #top-32-general that the cut lands
 * right after the current game (Game 2) locks. Distinct from the pinned full
 * format post and from the actual cut-results announcement (posted separately
 * once Game 2 is locked).
 *
 * Usage: node discord-bot/scripts/top32-cut-heads-up.js
 */

import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TOKEN = process.env.DISCORD_TOKEN;
const GENERAL_CH = '1525465159030542559';

async function main() {
  if (!TOKEN) { console.error('[cut-heads-up] missing DISCORD_TOKEN'); process.exit(1); }
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages], partials: [Partials.Channel] });
  await client.login(TOKEN);
  await new Promise(function(res) { client.once('ready', res); });

  var general = await client.channels.fetch(GENERAL_CH);
  await general.send(
    '⚠️ **Heads up - this is the last game before the cut.** Once Game 2 scores are locked, standings (total points from Games 1+2) decide who advances. **Only the Top 16 move on** to Games 3-5; the rest are done for tonight. GLHF - make it count!'
  );
  console.log('[cut-heads-up] posted');
  await client.destroy();
  process.exit(0);
}

main().catch(function(e) { console.error('[cut-heads-up] FATAL:', e); process.exit(1); });
