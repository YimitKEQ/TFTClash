/**
 * top32-sync-roles.js - sync Discord roles (rank / Pro / Host / Season Champion
 * / Player) for the current Top 32 Playoffs roster, so the players whose Discord
 * IDs were just backfilled + the subs get their roles. Standalone; does not need
 * the main bot running.
 *
 * Usage: node discord-bot/scripts/top32-sync-roles.js
 */

import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const TOURNAMENT_ID = '06894db4-3dd0-443d-932c-8bcffe768fab';

async function main() {
  if (!TOKEN || !GUILD_ID) { console.error('[sync] missing env'); process.exit(1); }
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
    partials: [Partials.GuildMember],
  });
  await client.login(TOKEN);
  await new Promise(function(res) { client.once('ready', res); });
  const guild = await client.guilds.fetch(GUILD_ID).then(function(g) { return g.fetch(); });
  await guild.members.fetch().catch(function() {});
  console.log('[sync] connected as ' + client.user.tag + ' / guild ' + guild.name);

  // Dynamic import AFTER dotenv so utils/supabase.js sees the env at eval time.
  const { supabase } = await import('../utils/supabase.js');
  const { syncPlayerRoles } = await import('../utils/roles.js');

  const res = await supabase
    .from('registrations')
    .select('player_id, players(id,username,rank,auth_user_id,discord_user_id)')
    .eq('tournament_id', TOURNAMENT_ID);
  if (res.error || !res.data) { console.error('[sync] fetch failed:', res.error && res.error.message); await client.destroy(); process.exit(1); }

  var players = res.data.map(function(r) { return r.players; }).filter(Boolean);
  console.log('[sync] syncing roles for ' + players.length + ' roster players...');

  var changed = 0, skipped = 0;
  for (var i = 0; i < players.length; i++) {
    try {
      var result = await syncPlayerRoles(guild, players[i]);
      if (result.skipped) { skipped++; console.log('  - skip ' + (players[i].username) + ': ' + result.reason); }
      else if ((result.added && result.added.length) || (result.removed && result.removed.length)) {
        changed++;
        console.log('  ✓ ' + result.player + ': +[' + result.added.join(',') + '] -[' + result.removed.join(',') + ']');
      }
    } catch (e) { console.error('  ! ' + players[i].username + ': ' + (e && e.message)); }
  }
  console.log('[sync] done. ' + changed + ' updated, ' + skipped + ' skipped (not in guild / no link).');
  await client.destroy();
  process.exit(0);
}

main().catch(function(e) { console.error('[sync] FATAL:', e); process.exit(1); });
