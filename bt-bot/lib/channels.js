/**
 * channels.js - resolve a channel from a raw id or a name substring.
 */

// Discord text-based channel types we are willing to post in.
var TEXT_CHANNEL_TYPES = [0, 5]; // GuildText, GuildAnnouncement

function isTextChannel(ch) {
  return ch && TEXT_CHANNEL_TYPES.indexOf(ch.type) !== -1;
}

// Accepts either a raw channel id or a (case-insensitive) name substring.
// Returns the matching text channel or null.
export function resolveChannel(guild, nameOrId) {
  if (!guild || !nameOrId) return null;
  var needle = String(nameOrId).trim();
  if (!needle) return null;

  // Exact id match first.
  var byId = guild.channels.cache.get(needle);
  if (isTextChannel(byId)) return byId;

  // Then a name substring match (case-insensitive).
  var lower = needle.toLowerCase();
  var match = guild.channels.cache.find(function(ch) {
    return isTextChannel(ch) && ch.name && ch.name.toLowerCase().indexOf(lower) !== -1;
  });
  return match || null;
}
