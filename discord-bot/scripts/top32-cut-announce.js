/**
 * top32-cut-announce.js - announce the Top-16 cut result (post-Game-2) to
 * #top-32-general and #top-32-info. Standings hardcoded from the ranking
 * already computed (SUM(points) incl. seed bonus, tiebreaker chain).
 *
 * Usage: node discord-bot/scripts/top32-cut-announce.js
 */

import { Client, GatewayIntentBits, EmbedBuilder, Partials } from 'discord.js';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TOKEN = process.env.DISCORD_TOKEN;
const GENERAL_CH = '1525465159030542559';
const INFO_CH = '1525465163350806691';

const SURVIVORS = [
  'yatora1', 'wondeR', 'Nike3', 'ochimop', 'RavingRaven', 'Lynx', 'Lava', 'Sacred Norris',
  '૮꒰˶ - ˕ -꒱ა', 'magoose', 'PortugueseBabe', 'BigClean', 'mibi', 'Kajuso', 'Fitspire', 'Kreivo',
];
const CUT = ['ThorThePaladin', 'KAIDO', 'Nacht', 'TeaTimePrime'];

function embed() {
  var list = SURVIVORS.map(function(n, i) { return (i + 1) + '. ' + n; }).join('\n');
  return new EmbedBuilder()
    .setColor(0xEDC200)
    .setTitle('✂️ The cut is in - Top 16')
    .setDescription(
      'Games 1-2 are locked. Standings after 2 games (bonus points included) decided it.\n\n' +
      '**Advancing to Games 3-5 (no further cuts until after Game 5):**\n' +
      list + '\n\n' +
      '**Thank you for playing tonight - eliminated:**\n' +
      CUT.join(', ') + '\n\n' +
      'Lobbies for Game 3 are up: <#1525465159030542559> (check `/lobby`). After Game 5, the **Top 8** advance to the Grand Final on another day.'
    )
    .setFooter({ text: 'TFT Clash · Top 32 Playoffs' });
}

async function main() {
  if (!TOKEN) { console.error('[cut-announce] missing DISCORD_TOKEN'); process.exit(1); }
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages], partials: [Partials.Channel] });
  await client.login(TOKEN);
  await new Promise(function(res) { client.once('ready', res); });

  var general = await client.channels.fetch(GENERAL_CH);
  var info = await client.channels.fetch(INFO_CH);
  var msg1 = await general.send({ embeds: [embed()] });
  await msg1.pin().catch(function() {});
  var msg2 = await info.send({ embeds: [embed()] });
  await msg2.pin().catch(function() {});

  console.log('[cut-announce] posted + pinned in both channels');
  await client.destroy();
  process.exit(0);
}

main().catch(function(e) { console.error('[cut-announce] FATAL:', e); process.exit(1); });
