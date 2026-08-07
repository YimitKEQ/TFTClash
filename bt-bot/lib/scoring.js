/**
 * scoring.js - accountability analytics over the BrosephTech board.
 *
 * memberScorecard / buildDigest are pure (apart from the time reference).
 * postDigest / postBlockedSweep read the board and post to Discord, guarding
 * missing channels rather than crashing.
 *
 * Copy rule: zero em or en dashes anywhere in user-facing strings.
 */

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
import {
  BRAND,
  COLOR,
  DOT,
  MARK,
  bar,
  baseEmbed,
  clamp,
  eyebrow,
  pack,
} from './ui.js';

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

/**
 * Turn a scorecard into a 0..100 standing plus a plain-language band.
 *
 * Deliberately not a letter grade. This runs between friends on a small crew,
 * so the output has to be usable as a nudge, not as a public ranking. Weights:
 * an overdue card is the worst signal, a blocked one is nearly as bad because
 * it means nobody escalated, staleness is a soft warning, and shipping pulls
 * the number back up.
 *
 * Pure: same inputs always give the same standing.
 */
export function accountabilityStanding(scorecard) {
  var s = scorecard || {};
  var score = 100;
  score -= (Number(s.overdue) || 0) * 12;
  score -= (Number(s.blocked) || 0) * 8;
  score -= (Number(s.stuck) || 0) * 6;
  score += Math.min(18, (Number(s.shippedThisWeek) || 0) * 6);
  score = Math.max(0, Math.min(100, Math.round(score)));

  var band;
  var color;
  var verdict;
  if (score >= 90) {
    band = 'On top of it';
    color = COLOR.success;
    verdict = 'Nothing is slipping. This is what the board is supposed to look like.';
  } else if (score >= 72) {
    band = 'Steady';
    color = COLOR.brand;
    verdict = 'Mostly clean. One or two cards want a look before they turn into a problem.';
  } else if (score >= 50) {
    band = 'Slipping';
    color = COLOR.warn;
    verdict = 'Work is aging faster than it is moving. Pick the oldest card and close it out.';
  } else {
    band = 'Needs a reset';
    color = COLOR.danger;
    verdict = 'Too much is late or stuck to fix by working harder. Cut scope or hand something off.';
  }

  return { score: score, band: band, color: color, verdict: verdict };
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

export function digestEmbed(digest) {
  var totals = digest.totals;
  var ref = digest.generatedAt || new Date();

  // Only people with something to show, most shipped first. A wall of zeroes
  // teaches the crew to scroll past the digest, which defeats the point of it.
  var active = digest.rows.filter(function(r) {
    return r.active > 0 || r.shippedThisWeek > 0 || r.overdue > 0 || r.stuck > 0 || r.blocked > 0;
  });
  active.sort(function(a, b) {
    if (b.shippedThisWeek !== a.shippedThisWeek) return b.shippedThisWeek - a.shippedThisWeek;
    return b.overdue - a.overdue;
  });

  var shipped = totals.shippedThisWeek;
  var headline = shipped === 0
    ? 'Nothing shipped this week'
    : shipped + ' card' + (shipped === 1 ? '' : 's') + ' shipped this week';

  var embed = baseEmbed({
    color: shipped > 0 ? COLOR.success : COLOR.warn,
    author: BRAND.name + '  ' + MARK.arrow + '  weekly digest',
    title: headline,
    description: shipped > 0
      ? 'Shipped counts anything that reached published in the last 7 days.'
      : 'Nothing reached published in the last 7 days. Worth asking what is in the way.',
    footer: BRAND.name + ' accountability  ' + MARK.arrow + '  /scorecard for one person in detail',
    timestamp: ref,
  });

  if (active.length === 0) {
    embed.addFields({ name: eyebrow('Crew'), value: 'Nobody has any active or shipped cards this week. Quiet board.' });
  } else {
    var peak = active.reduce(function(m, r) { return Math.max(m, r.shippedThisWeek); }, 0);
    var lines = active.map(function(r) {
      var flags = [];
      if (r.overdue) flags.push(DOT.danger + ' ' + r.overdue);
      if (r.stuck) flags.push(DOT.warn + ' ' + r.stuck);
      if (r.blocked) flags.push(MARK.blocked + ' ' + r.blocked);
      return '`' + bar(r.shippedThisWeek, peak, 6) + '` ' + mention(r.name)
        + '  ' + MARK.arrow + '  ' + r.shippedThisWeek + ' shipped, ' + r.active + ' active'
        + (flags.length ? '  ' + flags.join('  ') : '');
    });
    embed.addFields({ name: eyebrow('Crew', active.length), value: pack(lines) });
  }

  embed.addFields(
    { name: eyebrow('Active'), value: String(totals.active), inline: true },
    { name: eyebrow('Overdue'), value: (totals.overdue ? DOT.danger + ' ' : '') + totals.overdue, inline: true },
    { name: eyebrow('Stuck'), value: (totals.stuck ? DOT.warn + ' ' : '') + totals.stuck, inline: true },
    { name: eyebrow('Due soon'), value: (totals.dueSoon ? DOT.soon + ' ' : '') + totals.dueSoon, inline: true },
    { name: eyebrow('Blocked'), value: (totals.blocked ? MARK.blocked + ' ' : '') + totals.blocked, inline: true },
    { name: eyebrow('Shipped 7d'), value: (shipped ? MARK.shipped + ' ' : '') + shipped, inline: true }
  );

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

  var ref = new Date();
  var lines = blocked.map(function(card) {
    var owners = assigneesOf(card).map(function(a) { return mention(a); });
    var ownerText = owners.length ? owners.join(', ') : '*unassigned*';
    var sd = staleDays(card, ref);
    return MARK.blocked + ' **' + clamp(titleOf(card), 66) + '**  ' + MARK.arrow + '  ' + ownerText
      + (sd > 0 ? '  ' + MARK.arrow + '  stuck ' + sd + 'd' : '');
  });

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
    ? ids.map(function(id) { return '<@' + id + '>'; }).join(' ') + ' you have blocked cards. Unblock them or say what they are waiting on.'
    : undefined;

  var embed = baseEmbed({
    color: COLOR.danger,
    author: BRAND.name + '  ' + MARK.arrow + '  blocked sweep',
    title: blocked.length + ' card' + (blocked.length === 1 ? '' : 's') + ' cannot move',
    description: 'Daily check. A blocked card burns a week without anyone noticing unless somebody says so.',
    footer: 'Use /card unblock once it is cleared',
    timestamp: ref,
  });
  embed.addFields({ name: eyebrow('Blocked', blocked.length), value: pack(lines) });

  try {
    await channel.send({ content: content, embeds: [embed], allowedMentions: { users: ids } });
    console.log('[scoring] blocked sweep posted to #' + channel.name + ' (' + blocked.length + ' card(s))');
    return true;
  } catch (e) {
    console.error('[scoring] postBlockedSweep send failed: ' + ((e && e.message) || e));
    return false;
  }
}
