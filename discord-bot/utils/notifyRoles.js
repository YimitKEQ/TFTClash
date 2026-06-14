/**
 * notifyRoles.js — opt-in notification roles.
 *
 * Replaces @everyone / @here mass pings.
 * Players opt in via reaction panel (#notifications) or /notify slash command.
 *
 * Roles created on bot startup if missing:
 *   Clash Notify       — season clash phase changes + reminders
 *   Tournament Notify  — custom tournament phase changes
 *   Live Updates       — reserved for Phase 3 (live game results)
 *   Pre-Game           — auto-applied to registered players for last-call ping
 */

import { PermissionFlagsBits } from 'discord.js';

export var NOTIFY_KINDS = Object.freeze({
  clash:      { roleName: 'Clash Notify',      emoji: '\u2694\uFE0F', label: 'Clash Notify',      desc: 'Season clash open / live / reminders' },
  tournament: { roleName: 'Tournament Notify', emoji: '\uD83C\uDFC6', label: 'Tournament Notify', desc: 'Custom tournament open / start' },
  live:       { roleName: 'Live Updates',      emoji: '\uD83D\uDD34', label: 'Live Updates',      desc: 'Live game-by-game results (coming soon)' },
  all:        { roleName: 'Fuck it ping me',   emoji: '\uD83D\uDD14', label: 'Fuck it ping me',   desc: 'Ping me for EVERYTHING - clash, tournament, live, reminders' },
});

export var PRE_GAME_ROLE = 'Pre-Game';

// The catch-all kind. Anyone holding this role is mentioned on every notify
// send, regardless of which specific kind fired.
export var ALL_KIND = 'all';

var ROLE_COLOR = {
  'Clash Notify':      0x4ECDC4,
  'Tournament Notify': 0xE8A838,
  'Live Updates':      0xC0392B,
  'Fuck it ping me':   0xFF4D4D,
  'Pre-Game':          0x9B72CF,
};

function findRole(guild, name) {
  return guild.roles.cache.find(function(r) { return r.name === name; });
}

async function ensureRole(guild, name) {
  var existing = findRole(guild, name);
  if (existing) return existing;
  try {
    var created = await guild.roles.create({
      name: name,
      colors: { primaryColor: ROLE_COLOR[name] || 0x95A5A6 },
      mentionable: true,
      reason: 'TFT Clash bot — notify role bootstrap',
    });
    console.log('[notifyRoles] created ' + name);
    return created;
  } catch (e) {
    console.error('[notifyRoles] create ' + name + ' failed: ' + ((e && e.message) || e));
    return null;
  }
}

/**
 * Bootstrap all notify + Pre-Game roles. Verifies the bot's highest role
 * sits above every managed role so role grants will succeed.
 *
 * Returns { ok: boolean, roles: { clash, tournament, live, preGame }, hierarchyOk: boolean }.
 */
export async function ensureNotifyRoles(guild) {
  if (!guild) return { ok: false, roles: {}, hierarchyOk: false };
  var clash      = await ensureRole(guild, NOTIFY_KINDS.clash.roleName);
  var tournament = await ensureRole(guild, NOTIFY_KINDS.tournament.roleName);
  var live       = await ensureRole(guild, NOTIFY_KINDS.live.roleName);
  var all        = await ensureRole(guild, NOTIFY_KINDS.all.roleName);
  var preGame    = await ensureRole(guild, PRE_GAME_ROLE);

  var me = guild.members.me;
  var botTop = me ? me.roles.highest.position : 0;
  var managed = [clash, tournament, live, all, preGame].filter(Boolean);
  var blocking = managed.filter(function(r) { return r.position >= botTop; });
  var hierarchyOk = blocking.length === 0;
  if (!hierarchyOk) {
    console.warn('[notifyRoles] hierarchy WARNING — bot role position ' + botTop + ' is not above: ' + blocking.map(function(r) { return r.name + '@' + r.position; }).join(', '));
  }
  var manageOk = me && me.permissions.has(PermissionFlagsBits.ManageRoles);
  if (!manageOk) console.warn('[notifyRoles] bot is missing ManageRoles permission');

  return {
    ok: !!(clash && tournament && live && all && preGame) && hierarchyOk && manageOk,
    roles: { clash: clash, tournament: tournament, live: live, all: all, preGame: preGame },
    hierarchyOk: hierarchyOk,
    manageOk: !!manageOk,
  };
}

/**
 * Build the ping payload for a notify send: combines the specific kind's role
 * mention with the catch-all "Fuck it ping me" role so a single opt-in covers
 * everything. Returns { content, roleIds } — content is the space-joined
 * mention string (or ''), roleIds is the deduped list for allowedMentions.
 */
export function buildNotifyPing(guild, kind) {
  if (!guild) return { content: '', roleIds: [] };
  var parts = [];
  var ids = [];
  var def = NOTIFY_KINDS[kind];
  if (def) {
    var r = findRole(guild, def.roleName);
    if (r) { parts.push('<@&' + r.id + '>'); ids.push(r.id); }
  }
  var allRole = findRole(guild, NOTIFY_KINDS.all.roleName);
  if (allRole && ids.indexOf(allRole.id) < 0) { parts.push('<@&' + allRole.id + '>'); ids.push(allRole.id); }
  return { content: parts.join(' '), roleIds: ids };
}

/**
 * Build a mention string for a notify kind. Falls back to '' (no mention)
 * if the role doesn't exist yet — never falls back to @everyone.
 */
export function mentionFor(guild, kind) {
  if (!guild) return '';
  var def = NOTIFY_KINDS[kind];
  if (!def) return '';
  var role = findRole(guild, def.roleName);
  return role ? ('<@&' + role.id + '>') : '';
}

export function preGameMention(guild) {
  if (!guild) return '';
  var role = findRole(guild, PRE_GAME_ROLE);
  return role ? ('<@&' + role.id + '>') : '';
}

/**
 * Add a notify role to a member by kind. Returns true on success.
 */
export async function addNotifyRole(member, kind) {
  if (!member) return false;
  var def = NOTIFY_KINDS[kind];
  if (!def) return false;
  var role = findRole(member.guild, def.roleName);
  if (!role) return false;
  if (member.roles.cache.has(role.id)) return true;
  try {
    await member.roles.add(role, 'opt-in via /notify or reaction panel');
    return true;
  } catch (e) {
    console.warn('[notifyRoles] addNotifyRole ' + kind + ' for ' + (member.user && member.user.tag) + ' failed: ' + ((e && e.message) || e));
    return false;
  }
}

export async function removeNotifyRole(member, kind) {
  if (!member) return false;
  var def = NOTIFY_KINDS[kind];
  if (!def) return false;
  var role = findRole(member.guild, def.roleName);
  if (!role || !member.roles.cache.has(role.id)) return true;
  try {
    await member.roles.remove(role, 'opt-out via /notify or reaction panel');
    return true;
  } catch (e) {
    console.warn('[notifyRoles] removeNotifyRole ' + kind + ' for ' + (member.user && member.user.tag) + ' failed: ' + ((e && e.message) || e));
    return false;
  }
}

/**
 * Sweep Pre-Game role from all members holding it. Cheap because it queries
 * the role's existing member set, NOT the entire guild.
 */
export async function sweepPreGameRole(guild) {
  if (!guild) return 0;
  var role = findRole(guild, PRE_GAME_ROLE);
  if (!role) return 0;
  var holders = role.members;
  var removed = 0;
  for (var entry of holders.values()) {
    try {
      await entry.roles.remove(role, 'pre-game sweep on phase=complete');
      removed += 1;
    } catch (e) {
      // continue, log only
      console.warn('[notifyRoles] sweepPreGame failed for ' + (entry.user && entry.user.tag) + ': ' + ((e && e.message) || e));
    }
  }
  if (removed) console.log('[notifyRoles] swept Pre-Game from ' + removed + ' members');
  return removed;
}
