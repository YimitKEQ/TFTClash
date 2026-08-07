/**
 * feed.js - the live board feed, driven by Supabase realtime.
 *
 * startFeed(client) subscribes to changes on bt_content_cards and posts a
 * compact embed to the right HQ channels whenever a card is created, shipped,
 * or blocked. Reliability comes from a snapshot-diff approach: realtime tells
 * us "something changed", but we never trust its old-row payload (Supabase only
 * guarantees the new row unless REPLICA IDENTITY FULL is set). Instead we keep
 * an in-memory baseline and re-derive what changed by refetching and diffing.
 *
 * Routing (per the HQ layout):
 *   card created  -> bt-board AND bt-<department> (ping owner if mapped)
 *   card shipped  -> bt-wins  AND bt-board
 *   card blocked  -> bt-blocked (ping owner) AND bt-board
 *
 * Copy rule: zero em or en dashes anywhere in user-facing strings.
 */

import { supabase } from './supabase.js';
import { fetchCards, assigneesOf, isOverdue, staleDays } from './board.js';
import { resolveChannel } from './channels.js';
import { departmentChannel, resolveDeptId, deptLabel, stageLabel, priorityLabel } from './hq.js';
import { mention } from '../config/crew.js';
import {
  BRAND,
  COLOR,
  DOT,
  MARK,
  bar,
  baseEmbed,
  clamp,
  deptColor,
  eyebrow,
  rel,
} from './ui.js';

// Pipeline columns in board order, used to render a card's progress through the
// board as a meter rather than as the words "column 3 of 5".
var PIPELINE_COLUMNS = ['ideas', 'writing', 'production', 'review', 'published'];

// Fixed shared channels (everything else is per-department).
var BOARD_CHANNEL = 'bt-board';
var WINS_CHANNEL = 'bt-wins';
var BLOCKED_CHANNEL = 'bt-blocked';

// The column that means a card has shipped.
var PUBLISHED_COLUMN = 'published';

// Debounce window: realtime can fire several events for one logical change
// (and bulk edits fire many). Collapse a burst into a single refetch + diff.
var DEBOUNCE_MS = 400;

// ---- small helpers -----------------------------------------------------------

function columnOf(card) {
  return String((card && card.column_id) || '').toLowerCase();
}

function titleOf(card) {
  return (card && (card.title || card.name)) || 'Untitled card';
}

function deptIdOf(card) {
  return resolveDeptId(card && card.department);
}

// The first mapped/known owner of a card, as a display mention. Returns null
// when the card has no assignees so callers can skip the ping line.
function ownerMention(card) {
  var owners = assigneesOf(card);
  if (!owners.length) return null;
  return owners.map(function(name) { return mention(name); }).join(', ');
}

// The card's position in the pipeline as a meter, e.g. "███░░ Review 4/5".
// A card in archive or an unknown column just names its stage.
function stageMeter(card) {
  var col = columnOf(card);
  var label = stageLabel(card && card.department, col);
  var idx = PIPELINE_COLUMNS.indexOf(col);
  if (idx === -1) return label;
  var step = idx + 1;
  return '`' + bar(step, PIPELINE_COLUMNS.length, 5) + '` ' + label + '  ' + step + '/' + PIPELINE_COLUMNS.length;
}

// A short status marker. Blocked beats overdue beats stuck. Returns '' when the
// card is healthy so callers can omit the field entirely.
function statusMarker(card, ref) {
  if (card && card.blocked) return MARK.blocked + ' Blocked';
  if (isOverdue(card, ref)) return DOT.danger + ' Overdue';
  var sd = staleDays(card, ref);
  if (sd > 0) return DOT.warn + ' Untouched ' + sd + 'd';
  return '';
}

/**
 * The three-up card fields every feed embed shares. Owner and stage always
 * appear; due date and status only when they carry information. Keeping this to
 * one tidy row of three (plus at most one more) is the whole readability fix:
 * the old version emitted up to six fields for a card nobody had read yet.
 */
function cardFields(card, ref) {
  var owner = ownerMention(card);
  var fields = [
    { name: eyebrow('Owner'), value: clamp(owner || '*unassigned*', 1024), inline: true },
    { name: eyebrow('Priority'), value: priorityLabel(card && card.priority), inline: true },
    { name: eyebrow('Due'), value: card && card.due_date ? rel(card.due_date) : 'no date', inline: true },
  ];
  var marker = statusMarker(card, ref);
  if (marker) fields.push({ name: eyebrow('Status'), value: marker, inline: false });
  return fields;
}

// ---- embed builders (local to this module) -----------------------------------

export function newCardEmbed(card) {
  var ref = new Date();
  var embed = baseEmbed({
    color: deptColor(deptIdOf(card)),
    author: deptLabel(card && card.department) + '  ' + MARK.arrow + '  new card',
    title: titleOf(card),
    description: card && card.description
      ? clamp(String(card.description), 280) + '\n' + stageMeter(card)
      : stageMeter(card),
    footer: BRAND.name + ' board',
    timestamp: ref,
  });
  embed.addFields(cardFields(card, ref));
  return embed;
}

export function shippedEmbed(card) {
  var ref = new Date();
  var embed = baseEmbed({
    color: COLOR.success,
    author: deptLabel(card && card.department) + '  ' + MARK.arrow + '  shipped',
    title: MARK.shipped + '  ' + titleOf(card),
    description: 'Moved to published. Nice work.\n' + stageMeter(card),
    footer: BRAND.name + ' board',
    timestamp: ref,
  });
  embed.addFields(cardFields(card, ref));
  return embed;
}

export function blockedEmbed(card) {
  var ref = new Date();
  var embed = baseEmbed({
    color: COLOR.danger,
    author: deptLabel(card && card.department) + '  ' + MARK.arrow + '  blocked',
    title: MARK.blocked + '  ' + titleOf(card),
    description: 'This card cannot move. Unblock it or drop a note explaining what it is waiting on.\n' + stageMeter(card),
    footer: BRAND.name + ' board',
    timestamp: ref,
  });
  embed.addFields(cardFields(card, ref));
  return embed;
}

// ---- posting -----------------------------------------------------------------

// Send an embed to a channel resolved by name. A missing channel is skipped
// silently (the server may not have run /setup yet). content is optional and
// used to carry an owner ping outside the embed so the mention actually pings.
async function postTo(guild, channelName, embed, content) {
  if (!channelName) return;
  var channel = resolveChannel(guild, channelName);
  if (!channel) return;
  var payload = { embeds: [embed] };
  if (content) payload.content = content;
  try {
    await channel.send(payload);
  } catch (e) {
    console.warn('[feed] could not post to #' + channelName + ': ' + ((e && e.message) || e));
  }
}

// Only a real <@id> belongs in message content: a mention() fallback is the
// plain bold name, which as a content line reads like a stray shout.
function pingContent(card, suffix) {
  var owner = ownerMention(card);
  if (!owner || owner.indexOf('<@') === -1) return undefined;
  return owner + (suffix ? ' ' + suffix : '');
}

async function announceNew(guild, card) {
  var embed = newCardEmbed(card);
  await postTo(guild, BOARD_CHANNEL, embed);
  await postTo(guild, departmentChannel(deptIdOf(card)), embed, pingContent(card, 'this one is yours.'));
}

async function announceShipped(guild, card) {
  var embed = shippedEmbed(card);
  await postTo(guild, WINS_CHANNEL, embed);
  await postTo(guild, BOARD_CHANNEL, embed);
}

async function announceBlocked(guild, card) {
  var embed = blockedEmbed(card);
  await postTo(guild, BLOCKED_CHANNEL, embed, pingContent(card, 'your card is blocked.'));
  await postTo(guild, BOARD_CHANNEL, embed);
}

// ---- snapshot + diff ---------------------------------------------------------

// Reduce the full card list to the only two fields the diff cares about.
function buildSnapshot(cards) {
  var snap = {};
  (cards || []).forEach(function(card) {
    if (!card || card.id == null) return;
    snap[String(card.id)] = {
      column_id: columnOf(card),
      blocked: !!card.blocked,
    };
  });
  return snap;
}

// Compare the current cards against the previous snapshot and post for every
// detected transition. Order is deterministic (created, shipped, blocked) so a
// brand new published card reads naturally.
async function diffAndAnnounce(guild, previous, cards) {
  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    if (!card || card.id == null) continue;
    var id = String(card.id);
    var before = previous[id];
    var nowColumn = columnOf(card);
    var nowBlocked = !!card.blocked;

    if (!before) {
      // Brand new card. If it landed straight in published, also celebrate it.
      await announceNew(guild, card);
      if (nowColumn === PUBLISHED_COLUMN) await announceShipped(guild, card);
      if (nowBlocked) await announceBlocked(guild, card);
      continue;
    }

    if (before.column_id !== PUBLISHED_COLUMN && nowColumn === PUBLISHED_COLUMN) {
      await announceShipped(guild, card);
    }
    if (!before.blocked && nowBlocked) {
      await announceBlocked(guild, card);
    }
  }
}

// ---- public API --------------------------------------------------------------

// Start the live feed. Builds the baseline snapshot, subscribes to realtime,
// and on every change debounces, refetches, diffs, and posts. Never throws:
// any failure is logged and the process keeps running.
export async function startFeed(client) {
  var guildId = process.env.BT_GUILD_ID;

  var snapshot = {};
  try {
    snapshot = buildSnapshot(await fetchCards());
  } catch (e) {
    console.error('[feed] could not build baseline snapshot: ' + ((e && e.message) || e));
    snapshot = {};
  }
  console.log('[feed] baseline snapshot built (' + Object.keys(snapshot).length + ' card(s))');

  var timer = null;

  function getGuild() {
    return client.guilds.cache.get(guildId) || null;
  }

  async function runDiff() {
    timer = null;
    try {
      var guild = getGuild();
      if (!guild) {
        console.warn('[feed] guild ' + guildId + ' not in cache. Refreshing snapshot only.');
        snapshot = buildSnapshot(await fetchCards());
        return;
      }
      var cards = await fetchCards();
      var previous = snapshot;
      // Replace the snapshot BEFORE awaiting the posts so a fresh burst that
      // arrives mid-post diffs against the already-seen state, not stale data.
      snapshot = buildSnapshot(cards);
      await diffAndAnnounce(guild, previous, cards);
    } catch (e) {
      console.error('[feed] diff run failed: ' + ((e && e.message) || e));
    }
  }

  function onChange() {
    try {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function() {
        runDiff().catch(function(e) {
          console.error('[feed] runDiff error: ' + ((e && e.message) || e));
        });
      }, DEBOUNCE_MS);
    } catch (e) {
      console.error('[feed] onChange error: ' + ((e && e.message) || e));
    }
  }

  // Subscribe to every change on the board table. We do not read the payload
  // (old-row data is not guaranteed); a change just triggers a debounced diff.
  // Wrapped so a synchronous realtime-client failure can never escape startFeed.
  try {
    var channel = supabase
      .channel('bt-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bt_content_cards' },
        function() { onChange(); }
      )
      .subscribe(function(status) {
        console.log('[feed] realtime subscription status: ' + status);
      });
    return channel;
  } catch (e) {
    console.error('[feed] could not subscribe to realtime: ' + ((e && e.message) || e));
    return null;
  }
}
