/**
 * one-shot: connect, run cleanupOrphanDuplicates against GUILD_ID, exit.
 * Usage: node discord-bot/scripts/cleanup-orphans.js
 *
 * Safe to delete after the live guild is cleaned up. Kept under scripts/
 * so it doesn't get auto-loaded as a slash command.
 */

import { Client, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';
import { cleanupOrphanDuplicates, findDuplicates } from '../utils/serverLayout.js';

var client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async function() {
  try {
    var guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.channels.fetch();
    var dupes = findDuplicates(guild);
    console.log('[cleanup] duplicate groups before: ' + dupes.length);
    dupes.forEach(function(g) {
      console.log('  - ' + g.name + ' x' + g.channels.length + ': ' + g.channels.map(function(c) { return (c.parentName || '<no-parent>') + '#' + c.name; }).join(', '));
    });
    var res = await cleanupOrphanDuplicates(guild);
    console.log('[cleanup] deleted: ' + res.deleted.length);
    res.deleted.forEach(function(d) { console.log('  ✓ ' + d.name + ' (' + d.id + ')'); });
    if (res.skipped.length) {
      console.log('[cleanup] skipped: ' + res.skipped.length);
      res.skipped.forEach(function(s) { console.log('  - ' + s.name + ': ' + s.reason); });
    }
    if (res.errors.length) {
      console.log('[cleanup] errors: ' + res.errors.length);
      res.errors.forEach(function(e) { console.log('  ✗ ' + e); });
    }
  } catch (e) {
    console.error('[cleanup] failed:', (e && e.message) || e);
  } finally {
    await client.destroy();
    process.exit(0);
  }
});

client.login(process.env.DISCORD_TOKEN);
