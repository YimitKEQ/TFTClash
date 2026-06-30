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

// Strip a "[mm:ss] Name:" transcript prefix. Returns { speaker, text }.
var LINE_PREFIX_RE = /^\[\d{1,2}:\d{2}(?::\d{2})?\]\s*([^:]{1,40}?):\s*(.*)$/;
function splitLine(raw) {
  var m = raw.match(LINE_PREFIX_RE);
  if (m) return { speaker: m[1].trim(), text: m[2].trim() };
  return { speaker: null, text: raw };
}

// Commitment / assignment patterns that signal a real action item in speech.
// Each returns { phrase, who } where `who` is the speaker for first-person.
function commitmentsFrom(text, speaker) {
  var out = [];
  var firstPerson = /\b(?:i'?ll|i will|i can|i'?m gonna|i am going to|i'?ll go|let me)\s+(.{4,110})/i.exec(text);
  if (firstPerson) out.push({ phrase: firstPerson[1], who: speaker });
  var askName = /\b([A-Z][a-z]{2,})[,]?\s+(?:can|could|would)\s+you\s+(.{4,110})/.exec(text);
  if (askName) out.push({ phrase: askName[2], who: askName[1] });
  var assign = /\b([A-Z][a-z]{2,})\s+(?:will|should|needs to|is going to|gonna|to)\s+(.{4,110})/.exec(text);
  if (assign && (!askName || assign.index !== askName.index)) out.push({ phrase: assign[2], who: assign[1] });
  var weNeed = /\b(?:we need to|we should|we have to|need to|let'?s|make sure to|action item:?|todo:?|next step:?)\s+(.{4,110})/i.exec(text);
  if (weNeed) out.push({ phrase: weNeed[1], who: null });
  return out;
}

// Tidy a captured phrase into a short imperative-ish title.
function tidyTitle(phrase) {
  var s = String(phrase || '').trim();
  s = s.split(/[.!?]|,\s+(?:and|so|but|then)\b/)[0].trim(); // first clause
  s = s.replace(/\s+/g, ' ').replace(/[\s,;:]+$/, '');
  if (s) s = s.charAt(0).toUpperCase() + s.slice(1);
  return clamp(s, 120);
}

function ruleBasedAnalyze(notes, forcedDept) {
  var lines = String(notes || '').split(/\r?\n/);
  var tasks = [];
  var seen = {};
  var speakerSet = {};
  var contentLines = 0;

  lines.forEach(function(line) {
    var raw = line.trim();
    if (!raw) return;
    var parsed = splitLine(raw);
    if (parsed.speaker) speakerSet[parsed.speaker] = true;
    var text = parsed.text;
    if (!text) return;
    contentLines++;

    // Bullet / explicit TODO lines (pasted notes) still work as before.
    var fromBullet = ITEM_RE.test(line) || KEYWORD_RE.test(text);

    var commits = commitmentsFrom(text, parsed.speaker);
    if (!commits.length && fromBullet) {
      commits = [{ phrase: text.replace(ITEM_RE, '').replace(KEYWORD_RE, ''), who: null }];
    }

    commits.forEach(function(ci) {
      var title = tidyTitle(ci.phrase);
      if (!title || title.length < 4) return;
      var key = title.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      var assignee = ci.who ? matchCrewName(ci.who) : null;
      var priority = /\b(urgent|asap|critical|high priority|p0|p1|blocker|important)\b/i.test(text) ? 'high' : 'medium';
      tasks.push({
        title: title,
        department: resolveDept(inferDepartment(text), forcedDept),
        assignee: assignee,
        priority: priority,
      });
    });
  });

  var speakers = Object.keys(speakerSet);
  var tldrText = speakers.length
    ? ('Conversation between ' + speakers.join(', ') + ' across ' + contentLines + ' lines. '
       + (tasks.length ? (tasks.length + ' likely action item(s) detected.') : 'No clear action items detected.'))
    : clamp((String(notes || '').split(/\n\s*\n/)[0] || String(notes || '')).replace(/\s+/g, ' ').trim(), 280);

  var recap = normalizeRecap({
    tldr: tldrText,
    attendees: speakers,
    next_steps: tasks.slice(0, 5).map(function(t) { return t.title; }),
  });

  return { summary: recapToText(recap), recap: recap, tasks: tasks.slice(0, 25), engine: 'rules' };
}

// ---- Structured recap helpers ----------------------------------------------

function strArr(arr, maxItems, maxLen) {
  if (!Array.isArray(arr)) return [];
  var out = [];
  for (var i = 0; i < arr.length && out.length < maxItems; i++) {
    var s = clamp(String(arr[i] == null ? '' : arr[i]).trim(), maxLen);
    if (s) out.push(s);
  }
  return out;
}

// Coerce a raw model recap into the canonical, clamped shape. Every section is
// optional and degrades to an empty array so a thin meeting never breaks.
function normalizeRecap(raw) {
  var r = raw || {};
  var discussion = [];
  if (Array.isArray(r.discussion)) {
    for (var i = 0; i < r.discussion.length && discussion.length < 5; i++) {
      var d = r.discussion[i] || {};
      var topic = clamp(String(d.topic || '').trim(), 60);
      var notes = strArr(d.notes, 4, 180);
      if (topic || notes.length) discussion.push({ topic: topic || 'Discussion', notes: notes });
    }
  }
  return {
    tldr: clamp(String(r.tldr || '').trim(), 280),
    attendees: strArr(r.attendees, 12, 40),
    decisions: strArr(r.decisions, 6, 180),
    discussion: discussion,
    blockers: strArr(r.blockers, 5, 180),
    next_steps: strArr(r.next_steps, 6, 180),
  };
}

function bullet(s) { return '- ' + s; }

// Plain-text rendering of the recap, stored in bt_meetings.summary / raw_notes
// and used for the attached .md file.
function recapToText(r) {
  var parts = [];
  if (r.tldr) parts.push('TL;DR: ' + r.tldr);
  if (r.decisions.length) parts.push('Decisions\n' + r.decisions.map(bullet).join('\n'));
  if (r.discussion.length) {
    var blocks = r.discussion.map(function(d) {
      return d.topic + (d.notes.length ? '\n' + d.notes.map(bullet).join('\n') : '');
    });
    parts.push('Discussion\n' + blocks.join('\n'));
  }
  if (r.blockers.length) parts.push('Blockers\n' + r.blockers.map(bullet).join('\n'));
  if (r.next_steps.length) parts.push('Next steps\n' + r.next_steps.map(bullet).join('\n'));
  if (!parts.length) return 'No summary.';
  return clamp(parts.join('\n\n'), 1800);
}

// ---- Claude API (forced tool use for clean JSON) ----------------------------

async function llmAnalyze(notes, forcedDept) {
  var key = process.env.ANTHROPIC_API_KEY;
  var model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

  var tool = {
    name: 'record_meeting',
    description: 'Record a structured recap of the meeting plus its action items as board tasks.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['tldr', 'tasks'],
      properties: {
        tldr: {
          type: 'string',
          description: 'One or two sentences, under 240 characters, capturing the single most important outcome of this meeting. The headline a busy person reads first. Plain past tense, concrete. No preamble like "The team discussed" and no restating the agenda.',
        },
        attendees: {
          type: 'array',
          description: 'Display names of the people who actually spoke, taken from the "[mm:ss] Name:" speaker labels. Empty array if names are not identifiable.',
          items: { type: 'string' },
        },
        decisions: {
          type: 'array',
          description: 'Firm decisions the team committed to, each one past-tense sentence under 160 characters. Only settled calls, not options still being weighed. Empty array if none.',
          items: { type: 'string' },
        },
        discussion: {
          type: 'array',
          description: 'The substance of the meeting grouped into 2 to 5 topics, in order of importance. Capture context and reasoning, not a line-by-line replay. Skip small talk.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['topic', 'notes'],
            properties: {
              topic: { type: 'string', description: 'Short topic heading under 60 characters, no trailing punctuation.' },
              notes: {
                type: 'array',
                description: '1 to 4 tight bullets for this topic.',
                items: { type: 'string', description: 'One bullet under 180 characters.' },
              },
            },
          },
        },
        blockers: {
          type: 'array',
          description: 'Things explicitly blocking progress: waiting on a person, a missing asset, or an unresolved question. Each under 160 characters. Empty array if none.',
          items: { type: 'string' },
        },
        next_steps: {
          type: 'array',
          description: 'Forward moves agreed for before the next sync that are lighter than a tracked task, or that name who follows up with whom. Each under 160 characters. Do not repeat the tasks list verbatim. Empty array if none.',
          items: { type: 'string' },
        },
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

  var system = 'You are the meeting scribe for BrosephTech, a small TFT content and esports team. Broseph is the on-camera talent for YouTube and TikTok; a small dev team builds the Barontactics coaching app; Lodie runs ops. Departments: content (YouTube and TikTok videos), engineering (the Barontactics app), design, marketing, ops. '
    + 'You convert a meeting transcript into a tight, skimmable recap plus concrete board tasks. The input is a voice transcript with lines like "[mm:ss] Name: ...". Use the speaker names to attribute who said and owns what, and read across the back-and-forth instead of line by line. '
    + 'Recap rules: tldr is the one outcome that mattered most, not a summary of the agenda. Put settled calls in decisions and still-open or stuck items in blockers, never both. discussion is grouped topics with tight bullets that keep the reasoning, not a transcript replay. next_steps are lighter follow-ups or who-checks-in-with-whom, and must not just repeat the tasks. Leave a section as an empty array when the meeting genuinely had nothing for it. Be concrete; prefer fewer strong bullets over many weak ones. '
    + 'Task rules: only real action items and decisions become tasks, never chit-chat. Give each task a department. Set assignee only when a specific person clearly owns it, usually the speaker who agreed to do it, otherwise null. Default priority to medium. Keep titles short and imperative. '
    + 'Write plainly. Do not use em dashes or en dashes anywhere.';

  var body = {
    model: model,
    max_tokens: 2000,
    system: system,
    tools: [tool],
    tool_choice: { type: 'tool', name: 'record_meeting' },
    messages: [{ role: 'user', content: 'Meeting notes:\n\n' + String(notes || '') }],
  };

  // Never let the summary step hang the bot. Cap the call (default 90s).
  var controller = new AbortController();
  var timeoutMs = parseInt(process.env.ANTHROPIC_TIMEOUT_MS, 10) || 90000;
  var timer = setTimeout(function() { controller.abort(); }, timeoutMs);
  var res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('Anthropic API timed out after ' + Math.round(timeoutMs / 1000) + 's');
    throw e;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    var txt = await res.text().catch(function() { return ''; });
    throw new Error('Anthropic API ' + res.status + ': ' + clamp(txt, 200));
  }

  var data = await res.json();
  var block = (data.content || []).find(function(b) { return b.type === 'tool_use' && b.name === 'record_meeting'; });
  if (!block || !block.input) throw new Error('No structured output returned');

  var out = block.input;
  var recap = normalizeRecap(out);
  var tasks = (out.tasks || []).map(function(t) {
    return {
      title: clamp(t.title || '', 120),
      department: resolveDept(t.department, forcedDept),
      assignee: t.assignee ? matchCrewName(t.assignee) : null,
      priority: normalizePriority(t.priority),
    };
  }).filter(function(t) { return t.title; });

  return { summary: recapToText(recap), recap: recap, tasks: tasks.slice(0, 40), engine: 'ai' };
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
