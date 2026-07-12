/**
 * gf-lobby-check.js - check whether the 🔴 LIVE CLASH lobby-a/lobby-b channels
 * reflect TODAY's Grand Final roster or are stale leftovers, by reading their
 * pinned roster messages.
 *
 * Usage: node discord-bot/scripts/gf-lobby-check.js
 */

import { Client, GatewayIntentBits, ChannelType, Partials } from 'discord.js';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages], partials: [Partials.Channel] });
  await client.login(process.env.DISCORD_TOKEN);
  await new Promise(function(res) { client.once('ready', res); });
  const guild = await client.guilds.fetch(process.env.GUILD_ID).then(function(g) { return g.fetch(); });
  await guild.channels.fetch();

  var cat = guild.channels.cache.get('1525521943628091432');
  var children = guild.channels.cache.filter(function(c) { return c.parentId === cat.id && c.type === ChannelType.GuildText; });
  for (var entry of children) {
    var ch = entry[1];
    var pins = await ch.messages.fetchPins().catch(function() { return { items: [] }; });
    var items = pins.items || pins;
    console.log('--- #' + ch.name + ' (created ' + ch.createdAt.toISOString() + ') ---');
    items.forEach(function(m) { console.log('  PIN: ' + m.content.slice(0, 200)); });
  }

  await client.destroy();
  process.exit(0);
}

main().catch(function(e) { console.error('[check] FATAL:', e); process.exit(1); });
