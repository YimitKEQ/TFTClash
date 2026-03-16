import cron from 'node-cron';
import { standingsEmbed, reminderEmbed, clashInfoEmbed } from './utils/embeds.js';
import { getStandings } from './utils/data.js';

export function startScheduler(client) {
  const guild = () => client.guilds.cache.get(process.env.GUILD_ID);
  const ch    = (name) => guild()?.channels.cache.find(c => c.name.includes(name));

  // Weekly standings — every Monday 9am
  cron.schedule('0 9 * * 1', async () => {
    const c = ch('standings');
    if (c) {
      const players = await getStandings();
      await c.send({ content: '📊 **Weekly Standings Update**', embeds: [standingsEmbed(players)] });
      console.log('[sched] standings posted');
    }
  }, { timezone: process.env.TIMEZONE || 'Europe/London' });

  // 24h reminder — Saturday 8PM
  cron.schedule('0 20 * * 6', async () => {
    const c = ch('clash-schedule');
    if (c) {
      await c.send({ content: '@everyone', embeds: [reminderEmbed(24)] });
      console.log('[sched] 24h reminder');
    }
  }, { timezone: process.env.TIMEZONE || 'Europe/London' });

  // 1h reminder — Sunday 7PM
  cron.schedule('0 19 * * 0', async () => {
    const c = ch('clash-schedule');
    if (c) {
      await c.send({ content: '@here', embeds: [reminderEmbed(1)] });
      console.log('[sched] 1h reminder');
    }
  }, { timezone: process.env.TIMEZONE || 'Europe/London' });

  console.log('[sched] Jobs active');
}
