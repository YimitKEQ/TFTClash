import cron from 'node-cron';
import { standingsEmbed, reminderEmbed } from './utils/embeds.js';
import { getStandings, getSeasonConfig, getTournamentState } from './utils/data.js';

function getChannel(client, name) {
  var g = client.guilds.cache.get(process.env.GUILD_ID);
  return g ? g.channels.cache.find(function(c) { return c.name.includes(name); }) : null;
}

/** Post weekly standings to #standings. Callable manually from dashboard. */
export async function postStandings(client) {
  var c = getChannel(client, 'standings');
  if (!c) throw new Error('Channel #standings not found');
  var players = await getStandings(10);
  var season = await getSeasonConfig();
  await c.send({ content: '📊 **Weekly Standings Update**', embeds: [standingsEmbed(players, season)] });
  console.log('[sched] standings posted');
  return { channel: c.name, action: 'standings' };
}

/** Post 24h reminder to #clash-schedule. */
export async function postReminder24h(client) {
  var c = getChannel(client, 'clash-schedule');
  if (!c) throw new Error('Channel #clash-schedule not found');
  var ts = await getTournamentState();
  await c.send({ content: '@everyone', embeds: [reminderEmbed(24, ts)] });
  console.log('[sched] 24h reminder posted');
  return { channel: c.name, action: 'reminder24h' };
}

/** Post 1h reminder to #clash-schedule. */
export async function postReminder1h(client) {
  var c = getChannel(client, 'clash-schedule');
  if (!c) throw new Error('Channel #clash-schedule not found');
  var ts = await getTournamentState();
  await c.send({ content: '@here', embeds: [reminderEmbed(1, ts)] });
  console.log('[sched] 1h reminder posted');
  return { channel: c.name, action: 'reminder1h' };
}

export function startScheduler(client) {
  // Weekly standings - every Monday 9am
  cron.schedule('0 9 * * 1', function() {
    postStandings(client).catch(function(e) { console.error('[sched] standings error:', e); });
  }, { timezone: process.env.TIMEZONE || 'Europe/London' });

  // 24h reminder - Saturday 8PM
  cron.schedule('0 20 * * 6', function() {
    postReminder24h(client).catch(function(e) { console.error('[sched] 24h error:', e); });
  }, { timezone: process.env.TIMEZONE || 'Europe/London' });

  // 1h reminder - Sunday 7PM
  cron.schedule('0 19 * * 0', function() {
    postReminder1h(client).catch(function(e) { console.error('[sched] 1h error:', e); });
  }, { timezone: process.env.TIMEZONE || 'Europe/London' });

  console.log('[sched] Jobs active');
}
