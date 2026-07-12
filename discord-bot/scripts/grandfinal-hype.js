/**
 * grandfinal-hype.js - crown wondeR as Season Champion in Discord: pinned
 * embed in the Grand Final lounge + a server-wide announcement.
 *
 * Usage: node discord-bot/scripts/grandfinal-hype.js
 */

import { Client, GatewayIntentBits, EmbedBuilder, Partials, ChannelType } from 'discord.js';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const GENERAL_CH = '1525596923899097088'.length ? null : null; // placeholder, resolved below by name

function championEmbed() {
  return new EmbedBuilder()
    .setColor(0xEDC200)
    .setTitle('👑 wondeR is your Season 1 Champion')
    .setDescription(
      '32 players. A knockout down to 16. A knockout down to 8. And a checkmate final that came down ' +
      'to the wire - Sacred Norris led on raw points the whole way, but **wondeR** clinched it the only ' +
      'way that matters in this format: crossing 20+ finals points AND winning the game to seal it.\n\n' +
      '**Final standings:**\n' +
      '🥇 wondeR (champion - clinched Game 4)\n🥈 Sacred Norris\n🥉 yatora1\n' +
      '4. PortugueseBabe · 5. magoose · 6. Lynx · 7. Nike3 · 8. RavingRaven\n\n' +
      'GG to all 32 who competed today. See you next season.'
    )
    .setFooter({ text: 'TFT Clash · Season 1 Champion' });
}

async function main() {
  if (!TOKEN || !GUILD_ID) { console.error('[hype] missing env'); process.exit(1); }
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages], partials: [Partials.Channel] });
  await client.login(TOKEN);
  await new Promise(function(res) { client.once('ready', res); });
  const guild = await client.guilds.fetch(GUILD_ID).then(function(g) { return g.fetch(); });
  await guild.channels.fetch();

  var category = guild.channels.cache.find(function(c) { return c.type === ChannelType.GuildCategory && c.name === '👑 GRAND FINAL'; });
  var lounge = category ? guild.channels.cache.find(function(c) { return c.parentId === category.id && c.name.indexOf('general') !== -1; }) : null;
  if (lounge) {
    var m1 = await lounge.send({ content: '@here', embeds: [championEmbed()], allowedMentions: { parse: ['everyone'] } });
    await m1.pin().catch(function() {});
    console.log('[hype] posted in Grand Final lounge');
  }

  var wide = guild.channels.cache.find(function(c) { return c.type === ChannelType.GuildText && c.name.indexOf('announcements') !== -1; })
    || guild.channels.cache.find(function(c) { return c.type === ChannelType.GuildText && c.name.indexOf('results') !== -1; });
  if (wide) {
    await wide.send({ embeds: [championEmbed()] });
    console.log('[hype] also posted to #' + wide.name);
  }

  await client.destroy();
  process.exit(0);
}

main().catch(function(e) { console.error('[hype] FATAL:', e); process.exit(1); });
