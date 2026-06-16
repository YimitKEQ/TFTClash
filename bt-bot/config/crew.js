/**
 * crew.js - the BrosephTech crew roster and department palette.
 *
 * BT_CREW is the canonical list of people the accountability bot tracks.
 * BT_DEPARTMENTS mirrors the content board's department taxonomy.
 *
 * resolveDiscordId / mention translate a board name into a real Discord ping
 * when (and only when) a mapping exists. They never fabricate a ping.
 */

export var BT_CREW = [
  { name: 'Levitate', role: 'Founder' },
  { name: 'Maestosoya', role: 'Co-Founder & Strategy' },
  { name: 'Broseph', role: 'Founder' },
  { name: 'Cathy', role: 'Scriptwriter' },
  { name: 'Bacrif', role: 'Video Editor' },
  { name: 'Axel', role: 'Graphics & Thumbnails' },
  { name: 'Fridley', role: 'Developer' },
  { name: 'Tactic', role: 'Design & Product' },
];

export var BT_DEPARTMENTS = [
  {
    id: 'content',
    label: 'Content',
    icon: 'play_circle',
    color: '#5BA3DB',
    accent: 'rgba(91,163,219,0.15)',
    halo: 'rgba(91,163,219,0.55)',
  },
  {
    id: 'engineering',
    label: 'Engineering',
    icon: 'code',
    color: '#818CF8',
    accent: 'rgba(129,140,248,0.15)',
    halo: 'rgba(129,140,248,0.55)',
  },
  {
    id: 'design',
    label: 'Design',
    icon: 'brush',
    color: '#F472B6',
    accent: 'rgba(244,114,182,0.15)',
    halo: 'rgba(244,114,182,0.55)',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: 'campaign',
    color: '#E8A020',
    accent: 'rgba(232,160,32,0.15)',
    halo: 'rgba(232,160,32,0.55)',
  },
  {
    id: 'ops',
    label: 'Ops',
    icon: 'insights',
    color: '#34D399',
    accent: 'rgba(52,211,153,0.15)',
    halo: 'rgba(52,211,153,0.55)',
  },
];

// Parse BT_CREW_DISCORD once and cache it. Malformed JSON falls back to an
// empty map and logs a warning, but never throws (the bot must still boot).
var crewDiscordCache = {};
var crewDiscordLoaded = false;

function loadCrewDiscord() {
  if (crewDiscordLoaded) return crewDiscordCache;
  crewDiscordLoaded = true;
  var raw = process.env.BT_CREW_DISCORD;
  if (!raw || !raw.trim()) {
    crewDiscordCache = {};
    return crewDiscordCache;
  }
  try {
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.warn('[crew] BT_CREW_DISCORD must be a JSON object of name -> id. Falling back to empty map.');
      crewDiscordCache = {};
      return crewDiscordCache;
    }
    crewDiscordCache = parsed;
    return crewDiscordCache;
  } catch (e) {
    console.warn('[crew] BT_CREW_DISCORD is not valid JSON. Falling back to empty map. (' + ((e && e.message) || e) + ')');
    crewDiscordCache = {};
    return crewDiscordCache;
  }
}

// Returns the Discord user id mapped to a crew name, or null if unmapped.
export function resolveDiscordId(name) {
  if (!name) return null;
  var map = loadCrewDiscord();
  var id = map[name];
  return id ? String(id) : null;
}

// Returns a real Discord ping when the name is mapped, otherwise the plain
// name in bold. Never produces a fabricated ping.
export function mention(name) {
  if (!name) return '**Unassigned**';
  var id = resolveDiscordId(name);
  if (id) return '<@' + id + '>';
  return '**' + name + '**';
}

// Reverse lookup: a Discord user id back to the crew name(s) that map to it.
// Returns the first matching crew name, or null if no mapping exists.
export function crewNameForDiscordId(discordId) {
  if (!discordId) return null;
  var map = loadCrewDiscord();
  var names = Object.keys(map);
  for (var i = 0; i < names.length; i++) {
    if (String(map[names[i]]) === String(discordId)) return names[i];
  }
  return null;
}

// Match a free-text name or a <@id> mention to a known crew name.
// Returns the canonical crew name, or null if nothing matches.
export function matchCrewName(text) {
  if (!text) return null;
  var raw = String(text).trim();
  var mentionMatch = raw.match(/^<@!?(\d+)>$/);
  if (mentionMatch) {
    var byId = crewNameForDiscordId(mentionMatch[1]);
    if (byId) return byId;
  }
  var lower = raw.toLowerCase().replace(/^@/, '');
  if (!lower) return null;
  var i;
  for (i = 0; i < BT_CREW.length; i++) {
    if (BT_CREW[i].name.toLowerCase() === lower) return BT_CREW[i].name;
  }
  for (i = 0; i < BT_CREW.length; i++) {
    if (lower.indexOf(BT_CREW[i].name.toLowerCase()) !== -1) return BT_CREW[i].name;
  }
  return null;
}

// Test-only / hot-reload helper: clears the cached parse of BT_CREW_DISCORD.
export function _resetCrewDiscordCache() {
  crewDiscordCache = {};
  crewDiscordLoaded = false;
}
