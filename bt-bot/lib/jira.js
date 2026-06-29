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

// Map the bot's high/medium/low to common Jira priority names. Only used when
// JIRA_SET_PRIORITY=1 (the field is not on every project's create screen).
var PRIORITY_NAME = { high: 'High', medium: 'Medium', low: 'Low' };

/**
 * Create one Jira issue.
 * task: { title, department, assignee, priority }
 * meta: { meetingTitle, summary }
 * Returns { key, url }.
 */
export async function createIssue(task, meta) {
  var c = cfg();
  if (!jiraConfigured()) throw new Error('Jira is not configured (' + jiraMissingHint() + ')');
  var t = task || {};
  var m = meta || {};

  var descLines = [];
  if (t.assignee) descLines.push('Owner: ' + t.assignee);
  descLines.push('Department: ' + (t.department || 'content'));
  descLines.push('Priority: ' + (t.priority || 'medium'));
  if (m.meetingTitle) descLines.push('Source: meeting "' + m.meetingTitle + '"');
  if (m.summary) descLines.push('Context: ' + String(m.summary).slice(0, 500));

  var labels = ['bt-meeting'];
  var deptLabel = safeLabel(t.department);
  if (deptLabel) labels.push(deptLabel);

  var fields = {
    project: { key: c.projectKey },
    summary: String(t.title || 'Untitled task').slice(0, 250),
    issuetype: { name: c.issueType },
    description: adf(descLines),
    labels: labels,
  };
  if (c.setPriority && PRIORITY_NAME[t.priority]) {
    fields.priority = { name: PRIORITY_NAME[t.priority] };
  }

  var res = await fetch(c.baseUrl + '/rest/api/3/issue', {
    method: 'POST',
    headers: {
      'Authorization': authHeader(c),
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: fields }),
  });

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
