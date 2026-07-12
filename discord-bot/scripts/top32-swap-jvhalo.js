/**
 * top32-swap-jvhalo.js - replace Jvhalo (not in the Discord server) with the
 * next alternate who IS in the server. Grants channel access + DMs them.
 * Prints CHOSEN <name> <discordId> <playerId> for the DB swap.
 *
 * Usage: node discord-bot/scripts/top32-swap-jvhalo.js
 */

import { Client, GatewayIntentBits, EmbedBuilder, Partials } from 'discord.js';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const GENERAL_CH = '1525465159030542559';
const INFO_CH = '1525465163350806691';
const SITE_URL = 'https://tftclash.com';

// Next alternates in rank order.
const ALTS = [
  { name: 'endsjustice', id: '247529327858679808', playerId: '6adf150a-7756-43e8-a8cb-50f865d6e93c' },
  { name: 'Nearr', id: '829422909402513478', playerId: '52efc760-32fe-4260-b37f-cf639a37ff06' },
];

function inviteEmbed() {
  return new EmbedBuilder()
    .setColor(0xEDC200)
    .setTitle('🏆 You\'re in - Top 32 Playoffs')
    .setDescription(
      'A spot just opened and you\'re next off the leaderboard, so you\'re in tonight\'s **Top 32 Playoffs**.\n\n' +
      '🕔 **17:00 CEST · 5-game knockout**\n' +
      'No cut after game 1, **bottom 8 out after games 2 and 3**, then the last 16 play games 4 & 5 and the **Top 8 advance** to the Grand Final (another day).\n\n' +
      '🎟️ **Check in now** - `/checkin` or ' + SITE_URL + '.\n' +
      '💬 Your lounge: <#' + GENERAL_CH + '>\n\n' +
      'Be checked in by 17:00 or the seat passes on. Can\'t make it? Reply here. GLHF!'
    )
    .setFooter({ text: 'TFT Clash · Top 32 Playoffs' });
}

async function main() {
  if (!TOKEN || !GUILD_ID) { console.error('[swap] missing env'); process.exit(1); }
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages], partials: [Partials.Channel] });
  await client.login(TOKEN);
  await new Promise(function(res) { client.once('ready', res); });
  const guild = await client.guilds.fetch(GUILD_ID).then(function(g) { return g.fetch(); });
  await guild.members.fetch().catch(function() {});

  var chosen = null;
  for (var i = 0; i < ALTS.length; i++) {
    if (guild.members.cache.has(ALTS[i].id)) { chosen = ALTS[i]; break; }
    console.log('[swap] ' + ALTS[i].name + ' not in server, trying next');
  }
  if (!chosen) { console.log('[swap] NO reachable alternate. Keep Jvhalo.'); await client.destroy(); process.exit(2); }

  var general = await client.channels.fetch(GENERAL_CH);
  var info = await client.channels.fetch(INFO_CH);
  await general.permissionOverwrites.edit(chosen.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(function(e) { console.error('[swap] general grant failed:', e && e.message); });
  await info.permissionOverwrites.edit(chosen.id, { ViewChannel: true, ReadMessageHistory: true, SendMessages: false }).catch(function(e) { console.error('[swap] info grant failed:', e && e.message); });

  var dmOk = true;
  try {
    var user = await client.users.fetch(chosen.id);
    await user.send({ embeds: [inviteEmbed()] });
  } catch (e) { dmOk = false; console.error('[swap] DM failed:', e && e.message); }

  console.log('[swap] channel access granted, DM ' + (dmOk ? 'sent' : 'FAILED'));
  console.log('CHOSEN ' + chosen.name + ' ' + chosen.id + ' ' + chosen.playerId);
  await client.destroy();
  process.exit(0);
}

main().catch(function(e) { console.error('[swap] FATAL:', e); process.exit(1); });
