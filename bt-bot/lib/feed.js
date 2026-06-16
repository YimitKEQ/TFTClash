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

import { EmbedBuilder } from 'discord.js';
import { supabase } from './supabase.js';
import { fetchCards, assigneesOf } from './board.js';
import { resolveChannel } from './channels.js';
import { departmentChannel, DEPT_COLOR, resolveDeptId, deptLabel, stageLabel, priorityLabel } from './hq.js';
import { mention } from '../config/crew.js';

// Fixed shared channels (everything else is per-department).
var BOARD_CHANNEL = 'bt-board';
var WINS_CHANNEL = 'bt-wins';
var BLOCKED_CHANNEL = 'bt-blocked';

// The column that means a card has shipped.
var PUBLISHED_COLUMN = 'published';

// Fallback embed color when a card has no recognised department.
var DEFAULT_COLOR = 0x5BA3DB;

// Blocked is a state, not a department, so it gets the board's red (0xEF4444),
// never a department hue (amber would collide with the Marketing department).
var BLOCKED_COLOR = 0xEF4444;

// Debounce window: realtime can fire several events for one logical change
// (and bulk edits fire many). Collapse a burst into a single refetch + diff.
var DEBOUNCE_MS = 400;

// ---- small helpers -----------------------------------------------------------

function colorForDepartment(deptId) {
  var hex = DEPT_COLOR[String(deptId || '').toLowerCase()];
  if (!hex) return DEFAULT_COLOR;
  return parseInt(String(hex).replace('#', ''), 16);
}

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

// ---- embed builders (local to this module) -----------------------------------

function newCardEmbed(card) {
  var embed = new EmbedBuilder()
    .setColor(colorForDepartment(card && card.department))
    .setTitle('New card: ' + titleOf(card))
    .setTimestamp(new Date());

  var fields = [
    { name: 'Department', value: deptLabel(card && card.department), inline: true },
    { name: 'Stage', value: stageLabel(card && card.department, columnOf(card)), inline: true },
  ];
  if (card && card.priority) {
    fields.push({ name: 'Priority', value: priorityLabel(card.priority), inline: true });
  }
  var owner = ownerMention(card);
  fields.push({ name: 'Owner', value: owner || 'Unassigned', inline: false });
  if (card && card.due_date) {
    fields.push({ name: 'Due', value: String(card.due_date), inline: true });
  }
  embed.addFields(fields);

  if (card && card.description) {
    embed.setDescription(String(card.description).slice(0, 300));
  }
  return embed;
}

function shippedEmbed(card) {
  var embed = new EmbedBuilder()
    .setColor(colorForDepartment(card && card.department))
    .setTitle('Shipped: ' + titleOf(card))
    .setDescription('Moved to published. Nice work.')
    .setTimestamp(new Date());

  var owner = ownerMention(card);
  embed.addFields(
    { name: 'Department', value: deptLabel(card && card.department), inline: true },
    { name: 'Owner', value: owner || 'Unassigned', inline: true }
  );
  return embed;
}

function blockedEmbed(card) {
  var embed = new EmbedBuilder()
    .setColor(BLOCKED_COLOR)
    .setTitle('Blocked: ' + titleOf(card))
    .setDescription('This card is blocked. Owner, please unblock it or drop a note on the card.')
    .setTimestamp(new Date());

  var owner = ownerMention(card);
  embed.addFields(
    { name: 'Department', value: deptLabel(card && card.department), inline: true },
    { name: 'Owner', value: owner || 'Unassigned', inline: true }
  );
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

async function announceNew(guild, card) {
  var embed = newCardEmbed(card);
  var owner = ownerMention(card);
  await postTo(guild, BOARD_CHANNEL, embed);
  await postTo(guild, departmentChannel(deptIdOf(card)), embed, owner || undefined);
}

async function announceShipped(guild, card) {
  var embed = shippedEmbed(card);
  await postTo(guild, WINS_CHANNEL, embed);
  await postTo(guild, BOARD_CHANNEL, embed);
}

async function announceBlocked(guild, card) {
  var embed = blockedEmbed(card);
  var owner = ownerMention(card);
  await postTo(guild, BLOCKED_CHANNEL, embed, owner || undefined);
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
}
