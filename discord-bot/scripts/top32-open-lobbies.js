/**
 * top32-open-lobbies.js - create/refresh the open "🔴 LIVE CLASH" lobby chat
 * channels (text + voice per lobby, read-only hub) from the current live-clash
 * state's savedLobbies. Reuses the bot's own setupLobbyRound so behavior is
 * identical to the normal automatic path; safe to re-run (idempotent, prunes
 * extras, refreshes rosters).
 *
 * Usage: node discord-bot/scripts/top32-open-lobbies.js
 */

import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

async function main() {
  if (!TOKEN || !GUILD_ID) { console.error('[lobbies] missing env'); process.exit(1); }

  const { supabase } = await import('../utils/supabase.js');
  const { setupLobbyRound } = await import('../utils/lobbies.js');

  var stateRes = await supabase.from('site_settings').select('value').eq('key', 'tournament_state').single();
  if (stateRes.error || !stateRes.data) { console.error('[lobbies] state fetch failed:', stateRes.error && stateRes.error.message); process.exit(1); }
  var raw = stateRes.data.value;
  var ts = (typeof raw === 'string') ? JSON.parse(raw) : raw;

  var savedLobbies = ts.savedLobbies || [];
  if (!savedLobbies.length) { console.error('[lobbies] no savedLobbies in tournament_state - build lobbies in the Bracket console first'); process.exit(1); }

  // Resolve player ids -> {id, name} so the channel roster posts show real names.
  var allIds = [].concat.apply([], savedLobbies);
  var pRes = await supabase.from('players').select('id, username').in('id', allIds);
  if (pRes.error) { console.error('[lobbies] players fetch failed:', pRes.error.message); process.exit(1); }
  var nameById = {};
  (pRes.data || []).forEach(function(p) { nameById[p.id] = p.username; });
  var resolvedLobbies = savedLobbies.map(function(ids) {
    return ids.map(function(id) { return { id: id, name: nameById[id] || ('Player ' + id) }; });
  });
  ts.savedLobbies = resolvedLobbies;

  console.log('[lobbies] ' + resolvedLobbies.length + ' lobbies, sizes: ' + resolvedLobbies.map(function(l) { return l.length; }).join('/'));
  resolvedLobbies.forEach(function(l, i) {
    console.log('  Lobby ' + String.fromCharCode(65 + i) + ': ' + l.map(function(p) { return p.name; }).join(', '));
  });

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers], partials: [Partials.Channel] });
  await client.login(TOKEN);
  await new Promise(function(res) { client.once('ready', res); });
  console.log('[lobbies] connected as ' + client.user.tag);

  const guild = await client.guilds.fetch(GUILD_ID).then(function(g) { return g.fetch(); });

  var result = await setupLobbyRound(guild, ts);
  console.log('[lobbies] setupLobbyRound result:', result);

  await client.destroy();
  process.exit(0);
}

main().catch(function(e) { console.error('[lobbies] FATAL:', e); process.exit(1); });
