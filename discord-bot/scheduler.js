import cron from 'node-cron';
import { EmbedBuilder } from 'discord.js';
import { standingsEmbed, reminderEmbed } from './utils/embeds.js';
import { getStandings, getSeasonConfig, getTournamentState, getRegistrations } from './utils/data.js';
import { requireChannel } from './utils/channels.js';

function getGuild(client) {
  return client.guilds.cache.get(process.env.GUILD_ID);
}

// Parse the scheduled clash time from tournament_state. Returns Date or null.
function getClashDate(ts) {
  if (!ts || !ts.clashTimestamp) return null;
  var d = new Date(ts.clashTimestamp);
  return isNaN(d.getTime()) ? null : d;
}

// True when the scheduled clash falls on the same calendar day as `now`
// in the configured timezone. Uses Intl to avoid host-locale drift.
function isSameClashDay(clashDate, now, tz) {
  if (!clashDate) return false;
  try {
    var fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    return fmt.format(clashDate) === fmt.format(now);
  } catch (e) {
    return clashDate.toDateString() === now.toDateString();
  }
}

// True when the clash is between [minH, maxH] hours ahead of now.
function hoursAhead(clashDate, minH, maxH) {
  if (!clashDate) return false;
  var diffH = (clashDate.getTime() - Date.now()) / 3600000;
  return diffH >= minH && diffH <= maxH;
}

// A clash is "scheduled" only if state has a future timestamp, a real DB id,
// and is not in a terminal phase. This is the gate every public post must pass.
function isClashScheduled(ts) {
  if (!ts) return false;
  if (ts.phase === 'idle' || ts.phase === 'complete' || ts.phase === 'cancelled') return false;
  if (!ts.dbTournamentId && !ts.activeTournamentId) return false;
  var d = getClashDate(ts);
  if (!d) return false;
  // Allow up to 4h after start so live posts still go through; reject anything older.
  return d.getTime() > Date.now() - 4 * 3600000;
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

/** Post 24h reminder to #clash-schedule. Manual override skips the schedule gate. */
export async function postReminder24h(client, opts) {
  var guild = getGuild(client);
  var c = requireChannel(guild, 'clash-schedule', 'postReminder24h');
  if (!c) throw new Error('Channel #clash-schedule not found - create a text channel with "clash-schedule" in the name.');
  var ts = await getTournamentState();
  var manual = opts && opts.manual;
  if (!manual && !isClashScheduled(ts)) { console.log('[sched] 24h skipped - no scheduled clash'); return { skipped: true, reason: 'no-clash' }; }
  await c.send({ content: '@everyone', embeds: [reminderEmbed(24, ts)] });
  console.log('[sched] 24h reminder posted');
  return { channel: c.name, action: 'reminder24h' };
}

/** Post 1h reminder to #clash-schedule. Manual override skips the schedule gate. */
export async function postReminder1h(client, opts) {
  var guild = getGuild(client);
  var c = requireChannel(guild, 'clash-schedule', 'postReminder1h');
  if (!c) throw new Error('Channel #clash-schedule not found - create a text channel with "clash-schedule" in the name.');
  var ts = await getTournamentState();
  var manual = opts && opts.manual;
  if (!manual && !isClashScheduled(ts)) { console.log('[sched] 1h skipped - no scheduled clash'); return { skipped: true, reason: 'no-clash' }; }
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
  if (!isClashScheduled(ts)) { console.log('[sched] hype skipped - no scheduled clash'); return; }

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

// Per-clash de-dupe so a given tournament only fires each reminder once,
// even if the proximity tick re-evaluates it. Keyed by dbTournamentId + kind.
var firedReminders = new Set();
function reminderKey(ts, kind) {
  var id = (ts && (ts.dbTournamentId || ts.activeTournamentId)) || 'no-id';
  return id + ':' + kind;
}
function alreadyFired(ts, kind) { return firedReminders.has(reminderKey(ts, kind)); }
function markFired(ts, kind) { firedReminders.add(reminderKey(ts, kind)); }

// Single tick: evaluates the live tournament_state and posts only the
// reminders whose timing actually matches. Day-of-week is no longer assumed.
async function tickReminders(client) {
  var ts = await getTournamentState();
  if (!isClashScheduled(ts)) return;
  var clashDate = getClashDate(ts);
  var tz = process.env.TIMEZONE || 'Europe/London';
  var now = new Date();

  // 24h reminder window: 22-26 hours ahead
  if (hoursAhead(clashDate, 22, 26) && !alreadyFired(ts, '24h')) {
    markFired(ts, '24h');
    try { await postReminder24h(client); } catch (e) { console.error('[sched] 24h error:', e.message); }
  }
  // 1h reminder window: 0.5-1.5 hours ahead
  if (hoursAhead(clashDate, 0.5, 1.5) && !alreadyFired(ts, '1h')) {
    markFired(ts, '1h');
    try { await postReminder1h(client); } catch (e) { console.error('[sched] 1h error:', e.message); }
  }
  // Clash day hype: only on the actual clash day, only before clash starts
  if (isSameClashDay(clashDate, now, tz) && clashDate.getTime() > now.getTime() && !alreadyFired(ts, 'hype')) {
    markFired(ts, 'hype');
    try { await postClashDayHype(client); } catch (e) { console.error('[sched] hype error:', e.message); }
  }
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

  // Reminder tick - every 15 minutes. The function itself decides what (if
  // anything) to post based on the actual scheduled clash time.
  cron.schedule('*/15 * * * *', function() {
    tickReminders(client).catch(function(e) { console.error('[sched] tick error:', e.message); });
  }, { timezone: tz });

  console.log('[sched] Jobs active (date-aware reminders)');
}
