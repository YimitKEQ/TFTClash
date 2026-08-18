/**
 * backfill-jira-links.js - connect the board cards and Jira issues that were
 * created before the two knew about each other.
 *
 * Every card made by /record before the sync existed has no jira_key, so the
 * sync pass cannot see it. This matches those cards to their issues by title
 * and writes the link, then optionally reconciles their columns with whatever
 * Jira currently says.
 *
 * Only unambiguous matches are linked (exactly one card and exactly one issue
 * share a title). Anything ambiguous is reported and left alone, because a card
 * wired to the wrong ticket moves the wrong work later and nobody would notice.
 *
 * Linking only is the default, on purpose. When this was first run against the
 * live board, Jira was BEHIND the board: 24 of 40 issues still sat in "Idea"
 * while their cards had already moved to Review and Done. Forcing the board to
 * match Jira would have thrown that progress away. So the backfill establishes
 * the link and takes Jira's current state as the baseline, and only changes
 * made in Jira from that point on move a card. Pass --reconcile if you really
 * do want Jira's current state stamped onto the board.
 *
 * Usage:
 *   node scripts/backfill-jira-links.js              dry run, prints the plan
 *   node scripts/backfill-jira-links.js --apply      write the links only
 *   node scripts/backfill-jira-links.js --apply --reconcile
 *                                    also move every card to match Jira today
 */

import 'dotenv/config';
import { jiraConfigured, jiraMissingHint, searchAllIssues } from '../lib/jira.js';
import {
  columnLabel,
  fetchUnlinkedCards,
  linkPairs,
  pairByTitle,
  planSync,
  applyPlan,
  fetchLinkedCards,
  COLUMN_FOR_CATEGORY,
} from '../lib/jiraSync.js';

var APPLY = process.argv.indexOf('--apply') !== -1;
var RECONCILE = process.argv.indexOf('--reconcile') !== -1;

function line(s) { console.log(s); }

async function main() {
  if (!jiraConfigured()) {
    line('Jira is not configured (' + jiraMissingHint() + '). Nothing to do.');
    process.exit(1);
  }

  var projectKey = process.env.JIRA_PROJECT_KEY;
  line('Project ' + projectKey + (APPLY ? '  [APPLY]' : '  [dry run]'));

  var cards = await fetchUnlinkedCards();
  line('Unlinked board cards: ' + cards.length);
  if (!cards.length) {
    line('Every card is already linked. Nothing to backfill.');
    return;
  }

  var issues = await searchAllIssues('project = ' + projectKey + ' ORDER BY updated DESC', 1000);
  line('Jira issues in project: ' + issues.length);

  var paired = pairByTitle(cards, issues);
  line('');
  line('Matched ' + paired.pairs.length + ' card(s) to an issue:');
  paired.pairs.forEach(function(p) {
    var target = COLUMN_FOR_CATEGORY[p.issue.category] || '?';
    var from = String(p.card.column_id || '').toLowerCase();
    var moveNote = from === target
      ? 'board agrees (' + columnLabel(target) + ')'
      : 'board says ' + columnLabel(from) + ', Jira says ' + columnLabel(target) + (RECONCILE ? '  WILL MOVE' : '  (left as is)');
    line('  ' + p.issue.key + '  ' + p.card.title.slice(0, 60) + '  [' + p.issue.status + ']  ' + moveNote);
  });

  if (paired.ambiguous.length) {
    line('');
    line('Skipped ' + paired.ambiguous.length + ' ambiguous title(s) (link these by hand if they matter):');
    paired.ambiguous.forEach(function(a) {
      line('  "' + a.title.slice(0, 60) + '"  ' + a.cards + ' card(s), ' + a.issues + ' issue(s)');
    });
  }

  var unmatched = cards.length - paired.pairs.length;
  if (unmatched > 0) {
    line('');
    line(unmatched + ' card(s) have no matching Jira issue. Those are board-only work and stay board-only.');
  }

  if (!APPLY) {
    line('');
    line('Dry run. Re-run with --apply to write these links.');
    return;
  }

  line('');
  var linked = await linkPairs(paired.pairs);
  line('Linked ' + linked.linked + ' card(s).');
  if (linked.failed.length) {
    linked.failed.forEach(function(f) { line('  FAILED ' + f.key + ': ' + f.error); });
  }

  if (!RECONCILE) {
    line('Columns left untouched. Jira is now the baseline, so from here a change in Jira moves the card.');
    line('Pass --reconcile if you want the board forced to match Jira as it stands today.');
    return;
  }

  // Reconcile once, now. baseline 'apply' is deliberate: linkPairs just seeded
  // jira_status from the issue's CURRENT category, so a normal pass would see no
  // change at all. This pass instead asks "where should this card be, given
  // where Jira is right now", which is the whole point of a backfill.
  var fresh = await fetchLinkedCards();
  var toReconcile = fresh.filter(function(c) {
    var target = COLUMN_FOR_CATEGORY[c.jira_status];
    return target && String(c.column_id || '').toLowerCase() !== target;
  }).map(function(c) {
    // Blank the recorded status so planSync treats current Jira as a change.
    return Object.assign({}, c, { jira_status: null });
  });

  var plan = planSync(toReconcile, issues, { baseline: 'apply' });
  line('');
  line('Reconciling ' + plan.moves.length + ' card(s) with Jira:');
  plan.moves.forEach(function(m) {
    line('  ' + m.key + '  ' + m.title.slice(0, 60) + '  ' + columnLabel(m.from) + ' -> ' + columnLabel(m.to));
  });

  if (plan.moves.length) {
    var index = {};
    toReconcile.forEach(function(c) { index[c.id] = c; });
    var applied = await applyPlan(plan, index);
    line('Moved ' + applied.moved + ' card(s).');
    if (applied.errors.length) {
      applied.errors.forEach(function(e) { line('  FAILED ' + e.key + ': ' + e.error); });
    }
  }

  line('');
  line('Done. From here the bot syncs every 10 minutes, or run /record jirasync.');
}

main().catch(function(e) {
  console.error('Backfill failed: ' + ((e && e.message) || e));
  process.exit(1);
});
