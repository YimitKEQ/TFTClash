/**
 * serverLayout.js — Desired channel layout for the TFT Clash Discord server.
 *
 * Source of truth for "what categories and channels should exist". The
 * `/layout audit` command diffs a live guild against this map; `/layout apply`
 * creates anything missing. Neither command ever deletes — humans handle removal.
 *
 * Names are kept stable on purpose so that `resolveChannel()` substring matches
 * keep working. Cosmetic prefixes (emojis, bullets) live here and are stripped
 * before comparison.
 */

import { ChannelType } from 'discord.js';

// Per-tournament categories created by customTournamentChannels.js look like
// "🏆 my-cup #a3f1b9c8". They are owned by that module and must be excluded
// from layout audits so they aren't reported as "extras" or removed by humans.
export var TOURNAMENT_CATEGORY_PATTERN = /🏆\s.*#[a-f0-9]{6,}/i;

// Lobby category created by lobbies.js for the season clash. Same exclusion
// applies — it's transient and owned by that module.
export var LIVE_CLASH_CATEGORY = '🔴 LIVE CLASH';

// "kind" maps to a Discord channel type. Default 'text' for GuildText.
export var DESIRED_LAYOUT = [
  {
    category: '── INFO ──',
    children: [
      { name: 'announcements',     kind: 'text', topic: 'Official news from the TFT Clash team. Read-only.' },
      { name: 'rules',             kind: 'text', topic: 'Server rules. Read before participating.' },
      { name: 'how-to-clash',      kind: 'text', topic: 'Step-by-step guide on how a TFT Clash works.' },
      { name: 'faq',               kind: 'text', topic: 'Frequently asked questions. Read before pinging a host.' },
    ],
  },
  {
    category: '── PLATFORM ──',
    children: [
      { name: 'verify',            kind: 'text', topic: 'Click the Verify button to unlock the rest of the server.' },
      { name: 'notifications',     kind: 'text', topic: 'React to opt in to ping roles. The bot manages this panel.' },
      { name: 'bot-commands',      kind: 'text', topic: 'Try out slash commands here. /standings, /clash, /lobby, /notify, ...' },
    ],
  },
  {
    category: '── TOURNAMENTS ──',
    children: [
      { name: 'clash-schedule',      kind: 'text', topic: 'Upcoming clashes, reminders, phase changes. Bot-posted.' },
      { name: 'clash-registrations', kind: 'text', topic: 'Live feed of new clash registrations. Bot-posted.' },
      { name: 'results',             kind: 'text', topic: 'Final placements published after each clash. Bot-posted.' },
      { name: 'standings',           kind: 'text', topic: 'Weekly standings auto-posted by the bot.' },
      { name: 'bracket',             kind: 'text', topic: 'Bracket and recap posts. Bot-posted.' },
    ],
  },
  {
    category: '── COMMUNITY ──',
    children: [
      { name: 'general',           kind: 'text', topic: 'Main community chat. Be kind, no slurs, no advertising.' },
      { name: 'meta-talk',         kind: 'text', topic: 'Patch talk, comp theory, augment debates.' },
      { name: 'lfg',               kind: 'text', topic: 'Looking for a duo or scrim partner? Post here.' },
      { name: 'clips',             kind: 'text', topic: 'Drop your sickest TFT moments and screenshots.' },
      { name: 'newcomers',         kind: 'text', topic: 'New to TFT Clash? Say hi here.' },
    ],
  },
  {
    category: '── SUPPORT ──',
    children: [
      { name: 'feedback',          kind: 'forum', topic: 'Suggestions, ideas, feature requests. One thread per idea.' },
      { name: 'bug-reports',       kind: 'forum', topic: 'Site or bot bug? Open a thread with steps to reproduce.' },
    ],
  },
  {
    category: '── STAFF ──',
    children: [
      { name: 'bot-logs',          kind: 'text', topic: 'Bot error log. Host-only.' },
      { name: 'host-dashboard',    kind: 'text', topic: 'Hosts coordinate here.' },
    ],
  },
];

function normalizeKey(s) {
  if (!s) return '';
  // Strip emoji, dashes, dots, bullets, whitespace; lowercase. Substring match
  // is intentional so cosmetic prefixes don't break detection.
  return String(s).replace(/[\u{1F000}-\u{1FFFF}\u2000-\u27FF\u2900-\u297F\u2B00-\u2BFF\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[─\-\s\.\u00B7\u2022\uFF65・]/g, '').toLowerCase();
}

function findCategory(guild, name) {
  var key = normalizeKey(name);
  return guild.channels.cache.find(function(c) {
    return c.type === ChannelType.GuildCategory && normalizeKey(c.name) === key;
  }) || null;
}

function findChannelByName(guild, name, kind) {
  var key = normalizeKey(name);
  var wantedType = kind === 'forum' ? ChannelType.GuildForum : ChannelType.GuildText;
  return guild.channels.cache.find(function(c) {
    if (c.type !== wantedType) return false;
    return normalizeKey(c.name) === key;
  }) || null;
}

function isTournamentCategory(name) {
  return !!name && TOURNAMENT_CATEGORY_PATTERN.test(name);
}

function isLiveClashCategory(name) {
  if (!name) return false;
  // Match both new and legacy names so we don't double-report the lobby category.
  return name === LIVE_CLASH_CATEGORY || /CLASH\s*LIVE/i.test(name);
}

/**
 * Diff the live guild against DESIRED_LAYOUT.
 *
 * Returns:
 *   {
 *     missingCategories: [string],
 *     missingChannels:   [{ category, name, kind }],
 *     existingCategories:[string],
 *     existingChannels:  [{ category, name, kind }],
 *     extraCategories:   [string],   // present in guild, not in layout (excludes tournament + live)
 *     extraChannels:     [{ category, name, type }], // children of known categories not in layout
 *   }
 */
export function auditLayout(guild) {
  var out = {
    missingCategories: [],
    missingChannels: [],
    existingCategories: [],
    existingChannels: [],
    extraCategories: [],
    extraChannels: [],
  };
  if (!guild) return out;

  var desiredCategoryKeys = {};

  for (var group of DESIRED_LAYOUT) {
    desiredCategoryKeys[normalizeKey(group.category)] = true;
    var cat = findCategory(guild, group.category);
    if (!cat) {
      out.missingCategories.push(group.category);
      // Every child counts as missing if the category doesn't exist
      for (var miss of group.children) {
        out.missingChannels.push({ category: group.category, name: miss.name, kind: miss.kind || 'text' });
      }
      continue;
    }
    out.existingCategories.push(cat.name);
    for (var def of group.children) {
      var existing = findChannelByName(guild, def.name, def.kind || 'text');
      if (existing) {
        out.existingChannels.push({ category: cat.name, name: existing.name, kind: def.kind || 'text' });
      } else {
        out.missingChannels.push({ category: group.category, name: def.name, kind: def.kind || 'text' });
      }
    }
  }

  // Walk every category in the guild to flag extras (excluding tournament + live)
  for (var pair of guild.channels.cache) {
    var ch = pair[1];
    if (ch.type !== ChannelType.GuildCategory) continue;
    if (isTournamentCategory(ch.name)) continue;
    if (isLiveClashCategory(ch.name)) continue;
    if (!desiredCategoryKeys[normalizeKey(ch.name)]) {
      out.extraCategories.push(ch.name);
    }
  }

  // Walk children of known categories to flag extras inside them
  var knownCategoryNamesByKey = {};
  for (var g of DESIRED_LAYOUT) {
    var c2 = findCategory(guild, g.category);
    if (c2) {
      knownCategoryNamesByKey[c2.id] = {
        category: c2.name,
        wanted: {},
      };
      for (var ch2 of g.children) {
        knownCategoryNamesByKey[c2.id].wanted[normalizeKey(ch2.name)] = true;
      }
    }
  }
  for (var pair2 of guild.channels.cache) {
    var ch3 = pair2[1];
    if (ch3.type !== ChannelType.GuildText && ch3.type !== ChannelType.GuildForum) continue;
    if (!ch3.parentId) continue;
    var meta = knownCategoryNamesByKey[ch3.parentId];
    if (!meta) continue;
    if (!meta.wanted[normalizeKey(ch3.name)]) {
      out.extraChannels.push({ category: meta.category, name: ch3.name, type: ch3.type === ChannelType.GuildForum ? 'forum' : 'text' });
    }
  }

  return out;
}

/**
 * Create-only application of DESIRED_LAYOUT. Never deletes or renames anything.
 *
 * Returns { createdCategories: [string], createdChannels: [string], errors: [string] }.
 */
export async function applyLayout(guild) {
  var result = { createdCategories: [], createdChannels: [], errors: [] };
  if (!guild) {
    result.errors.push('no guild');
    return result;
  }

  for (var group of DESIRED_LAYOUT) {
    var cat = findCategory(guild, group.category);
    if (!cat) {
      try {
        cat = await guild.channels.create({
          name: group.category,
          type: ChannelType.GuildCategory,
          reason: 'TFT Clash bot — /layout apply',
        });
        result.createdCategories.push(group.category);
      } catch (e) {
        result.errors.push('create category ' + group.category + ': ' + ((e && e.message) || e));
        continue;
      }
    }
    for (var def of group.children) {
      var existing = findChannelByName(guild, def.name, def.kind || 'text');
      if (existing) continue;
      var wantedType = def.kind === 'forum' ? ChannelType.GuildForum : ChannelType.GuildText;
      try {
        await guild.channels.create({
          name: def.name,
          type: wantedType,
          parent: cat.id,
          topic: def.topic || '',
          reason: 'TFT Clash bot — /layout apply',
        });
        result.createdChannels.push(group.category + ' / ' + def.name);
      } catch (e) {
        result.errors.push('create channel ' + def.name + ': ' + ((e && e.message) || e));
      }
    }
  }

  return result;
}
