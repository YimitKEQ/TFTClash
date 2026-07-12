/**
 * top32-format-post.js - post the FINAL 5-game knockout format to #top-32-info.
 * Roster is pulled LIVE from the DB (checked-in players), so it matches who is
 * actually going to play. Cleans the bot's earlier format message(s), then posts
 * + pins the current one.
 *
 * Usage: node discord-bot/scripts/top32-format-post.js
 */

import { Client, GatewayIntentBits, EmbedBuilder, Partials } from 'discord.js';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TOKEN = process.env.DISCORD_TOKEN;
const INFO_CH = '1525465163350806691';
const TOURNAMENT_ID = '06894db4-3dd0-443d-932c-8bcffe768fab';
const SITE_URL = 'https://tftclash.com';

function formatEmbed(roster) {
  var list = roster.map(function(n, i) { return (i + 1) + '. ' + n; }).join('\n');
  return new EmbedBuilder()
    .setColor(0xEDC200)
    .setTitle('📋 FINAL FORMAT - Top 32 Playoffs (5 games)')
    .setDescription(
      'Tonight is a **5-game knockout**. Here is how it runs:\n\n' +
      '🕔 **17:00 CEST**\n' +
      '**Games 1-2** - everyone plays, no cuts\n' +
      '**After Game 2** - cut down to the **Top 16**\n' +
      '**Games 3-5** - the Top 16 battle across three games\n' +
      '**After Game 5** - the **Top 8 advance** to the Grand Final\n\n' +
      'Cuts are by **total points** across your games (1st = 8 ... 8th = 1). Ties: most Top 4s, then fewest bottom 3s, then most 1sts.\n\n' +
      'The **Top 8 play the Grand Final on another day** (checkmate format).\n\n' +
      '✅ **Check in now** - `/checkin` or ' + SITE_URL + '. Field locks at 17:00; not checked in = your seat goes to a standby.'
    )
    .addFields({ name: 'Checked in so far (' + roster.length + ')', value: (list.length > 1024 ? list.slice(0, 1020) + '...' : list) || 'Nobody yet - check in!' })
    .setFooter({ text: 'TFT Clash · Top 32 Playoffs · GLHF' });
}

async function main() {
  if (!TOKEN) { console.error('[fmt] missing DISCORD_TOKEN'); process.exit(1); }

  const { supabase } = await import('../utils/supabase.js');
  const rosterRes = await supabase
    .from('registrations')
    .select('status, players(username, season_pts)')
    .eq('tournament_id', TOURNAMENT_ID)
    .eq('status', 'checked_in');
  if (rosterRes.error || !rosterRes.data) {
    console.error('[fmt] roster fetch failed:', rosterRes.error && rosterRes.error.message);
    process.exit(1);
  }
  var roster = rosterRes.data
    .map(function(r) { return r.players; })
    .filter(Boolean)
    .sort(function(a, b) { return (b.season_pts || 0) - (a.season_pts || 0) || String(a.username).localeCompare(String(b.username)); })
    .map(function(p) { return p.username; });
  console.log('[fmt] checked-in roster (' + roster.length + '): ' + roster.join(', '));

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages], partials: [Partials.Channel] });
  await client.login(TOKEN);
  await new Promise(function(res) { client.once('ready', res); });
  console.log('[fmt] connected as ' + client.user.tag);

  var info = await client.channels.fetch(INFO_CH);
  try {
    var recent = await info.messages.fetch({ limit: 25 });
    var mine = recent.filter(function(m) { return m.author.id === client.user.id; });
    for (var entry of mine) { await entry[1].delete().catch(function() {}); }
    console.log('[fmt] cleared ' + mine.size + ' old bot message(s) in #top-32-info');
  } catch (e) { console.error('[fmt] cleanup failed:', e && e.message); }

  var posted = await info.send({ embeds: [formatEmbed(roster)] });
  await posted.pin().catch(function() {});
  console.log('[fmt] posted + pinned FINAL format (checked-in roster) in #top-32-info');

  await client.destroy();
  process.exit(0);
}

main().catch(function(e) { console.error('[fmt] FATAL:', e); process.exit(1); });
