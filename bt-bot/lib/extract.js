/**
 * extract.js - turn raw meeting notes into a summary + action-item tasks.
 *
 * Uses the Claude Messages API when ANTHROPIC_API_KEY is set (best quality);
 * otherwise falls back to a deterministic rule-based parser so the feature
 * always works with no external dependency or key.
 */

import { BT_DEPARTMENTS, matchCrewName } from '../config/crew.js';

var DEPT_IDS = BT_DEPARTMENTS.map(function(d) { return d.id; });

function clamp(value, n) {
  var s = String(value == null ? '' : value);
  return s.length > n ? s.slice(0, n - 3) + '...' : s;
}

function knownDept(value) {
  return (value && DEPT_IDS.indexOf(value) !== -1) ? value : null;
}

function normalizePriority(value) {
  var p = String(value || '').toLowerCase();
  return (p === 'high' || p === 'medium' || p === 'low') ? p : 'medium';
}

// Guess a department from the words in a line. Returns null when nothing fits.
function inferDepartment(text) {
  var t = String(text || '').toLowerCase();
  if (/\b(bug|crash|api|deploy|build|code|backend|frontend|release|feature|refactor|server|endpoint)\b/.test(t)) return 'engineering';
  if (/\b(design|figma|ui|ux|mockup|logo|brand|prototype|wireframe|icon)\b/.test(t)) return 'design';
  if (/\b(ad|ads|post|tweet|reddit|campaign|launch|promo|marketing|reel|sponsor|email)\b/.test(t)) return 'marketing';
  if (/\b(invoice|finance|budget|legal|contract|admin|payroll|process|hire)\b/.test(t)) return 'ops';
  if (/\b(video|script|thumbnail|edit|youtube|tiktok|short|longform|vod|episode)\b/.test(t)) return 'content';
  return null;
}

function resolveDept(value, forcedDept) {
  if (forcedDept) return forcedDept;
  return knownDept(value) || 'content';
}

// ---- Rule-based fallback -----------------------------------------------------

var ITEM_RE = /^\s*(?:[-*•]|\[\s?\]|\d+[.)])\s+/;
var KEYWORD_RE = /\b(todo|action item|action|ai|follow[- ]?up|next step)\b\s*[:\-]?\s*/i;

function ruleBasedAnalyze(notes, forcedDept) {
  var lines = String(notes || '').split(/\r?\n/);
  var tasks = [];
  lines.forEach(function(line) {
    var raw = line.trim();
    if (!raw) return;
    if (!ITEM_RE.test(line) && !KEYWORD_RE.test(raw)) return;
    var title = raw.replace(ITEM_RE, '').replace(KEYWORD_RE, '').trim();
    if (!title || title.length < 3) return;

    var assignee = null;
    var at = title.match(/@([A-Za-z0-9_]+)/);
    if (at) assignee = matchCrewName(at[1]);
    if (!assignee) {
      var who = title.match(/^([A-Za-z]+)\s+(?:will|to|should|needs to|is going to|gonna)\b/i);
      if (who) assignee = matchCrewName(who[1]);
    }

    var priority = /\b(urgent|asap|critical|high priority|p0|p1|blocker)\b/i.test(title) ? 'high' : 'medium';
    tasks.push({
      title: clamp(title, 120),
      department: resolveDept(inferDepartment(title), forcedDept),
      assignee: assignee,
      priority: priority,
    });
  });

  var summary = (String(notes || '').split(/\n\s*\n/)[0] || String(notes || '')).replace(/\s+/g, ' ').trim();
  return { summary: clamp(summary, 600), tasks: tasks.slice(0, 25), engine: 'rules' };
}

// ---- Claude API (forced tool use for clean JSON) ----------------------------

async function llmAnalyze(notes, forcedDept) {
  var key = process.env.ANTHROPIC_API_KEY;
  var model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

  var tool = {
    name: 'record_meeting',
    description: 'Record the meeting summary and its action items as board tasks.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'tasks'],
      properties: {
        summary: { type: 'string', description: 'A concise 2 to 4 sentence summary of the meeting.' },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['title', 'department', 'priority'],
            properties: {
              title: { type: 'string', description: 'Short imperative task title.' },
              department: { type: 'string', enum: DEPT_IDS },
              assignee: { type: ['string', 'null'], description: 'Crew member name if clearly responsible, else null.' },
              priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            },
          },
        },
      },
    },
  };

  var system = 'You convert raw meeting notes for the BrosephTech team into a short summary and a list of concrete, actionable board tasks. Departments: content (YouTube and TikTok videos), engineering (the Barontactics app), design, marketing, ops. Only create tasks for real action items, not general discussion. Give each task a department. Set assignee only when a specific person is clearly responsible, otherwise null. Default priority to medium. Keep titles short and imperative. Do not use em dashes.';

  var body = {
    model: model,
    max_tokens: 1500,
    system: system,
    tools: [tool],
    tool_choice: { type: 'tool', name: 'record_meeting' },
    messages: [{ role: 'user', content: 'Meeting notes:\n\n' + String(notes || '') }],
  };

  var res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    var txt = await res.text().catch(function() { return ''; });
    throw new Error('Anthropic API ' + res.status + ': ' + clamp(txt, 200));
  }

  var data = await res.json();
  var block = (data.content || []).find(function(b) { return b.type === 'tool_use' && b.name === 'record_meeting'; });
  if (!block || !block.input) throw new Error('No structured output returned');

  var out = block.input;
  var tasks = (out.tasks || []).map(function(t) {
    return {
      title: clamp(t.title || '', 120),
      department: resolveDept(t.department, forcedDept),
      assignee: t.assignee ? matchCrewName(t.assignee) : null,
      priority: normalizePriority(t.priority),
    };
  }).filter(function(t) { return t.title; });

  return { summary: clamp(out.summary || '', 800), tasks: tasks.slice(0, 40), engine: 'ai' };
}

// Analyze meeting notes into { summary, tasks, engine }. forcedDept (optional)
// pins every task to one department; otherwise each task is classified.
export async function analyzeMeeting(notes, forcedDept) {
  var pinned = knownDept(forcedDept);
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await llmAnalyze(notes, pinned);
    } catch (e) {
      console.warn('[meeting] AI analysis failed, using rule-based fallback: ' + ((e && e.message) || e));
    }
  }
  return ruleBasedAnalyze(notes, pinned);
}
