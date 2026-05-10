/**
 * channels.js — Robust channel resolution for the TFT Clash bot.
 * Finds channels by name with graceful fallbacks.
 */

/**
 * Semantic targets used across the bot. Each value is a list of substrings
 * tried in order — first hit wins. Keep these in sync with serverLayout.js
 * so /layout audit + apply will always satisfy them.
 *
 * Use `channelFor(guild, 'clashSchedule')` instead of literal strings so
 * future renames live in one place.
 */
export var CHANNEL_TARGETS = Object.freeze({
  announcements:      ['announcements'],
  rules:              ['rules'],
  faq:                ['faq'],
  howToClash:         ['how-to-clash'],
  notifications:      ['notifications'],
  verify:             ['verify'],
  botCommands:        ['bot-commands'],
  clashSchedule:      ['clash-schedule'],
  clashRegistrations: ['clash-registrations', 'registrations'],
  results:            ['results'],
  standings:          ['standings'],
  bracket:            ['bracket'],
  general:            ['general'],
  newcomers:          ['newcomers'],
  lfg:                ['lfg'],
  clips:              ['clips'],
  metaTalk:           ['meta-talk'],
  feedback:           ['feedback'],
  bugReports:         ['bug-reports'],
  botLogs:            ['bot-logs'],
  hostDashboard:      ['host-dashboard'],
});

/**
 * Resolve a Discord text channel by name substring.
 * Returns the channel or null (never throws).
 * @param {import('discord.js').Guild} guild
 * @param {string} name - channel name to search for (substring match)
 * @returns {import('discord.js').TextChannel|null}
 */
export function resolveChannel(guild, name) {
  if (!guild) return null;
  return guild.channels.cache.find(function(c) {
    return c.type === 0 && c.name.includes(name);
  }) || null;
}

/**
 * Resolve a channel, logging a warning if not found.
 * @param {import('discord.js').Guild} guild
 * @param {string} name
 * @param {string} [context] - what feature needed it (for logging)
 * @returns {import('discord.js').TextChannel|null}
 */
export function requireChannel(guild, name, context) {
  var ch = resolveChannel(guild, name);
  if (!ch) {
    console.log('[channels] #' + name + ' not found' + (context ? ' (needed by ' + context + ')' : '') + ' - skipping');
  }
  return ch;
}

/**
 * Resolve a channel by semantic target key (e.g. 'clashSchedule'). Tries each
 * substring in CHANNEL_TARGETS[key] until one matches.
 *
 * @param {import('discord.js').Guild} guild
 * @param {keyof typeof CHANNEL_TARGETS} key
 * @returns {import('discord.js').TextChannel|null}
 */
export function channelFor(guild, key) {
  if (!guild) return null;
  var candidates = CHANNEL_TARGETS[key];
  if (!candidates) return null;
  for (var name of candidates) {
    var ch = resolveChannel(guild, name);
    if (ch) return ch;
  }
  return null;
}
