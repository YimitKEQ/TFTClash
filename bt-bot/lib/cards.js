/**
 * cards.js - reading and mutating single board cards from Discord.
 *
 * Until now the bot could create a card and then only ever watch it. You could
 * not finish, move, assign, block, or unblock anything without opening the web
 * board, which meant the accountability nudges had no matching way to act. This
 * module is the write path behind /card.
 *
 * Two details that matter and are easy to get wrong:
 *
 *  1. column_changed_at drives the "stuck" calculation in board.js. Moving a
 *     card without bumping it would leave a freshly moved card reading as
 *     untouched for a week, so every column change stamps it here, in one place.
 *  2. Slash-command autocomplete has roughly three seconds to answer and fires
 *     on every keystroke. Hitting Supabase per keystroke would be both slow and
 *     rude, so lookups run off a short-lived cache.
 *
 * Copy rule: zero em or en dashes anywhere in user-facing strings.
 */

import { supabase } from './supabase.js';

// Columns that mean the work is finished.
export var DONE_COLUMNS = ['published', 'archive'];

// The board pipeline, in order, with the id the database stores.
export var COLUMNS = [
  { id: 'ideas', label: 'Ideas / Backlog' },
  { id: 'writing', label: 'Planned' },
  { id: 'production', label: 'In progress' },
  { id: 'review', label: 'Review' },
  { id: 'published', label: 'Published / Done' },
  { id: 'archive', label: 'Archive' },
];

var COLUMN_IDS = COLUMNS.map(function(c) { return c.id; });

export function isKnownColumn(id) {
  return COLUMN_IDS.indexOf(String(id || '').toLowerCase()) !== -1;
}

// ---- cached lookup -----------------------------------------------------------

// Autocomplete fires per keystroke. An 8 second window is long enough to cover
// a burst of typing and short enough that a card someone just created shows up.
var CACHE_TTL_MS = 8000;
var cache = { at: 0, rows: [] };

/**
 * Every card, from cache when it is fresh. Returns [] on a read failure rather
 * than throwing, because the only caller that cannot tolerate a throw is
 * autocomplete, and an empty option list is a far better failure than a
 * spinning menu.
 */
export async function cachedCards(force) {
  var now = Date.now();
  if (!force && cache.rows.length && (now - cache.at) < CACHE_TTL_MS) return cache.rows;
  try {
    var res = await supabase
      .from('bt_content_cards')
      .select('id, title, column_id, department, assignee, assignees, priority, due_date, blocked, column_changed_at, updated_at, created_at');
    if (res.error) {
      console.warn('[cards] cachedCards failed: ' + res.error.message);
      return cache.rows;
    }
    cache = { at: now, rows: res.data || [] };
    return cache.rows;
  } catch (e) {
    console.warn('[cards] cachedCards threw: ' + ((e && e.message) || e));
    return cache.rows;
  }
}

// Drop the cache so the next read is authoritative. Called after every write.
export function invalidateCards() {
  cache = { at: 0, rows: [] };
}

function isDone(card) {
  return DONE_COLUMNS.indexOf(String((card && card.column_id) || '').toLowerCase()) !== -1;
}

/**
 * Rank cards against a free-text query. Pure, so the matching rules are
 * testable without a database: the network fetch lives in searchCards below.
 *
 * filter: 'open' excludes finished cards, 'blocked' keeps only blocked ones,
 * 'done' keeps only finished ones. Anything else means no filter.
 */
export function rankCards(rows, query, filter, limit) {
  var needle = String(query || '').trim().toLowerCase();
  var max = limit || 25;

  var pool = (rows || []).filter(function(c) {
    if (filter === 'open') return !isDone(c);
    if (filter === 'blocked') return !!c.blocked && !isDone(c);
    if (filter === 'done') return isDone(c);
    return true;
  });

  var scored = pool.map(function(c) {
    var title = String(c.title || '').toLowerCase();
    var score;
    if (!needle) score = 0;
    else if (title.indexOf(needle) === 0) score = 3;
    else if (title.indexOf(needle) !== -1) score = 2;
    else if (String(c.department || '').toLowerCase().indexOf(needle) !== -1) score = 1;
    else score = -1;
    return { card: c, score: score };
  }).filter(function(s) { return s.score >= 0; });

  scored.sort(function(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    // Then most recently touched, so the card someone is actually working on
    // floats to the top of an empty query.
    var at = new Date(a.card.updated_at || a.card.created_at || 0).getTime();
    var bt = new Date(b.card.updated_at || b.card.created_at || 0).getTime();
    return bt - at;
  });

  return scored.slice(0, max).map(function(s) { return s.card; });
}

// Cards matching a query, read through the autocomplete cache.
export async function searchCards(query, filter, limit) {
  var rows = await cachedCards(false);
  return rankCards(rows, query, filter, limit);
}

// One card by id, straight from the database (never the cache: a mutation must
// act on current state, not on something up to eight seconds old).
export async function getCard(id) {
  if (!id) return null;
  var res = await supabase.from('bt_content_cards').select('*').eq('id', id).maybeSingle();
  if (res.error) throw new Error('Could not read that card: ' + res.error.message);
  return res.data || null;
}

// ---- mutation ----------------------------------------------------------------

/**
 * Patch one card. Always stamps updated_at, and stamps column_changed_at too
 * whenever the column actually changes, so the staleness clock restarts with
 * the move instead of counting from the last time somebody edited the title.
 *
 * Returns the updated row. Throws with a readable message on failure.
 */
export async function updateCard(id, patch, current) {
  if (!id) throw new Error('No card id given.');
  var body = Object.assign({}, patch || {});
  var now = new Date().toISOString();
  body.updated_at = now;

  if (body.column_id != null) {
    var before = current ? String(current.column_id || '').toLowerCase() : null;
    if (before === null || before !== String(body.column_id).toLowerCase()) {
      body.column_changed_at = now;
    }
  }

  var res = await supabase
    .from('bt_content_cards')
    .update(body)
    .eq('id', id)
    .select('id, title, column_id, department, assignee, assignees, priority, due_date, blocked')
    .single();

  if (res.error) throw new Error('Could not update that card: ' + res.error.message);
  invalidateCards();
  return res.data;
}

/**
 * Leave a note on a card. Best effort: a comment is context, never the point of
 * the action, so a missing table or a failed insert must not fail the /card
 * command that triggered it.
 */
export async function addComment(cardId, author, body) {
  if (!cardId || !body) return null;
  try {
    var res = await supabase
      .from('bt_card_comments')
      .insert({ card_id: cardId, author: String(author || '').slice(0, 120), body: String(body).slice(0, 2000) })
      .select('id')
      .single();
    if (res.error) {
      console.warn('[cards] comment failed (continuing): ' + res.error.message);
      return null;
    }
    return res.data;
  } catch (e) {
    console.warn('[cards] comment threw (continuing): ' + ((e && e.message) || e));
    return null;
  }
}

// Set the single assignee and keep the assignees array in step. The board reads
// both, so writing only one of them makes a card look unassigned in half the UI.
export function assigneePatch(name) {
  var owner = name ? String(name) : '';
  return { assignee: owner, assignees: owner ? [owner] : [] };
}
