/**
 * scheduler.js - standup, nudge, weekly digest, blocked sweep, and Jira sync crons.
 *
 * 09:30 daily (TIMEZONE): post the standup embed to BT_STANDUP_CHANNEL.
 * 18:00 daily (TIMEZONE): ping each member who has overdue or stuck cards.
 * 09:00 Monday (TIMEZONE): post the weekly digest scorecard.
 * 12:00 daily (TIMEZONE): sweep blocked cards and ping their owners.
 * every 10 minutes: pull Jira status changes onto the board.
 *
 * postStandup / postNudges / postJiraSync are exported for manual triggers
 * (slash commands). postDigest / postBlockedSweep live in lib/scoring.js. A
 * missing channel is logged and skipped, never crashed on, and every cron is
 * wrapped so a failure never takes down the process.
 */

import cron from 'node-cron';
import { fetchCards, buildAccountability } from './lib/board.js';
import { standupEmbed, nudgeContent } from './lib/embeds.js';
import { resolveChannel } from './lib/channels.js';
import { postDigest, postBlockedSweep } from './lib/scoring.js';
import { syncJiraToBoard, columnLabel } from './lib/jiraSync.js';
import { BRAND, COLOR, MARK, baseEmbed, clamp, eyebrow, pack } from './lib/ui.js';

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

/**
 * The embed announcing what a sync pass moved. Pure, so the preview renderer
 * and the tests can build the real thing without Discord or a database.
 * Returns null when nothing moved: a heartbeat every ten minutes saying "no
 * change" would train everyone to ignore the channel.
 */
export function jiraSyncEmbed(result, now) {
  var moves = (result && result.moves) || [];
  if (!moves.length) return null;

  var lines = moves.map(function(m) {
    var label = m.url ? '[' + m.key + '](' + m.url + ')' : m.key;
    return label + '  ' + clamp(m.title, 60) + '\n`' + columnLabel(m.from) + ' ' + MARK.arrow + ' ' + columnLabel(m.to) + '`'
      + (m.status ? '  ' + m.status : '');
  });

  var doneCount = moves.filter(function(m) { return m.category === 'done'; }).length;

  return baseEmbed({
    color: doneCount === moves.length ? COLOR.success : COLOR.info,
    author: BRAND.name + '  ' + MARK.arrow + '  jira sync',
    title: MARK.board + '  ' + moves.length + ' card' + (moves.length === 1 ? '' : 's') + ' moved to match Jira',
    description: 'Jira is the source of truth for status. Move a ticket there and the board follows within ten minutes.',
    footer: 'Checked ' + ((result && result.checked) || 0) + ' linked card(s)',
    timestamp: now || new Date(),
  }).addFields({ name: eyebrow('Moved', moves.length), value: pack(lines) });
}

/**
 * Run one Jira to board sync pass and announce any moves. Returns the raw sync
 * result so a slash command can report the quiet outcome too.
 */
export async function postJiraSync(client, options) {
  var result = await syncJiraToBoard(options);

  if (!result.ok && !result.skipped) {
    console.warn('[jira-sync] pass failed: ' + result.reason);
    return result;
  }
  if (result.skipped) {
    console.log('[jira-sync] skipped: ' + result.reason);
    return result;
  }

  if (result.errors && result.errors.length) {
    console.warn('[jira-sync] ' + result.errors.length + ' card write(s) failed: '
      + result.errors.map(function(e) { return e.key + ' (' + e.error + ')'; }).join(', '));
  }
  if (result.missing && result.missing.length) {
    console.warn('[jira-sync] ' + result.missing.length + ' linked card(s) point at an issue that no longer exists: ' + result.missing.join(', '));
  }

  console.log('[jira-sync] checked ' + result.checked + ', moved ' + result.moved + ', baseline stamped ' + result.stamped);
  if (!result.moved) return result;

  var embed = jiraSyncEmbed(result, new Date());
  if (!embed) return result;

  var channel = resolveStandupChannel(client);
  if (!channel) return result;
  try {
    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.warn('[jira-sync] could not announce moves: ' + ((e && e.message) || e));
  }
  return result;
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

  // Ten minutes is the compromise between "the board feels live" and not
  // hammering the Jira API all day for a board that changes a few times a week.
  safeSchedule('jira sync', '*/10 * * * *', function() {
    postJiraSync(client).catch(function(e) {
      console.error('[scheduler] jira sync cron error: ' + ((e && e.message) || e));
    });
  }, tz);

  console.log('[scheduler] crons armed (standup 09:30, nudge 18:00, digest Mon 09:00, blocked sweep 12:00, jira sync every 10m, tz=' + tz + ')');
}
