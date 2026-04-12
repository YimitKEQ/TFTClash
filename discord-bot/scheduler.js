import cron from 'node-cron';
import { standingsEmbed, reminderEmbed } from './utils/embeds.js';
import { getStandings, getSeasonConfig, getTournamentState } from './utils/data.js';

export function startScheduler(client) {
  const guild = function() { return client.guilds.cache.get(process.env.GUILD_ID); };
  const ch = function(name) {
    const g = guild();
    return g ? g.channels.cache.find(function(c) { return c.name.includes(name); }) : null;
  };

  // Weekly standings - every Monday 9am
  cron.schedule('0 9 * * 1', async function() {
    const c = ch('standings');
    if (c) {
      const players = await getStandings(10);
      const season = await getSeasonConfig();
      await c.send({ content: '📊 **Weekly Standings Update**', embeds: [standingsEmbed(players, season)] });
      console.log('[sched] standings posted');
    }
  }, { timezone: process.env.TIMEZONE || 'Europe/London' });

  // 24h reminder - Saturday 8PM (adjust based on your clash day)
  cron.schedule('0 20 * * 6', async function() {
    const c = ch('clash-schedule');
    if (c) {
      const ts = await getTournamentState();
      await c.send({ content: '@everyone', embeds: [reminderEmbed(24, ts)] });
      console.log('[sched] 24h reminder');
    }
  }, { timezone: process.env.TIMEZONE || 'Europe/London' });

  // 1h reminder - Sunday 7PM
  cron.schedule('0 19 * * 0', async function() {
    const c = ch('clash-schedule');
    if (c) {
      const ts = await getTournamentState();
      await c.send({ content: '@here', embeds: [reminderEmbed(1, ts)] });
      console.log('[sched] 1h reminder');
    }
  }, { timezone: process.env.TIMEZONE || 'Europe/London' });

  console.log('[sched] Jobs active');
}
