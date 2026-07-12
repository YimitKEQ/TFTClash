/**
 * top32-add-subs.js - onboard replacement players into the Top 32 Playoffs:
 * grant them access to the private channels and DM them a "you're in" invite.
 *
 * Usage:
 *   node discord-bot/scripts/top32-add-subs.js --dry   # verify membership only
 *   node discord-bot/scripts/top32-add-subs.js         # grant access + DM
 */

import { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, Partials } from 'discord.js';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import { runAll } from '../utils/dmQueue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const GENERAL_CH = '1525465159030542559';
const INFO_CH = '1525465163350806691';
const SITE_URL = 'https://tftclash.com';
const DRY = process.argv.includes('--dry');

// The 6 replacement players pulled off the leaderboard.
const SUBS = [
  { name: 'sousa', id: '339547857788993556' },
  { name: 'thunderousrai', id: '329174870673850368' },
  { name: 'Gasper', id: '456153086126325761' },
  { name: 'Abrikossodavand999', id: '891291680412672050' },
  { name: 'Jvhalo', id: '530053144638652427' },
  { name: 'leezus', id: '184694216037892106' },
];

function inviteEmbed(generalId) {
  return new EmbedBuilder()
    .setColor(0xEDC200)
    .setTitle('🏆 You\'re in - Top 32 Playoffs')
    .setDescription(
      'A spot just opened and you\'re next off the leaderboard, so you\'re in tonight\'s **Top 32 Playoffs**.\n\n' +
      '🕔 **17:00 CEST · 5-game knockout**\n' +
      'No cut after game 1, **bottom 8 out after games 2 and 3**, then the last 16 play games 4 & 5 and the **Top 8 advance** to the Grand Final (another day).\n\n' +
      '🎟️ **Check in now** - `/checkin` or ' + SITE_URL + '.\n' +
      '💬 Your lounge: <#' + generalId + '>\n\n' +
      'Be checked in by 17:00 or the seat passes on. Can\'t make it? Reply here. GLHF!'
    )
    .setFooter({ text: 'TFT Clash · Top 32 Playoffs' });
}

async function main() {
  if (!TOKEN || !GUILD_ID) { console.error('[subs] missing DISCORD_TOKEN/GUILD_ID'); process.exit(1); }
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages], partials: [Partials.Channel] });
  await client.login(TOKEN);
  await new Promise(function(res) { client.once('ready', res); });
  console.log('[subs] connected as ' + client.user.tag + (DRY ? '  (DRY)' : ''));

  const guild = await client.guilds.fetch(GUILD_ID).then(function(g) { return g.fetch(); });
  await guild.members.fetch().catch(function() {});

  var present = SUBS.filter(function(s) { return guild.members.cache.has(s.id); });
  var absent = SUBS.filter(function(s) { return !guild.members.cache.has(s.id); });
  console.log('[subs] in server: ' + present.length + '/' + SUBS.length);
  absent.forEach(function(s) { console.log('   NOT in server: ' + s.name + ' (' + s.id + ')'); });

  if (DRY) { await client.destroy(); process.exit(0); }

  // Grant channel access to each present sub.
  var general = await client.channels.fetch(GENERAL_CH);
  var info = await client.channels.fetch(INFO_CH);
  for (var i = 0; i < present.length; i++) {
    var s = present[i];
    try {
      await general.permissionOverwrites.edit(s.id, {
        ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
      });
      await info.permissionOverwrites.edit(s.id, {
        ViewChannel: true, ReadMessageHistory: true, SendMessages: false,
      });
    } catch (e) { console.error('[subs] access grant failed for ' + s.name + ':', e && e.message); }
  }
  console.log('[subs] channel access granted to ' + present.length + ' subs');

  var embed = inviteEmbed(GENERAL_CH);
  var results = await runAll(SUBS, async function(s) {
    var user = await client.users.fetch(s.id);
    await user.send({ embeds: [embed] });
    return true;
  });
  var ok = results.filter(function(r) { return r.ok; });
  var failed = results.filter(function(r) { return !r.ok; });
  console.log('[subs] DMs sent: ' + ok.length + '/' + SUBS.length);
  failed.forEach(function(r) {
    console.log('   DM FAILED: ' + r.item.name + ' (' + r.item.id + '): ' + (r.error && r.error.message ? r.error.message : 'unknown'));
  });

  await client.destroy();
  process.exit(0);
}

main().catch(function(e) { console.error('[subs] FATAL:', e); process.exit(1); });
