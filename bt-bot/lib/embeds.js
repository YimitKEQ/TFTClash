/**
 * embeds.js - the daily standup card and the evening nudge.
 *
 * The standup leads with a verdict ("3 cards need action today"), not with a
 * row of numbers, because the whole point of a standup is telling the crew what
 * to do before they scroll past it. Colors, glyphs, meters, and line packing
 * all come from lib/ui.js so nothing here is retyped per embed.
 *
 * Copy rule: zero em or en dashes anywhere in user-facing strings.
 */

import { mention } from '../config/crew.js';
import { staleDays, isOverdue, isDueSoon } from './board.js';
import {
  BRAND,
  COLOR,
  DOT,
  MARK,
  baseEmbed,
  bar,
  cardDot,
  clamp,
  eyebrow,
  health,
  healthMeter,
  kpiFields,
  pack,
  rel,
} from './ui.js';

function titleOf(card) {
  return (card && (card.title || card.name)) || 'Untitled card';
}

function ownersOf(card) {
  var assignees = Array.isArray(card.assignees) && card.assignees.length
    ? card.assignees
    : (card.assignee ? [card.assignee] : []);
  if (!assignees.length) return '*unassigned*';
  return assignees.map(function(a) { return mention(a); }).join(', ');
}

// Why this card is on the attention list, in the reader's own timezone where a
// real date exists. Blocked beats overdue beats stuck.
function reasonOf(card, ref) {
  if (card && card.blocked) return MARK.blocked + ' blocked';
  if (isOverdue(card, ref) && card.due_date) return 'due ' + rel(card.due_date);
  if (isOverdue(card, ref)) return 'overdue';
  var sd = staleDays(card, ref);
  if (sd > 0) return 'untouched ' + sd + 'd';
  if (isDueSoon(card, ref) && card.due_date) return 'due ' + rel(card.due_date);
  return '';
}

// One scannable row: status dot, title, owner, reason.
function attentionLine(card, ref) {
  var dot = cardDot({
    blocked: !!(card && card.blocked),
    overdue: isOverdue(card, ref),
    stuck: staleDays(card, ref) > 0,
    dueSoon: isDueSoon(card, ref),
  });
  var bits = [dot + ' **' + clamp(titleOf(card), 70) + '**', ownersOf(card)];
  var reason = reasonOf(card, ref);
  if (reason) bits.push(reason);
  return bits.join('  ' + MARK.arrow + '  ');
}

// A load meter per department, scaled against the busiest one so the bars are
// comparable at a glance rather than all pinned to full.
function departmentLines(departments) {
  var list = (departments || []).filter(function(d) { return d && (d.active > 0 || d.overdue > 0); });
  if (!list.length) return [];
  var peak = list.reduce(function(m, d) { return Math.max(m, d.active); }, 0);
  return list.map(function(d) {
    var flags = [];
    if (d.overdue) flags.push(DOT.danger + ' ' + d.overdue);
    if (d.stuck) flags.push(DOT.warn + ' ' + d.stuck);
    var suffix = flags.length ? '  ' + flags.join('  ') : '';
    return '`' + bar(d.active, peak, 8) + '` **' + d.label + '** ' + d.active + suffix;
  });
}

// Collect the unique cards that need a human today, worst first.
function attentionCards(members, ref) {
  var seen = {};
  var out = [];
  Object.keys(members || {}).forEach(function(name) {
    var b = members[name] || {};
    (b.blocked || []).concat(b.overdue || [], b.stuck || []).forEach(function(card) {
      var key = String(card.id || titleOf(card));
      if (seen[key]) return;
      seen[key] = true;
      out.push(card);
    });
  });
  out.sort(function(a, b) {
    var aBlocked = a.blocked ? 1 : 0;
    var bBlocked = b.blocked ? 1 : 0;
    if (aBlocked !== bBlocked) return bBlocked - aBlocked;
    var aOver = isOverdue(a, ref) ? 1 : 0;
    var bOver = isOverdue(b, ref) ? 1 : 0;
    if (aOver !== bOver) return bOver - aOver;
    return staleDays(b, ref) - staleDays(a, ref);
  });
  return out;
}

/**
 * The daily standup card.
 * accountability is a buildAccountability() result.
 */
export function standupEmbed(accountability, now) {
  var ref = now || new Date();
  var totals = (accountability && accountability.totals) || { cards: 0, active: 0, overdue: 0, stuck: 0, dueSoon: 0 };
  var departments = (accountability && accountability.departments) || [];
  var attention = attentionCards((accountability && accountability.members) || {}, ref);

  var h = health(totals);

  var embed = baseEmbed({
    color: h.color,
    author: BRAND.name + '  ' + MARK.arrow + '  Daily standup',
    title: h.verdict,
    description: h.guidance + '\n' + healthMeter(h),
    footer: totals.cards + ' cards tracked  ' + MARK.arrow + '  /mytasks for your own list',
    timestamp: ref,
  });

  embed.addFields(kpiFields(totals).slice(0, 3));

  if (attention.length) {
    embed.addFields({
      name: eyebrow('Needs attention', attention.length),
      value: pack(attention.map(function(c) { return attentionLine(c, ref); })),
    });
  }

  var deptLines = departmentLines(departments);
  if (deptLines.length) {
    embed.addFields({ name: eyebrow('Load by department'), value: pack(deptLines) });
  }

  return embed;
}

/**
 * The evening nudge for one crew member. Returns null when they are clean, so
 * the scheduler only ever pings people who actually owe something.
 */
export function nudgeContent(member, buckets, now) {
  if (!member || !buckets) return null;
  var ref = now || new Date();
  var overdue = buckets.overdue || [];
  var stuck = buckets.stuck || [];
  if (overdue.length === 0 && stuck.length === 0) return null;

  var lines = [mention(member) + '  ' + MARK.arrow + '  end of day check'];

  overdue.forEach(function(c) {
    lines.push(DOT.danger + ' **' + clamp(titleOf(c), 80) + '**' + (c.due_date ? '  due ' + rel(c.due_date) : ''));
  });
  stuck.forEach(function(c) {
    var sd = staleDays(c, ref);
    lines.push(DOT.warn + ' **' + clamp(titleOf(c), 80) + '**' + (sd > 0 ? '  untouched ' + sd + 'd' : ''));
  });

  lines.push('Move one forward or drop a note on the card.');
  // A ping is plain content, not an embed, so the cap is 2000 not 1024.
  return pack(lines, { cap: 1900 });
}

export var EMBED_COLORS = {
  brand: COLOR.brand,
  warn: COLOR.warn,
  fromHex: function(hex) {
    if (!hex) return COLOR.brand;
    return parseInt(String(hex).replace('#', ''), 16);
  },
};
