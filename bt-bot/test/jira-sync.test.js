/**
 * Tests for lib/jiraSync.js, the Jira to board sync rules.
 *
 * This is a boring critical path: it moves real work between columns based on
 * something that happened in another system, unattended, every ten minutes. The
 * two ways it can go wrong are both silent. It can fail to move a card (the
 * original bug: Jira said Done, the board never noticed) or it can move the
 * wrong card, or move one that a human had deliberately put somewhere else.
 *
 * Every rule below exists because of one of those two failures.
 */

import './env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  COLUMN_FOR_CATEGORY,
  columnLabel,
  normalizeTitle,
  pairByTitle,
  planSync,
} from '../lib/jiraSync.js';
import { jiraSyncEmbed } from '../scheduler.js';

function card(overrides) {
  return Object.assign({
    id: 'card-1',
    title: 'Ship the landing page',
    column_id: 'ideas',
    jira_key: 'KAN-1',
    jira_status: 'new',
  }, overrides || {});
}

function issue(overrides) {
  return Object.assign({
    key: 'KAN-1',
    summary: 'Ship the landing page',
    status: 'To Do',
    category: 'new',
    url: 'https://example.atlassian.net/browse/KAN-1',
  }, overrides || {});
}

// ---- title matching ----------------------------------------------------------

test('normalizeTitle ignores case, padding, and collapsed whitespace', function() {
  assert.equal(normalizeTitle('  Ship  The   Landing Page '), 'ship the landing page');
});

test('normalizeTitle truncates to the 140 chars a card title is stored at', function() {
  var long = 'x'.repeat(200);
  assert.equal(normalizeTitle(long).length, 140);
});

test('normalizeTitle survives null and undefined', function() {
  assert.equal(normalizeTitle(null), '');
  assert.equal(normalizeTitle(undefined), '');
});

test('pairByTitle links a card to the issue with the same title', function() {
  var res = pairByTitle([card()], [issue()]);
  assert.equal(res.pairs.length, 1);
  assert.equal(res.pairs[0].card.id, 'card-1');
  assert.equal(res.pairs[0].issue.key, 'KAN-1');
  assert.equal(res.ambiguous.length, 0);
});

test('pairByTitle matches a card against the issue summary truncated the same way', function() {
  var title = 'A'.repeat(160);
  var res = pairByTitle(
    [card({ title: title.slice(0, 140) })],
    [issue({ summary: title })]
  );
  assert.equal(res.pairs.length, 1);
});

test('pairByTitle refuses to guess when two cards share a title', function() {
  var res = pairByTitle(
    [card({ id: 'a' }), card({ id: 'b' })],
    [issue()]
  );
  assert.equal(res.pairs.length, 0, 'a wrong link is worse than no link');
  assert.equal(res.ambiguous.length, 1);
  assert.equal(res.ambiguous[0].cards, 2);
  assert.equal(res.ambiguous[0].issues, 1);
});

test('pairByTitle refuses to guess when two issues share a title', function() {
  var res = pairByTitle(
    [card()],
    [issue({ key: 'KAN-1' }), issue({ key: 'KAN-2' })]
  );
  assert.equal(res.pairs.length, 0);
  assert.equal(res.ambiguous.length, 1);
});

test('pairByTitle leaves board-only cards alone', function() {
  var res = pairByTitle([card({ title: 'Something never sent to Jira' })], [issue()]);
  assert.equal(res.pairs.length, 0);
  assert.equal(res.ambiguous.length, 0);
});

// ---- sync planning -----------------------------------------------------------

test('a Jira status that has not changed produces no work at all', function() {
  var plan = planSync([card({ jira_status: 'new' })], [issue({ category: 'new' })]);
  assert.equal(plan.moves.length, 0);
  assert.equal(plan.stamps.length, 0);
});

test('marking a ticket Done moves the card to the published column', function() {
  var plan = planSync(
    [card({ column_id: 'production', jira_status: 'indeterminate' })],
    [issue({ category: 'done', status: 'Done' })]
  );
  assert.equal(plan.moves.length, 1);
  assert.equal(plan.moves[0].from, 'production');
  assert.equal(plan.moves[0].to, 'published');
  assert.equal(plan.moves[0].category, 'done');
  assert.equal(plan.moves[0].key, 'KAN-1');
});

test('starting a ticket moves the card into production', function() {
  var plan = planSync(
    [card({ column_id: 'ideas', jira_status: 'new' })],
    [issue({ category: 'indeterminate', status: 'In Progress' })]
  );
  assert.equal(plan.moves.length, 1);
  assert.equal(plan.moves[0].to, 'production');
});

test('reopening a done ticket pulls the card back out of published', function() {
  var plan = planSync(
    [card({ column_id: 'published', jira_status: 'done' })],
    [issue({ category: 'indeterminate', status: 'In Progress' })]
  );
  assert.equal(plan.moves.length, 1);
  assert.equal(plan.moves[0].from, 'published');
  assert.equal(plan.moves[0].to, 'production');
});

test('a card already sitting in the right column is stamped, not moved', function() {
  var plan = planSync(
    [card({ column_id: 'published', jira_status: 'indeterminate' })],
    [issue({ category: 'done' })]
  );
  assert.equal(plan.moves.length, 0);
  assert.equal(plan.stamps.length, 1);
  assert.equal(plan.stamps[0].category, 'done');
});

test('an archived card is never hauled back into the pipeline', function() {
  var plan = planSync(
    [card({ column_id: 'archive', jira_status: 'new' })],
    [issue({ category: 'done' })]
  );
  assert.equal(plan.moves.length, 0, 'archive is a deliberate human decision');
  assert.equal(plan.stamps.length, 1, 'but record the category so it stops retrying');
});

test('the first pass over a card with no baseline records Jira without moving it', function() {
  // Otherwise every freshly linked card would jump columns at once, including
  // ones a human had already filed correctly by hand.
  var plan = planSync(
    [card({ column_id: 'review', jira_status: null })],
    [issue({ category: 'done' })]
  );
  assert.equal(plan.moves.length, 0);
  assert.equal(plan.stamps.length, 1);
  assert.equal(plan.stamps[0].category, 'done');
});

test('the backfill baseline does move a card with no recorded status', function() {
  var plan = planSync(
    [card({ column_id: 'review', jira_status: null })],
    [issue({ category: 'done' })],
    { baseline: 'apply' }
  );
  assert.equal(plan.moves.length, 1);
  assert.equal(plan.moves[0].to, 'published');
});

test('a board move with no Jira change is left alone, so the board wins', function() {
  // Someone dragged the card to published on the board; Jira still says To Do.
  var plan = planSync(
    [card({ column_id: 'published', jira_status: 'new' })],
    [issue({ category: 'new' })]
  );
  assert.equal(plan.moves.length, 0);
  assert.equal(plan.stamps.length, 0);
});

test('a linked card whose issue was deleted is reported, not touched', function() {
  var plan = planSync([card({ jira_key: 'KAN-99' })], [issue({ key: 'KAN-1' })]);
  assert.equal(plan.moves.length, 0);
  assert.equal(plan.stamps.length, 0);
  assert.deepEqual(plan.missing, ['KAN-99']);
});

test('issue keys match regardless of stored case', function() {
  var plan = planSync(
    [card({ jira_key: 'kan-1', jira_status: 'new' })],
    [issue({ key: 'KAN-1', category: 'done' })]
  );
  assert.equal(plan.moves.length, 1);
});

test('unlinked cards are ignored entirely', function() {
  var plan = planSync([card({ jira_key: null })], [issue({ category: 'done' })]);
  assert.equal(plan.moves.length, 0);
  assert.equal(plan.stamps.length, 0);
  assert.equal(plan.missing.length, 0);
});

test('an unknown Jira category never invents a column', function() {
  var plan = planSync(
    [card({ jira_status: 'new' })],
    [issue({ category: 'something-new-from-atlassian' })]
  );
  assert.equal(plan.moves.length, 0);
  assert.equal(plan.stamps.length, 1);
});

test('planSync tolerates empty input', function() {
  var plan = planSync([], []);
  assert.deepEqual(plan, { moves: [], stamps: [], missing: [] });
  var nulls = planSync(null, null);
  assert.equal(nulls.moves.length, 0);
});

test('every mapped category targets a real board column', function() {
  var COLUMNS = ['ideas', 'writing', 'production', 'review', 'published', 'archive'];
  Object.keys(COLUMN_FOR_CATEGORY).forEach(function(cat) {
    assert.ok(COLUMNS.indexOf(COLUMN_FOR_CATEGORY[cat]) !== -1, cat + ' maps to a real column');
  });
});

// ---- the announcement --------------------------------------------------------

test('a quiet pass announces nothing', function() {
  assert.equal(jiraSyncEmbed({ checked: 12, moved: 0, moves: [] }), null);
  assert.equal(jiraSyncEmbed({}), null);
});

test('the sync embed names every card it moved', function() {
  var embed = jiraSyncEmbed({
    checked: 4,
    moves: [{
      cardId: 'card-1',
      title: 'Ship the landing page',
      key: 'KAN-1',
      from: 'production',
      to: 'published',
      status: 'Done',
      category: 'done',
      url: 'https://example.atlassian.net/browse/KAN-1',
    }],
  }, new Date('2026-08-18T12:00:00Z'));

  var json = embed.toJSON();
  assert.match(json.title, /1 card moved/);
  var body = json.fields[0].value;
  assert.match(body, /KAN-1/);
  assert.match(body, /Ship the landing page/);
  assert.match(body, /In progress . Done/);
  assert.match(json.footer.text, /4 linked card/);
});

test('no user-facing sync copy contains an em or en dash', function() {
  var embed = jiraSyncEmbed({
    checked: 1,
    moves: [{ cardId: 'c', title: 'A task', key: 'KAN-1', from: 'ideas', to: 'published', status: 'Done', category: 'done', url: '' }],
  }, new Date());
  var text = JSON.stringify(embed.toJSON()) + columnLabel('production') + columnLabel('published');
  assert.equal(/[–—]/.test(text), false);
});
