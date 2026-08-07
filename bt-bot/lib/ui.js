/**
 * ui.js - the single source of truth for how this bot LOOKS in Discord.
 *
 * Before this module existed the same brand blue was retyped as a raw hex in
 * six files, and the "pack whole lines under Discord's 1024 char field cap"
 * loop was copy-pasted four times with four slightly different behaviours.
 * Everything visual now comes from here: colors, status glyphs, meters,
 * sparklines, native timestamps, line packing, and the base embed shell.
 *
 * Design register: restrained. Status is carried by a small fixed set of dot
 * glyphs and by the embed's left color strip, never by emoji confetti. Field
 * names are uppercase eyebrows with a count. Numbers are monospace-aligned.
 *
 * Copy rule: zero em or en dashes anywhere in user-facing strings.
 */

import { EmbedBuilder } from 'discord.js';
import { BT_DEPARTMENTS } from '../config/crew.js';

// ---- brand -------------------------------------------------------------------

// One place for the crew-facing product name. The Discord app, the pm2 process,
// and the fleet dashboard have drifted apart on this before, so it is a single
// constant with an env override rather than a string retyped per embed.
export var BRAND = {
  name: process.env.BT_BRAND_NAME || 'BrosephTech',
  tagline: process.env.BT_BRAND_TAGLINE || 'Meetings to tasks, and nothing lost in between',
};

// ---- color tokens ------------------------------------------------------------

// Semantic first. Pick by MEANING (danger / success), never by hue.
export var COLOR = {
  brand: 0x5BA3DB,
  success: 0x34D399,
  warn: 0xE8A020,
  danger: 0xEF4444,
  info: 0x818CF8,
  neutral: 0x4B5563,
  live: 0xE05B5B,
};

var DEPT_COLOR_INT = {};
BT_DEPARTMENTS.forEach(function(d) {
  DEPT_COLOR_INT[d.id] = parseInt(String(d.color).replace('#', ''), 16);
});

// Embed color for a department id, falling back to the brand blue.
export function deptColor(deptId) {
  var id = String(deptId || '').toLowerCase();
  return DEPT_COLOR_INT[id] != null ? DEPT_COLOR_INT[id] : COLOR.brand;
}

// ---- glyph taxonomy ----------------------------------------------------------

// Status LEDs. The whole vocabulary, deliberately tiny, so a reader learns it
// once and then scans a list without reading a word.
export var DOT = {
  danger: '🔴',   // red    - overdue
  warn: '🟠',     // orange - stuck
  soon: '🟡',     // yellow - due soon
  ok: '🟢',       // green  - healthy
  idle: '⚪',           // white  - nothing to report
};

// Action glyphs. Used in titles only, never inside list rows.
export var MARK = {
  blocked: '⛔',        // no entry
  shipped: '✅',        // check
  live: '🎙',     // studio mic
  board: '📋',    // clipboard
  up: '▲',
  down: '▼',
  flat: '·',
  arrow: '›',          // single angle quote, used as a soft separator
};

// ---- text primitives ---------------------------------------------------------

export function clamp(value, max) {
  var s = String(value == null ? '' : value);
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 3)) + '...';
}

// Discord caps a field value at 1024 characters. Accumulate WHOLE lines so a
// mention or a link is never cut in half, and always tell the reader what was
// dropped instead of silently truncating.
export function pack(lines, options) {
  var opts = options || {};
  var cap = opts.cap || 1024;
  var empty = opts.empty != null ? opts.empty : '*nothing here*';
  var list = (lines || []).filter(function(l) { return l != null && l !== ''; });
  if (!list.length) return empty;

  var kept = [];
  var used = 0;
  var overflow = 0;
  for (var i = 0; i < list.length; i++) {
    var line = String(list[i]);
    var addLen = line.length + (kept.length ? 1 : 0);
    var remaining = list.length - i;
    // Reserve room for the overflow note only while more lines could follow.
    var reserve = remaining > 1 ? 20 : 0;
    if (used + addLen > cap - reserve) {
      overflow = remaining;
      break;
    }
    kept.push(line);
    used += addLen;
  }
  if (overflow > 0) kept.push('*and ' + overflow + ' more*');
  return kept.join('\n') || empty;
}

// An uppercase field-name eyebrow with an optional count: "NEEDS ATTENTION 4".
export function eyebrow(label, count) {
  var base = String(label || '').toUpperCase();
  if (count == null) return base;
  return base + '  ' + count;
}

// Pad a string to a fixed width so monospace blocks line up.
function padEnd(value, width) {
  var s = String(value == null ? '' : value);
  while (s.length < width) s += ' ';
  return s;
}

function padStart(value, width) {
  var s = String(value == null ? '' : value);
  while (s.length < width) s = ' ' + s;
  return s;
}

// A fenced monospace block of aligned label/value rows. Used where alignment
// genuinely helps (metric readouts), not as a default layout.
export function rows(pairs, options) {
  var opts = options || {};
  var list = (pairs || []).filter(Boolean);
  if (!list.length) return '';
  var labelWidth = 0;
  var valueWidth = 0;
  list.forEach(function(p) {
    labelWidth = Math.max(labelWidth, String(p[0]).length);
    valueWidth = Math.max(valueWidth, String(p[1]).length);
  });
  var body = list.map(function(p) {
    var line = padEnd(p[0], labelWidth) + '  ' + padStart(p[1], valueWidth);
    if (p[2]) line += '  ' + p[2];
    return line;
  }).join('\n');
  var fence = '```';
  return fence + (opts.lang || '') + '\n' + body + '\n' + fence;
}

// ---- meters ------------------------------------------------------------------

var BAR_FULL = '█';
var BAR_EMPTY = '░';

// A solid-block progress meter, e.g. bar(3, 10, 12) -> "████░░░░░░░░".
// A zero max renders as an empty track rather than dividing by zero.
export function bar(value, max, width) {
  var w = Math.max(1, width || 10);
  var total = Number(max) || 0;
  var v = Math.max(0, Number(value) || 0);
  if (total <= 0) return new Array(w + 1).join(BAR_EMPTY);
  var filled = Math.round((Math.min(v, total) / total) * w);
  if (v > 0 && filled === 0) filled = 1; // never render real work as empty
  return new Array(filled + 1).join(BAR_FULL) + new Array(w - filled + 1).join(BAR_EMPTY);
}

var SPARK_LEVELS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

// A unicode sparkline over a numeric series. A flat or single-point series
// renders on the baseline rather than spiking to full height.
export function spark(series) {
  var list = (series || []).map(function(n) { return Number(n) || 0; });
  if (list.length < 2) return '';
  var min = Math.min.apply(null, list);
  var max = Math.max.apply(null, list);
  var span = max - min;
  return list.map(function(n) {
    if (span === 0) return SPARK_LEVELS[0];
    var idx = Math.round(((n - min) / span) * (SPARK_LEVELS.length - 1));
    return SPARK_LEVELS[idx];
  }).join('');
}

// Signed delta with a direction glyph, e.g. "▲ +120". Returns '' for no data.
export function delta(current, previous) {
  if (current == null || previous == null) return '';
  var d = Number(current) - Number(previous);
  if (!isFinite(d)) return '';
  if (d === 0) return MARK.flat + ' no change';
  var sign = d > 0 ? '+' : '';
  return (d > 0 ? MARK.up : MARK.down) + ' ' + sign + Number(d).toLocaleString();
}

export function pct(value, total) {
  var t = Number(total) || 0;
  if (t <= 0) return 0;
  return Math.round((Number(value) || 0) / t * 100);
}

// ---- time --------------------------------------------------------------------

function toDate(value) {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (value == null || value === '') return null;
  var d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * A native Discord timestamp. These render in each reader's own locale and
 * timezone and keep counting on their own, which is why a raw "2026-08-12"
 * string never belongs in an embed.
 *
 * style: 'R' relative, 'd' short date, 'f' long date+time, 't' short time.
 *
 * ONLY valid in an embed description or a field value. Discord renders titles,
 * author names, field NAMES and footers as literal text, so a timestamp in any
 * of those ships as visible "<t:1786104000:t>" markup. Use the embed's own
 * timestamp for a footer clock instead. A test in test/render.test.js enforces
 * this, because it is invisible until it is in front of the whole crew.
 */
export function ts(value, style) {
  var d = toDate(value);
  if (!d) return '';
  return '<t:' + Math.floor(d.getTime() / 1000) + ':' + (style || 'R') + '>';
}

export function rel(value) {
  return ts(value, 'R');
}

// "in 3d" / "4d late" / "today", for places too tight for a native timestamp
// (select-menu descriptions, which do not render Discord markup).
export function shortDue(value, now) {
  var d = toDate(value);
  if (!d) return '';
  var ref = now || new Date();
  var days = Math.round((d.getTime() - ref.getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days > 0) return 'in ' + days + 'd';
  return Math.abs(days) + 'd late';
}

// ---- health ------------------------------------------------------------------

/**
 * Turn raw board totals into a verdict the reader can act on. This is the whole
 * point of the redesign: lead with what to DO, not with six numbers.
 *
 * Returns { level, color, dot, verdict, guidance, healthy, ratio }.
 */
export function health(totals) {
  var t = totals || {};
  var active = Number(t.active) || 0;
  var overdue = Number(t.overdue) || 0;
  var stuck = Number(t.stuck) || 0;
  var blocked = Number(t.blocked) || 0;
  var dueSoon = Number(t.dueSoon) || 0;

  // At risk is a card count, not a sum of flags: one card can be overdue AND
  // stuck AND blocked, so cap it at the active total.
  var atRisk = Math.min(active, overdue + stuck + blocked);
  var healthy = Math.max(0, active - atRisk);
  var ratio = active > 0 ? healthy / active : 1;

  if (overdue > 0 || blocked > 0) {
    var urgent = overdue + blocked;
    return {
      level: 'danger',
      color: COLOR.danger,
      dot: DOT.danger,
      healthy: healthy,
      atRisk: atRisk,
      ratio: ratio,
      verdict: urgent + ' card' + (urgent === 1 ? ' needs' : 's need') + ' action today',
      guidance: 'Overdue and blocked work is listed below with its owner. Move it or drop a note on the card.',
    };
  }
  if (stuck > 0) {
    return {
      level: 'warn',
      color: COLOR.warn,
      dot: DOT.warn,
      healthy: healthy,
      atRisk: atRisk,
      ratio: ratio,
      verdict: stuck + ' card' + (stuck === 1 ? ' has' : 's have') + ' gone quiet',
      guidance: 'Nothing is late yet. These have sat in the same column long enough to be worth a nudge.',
    };
  }
  if (dueSoon > 0) {
    return {
      level: 'soon',
      color: COLOR.brand,
      dot: DOT.soon,
      healthy: healthy,
      atRisk: atRisk,
      ratio: ratio,
      verdict: 'On track, ' + dueSoon + ' due soon',
      guidance: 'Nothing is late, stuck, or blocked. Keep an eye on what lands next.',
    };
  }
  return {
    level: 'ok',
    color: COLOR.success,
    dot: DOT.ok,
    healthy: healthy,
    atRisk: atRisk,
    ratio: ratio,
    verdict: active > 0 ? 'Board is clean' : 'Board is empty',
    guidance: active > 0
      ? 'Nothing overdue, stuck, or blocked. Every active card is moving.'
      : 'No active cards. Add one with /card add.',
  };
}

// The status dot for a single card, worst state wins.
export function cardDot(flags) {
  var f = flags || {};
  if (f.blocked) return MARK.blocked;
  if (f.overdue) return DOT.danger;
  if (f.stuck) return DOT.warn;
  if (f.dueSoon) return DOT.soon;
  return DOT.ok;
}

// ---- embed shell -------------------------------------------------------------

/**
 * Every embed in the bot starts here, so the brand footer, the timestamp, and
 * the color semantics can never drift per command.
 *
 * opts: { color, title, description, author, authorIcon, footer, url, timestamp }
 */
export function baseEmbed(opts) {
  var o = opts || {};
  var embed = new EmbedBuilder().setColor(o.color != null ? o.color : COLOR.brand);
  if (o.title) embed.setTitle(clamp(o.title, 250));
  if (o.url) embed.setURL(o.url);
  if (o.description) embed.setDescription(clamp(o.description, 4000));
  if (o.author) {
    var author = { name: clamp(o.author, 250) };
    if (o.authorIcon) author.iconURL = o.authorIcon;
    embed.setAuthor(author);
  }
  embed.setFooter({ text: clamp(o.footer || BRAND.name, 2040) });
  if (o.timestamp !== false) embed.setTimestamp(o.timestamp instanceof Date ? o.timestamp : new Date());
  return embed;
}

// Six KPI counters as two rows of three inline fields. Inline fields are the
// one native Discord layout that stays readable on a phone, which is why the
// old single run-on line of code pills is gone.
export function kpiFields(totals) {
  var t = totals || {};
  function cell(label, value, glyph) {
    var n = Number(value) || 0;
    return { name: eyebrow(label), value: (n > 0 && glyph ? glyph + ' ' : '') + n, inline: true };
  }
  return [
    cell('Active', t.active),
    cell('Overdue', t.overdue, DOT.danger),
    cell('Stuck', t.stuck, DOT.warn),
    cell('Due soon', t.dueSoon, DOT.soon),
    cell('Blocked', t.blocked, MARK.blocked),
    cell('Shipped 7d', t.shippedThisWeek, MARK.shipped),
  ];
}

// A one-line health meter for the hero description.
export function healthMeter(h) {
  var total = (h.healthy || 0) + (h.atRisk || 0);
  return bar(h.healthy, total, 14) + '  ' + pct(h.healthy, total) + '% moving cleanly';
}
