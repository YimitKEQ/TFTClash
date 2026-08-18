/**
 * jiraSync.js - pull Jira status changes back onto the board.
 *
 * The gap this closes: /record created a board card AND a Jira issue from every
 * approved task, then never connected them again. Nothing stored the issue key,
 * so moving a ticket to Done in Jira did literally nothing here. The card stayed
 * where it was, kept counting as overdue and stuck, and kept generating nudges
 * for work that had already shipped.
 *
 * Two design decisions worth knowing before changing anything in here:
 *
 *  1. The sync is EDGE TRIGGERED, not level triggered. Each card remembers the
 *     Jira status category it was last synced with (jira_status). A pass only
 *     acts when Jira's current category differs from that. This is what lets
 *     someone move a card on the board by hand without the next pass dragging it
 *     back to wherever Jira happens to sit. Board changes and Jira changes both
 *     win, whichever moved last.
 *  2. Direction is Jira to board only. Pushing board moves back into Jira needs
 *     conflict rules (two sources both changed since the last pass, now what)
 *     and is deliberately out of scope.
 *
 * Everything above applyPlan is pure so the rules are testable without a
 * database or a network.
 *
 * Copy rule: zero em or en dashes anywhere in user-facing strings.
 */

import { supabase } from './supabase.js';
import { updateCard } from './cards.js';
import { jiraConfigured, jiraMissingHint, searchAllIssues } from './jira.js';

// Jira status categories map onto the board pipeline. Jira only has three
// (new / indeterminate / done), so 'writing' and 'review' are never a sync
// target: they are board-only refinements and a Jira move must not clobber them
// beyond the coarse three-way position.
export var COLUMN_FOR_CATEGORY = {
  'new': 'ideas',
  'indeterminate': 'production',
  'done': 'published',
};

// A card in archive was deliberately parked by a human. Record the new Jira
// category so the pass stops retrying, but never haul it back into the pipeline.
var FROZEN_COLUMNS = ['archive'];

// Card titles are stored truncated to 140 chars, and the dashboard's slim issue
// shape truncates a Jira summary to the same 140, so normalizing to that length
// makes the two comparable without either side winning on length alone.
var TITLE_MAX = 140;

export function normalizeTitle(value) {
  return String(value == null ? '' : value)
    .slice(0, TITLE_MAX)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function groupByTitle(items, titleOf) {
  var map = {};
  (items || []).forEach(function(item) {
    var key = normalizeTitle(titleOf(item));
    if (!key) return;
    if (!map[key]) map[key] = [];
    map[key].push(item);
  });
  return map;
}

/**
 * Pair cards to Jira issues by title.
 *
 * A pair is only formed when a title maps to exactly one card AND exactly one
 * issue. Anything ambiguous is reported and left alone: an unlinked card is a
 * minor annoyance, a card linked to the wrong ticket silently moves the wrong
 * work and is far harder to notice. Fail closed.
 *
 * Returns { pairs: [{ card, issue }], ambiguous: [{ title, cards, issues }] }.
 */
export function pairByTitle(cards, issues) {
  var cardsByTitle = groupByTitle(cards, function(c) { return c && c.title; });
  var issuesByTitle = groupByTitle(issues, function(i) { return i && i.summary; });

  var pairs = [];
  var ambiguous = [];

  Object.keys(cardsByTitle).forEach(function(title) {
    var matchedCards = cardsByTitle[title];
    var matchedIssues = issuesByTitle[title] || [];
    if (matchedIssues.length === 0) return;
    if (matchedCards.length === 1 && matchedIssues.length === 1) {
      pairs.push({ card: matchedCards[0], issue: matchedIssues[0] });
      return;
    }
    ambiguous.push({ title: title, cards: matchedCards.length, issues: matchedIssues.length });
  });

  return { pairs: pairs, ambiguous: ambiguous };
}

function columnOf(card) {
  return String((card && card.column_id) || '').toLowerCase();
}

/**
 * Work out what a sync pass should do. Pure.
 *
 * cards:  linked board cards ({ id, title, column_id, jira_key, jira_status })
 * issues: slim Jira issues ({ key, summary, status, category, url })
 * options.baseline:
 *   'adopt' (default) - a card with no recorded jira_status just records where
 *     Jira currently sits, without moving. This is what makes the very first
 *     pass after linking safe: it establishes the baseline instead of yanking
 *     every card to match Jira all at once.
 *   'apply' - a card with no recorded status is treated as a real change and
 *     moved to match Jira now. Used by the one-time backfill, where reconciling
 *     with Jira is the entire point.
 *
 * Returns:
 *   moves:   [{ cardId, title, key, from, to, status, category, url }]
 *   stamps:  [{ cardId, key, category }]  category changed, column stays put
 *   missing: [key]  linked cards whose issue no longer exists in the project
 */
export function planSync(cards, issues, options) {
  var opts = options || {};
  var baseline = opts.baseline === 'apply' ? 'apply' : 'adopt';

  var byKey = {};
  (issues || []).forEach(function(i) {
    if (i && i.key) byKey[String(i.key).toUpperCase()] = i;
  });

  var moves = [];
  var stamps = [];
  var missing = [];

  (cards || []).forEach(function(card) {
    if (!card || !card.jira_key) return;
    var issue = byKey[String(card.jira_key).toUpperCase()];
    if (!issue) {
      missing.push(card.jira_key);
      return;
    }

    var category = String(issue.category || 'new');
    var known = card.jira_status ? String(card.jira_status) : null;
    if (known === category) return; // nothing changed in Jira since the last pass

    var stamp = { cardId: card.id, key: issue.key, category: category };

    // First sight of this card: record where Jira is, do not move it.
    if (!known && baseline === 'adopt') {
      stamps.push(stamp);
      return;
    }

    var target = COLUMN_FOR_CATEGORY[category];
    var from = columnOf(card);
    if (!target || from === target || FROZEN_COLUMNS.indexOf(from) !== -1) {
      stamps.push(stamp);
      return;
    }

    moves.push({
      cardId: card.id,
      title: card.title || 'Untitled card',
      key: issue.key,
      from: from,
      to: target,
      status: issue.status || '',
      category: category,
      url: issue.url || '',
    });
  });

  return { moves: moves, stamps: stamps, missing: missing };
}

// ---- database side -----------------------------------------------------------

var LINKED_FIELDS = 'id, title, column_id, department, assignee, assignees, blocked, jira_key, jira_status';

// Every card that is linked to a Jira issue.
export async function fetchLinkedCards() {
  var res = await supabase
    .from('bt_content_cards')
    .select(LINKED_FIELDS)
    .not('jira_key', 'is', null);
  if (res.error) throw new Error('Failed to read linked cards: ' + res.error.message);
  return res.data || [];
}

// Every card that is NOT linked yet, for the backfill.
export async function fetchUnlinkedCards() {
  var res = await supabase
    .from('bt_content_cards')
    .select(LINKED_FIELDS)
    .is('jira_key', null);
  if (res.error) throw new Error('Failed to read unlinked cards: ' + res.error.message);
  return res.data || [];
}

/**
 * Attach a Jira key to a card. `category` seeds jira_status so the next sync
 * pass has a baseline and does not read the link itself as a change.
 * Best effort per card: one failed link must not abort the rest.
 */
export async function linkCard(cardId, jiraKey, category) {
  var patch = {
    jira_key: jiraKey,
    jira_status: category || 'new',
    jira_synced_at: new Date().toISOString(),
  };
  var res = await supabase
    .from('bt_content_cards')
    .update(patch)
    .eq('id', cardId)
    .select('id')
    .single();
  if (res.error) throw new Error('Could not link card to ' + jiraKey + ': ' + res.error.message);
  return res.data;
}

/**
 * Link a batch of freshly created cards to their freshly created Jira issues.
 * pairs: [{ card, issue }] as produced by pairByTitle.
 * Returns { linked, failed: [{ key, error }] }.
 */
export async function linkPairs(pairs) {
  var linked = 0;
  var failed = [];
  var list = pairs || [];
  for (var i = 0; i < list.length; i++) {
    var p = list[i];
    if (!p || !p.card || !p.issue || !p.card.id || !p.issue.key) continue;
    try {
      await linkCard(p.card.id, p.issue.key, p.issue.category || 'new');
      linked++;
    } catch (e) {
      failed.push({ key: p.issue.key, error: (e && e.message) || String(e) });
    }
  }
  return { linked: linked, failed: failed };
}

/**
 * Execute a plan. Moves go through updateCard so the column_changed_at stamp
 * (which drives the "stuck" clock) stays in exactly one place.
 * Returns { moved, stamped, errors: [{ key, error }] }.
 */
export async function applyPlan(plan, cardsById) {
  var p = plan || {};
  var index = cardsById || {};
  var moved = 0;
  var stamped = 0;
  var errors = [];
  var now = new Date().toISOString();

  var moves = p.moves || [];
  for (var i = 0; i < moves.length; i++) {
    var m = moves[i];
    try {
      await updateCard(
        m.cardId,
        { column_id: m.to, jira_status: m.category, jira_synced_at: now },
        index[m.cardId] || { column_id: m.from }
      );
      moved++;
    } catch (e) {
      errors.push({ key: m.key, error: (e && e.message) || String(e) });
    }
  }

  var stamps = p.stamps || [];
  for (var j = 0; j < stamps.length; j++) {
    var s = stamps[j];
    try {
      var res = await supabase
        .from('bt_content_cards')
        .update({ jira_status: s.category, jira_synced_at: now })
        .eq('id', s.cardId);
      if (res.error) throw new Error(res.error.message);
      stamped++;
    } catch (e2) {
      errors.push({ key: s.key, error: (e2 && e2.message) || String(e2) });
    }
  }

  return { moved: moved, stamped: stamped, errors: errors };
}

// Board column ids to the words the crew actually uses, for the report line.
var COLUMN_LABEL = {
  ideas: 'Backlog',
  writing: 'Planned',
  production: 'In progress',
  review: 'Review',
  published: 'Done',
  archive: 'Archive',
};

export function columnLabel(id) {
  var key = String(id || '').toLowerCase();
  return COLUMN_LABEL[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Unknown');
}

/**
 * One full sync pass. Never throws: the caller is a cron, and a Jira outage
 * must not take down the scheduler or the bot.
 *
 * Returns { ok, skipped, reason, checked, moved, stamped, missing, moves, errors }.
 */
export async function syncJiraToBoard(options) {
  var opts = options || {};
  if (!jiraConfigured()) {
    return { ok: false, skipped: true, reason: 'Jira is not configured (' + jiraMissingHint() + ')' };
  }

  var cards;
  try {
    cards = await fetchLinkedCards();
  } catch (e) {
    return { ok: false, skipped: false, reason: (e && e.message) || String(e) };
  }

  if (!cards.length) {
    return { ok: true, skipped: true, reason: 'No board cards are linked to Jira yet.', checked: 0, moved: 0, stamped: 0, moves: [] };
  }

  var issues;
  try {
    var jql = 'project = ' + (process.env.JIRA_PROJECT_KEY || '') + ' ORDER BY updated DESC';
    issues = await searchAllIssues(jql, 1000);
  } catch (e2) {
    return { ok: false, skipped: false, reason: (e2 && e2.message) || String(e2) };
  }

  var plan = planSync(cards, issues, { baseline: opts.baseline });
  var index = {};
  cards.forEach(function(c) { index[c.id] = c; });

  var applied = await applyPlan(plan, index);

  return {
    ok: true,
    skipped: false,
    checked: cards.length,
    moved: applied.moved,
    stamped: applied.stamped,
    missing: plan.missing,
    moves: plan.moves,
    errors: applied.errors,
  };
}
