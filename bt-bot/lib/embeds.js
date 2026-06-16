/**
 * embeds.js - Discord embed + ping builders for the accountability bot.
 *
 * Copy rule: zero em or en dashes anywhere in user-facing strings.
 */

import { EmbedBuilder } from 'discord.js';
import { mention } from '../config/crew.js';
import { staleDays } from './board.js';

var BRAND_BLUE = 0x5BA3DB;
var WARN_AMBER = 0xE8A020;

function hexToInt(hex) {
  if (!hex) return BRAND_BLUE;
  return parseInt(String(hex).replace('#', ''), 16);
}

function titleOf(card) {
  return (card && (card.title || card.name)) || 'Untitled card';
}

// One short line describing a card and who owns it.
function cardLine(card, now) {
  var owners = [];
  var assignees = Array.isArray(card.assignees) && card.assignees.length
    ? card.assignees
    : (card.assignee ? [card.assignee] : []);
  assignees.forEach(function(a) { owners.push(mention(a)); });
  var ownerText = owners.length ? owners.join(', ') : '*unassigned*';
  return '- **' + titleOf(card) + '** (' + ownerText + ')';
}

// Build the daily standup embed from a buildAccountability() result.
export function standupEmbed(accountability, now) {
  var ref = now || new Date();
  var totals = (accountability && accountability.totals) || { cards: 0, active: 0, overdue: 0, stuck: 0, dueSoon: 0 };
  var departments = (accountability && accountability.departments) || [];

  var deptLine = departments.map(function(d) {
    return d.label + ' ' + d.active;
  }).join('  |  ') || 'No departments tracked';

  var embed = new EmbedBuilder()
    .setColor(BRAND_BLUE)
    .setTitle('BrosephTech Standup')
    .setTimestamp(ref);

  embed.addFields({
    name: 'Active by department',
    value: deptLine,
  });

  // Collect unique overdue + stuck cards for the "Needs attention" section.
  var members = (accountability && accountability.members) || {};
  var seen = {};
  var attention = [];
  Object.keys(members).forEach(function(name) {
    var b = members[name];
    b.overdue.concat(b.stuck).forEach(function(card) {
      var key = String(card.id || titleOf(card));
      if (seen[key]) return;
      seen[key] = true;
      attention.push(card);
    });
  });

  if (attention.length === 0) {
    embed.setDescription('Board is clean. Nothing overdue and nothing stuck. Keep it rolling.');
    embed.addFields({
      name: 'Snapshot',
      value: totals.active + ' active card(s), ' + totals.dueSoon + ' due soon.',
    });
    return embed;
  }

  embed.setDescription('Here is where things stand this morning. Owners are pinged below.');

  var allLines = attention.map(function(card) {
    var reasonBits = [];
    if (card.due_date) {
      var due = new Date(card.due_date);
      if (!isNaN(due.getTime()) && due.getTime() < ref.getTime()) reasonBits.push('overdue');
    }
    var sd = staleDays(card, ref);
    if (sd > 0) reasonBits.push('stuck ' + sd + 'd');
    var suffix = reasonBits.length ? '  [' + reasonBits.join(', ') + ']' : '';
    return cardLine(card, ref) + suffix;
  });

  // Discord caps a field value at 1024 chars. Accumulate WHOLE lines so a
  // ping is never cut mid-mention, and surface any overflow as a count.
  var kept = [];
  var used = 0;
  var overflowNote = '';
  for (var li = 0; li < allLines.length; li++) {
    var candidate = allLines[li];
    var addLen = candidate.length + (kept.length ? 1 : 0);
    var remaining = allLines.length - li;
    var reserve = remaining > 1 ? 24 : 0; // room for the overflow note
    if (used + addLen > 1024 - reserve) {
      overflowNote = '...and ' + remaining + ' more';
      break;
    }
    kept.push(candidate);
    used += addLen;
  }
  if (overflowNote) kept.push(overflowNote);

  embed.addFields({
    name: 'Needs attention (' + attention.length + ')',
    value: kept.join('\n') || 'Nothing to show.',
  });

  embed.addFields({
    name: 'Snapshot',
    value: totals.overdue + ' overdue, ' + totals.stuck + ' stuck, ' + totals.dueSoon + ' due soon, ' + totals.active + ' active.',
  });

  return embed;
}

// A short ping string for one member, listing their overdue + stuck titles.
// Returns null when the member has nothing to be nudged about.
export function nudgeContent(member, buckets, now) {
  if (!member || !buckets) return null;
  var ref = now || new Date();
  var overdue = buckets.overdue || [];
  var stuck = buckets.stuck || [];
  if (overdue.length === 0 && stuck.length === 0) return null;

  var parts = [mention(member) + ' quick accountability check.'];

  if (overdue.length) {
    var overdueTitles = overdue.map(function(c) { return titleOf(c); });
    parts.push('Overdue: ' + overdueTitles.join(', ') + '.');
  }
  if (stuck.length) {
    var stuckTitles = stuck.map(function(c) {
      var sd = staleDays(c, ref);
      return titleOf(c) + (sd > 0 ? ' (' + sd + 'd)' : '');
    });
    parts.push('Stuck: ' + stuckTitles.join(', ') + '.');
  }
  parts.push('Move it forward today or drop a note on the card.');

  return parts.join(' ');
}

export var EMBED_COLORS = { brand: BRAND_BLUE, warn: WARN_AMBER, fromHex: hexToInt };
