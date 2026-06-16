/**
 * scoring.js - accountability analytics over the BrosephTech board.
 *
 * memberScorecard / buildDigest are pure (apart from the time reference).
 * postDigest / postBlockedSweep read the board and post to Discord, guarding
 * missing channels rather than crashing.
 *
 * Copy rule: zero em or en dashes anywhere in user-facing strings.
 */

import { EmbedBuilder } from 'discord.js';
import {
  fetchCards,
  buildAccountability,
  assigneesOf,
  isOverdue,
  staleDays,
  isDueSoon,
} from './board.js';
import { BT_CREW, mention, resolveDiscordId } from '../config/crew.js';
import { resolveChannel } from './channels.js';

var BRAND_BLUE = 0x5BA3DB;
// Blocked is a state: use the board's red so Discord and the board agree.
var BLOCKED_RED = 0xEF4444;

var MS_PER_DAY = 86400000;
var SHIPPED_WINDOW_DAYS = 7;

// Columns that mean the work is published/shipped.
var SHIPPED_COLUMNS = ['published'];

function getGuild(client) {
  return client.guilds.cache.get(process.env.BT_GUILD_ID);
}

function getStandupChannelName() {
  return process.env.BT_STANDUP_CHANNEL || 'bt-standup';
}

function getBlockedChannelName() {
  return process.env.BT_BLOCKED_CHANNEL || 'bt-blocked';
}

function titleOf(card) {
  return (card && (card.title || card.name)) || 'Untitled card';
}

function columnOf(card) {
  return String((card && card.column_id) || '').toLowerCase();
}

function parseDate(value) {
  if (!value) return null;
  var d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function isBlocked(card) {
  return !!(card && card.blocked === true);
}

// True when the card sits in a shipped column and was last touched within the
// shipped window. updated_at is preferred, falling back to column_changed_at.
function isShippedRecently(card, ref) {
  if (SHIPPED_COLUMNS.indexOf(columnOf(card)) === -1) return false;
  var touched = parseDate(card.updated_at) || parseDate(card.column_changed_at);
  if (!touched) return false;
  var days = (ref.getTime() - touched.getTime()) / MS_PER_DAY;
  return days >= 0 && days <= SHIPPED_WINDOW_DAYS;
}

function ownsCard(card, name) {
  return assigneesOf(card).indexOf(name) !== -1;
}

// Per-member analytics snapshot. active/overdue/stuck/dueSoon mirror the
// accountability buckets, shippedThisWeek counts the member's cards published
// in the last 7 days, blocked counts their currently blocked active cards.
export function memberScorecard(cards, name, now) {
  var ref = now || new Date();
  var list = Array.isArray(cards) ? cards : [];

  var active = 0;
  var overdue = 0;
  var stuck = 0;
  var dueSoon = 0;
  var shippedThisWeek = 0;
  var blocked = 0;

  list.forEach(function(card) {
    if (!ownsCard(card, name)) return;
    if (isShippedRecently(card, ref)) shippedThisWeek++;
    if (isOverdue(card, ref)) overdue++;
    if (staleDays(card, ref) > 0) stuck++;
    if (isDueSoon(card, ref)) dueSoon++;
    if (isBlocked(card) && SHIPPED_COLUMNS.indexOf(columnOf(card)) === -1 && columnOf(card) !== 'archive') blocked++;
  });

  // Active count comes from the shared accountability pass so it matches the
  // rest of the bot exactly (non-done columns).
  var accountability = buildAccountability(list, ref);
  var buckets = accountability.members[name];
  if (buckets) active = buckets.active.length;

  return {
    name: name,
    active: active,
    overdue: overdue,
    stuck: stuck,
    dueSoon: dueSoon,
    shippedThisWeek: shippedThisWeek,
    blocked: blocked,
  };
}

// Build a digest: a scorecard row per crew member plus board-wide totals.
export function buildDigest(cards, now) {
  var ref = now || new Date();
  var list = Array.isArray(cards) ? cards : [];

  var rows = BT_CREW.map(function(m) {
    return memberScorecard(list, m.name, ref);
  });

  var accountability = buildAccountability(list, ref);
  var totals = {
    cards: accountability.totals.cards,
    active: accountability.totals.active,
    overdue: accountability.totals.overdue,
    stuck: accountability.totals.stuck,
    dueSoon: accountability.totals.dueSoon,
    shippedThisWeek: 0,
    blocked: 0,
  };

  list.forEach(function(card) {
    if (isShippedRecently(card, ref)) totals.shippedThisWeek++;
    if (isBlocked(card) && SHIPPED_COLUMNS.indexOf(columnOf(card)) === -1 && columnOf(card) !== 'archive') totals.blocked++;
  });

  return { rows: rows, totals: totals, generatedAt: ref };
}

function digestEmbed(digest) {
  var totals = digest.totals;
  var ref = digest.generatedAt || new Date();

  var embed = new EmbedBuilder()
    .setColor(BRAND_BLUE)
    .setTitle('BrosephTech Weekly Digest')
    .setDescription('Where every department stands this week. Shipped counts the last 7 days.')
    .setTimestamp(ref);

  // Only show members who have something to show, sorted by most shipped, then
  // most overdue. Keeps the digest focused instead of a wall of zeroes.
  var active = digest.rows.filter(function(r) {
    return r.active > 0 || r.shippedThisWeek > 0 || r.overdue > 0 || r.stuck > 0 || r.blocked > 0;
  });
  active.sort(function(a, b) {
    if (b.shippedThisWeek !== a.shippedThisWeek) return b.shippedThisWeek - a.shippedThisWeek;
    return b.overdue - a.overdue;
  });

  if (active.length === 0) {
    embed.addFields({ name: 'Crew', value: 'Nobody has any active or shipped cards this week. Quiet board.' });
  } else {
    var lines = active.map(function(r) {
      var bits = [];
      bits.push('shipped ' + r.shippedThisWeek);
      bits.push('active ' + r.active);
      if (r.overdue) bits.push('overdue ' + r.overdue);
      if (r.stuck) bits.push('stuck ' + r.stuck);
      if (r.dueSoon) bits.push('due soon ' + r.dueSoon);
      if (r.blocked) bits.push('blocked ' + r.blocked);
      return mention(r.name) + ': ' + bits.join(', ');
    });

    // Discord caps a field value at 1024 chars. Keep whole lines so a ping is
    // never cut mid-mention.
    var kept = [];
    var used = 0;
    for (var i = 0; i < lines.length; i++) {
      var addLen = lines[i].length + (kept.length ? 1 : 0);
      if (used + addLen > 1024) break;
      kept.push(lines[i]);
      used += addLen;
    }
    embed.addFields({ name: 'Crew', value: kept.join('\n') || 'Nothing to show.' });
  }

  embed.addFields({
    name: 'Board totals',
    value:
      totals.shippedThisWeek + ' shipped this week, ' +
      totals.active + ' active, ' +
      totals.overdue + ' overdue, ' +
      totals.stuck + ' stuck, ' +
      totals.dueSoon + ' due soon, ' +
      totals.blocked + ' blocked.',
  });

  embed.setFooter({ text: 'BrosephTech accountability' });
  return embed;
}

// fetchCards, build the digest, and post it to the standup channel.
// Returns true on success, false when skipped or on error.
export async function postDigest(client) {
  var guild = getGuild(client);
  if (!guild) {
    console.warn('[scoring] guild ' + process.env.BT_GUILD_ID + ' not in cache. Skipping digest.');
    return false;
  }
  var channel = resolveChannel(guild, getStandupChannelName());
  if (!channel) {
    console.warn('[scoring] standup channel "' + getStandupChannelName() + '" not found. Skipping digest.');
    return false;
  }
  try {
    var cards = await fetchCards();
    var digest = buildDigest(cards);
    var embed = digestEmbed(digest);
    await channel.send({ embeds: [embed] });
    console.log('[scoring] digest posted to #' + channel.name);
    return true;
  } catch (e) {
    console.error('[scoring] postDigest failed: ' + ((e && e.message) || e));
    return false;
  }
}

// Collect every blocked active card with its owners.
function blockedCards(cards) {
  var list = Array.isArray(cards) ? cards : [];
  return list.filter(function(card) {
    if (!isBlocked(card)) return false;
    var col = columnOf(card);
    return col !== 'archive' && SHIPPED_COLUMNS.indexOf(col) === -1;
  });
}

// Post a summary of all blocked active cards to the blocked channel, pinging
// owners. Skips silently when there is nothing blocked. Returns true when a
// message was posted, false otherwise.
export async function postBlockedSweep(client) {
  var guild = getGuild(client);
  if (!guild) {
    console.warn('[scoring] guild ' + process.env.BT_GUILD_ID + ' not in cache. Skipping blocked sweep.');
    return false;
  }
  var channel = resolveChannel(guild, getBlockedChannelName());
  if (!channel) {
    console.warn('[scoring] blocked channel "' + getBlockedChannelName() + '" not found. Skipping blocked sweep.');
    return false;
  }

  var cards;
  try {
    cards = await fetchCards();
  } catch (e) {
    console.error('[scoring] postBlockedSweep fetch failed: ' + ((e && e.message) || e));
    return false;
  }

  var blocked = blockedCards(cards);
  if (blocked.length === 0) {
    console.log('[scoring] blocked sweep: nothing blocked, skipping.');
    return false;
  }

  var lines = blocked.map(function(card) {
    var owners = assigneesOf(card).map(function(a) { return mention(a); });
    var ownerText = owners.length ? owners.join(', ') : '*unassigned*';
    return '- **' + titleOf(card) + '** (' + ownerText + ')';
  });

  // Keep whole lines under the 1024-char field cap.
  var kept = [];
  var used = 0;
  var overflow = 0;
  for (var i = 0; i < lines.length; i++) {
    var addLen = lines[i].length + (kept.length ? 1 : 0);
    var remaining = lines.length - i;
    var reserve = remaining > 1 ? 24 : 0;
    if (used + addLen > 1024 - reserve) {
      overflow = remaining;
      break;
    }
    kept.push(lines[i]);
    used += addLen;
  }
  if (overflow) kept.push('...and ' + overflow + ' more');

  // Collect the real Discord ids of blocked-card owners so the ping actually
  // fires. Mentions inside an embed do not notify; they must be in content.
  var pingIds = {};
  blocked.forEach(function(card) {
    assigneesOf(card).forEach(function(name) {
      var id = resolveDiscordId(name);
      if (id) pingIds[id] = true;
    });
  });
  var ids = Object.keys(pingIds);
  var content = ids.length
    ? ids.map(function(id) { return '<@' + id + '>'; }).join(' ') + ' you have blocked cards, please unblock or drop a note.'
    : undefined;

  var embed = new EmbedBuilder()
    .setColor(BLOCKED_RED)
    .setTitle('Blocked cards (' + blocked.length + ')')
    .setDescription('These cards are blocked and need an unblock.')
    .addFields({ name: 'Blocked', value: kept.join('\n') || 'Nothing to show.' })
    .setTimestamp(new Date())
    .setFooter({ text: 'BrosephTech accountability' });

  try {
    await channel.send({ content: content, embeds: [embed], allowedMentions: { users: ids } });
    console.log('[scoring] blocked sweep posted to #' + channel.name + ' (' + blocked.length + ' card(s))');
    return true;
  } catch (e) {
    console.error('[scoring] postBlockedSweep send failed: ' + ((e && e.message) || e));
    return false;
  }
}
