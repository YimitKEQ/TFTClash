/**
 * backfill-tournament-role.js
 * One-off: create + assign a per-tournament Discord role for an existing
 * tournament whose role wasn't created at check-in time.
 *
 *   node backfill-tournament-role.js <tournament_id>
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { supabase } from './utils/supabase.js';
import { ensureTournamentRole, syncTournamentRoleMembers } from './utils/tournamentRoles.js';

var TOURNAMENT_ID = process.argv[2];
if (!TOURNAMENT_ID) {
  console.error('Usage: node backfill-tournament-role.js <tournament_id>');
  process.exit(1);
}

var client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
  partials: [Partials.GuildMember],
});

client.once('ready', async function() {
  try {
    var guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) {
      console.error('Guild ' + process.env.GUILD_ID + ' not found');
      process.exit(1);
    }
    try { await guild.members.fetch(); } catch (_e) {}

    var tRes = await supabase
      .from('tournaments')
      .select('id, name, phase, type')
      .eq('id', TOURNAMENT_ID)
      .single();
    if (tRes.error || !tRes.data) {
      console.error('Tournament not found:', tRes.error && tRes.error.message);
      process.exit(1);
    }
    var t = tRes.data;
    console.log('Backfilling role for "' + t.name + '" (' + t.id + ', phase=' + t.phase + ')...');
    await ensureTournamentRole(guild, t);
    var stats = await syncTournamentRoleMembers(guild, t);
    console.log('Done. Added ' + stats.added + ', removed ' + stats.removed + '.');
    process.exit(0);
  } catch (e) {
    console.error('Backfill failed:', e);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);
