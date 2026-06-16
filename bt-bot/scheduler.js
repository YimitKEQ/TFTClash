/**
 * scheduler.js - daily standup + evening nudge crons.
 *
 * 09:30 (TIMEZONE): post the standup embed to BT_STANDUP_CHANNEL.
 * 18:00 (TIMEZONE): ping each member who has overdue or stuck cards.
 *
 * postStandup / postNudges are exported for manual triggers (slash commands).
 * A missing channel is logged and skipped, never crashed on.
 */

import cron from 'node-cron';
import { fetchCards, buildAccountability } from './lib/board.js';
import { standupEmbed, nudgeContent } from './lib/embeds.js';
import { resolveChannel } from './lib/channels.js';

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

export function startScheduler(client) {
  var tz = getTimezone();

  // Daily standup at 09:30.
  cron.schedule('30 9 * * *', function() {
    postStandup(client).catch(function(e) {
      console.error('[scheduler] standup cron error: ' + ((e && e.message) || e));
    });
  }, { timezone: tz });

  // Evening nudge at 18:00.
  cron.schedule('0 18 * * *', function() {
    postNudges(client).catch(function(e) {
      console.error('[scheduler] nudge cron error: ' + ((e && e.message) || e));
    });
  }, { timezone: tz });

  console.log('[scheduler] crons armed (standup 09:30, nudge 18:00, tz=' + tz + ')');
}
