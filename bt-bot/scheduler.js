/**
 * scheduler.js - standup, nudge, weekly digest, and blocked sweep crons.
 *
 * 09:30 daily (TIMEZONE): post the standup embed to BT_STANDUP_CHANNEL.
 * 18:00 daily (TIMEZONE): ping each member who has overdue or stuck cards.
 * 09:00 Monday (TIMEZONE): post the weekly digest scorecard.
 * 12:00 daily (TIMEZONE): sweep blocked cards and ping their owners.
 *
 * postStandup / postNudges are exported for manual triggers (slash commands).
 * postDigest / postBlockedSweep live in lib/scoring.js. A missing channel is
 * logged and skipped, never crashed on, and every cron is wrapped so a failure
 * never takes down the process.
 */

import cron from 'node-cron';
import { fetchCards, buildAccountability } from './lib/board.js';
import { standupEmbed, nudgeContent } from './lib/embeds.js';
import { resolveChannel } from './lib/channels.js';
import { postDigest, postBlockedSweep } from './lib/scoring.js';

function getGuild(client) {
  return client.guilds.cache.get(process.env.BT_GUILD_ID);
}

function getTimezone() {
  return process.env.TIMEZONE || 'Europe/London';
}

function getStandupChannelName() {
  return process.env.BT_STANDUP_CHANNEL || 'bt-standup';
}

function resolveStandupChannel(client) {
  var guild = getGuild(client);
  if (!guild) {
    console.warn('[scheduler] guild ' + process.env.BT_GUILD_ID + ' not in cache. Skipping.');
    return null;
  }
  var channel = resolveChannel(guild, getStandupChannelName());
  if (!channel) {
    console.warn('[scheduler] standup channel "' + getStandupChannelName() + '" not found. Skipping.');
    return null;
  }
  return channel;
}

// Post the standup embed now. Returns true on success, false when skipped.
export async function postStandup(client) {
  var channel = resolveStandupChannel(client);
  if (!channel) return false;
  try {
    var cards = await fetchCards();
    var accountability = buildAccountability(cards);
    var embed = standupEmbed(accountability);
    await channel.send({ embeds: [embed] });
    console.log('[scheduler] standup posted to #' + channel.name);
    return true;
  } catch (e) {
    console.error('[scheduler] postStandup failed: ' + ((e && e.message) || e));
    return false;
  }
}

// Ping every member with overdue or stuck cards. Returns the number of nudges sent.
export async function postNudges(client) {
  var channel = resolveStandupChannel(client);
  if (!channel) return 0;
  try {
    var cards = await fetchCards();
    var accountability = buildAccountability(cards);
    var members = accountability.members || {};
    var names = Object.keys(members);
    var sent = 0;
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      var content = nudgeContent(name, members[name]);
      if (!content) continue;
      try {
        await channel.send({ content: content });
        sent++;
      } catch (sendErr) {
        console.warn('[scheduler] nudge for ' + name + ' failed: ' + ((sendErr && sendErr.message) || sendErr));
      }
    }
    console.log('[scheduler] sent ' + sent + ' nudge(s) to #' + channel.name);
    return sent;
  } catch (e) {
    console.error('[scheduler] postNudges failed: ' + ((e && e.message) || e));
    return 0;
  }
}

// Schedule a cron job, surviving a bad TIMEZONE. An invalid timezone makes
// node-cron throw synchronously, which would abort the whole startScheduler
// call, so we retry once with the default tz, then with the system tz.
function safeSchedule(label, expr, fn, tz) {
  try {
    return cron.schedule(expr, fn, { timezone: tz });
  } catch (e) {
    console.warn('[scheduler] ' + label + ' could not use tz "' + tz + '" (' + ((e && e.message) || e) + '). Retrying with Europe/London.');
  }
  try {
    return cron.schedule(expr, fn, { timezone: 'Europe/London' });
  } catch (e2) {
    console.warn('[scheduler] ' + label + ' falling back to system timezone.');
  }
  try {
    return cron.schedule(expr, fn);
  } catch (e3) {
    console.error('[scheduler] ' + label + ' could not be scheduled: ' + ((e3 && e3.message) || e3));
    return null;
  }
}

export function startScheduler(client) {
  var tz = getTimezone();

  safeSchedule('standup', '30 9 * * *', function() {
    postStandup(client).catch(function(e) {
      console.error('[scheduler] standup cron error: ' + ((e && e.message) || e));
    });
  }, tz);

  safeSchedule('nudge', '0 18 * * *', function() {
    postNudges(client).catch(function(e) {
      console.error('[scheduler] nudge cron error: ' + ((e && e.message) || e));
    });
  }, tz);

  safeSchedule('digest', '0 9 * * 1', function() {
    postDigest(client).catch(function(e) {
      console.error('[scheduler] digest cron error: ' + ((e && e.message) || e));
    });
  }, tz);

  safeSchedule('blocked sweep', '0 12 * * *', function() {
    postBlockedSweep(client).catch(function(e) {
      console.error('[scheduler] blocked sweep cron error: ' + ((e && e.message) || e));
    });
  }, tz);

  console.log('[scheduler] crons armed (standup 09:30, nudge 18:00, digest Mon 09:00, blocked sweep 12:00, tz=' + tz + ')');
}
