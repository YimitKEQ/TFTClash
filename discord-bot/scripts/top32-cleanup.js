/**
 * top32-cleanup.js - tear down the temporary "🏆 TOP 32 PLAYOFFS" Discord
 * category + channels created for the 2026-07-11 playoffs. This category was
 * created by a standalone script (top32-setup.js), not customTournamentChannels,
 * so the bot's own auto-teardown (which matches by a different naming marker)
 * will never find/remove it - must be deleted manually.
 *
 * Leaves the shared "🔴 LIVE CLASH" open category alone (reused weekly infra,
 * will refresh automatically for the next event).
 *
 * Usage: node discord-bot/scripts/top32-cleanup.js
 */

import { Client, GatewayIntentBits, ChannelType, Partials } from 'discord.js';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_NAME = '🏆 TOP 32 PLAYOFFS';

async function main() {
  if (!TOKEN || !GUILD_ID) { console.error('[cleanup] missing env'); process.exit(1); }
  const client = new Client({ intents: [GatewayIntentBits.Guilds], partials: [Partials.Channel] });
  await client.login(TOKEN);
  await new Promise(function(res) { client.once('ready', res); });

  const guild = await client.guilds.fetch(GUILD_ID).then(function(g) { return g.fetch(); });
  var category = guild.channels.cache.find(function(c) { return c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME; });
  if (!category) { console.log('[cleanup] category not found (already removed?)'); await client.destroy(); process.exit(0); }

  var children = guild.channels.cache.filter(function(c) { return c.parentId === category.id; });
  var removed = 0;
  for (var entry of children) {
    try { await entry[1].delete('Top 32 Playoffs concluded - cleanup'); removed++; } catch (e) { console.error('[cleanup] failed to delete ' + entry[1].name + ':', e && e.message); }
  }
  try { await category.delete('Top 32 Playoffs concluded - cleanup'); } catch (e) { console.error('[cleanup] failed to delete category:', e && e.message); }

  console.log('[cleanup] removed ' + removed + ' channels + category "' + CATEGORY_NAME + '"');
  await client.destroy();
  process.exit(0);
}

main().catch(function(e) { console.error('[cleanup] FATAL:', e); process.exit(1); });
