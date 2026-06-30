/**
 * jira.js - create issues on a Jira Cloud board (REST API v3).
 *
 * Auth is HTTP Basic with your Atlassian email + an API token
 * (https://id.atlassian.com/manage-profile/security/api-tokens).
 *
 * Configure via .env:
 *   JIRA_BASE_URL     e.g. https://brosephtech.atlassian.net   (no trailing slash)
 *   JIRA_EMAIL        the Atlassian account email
 *   JIRA_API_TOKEN    the API token (NOT your password)
 *   JIRA_PROJECT_KEY  the project key issues land in, e.g. BT
 *   JIRA_ISSUE_TYPE   optional, default "Task"
 *   JIRA_SET_PRIORITY optional "1" to also set the Jira priority field
 */

function cfg() {
  return {
    baseUrl: (process.env.JIRA_BASE_URL || '').replace(/\/+$/, ''),
    email: process.env.JIRA_EMAIL || '',
    token: process.env.JIRA_API_TOKEN || '',
    projectKey: process.env.JIRA_PROJECT_KEY || '',
    issueType: process.env.JIRA_ISSUE_TYPE || 'Task',
    setPriority: String(process.env.JIRA_SET_PRIORITY || '') === '1',
  };
}

// True only when every required value is present (and not a placeholder).
export function jiraConfigured() {
  var c = cfg();
  if (!c.baseUrl || !c.email || !c.token || !c.projectKey) return false;
  if (c.token.indexOf('PASTE') !== -1 || c.baseUrl.indexOf('PASTE') !== -1) return false;
  return true;
}

export function jiraMissingHint() {
  var c = cfg();
  var missing = [];
  if (!c.baseUrl) missing.push('JIRA_BASE_URL');
  if (!c.email) missing.push('JIRA_EMAIL');
  if (!c.token) missing.push('JIRA_API_TOKEN');
  if (!c.projectKey) missing.push('JIRA_PROJECT_KEY');
  return missing.join(', ');
}

function authHeader(c) {
  return 'Basic ' + Buffer.from(c.email + ':' + c.token).toString('base64');
}

// Jira labels may not contain spaces; normalize to safe tokens.
function safeLabel(s) {
  return String(s || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}

// Minimal Atlassian Document Format wrapper for a few text paragraphs.
function adf(paragraphs) {
  var content = (paragraphs || []).filter(Boolean).map(function(p) {
    return { type: 'paragraph', content: [{ type: 'text', text: String(p) }] };
  });
  if (!content.length) content = [{ type: 'paragraph', content: [{ type: 'text', text: ' ' }] }];
  return { type: 'doc', version: 1, content: content };
}

// Map the bot's high/medium/low to common Jira priority names.
var PRIORITY_NAME = { high: 'High', medium: 'Medium', low: 'Low' };

// ADF helpers for a clean, structured issue body.
function adfText(s) { return { type: 'text', text: String(s == null ? '' : s) }; }
function adfPara(nodes) { return { type: 'paragraph', content: Array.isArray(nodes) ? nodes : [adfText(nodes)] }; }
function adfHeading(text) { return { type: 'heading', attrs: { level: 3 }, content: [adfText(text)] }; }
function adfBullets(items) {
  return {
    type: 'bulletList',
    content: items.filter(Boolean).map(function(it) {
      return { type: 'listItem', content: [adfPara(it)] };
    }),
  };
}

// Build a structured ADF doc: a context paragraph, a details bullet list, and a
// source line. Reads cleanly in the Jira issue view instead of a flat blob.
function richDescription(t, m) {
  var content = [];
  if (m.summary) {
    content.push(adfHeading('Context'));
    content.push(adfPara(String(m.summary).slice(0, 1500)));
  }
  content.push(adfHeading('Details'));
  var bullets = [];
  bullets.push([adfText('Owner: '), adfText(t.assignee || 'Unassigned')]);
  bullets.push([adfText('Department: '), adfText(t.department || 'content')]);
  bullets.push([adfText('Priority: '), adfText(t.priority || 'medium')]);
  if (m.meetingTitle) bullets.push([adfText('Source: '), adfText('meeting "' + m.meetingTitle + '"')]);
  content.push(adfBullets(bullets));
  content.push(adfPara([adfText('Captured automatically by the BrosephTech bot.')]));
  return { type: 'doc', version: 1, content: content };
}

function buildFields(c, t, m, withPriority) {
  var labels = ['bt-meeting'];
  var deptLabel = safeLabel(t.department);
  if (deptLabel) labels.push(deptLabel);
  var prioLabel = safeLabel('prio-' + (t.priority || 'medium'));
  if (prioLabel) labels.push(prioLabel);
  if (t.assignee) { var who = safeLabel(t.assignee); if (who) labels.push('owner-' + who); }

  var fields = {
    project: { key: c.projectKey },
    summary: String(t.title || 'Untitled task').slice(0, 250),
    issuetype: { name: c.issueType },
    description: richDescription(t, m),
    labels: labels,
  };
  if (withPriority && PRIORITY_NAME[t.priority]) {
    fields.priority = { name: PRIORITY_NAME[t.priority] };
  }
  return fields;
}

async function postIssue(c, fields) {
  return fetch(c.baseUrl + '/rest/api/3/issue', {
    method: 'POST',
    headers: {
      'Authorization': authHeader(c),
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: fields }),
  });
}

/**
 * Create one Jira issue.
 * task: { title, department, assignee, priority }
 * meta: { meetingTitle, summary }
 * Returns { key, url }.
 *
 * Sets the real Jira priority field by default; if the project rejects it
 * (e.g. priority not on the create screen, or an unknown name), it retries once
 * without priority so the issue still gets created. Priority is also encoded as
 * a `prio-*` label, so it stays filterable either way.
 */
export async function createIssue(task, meta) {
  var c = cfg();
  if (!jiraConfigured()) throw new Error('Jira is not configured (' + jiraMissingHint() + ')');
  var t = task || {};
  var m = meta || {};

  var wantPriority = c.setPriority && !!PRIORITY_NAME[t.priority];
  var res = await postIssue(c, buildFields(c, t, m, wantPriority));

  if (!res.ok && wantPriority) {
    var firstErr = await res.text().catch(function() { return ''; });
    if (/priority/i.test(firstErr)) {
      res = await postIssue(c, buildFields(c, t, m, false)); // retry without priority
    } else {
      throw new Error('Jira ' + res.status + ': ' + firstErr.slice(0, 300));
    }
  }

  if (!res.ok) {
    var txt = await res.text().catch(function() { return ''; });
    throw new Error('Jira ' + res.status + ': ' + txt.slice(0, 300));
  }
  var data = await res.json();
  return { key: data.key, url: c.baseUrl + '/browse/' + data.key };
}

// Lightweight credential/project check used by /record setup diagnostics.
// Returns { ok, detail }.
export async function checkJira() {
  var c = cfg();
  if (!jiraConfigured()) return { ok: false, detail: 'Missing: ' + jiraMissingHint() };
  try {
    var res = await fetch(c.baseUrl + '/rest/api/3/project/' + encodeURIComponent(c.projectKey), {
      headers: { 'Authorization': authHeader(c), 'Accept': 'application/json' },
    });
    if (!res.ok) {
      var txt = await res.text().catch(function() { return ''; });
      return { ok: false, detail: 'Jira ' + res.status + ': ' + txt.slice(0, 200) };
    }
    var p = await res.json();
    return { ok: true, detail: 'Connected to ' + (p.name || c.projectKey) + ' (' + c.projectKey + ')' };
  } catch (e) {
    return { ok: false, detail: (e && e.message) || String(e) };
  }
}

// Slim issue shape for the dashboard.
function slimIssue(c, issue) {
  var f = issue.fields || {};
  var st = f.status || {};
  var cat = (st.statusCategory && st.statusCategory.key) || 'new'; // new | indeterminate | done
  return {
    key: issue.key,
    summary: (f.summary || '').slice(0, 140),
    status: st.name || '',
    category: cat,
    type: (f.issuetype && f.issuetype.name) || 'Task',
    priority: (f.priority && f.priority.name) || null,
    assignee: (f.assignee && f.assignee.displayName) || null,
    labels: f.labels || [],
    created: f.created || null,
    url: c.baseUrl + '/browse/' + issue.key,
  };
}

// Run a JQL search via the current /search/jql endpoint. Returns slim issues.
export async function searchIssues(jql, max) {
  var c = cfg();
  if (!jiraConfigured()) return [];
  var body = {
    jql: jql,
    maxResults: Math.min(max || 50, 100),
    fields: ['summary', 'status', 'issuetype', 'priority', 'assignee', 'labels', 'created'],
  };
  var res = await fetch(c.baseUrl + '/rest/api/3/search/jql', {
    method: 'POST',
    headers: {
      'Authorization': authHeader(c),
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Jira search ' + res.status);
  var data = await res.json();
  return (data.issues || []).map(function(i) { return slimIssue(c, i); });
}

/**
 * One snapshot of the Jira project for the dashboard. Best-effort: returns
 * { configured:false } when Jira is not set up, or { configured:true, error }
 * if the call fails, so the dashboard can degrade gracefully.
 */
export async function jiraOverview() {
  var c = cfg();
  if (!jiraConfigured()) return { configured: false };
  try {
    var issues = await searchIssues('project = ' + c.projectKey + ' ORDER BY created DESC', 100);
    var counts = { todo: 0, inProgress: 0, done: 0 };
    issues.forEach(function(i) {
      if (i.category === 'done') counts.done++;
      else if (i.category === 'indeterminate') counts.inProgress++;
      else counts.todo++;
    });
    // Group into kanban columns, highest-priority first, capped per column.
    var PW = { highest: 4, high: 3, medium: 2, low: 1 };
    function byPrio(a, b) {
      return (PW[String(b.priority || '').toLowerCase()] || 0) - (PW[String(a.priority || '').toLowerCase()] || 0);
    }
    var board = {
      todo: issues.filter(function(i) { return i.category !== 'done' && i.category !== 'indeterminate'; }).sort(byPrio).slice(0, 12),
      inProgress: issues.filter(function(i) { return i.category === 'indeterminate'; }).sort(byPrio).slice(0, 12),
      done: issues.filter(function(i) { return i.category === 'done'; }).slice(0, 12),
    };
    return {
      configured: true,
      projectKey: c.projectKey,
      browseUrl: c.baseUrl + '/jira/software/projects/' + c.projectKey + '/boards',
      total: issues.length,
      open: counts.todo + counts.inProgress,
      counts: counts,
      board: board,
      recent: issues.slice(0, 10),
      // The most recent still-open items are the most useful to surface.
      openItems: issues.filter(function(i) { return i.category !== 'done'; }).slice(0, 10),
    };
  } catch (e) {
    return { configured: true, error: (e && e.message) || String(e) };
  }
}
