/**
 * verify-jira-sync.js - prove the Jira to board sync against the real Jira and
 * the real board, end to end, instead of trusting the unit tests.
 *
 * The unit tests cover the rules. They cannot tell you that the credentials
 * work, that this Jira project actually exposes a Done transition, that the
 * status category comes back the way the planner expects, or that the Supabase
 * write lands. Only a live round trip proves that, and this is the original
 * complaint restated as a test: change a ticket to Done, does the board move.
 *
 * It creates its own throwaway issue and its own throwaway card, drives them
 * through the full path, then deletes both. It never touches real work.
 *
 * Usage: node scripts/verify-jira-sync.js
 */

import 'dotenv/config';
import { supabase } from '../lib/supabase.js';
import { createIssue, jiraConfigured, jiraMissingHint, jiraFetch } from '../lib/jira.js';
import { syncJiraToBoard } from '../lib/jiraSync.js';

var TITLE = 'BT bot sync smoke test ' + new Date().toISOString();

var failures = 0;
function ok(label, detail) { console.log('  PASS  ' + label + (detail ? '  (' + detail + ')' : '')); }
function bad(label, detail) { failures++; console.log('  FAIL  ' + label + (detail ? '  (' + detail + ')' : '')); }
function step(label) { console.log('\n' + label); }

// Find the transition into a status whose category is `wanted`, and take it.
async function transitionTo(key, wanted) {
  var res = await jiraFetch('/rest/api/3/issue/' + key + '/transitions');
  if (!res.ok) throw new Error('transitions ' + res.status);
  var data = await res.json();
  var match = (data.transitions || []).find(function(t) {
    var cat = t.to && t.to.statusCategory && t.to.statusCategory.key;
    return cat === wanted;
  });
  if (!match) {
    throw new Error('no transition into a "' + wanted + '" status. Available: '
      + (data.transitions || []).map(function(t) { return t.name; }).join(', '));
  }
  var apply = await jiraFetch('/rest/api/3/issue/' + key + '/transitions', {
    method: 'POST',
    body: JSON.stringify({ transition: { id: match.id } }),
  });
  if (!apply.ok) {
    var txt = await apply.text().catch(function() { return ''; });
    throw new Error('transition ' + apply.status + ': ' + txt.slice(0, 200));
  }
  return match.to.name;
}

async function cardColumn(id) {
  var res = await supabase.from('bt_content_cards').select('column_id, jira_status').eq('id', id).single();
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

async function main() {
  if (!jiraConfigured()) {
    console.error('Jira is not configured (' + jiraMissingHint() + ').');
    process.exit(1);
  }

  var issue = null;
  var cardId = null;

  try {
    step('1. Create a throwaway Jira issue');
    issue = await createIssue(
      { title: TITLE, department: 'engineering', assignee: '', priority: 'low' },
      { meetingTitle: 'sync verification', summary: 'Temporary issue created by verify-jira-sync.js. Safe to delete.' }
    );
    ok('issue created', issue.key);

    step('2. Create a linked board card sitting in the backlog');
    var ins = await supabase.from('bt_content_cards').insert({
      title: TITLE,
      description: 'Temporary card created by verify-jira-sync.js. Safe to delete.',
      column_id: 'ideas',
      department: 'engineering',
      content_type: 'feature',
      platform: 'both',
      assignee: '',
      assignees: [],
      subtasks: [],
      priority: 'low',
      links: [],
      blocked: false,
      jira_key: issue.key,
      jira_status: 'new',
    }).select('id').single();
    if (ins.error) throw new Error(ins.error.message);
    cardId = ins.data.id;
    ok('card created in Backlog', cardId);

    step('3. A sync pass with nothing changed must not touch the card');
    var quiet = await syncJiraToBoard();
    if (!quiet.ok) bad('quiet pass ran', quiet.reason);
    else if (quiet.moves.some(function(m) { return m.cardId === cardId; })) bad('quiet pass left the card alone');
    else ok('quiet pass left the card alone', 'checked ' + quiet.checked + ' linked card(s)');

    step('4. Move the Jira issue to Done, the thing that used to do nothing');
    var doneName = await transitionTo(issue.key, 'done');
    ok('issue transitioned', doneName);

    step('5. Run the sync');
    var pass = await syncJiraToBoard();
    if (!pass.ok) throw new Error('sync failed: ' + pass.reason);
    var move = (pass.moves || []).find(function(m) { return m.cardId === cardId; });
    if (move) ok('sync planned the move', move.from + ' -> ' + move.to);
    else bad('sync planned the move', 'no move produced for the test card');

    var after = await cardColumn(cardId);
    if (after.column_id === 'published') ok('card landed in Done on the board', after.column_id);
    else bad('card landed in Done on the board', 'it is in "' + after.column_id + '"');
    if (after.jira_status === 'done') ok('baseline recorded');
    else bad('baseline recorded', 'jira_status is "' + after.jira_status + '"');

    step('6. A second pass must be idempotent, not move it again');
    var second = await syncJiraToBoard();
    if ((second.moves || []).some(function(m) { return m.cardId === cardId; })) bad('second pass is idempotent');
    else ok('second pass is idempotent');

    step('7. Reopen in Jira, the card must come back out of Done');
    await transitionTo(issue.key, 'new');
    var third = await syncJiraToBoard();
    var back = await cardColumn(cardId);
    if (back.column_id === 'ideas') ok('card returned to Backlog', back.column_id);
    else bad('card returned to Backlog', 'it is in "' + back.column_id + '"');
    if (!third.ok) bad('reopen pass ran', third.reason);
  } catch (e) {
    failures++;
    console.log('\n  ERROR  ' + ((e && e.message) || e));
  } finally {
    step('Cleanup');
    if (cardId) {
      var del = await supabase.from('bt_content_cards').delete().eq('id', cardId);
      if (del.error) console.log('  WARN  could not delete the test card ' + cardId + ': ' + del.error.message);
      else console.log('  test card deleted');
    }
    if (issue) {
      var dj = await jiraFetch('/rest/api/3/issue/' + issue.key, { method: 'DELETE' }).catch(function() { return null; });
      if (dj && (dj.ok || dj.status === 204)) console.log('  test issue ' + issue.key + ' deleted');
      else console.log('  WARN  could not delete the test issue ' + issue.key + ', remove it by hand');
    }
  }

  console.log('\n' + (failures ? failures + ' CHECK(S) FAILED' : 'ALL CHECKS PASSED'));
  process.exit(failures ? 1 : 0);
}

main();
