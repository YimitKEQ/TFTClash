/**
 * channels.js — Robust channel resolution for the TFT Clash bot.
 * Finds channels by name with graceful fallbacks.
 */

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
