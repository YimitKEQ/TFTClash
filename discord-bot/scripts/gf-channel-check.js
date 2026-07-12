/**
 * gf-channel-check.js - diagnostic: list current guild channels/categories
 * related to the Grand Final and the open LIVE CLASH lobby category, to see
 * what actually exists right now vs what should have been auto-created.
 *
 * Usage: node discord-bot/scripts/gf-channel-check.js
 */

import { Client, GatewayIntentBits, ChannelType, Partials } from 'discord.js';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds], partials: [Partials.Channel] });
  await client.login(process.env.DISCORD_TOKEN);
  await new Promise(function(res) { client.once('ready', res); });

  const guild = await client.guilds.fetch(process.env.GUILD_ID).then(function(g) { return g.fetch(); });
  await guild.channels.fetch();

  var categories = guild.channels.cache.filter(function(c) { return c.type === ChannelType.GuildCategory; });
  console.log('[check] all categories:');
  categories.forEach(function(c) {
    var children = guild.channels.cache.filter(function(ch) { return ch.parentId === c.id; });
    console.log('  "' + c.name + '" (' + c.id + ') - ' + children.size + ' channels: ' + children.map(function(ch) { return ch.name; }).join(', '));
  });

  await client.destroy();
  process.exit(0);
}

main().catch(function(e) { console.error('[check] FATAL:', e); process.exit(1); });
