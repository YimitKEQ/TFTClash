import cron from 'node-cron';
import { EmbedBuilder } from 'discord.js';
import { standingsEmbed, reminderEmbed } from './utils/embeds.js';
import { getStandings, getSeasonConfig, getTournamentState, getRegistrations } from './utils/data.js';
import { requireChannel } from './utils/channels.js';

function getGuild(client) {
  return client.guilds.cache.get(process.env.GUILD_ID);
}

/** Post weekly standings to #standings. Callable manually from dashboard. */
export async function postStandings(client) {
  var guild = getGuild(client);
  var c = requireChannel(guild, 'standings', 'postStandings');
  if (!c) throw new Error('Channel #standings not found - create a text channel with "standings" in the name.');
  var players = await getStandings(10);
  var season = await getSeasonConfig();
  await c.send({ content: '**Weekly Standings Update**', embeds: [standingsEmbed(players, season)] });
  console.log('[sched] standings posted');
  return { channel: c.name, action: 'standings' };
}

/** Post 24h reminder to #clash-schedule. */
export async function postReminder24h(client) {
  var guild = getGuild(client);
  var c = requireChannel(guild, 'clash-schedule', 'postReminder24h');
  if (!c) throw new Error('Channel #clash-schedule not found - create a text channel with "clash-schedule" in the name.');
  var ts = await getTournamentState();
  await c.send({ content: '@everyone', embeds: [reminderEmbed(24, ts)] });
  console.log('[sched] 24h reminder posted');
  return { channel: c.name, action: 'reminder24h' };
}

/** Post 1h reminder to #clash-schedule. */
export async function postReminder1h(client) {
  var guild = getGuild(client);
  var c = requireChannel(guild, 'clash-schedule', 'postReminder1h');
  if (!c) throw new Error('Channel #clash-schedule not found - create a text channel with "clash-schedule" in the name.');
  var ts = await getTournamentState();
  await c.send({ content: '@here', embeds: [reminderEmbed(1, ts)] });
  console.log('[sched] 1h reminder posted');
  return { channel: c.name, action: 'reminder1h' };
}

/** Post a random hype/tip message on clash day morning. */
async function postClashDayHype(client) {
  var guild = getGuild(client);
  var c = requireChannel(guild, 'clash-schedule', 'clashDayHype') || requireChannel(guild, 'general', 'clashDayHype');
  if (!c) return;

  var ts = await getTournamentState();
  if (!ts || ts.phase === 'idle' || ts.phase === 'complete') return;

  var regs = await getRegistrations();
  var regCount = regs.length;

  var tips = [
    'Scout early, scout often. Knowing the lobby is half the battle.',
    'Do not force a comp just because it worked last time. Read the lobby.',
    'Items > units. A 2-star with BiS beats a 3-star with leftovers.',
    'Positioning wins fights. Check your opponent boards before every round.',
    'Strong Stage 2? Push levels. Weak Stage 2? Save HP through econ.',
    'The best players lose streak on purpose. Knowing when to bleed is a skill.',
    'Your augment choice at 2-1 shapes your entire game. Choose wisely.',
    'If 3 people are going the same comp, none of them are winning.',
    'Carousel priority is real. Sometimes 8th at Stage 3 is the play.',
    'Level 8 at 4-1 with 30+ gold. That is the dream. Make it happen.',
  ];

  var tip = tips[Math.floor(Math.random() * tips.length)];

  var embed = new EmbedBuilder()
    .setColor(0x4ECDC4)
    .setTitle('Clash Day - Quick Tip')
    .setDescription(
      '> *' + tip + '*\n\n' +
      'Clash #' + (ts.clashNumber || '?') + ' today at **' + (ts.clashTime || '8:00 PM GMT') + '**\n' +
      regCount + ' players registered.'
    )
    .setFooter({ text: 'TFT Clash - GL HF' })
    .setTimestamp();

  await c.send({ embeds: [embed] });
  console.log('[sched] Clash day hype posted');
}

/** Weekly summary posted Monday morning after standings. */
async function postWeeklySummary(client) {
  var guild = getGuild(client);
  var c = requireChannel(guild, 'general', 'weeklySummary');
  if (!c) return;

  var standings = await getStandings(5);
  var season = await getSeasonConfig();
  if (!standings.length) return;

  var leader = standings[0];
  var seasonName = (season && season.name) || 'Season 1';
  var currentClash = (season && season.currentClash) || '?';
  var totalClashes = (season && season.totalClashes) || '?';

  var embed = new EmbedBuilder()
    .setColor(0x9B72CF)
    .setTitle('Weekly Wrap - ' + seasonName)
    .setDescription(
      '**Clash ' + currentClash + '** of ' + totalClashes + ' in the books.\n\n' +
      '**Current Leader:** ' + leader.name + ' (' + leader.pts + ' pts)\n' +
      '**Top 5:**\n' +
      standings.map(function(p, i) {
        var icon = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.';
        return icon + ' ' + p.name + ' - ' + p.pts + ' pts';
      }).join('\n') +
      '\n\nUse `/standings` for the full leaderboard.'
    )
    .setFooter({ text: 'TFT Clash - See you next week' })
    .setTimestamp();

  await c.send({ embeds: [embed] });
  console.log('[sched] Weekly summary posted');
}

export function startScheduler(client) {
  var tz = process.env.TIMEZONE || 'Europe/London';

  // Weekly standings - every Monday 9am
  cron.schedule('0 9 * * 1', function() {
    postStandings(client).catch(function(e) { console.error('[sched] standings error:', e.message); });
  }, { timezone: tz });

  // Weekly summary - every Monday 9:05am (after standings)
  cron.schedule('5 9 * * 1', function() {
    postWeeklySummary(client).catch(function(e) { console.error('[sched] weekly summary error:', e.message); });
  }, { timezone: tz });

  // 24h reminder - Saturday 8PM
  cron.schedule('0 20 * * 6', function() {
    postReminder24h(client).catch(function(e) { console.error('[sched] 24h error:', e.message); });
  }, { timezone: tz });

  // 1h reminder - Sunday 7PM
  cron.schedule('0 19 * * 0', function() {
    postReminder1h(client).catch(function(e) { console.error('[sched] 1h error:', e.message); });
  }, { timezone: tz });

  // Clash day morning hype - Sunday 12PM
  cron.schedule('0 12 * * 0', function() {
    postClashDayHype(client).catch(function(e) { console.error('[sched] hype error:', e.message); });
  }, { timezone: tz });

  console.log('[sched] Jobs active');
}
