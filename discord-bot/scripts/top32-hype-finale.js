/**
 * top32-hype-finale.js - the big one: announce the Top 8 finalists + thank
 * the whole field of 32. Posts to #top-32-general, #top-32-info, and the
 * server-wide #announcements/#results channels so it reaches beyond the
 * private lounge too.
 *
 * Usage: node discord-bot/scripts/top32-hype-finale.js
 */

import { Client, GatewayIntentBits, EmbedBuilder, Partials, ChannelType } from 'discord.js';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const GENERAL_CH = '1525465159030542559';
const INFO_CH = '1525465163350806691';

const TOP8 = [
  { name: 'wondeR', pts: 33 },
  { name: 'yatora1', pts: 32 },
  { name: 'Sacred Norris', pts: 31 },
  { name: 'RavingRaven', pts: 31 },
  { name: 'Lynx', pts: 30 },
  { name: 'Nike3', pts: 28 },
  { name: 'PortugueseBabe', pts: 27 },
  { name: 'magoose', pts: 27 },
];
const REST = ['BigClean', 'Fitspire', 'Lava', '૮꒰˶ - ˕ -꒱ა', 'ochimop', 'Kajuso', 'Kreivo', 'mibi', 'ThorThePaladin', 'KAIDO', 'Nacht', 'TeaTimePrime'];

function finaleEmbed() {
  var medals = ['🥇', '🥈', '🥉'];
  var lines = TOP8.map(function(p, i) {
    var tag = i < 3 ? medals[i] : ('#' + (i + 1));
    return tag + ' **' + p.name + '** - ' + p.pts + ' pts';
  }).join('\n');
  return new EmbedBuilder()
    .setColor(0xEDC200)
    .setTitle('🏆 TOP 8 - Grand Final bound')
    .setDescription(
      '5 games, one cut, 20 competitors left standing after Game 2 - and now it\'s down to 8.\n\n' +
      lines + '\n\n' +
      '**These 8 play the Grand Final on another day (checkmate format) for the title.**\n\n' +
      '🙌 **Huge thanks to the whole Top 32** for showing up and competing tonight. GG all round.'
    )
    .setFooter({ text: 'TFT Clash · Top 32 Playoffs · Grand Final date TBA' });
}

function thankYouEmbed() {
  return new EmbedBuilder()
    .setColor(0x00DBED)
    .setTitle('GG Top 32 🙏')
    .setDescription(
      'That\'s a wrap on tonight\'s Top 32 Playoffs. Every one of you earned your seat on the leaderboard to be here - thank you for the games.\n\n' +
      '**Advancing to the Grand Final:** ' + TOP8.map(function(p) { return p.name; }).join(', ') + '\n\n' +
      '**Also competed tonight:** ' + REST.join(', ') + '\n\n' +
      'This lounge stays open - see you all for the next Clash. GLHF!'
    )
    .setFooter({ text: 'TFT Clash · Top 32 Playoffs' });
}

async function main() {
  if (!TOKEN || !GUILD_ID) { console.error('[hype] missing env'); process.exit(1); }
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages], partials: [Partials.Channel] });
  await client.login(TOKEN);
  await new Promise(function(res) { client.once('ready', res); });
  console.log('[hype] connected as ' + client.user.tag);

  var general = await client.channels.fetch(GENERAL_CH);
  var info = await client.channels.fetch(INFO_CH);

  var m1 = await general.send({ content: '@here', embeds: [finaleEmbed()], allowedMentions: { parse: ['everyone'] } });
  await m1.pin().catch(function() {});
  var m2 = await info.send({ embeds: [finaleEmbed()] });
  await m2.pin().catch(function() {});
  await general.send({ embeds: [thankYouEmbed()] });
  console.log('[hype] posted finale + thank-you in the Top 32 lounge');

  // Also broadcast to a server-wide channel if one exists (announcements/results).
  const guild = await client.guilds.fetch(GUILD_ID).then(function(g) { return g.fetch(); });
  var wide = guild.channels.cache.find(function(c) {
    return c.type === ChannelType.GuildText && (c.name === 'announcements' || c.name.indexOf('announcements') !== -1);
  }) || guild.channels.cache.find(function(c) {
    return c.type === ChannelType.GuildText && c.name.indexOf('results') !== -1;
  });
  if (wide) {
    await wide.send({ embeds: [finaleEmbed()] });
    console.log('[hype] also posted to #' + wide.name);
  } else {
    console.log('[hype] no server-wide announcements/results channel found - skipped');
  }

  await client.destroy();
  process.exit(0);
}

main().catch(function(e) { console.error('[hype] FATAL:', e); process.exit(1); });
