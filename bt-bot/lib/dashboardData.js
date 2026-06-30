/**
 * dashboardData.js - one composed snapshot of everything the BrosephTech crew
 * needs at a glance. Shared by the browser dashboard (web/server.js) and the
 * Discord /dashboard command so both always show identical numbers.
 *
 * Everything here is read-only against Supabase.
 */

import { supabase } from './supabase.js';
import {
  fetchCards,
  buildAccountability,
  isOverdue,
  staleDays,
  isDueSoon,
  assigneesOf,
} from './board.js';
import { BT_CREW, BT_DEPARTMENTS } from '../config/crew.js';
import { jiraOverview } from './jira.js';

var DONE_COLUMNS = ['published', 'archive'];
var MS_PER_DAY = 86400000;

var ROLE_BY_NAME = {};
BT_CREW.forEach(function(m) { ROLE_BY_NAME[m.name] = m.role; });

var DEPT_META = {};
BT_DEPARTMENTS.forEach(function(d) { DEPT_META[d.id] = d; });

function isDone(card) {
  return DONE_COLUMNS.indexOf(String((card && card.column_id) || '').toLowerCase()) !== -1;
}

function parseDate(v) {
  if (!v) return null;
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// Compact card shape for lists in the UI.
function slim(card, extra) {
  var base = {
    id: card.id,
    title: card.title || 'Untitled',
    department: card.department || null,
    column_id: card.column_id || null,
    priority: card.priority || 'medium',
    assignees: assigneesOf(card),
    due_date: card.due_date || null,
    blocked: !!card.blocked,
  };
  return extra ? Object.assign(base, extra) : base;
}

function daysUntil(due, now) {
  var d = parseDate(due);
  if (!d) return null;
  return Math.round((d.getTime() - now.getTime()) / MS_PER_DAY);
}

function recapArr(recap, key) {
  return (recap && Array.isArray(recap[key])) ? recap[key] : [];
}

// Distinct speaker names from a voice-session segments array (jsonb).
function speakersFromSegments(segs) {
  if (!Array.isArray(segs)) return [];
  var seen = {}, out = [];
  segs.forEach(function(s) {
    var n = s && s.name;
    if (n && !seen[n]) { seen[n] = true; out.push(String(n)); }
  });
  return out.slice(0, 12);
}

// Merge a bt_meetings row + its bt_voice_sessions row into a recap object the
// dashboard renders. tldr falls back to the legacy summary so old rows (no
// recap JSON) still display.
function deriveRecap(m, v) {
  var recap = (m && m.recap && typeof m.recap === 'object') ? m.recap : null;
  var tldr = (recap && recap.tldr) ? recap.tldr : (m.summary || '');
  var participants = (recap && Array.isArray(recap.attendees) && recap.attendees.length)
    ? recap.attendees
    : speakersFromSegments(v && v.segments);
  return {
    id: m.id,
    title: m.title || 'Untitled meeting',
    tldr: tldr,
    createdBy: m.created_by || '',
    createdAt: m.created_at,
    durationSeconds: (v && v.duration_seconds) || 0,
    participants: participants,
    tasksCreated: m.tasks_created || 0,
    decisions: recapArr(recap, 'decisions'),
    blockers: recapArr(recap, 'blockers'),
    tasks: (recap && Array.isArray(recap.tasks)) ? recap.tasks : [],
    hasTranscript: false,
  };
}

// The recap feed: the latest meeting in full + a compact list for history.
async function recapFeed() {
  try {
    var mres = await supabase
      .from('bt_meetings')
      .select('id, title, summary, created_by, tasks_created, created_at, recap')
      .order('created_at', { ascending: false })
      .limit(8);
    if (mres.error || !mres.data) return { latest: null, list: [] };
    var meetings = mres.data;
    var ids = meetings.map(function(m) { return m.id; });
    var voiceByMeeting = {};
    if (ids.length) {
      var vres = await supabase
        .from('bt_voice_sessions')
        .select('meeting_id, duration_seconds, segments')
        .in('meeting_id', ids);
      if (!vres.error && vres.data) vres.data.forEach(function(v) { if (v.meeting_id) voiceByMeeting[v.meeting_id] = v; });
    }
    var full = meetings.map(function(m) { return deriveRecap(m, voiceByMeeting[m.id] || null); });
    var list = full.map(function(r) {
      return {
        id: r.id, title: r.title, tldr: r.tldr, createdBy: r.createdBy,
        createdAt: r.createdAt, durationSeconds: r.durationSeconds,
        participantCount: r.participants.length, tasksCreated: r.tasksCreated,
      };
    });
    return { latest: full[0] || null, list: list };
  } catch (e) { return { latest: null, list: [] }; }
}

// One meeting in full, for lazy history expansion on the dashboard.
export async function getRecap(id) {
  try {
    var mres = await supabase
      .from('bt_meetings')
      .select('id, title, summary, created_by, tasks_created, created_at, recap')
      .eq('id', id).maybeSingle();
    if (mres.error || !mres.data) return null;
    var m = mres.data;
    var vres = await supabase
      .from('bt_voice_sessions')
      .select('duration_seconds, segments, transcript')
      .eq('meeting_id', id)
      .order('created_at', { ascending: false }).limit(1);
    var v = (!vres.error && vres.data && vres.data[0]) ? vres.data[0] : null;
    var r = deriveRecap(m, v);
    r.discussion = recapArr(m.recap, 'discussion');
    r.next_steps = recapArr(m.recap, 'next_steps');
    r.hasTranscript = !!(v && v.transcript);
    return r;
  } catch (e) { return null; }
}

async function ideaStats() {
  try {
    var res = await supabase.from('bt_ideas').select('status');
    if (res.error) return { total: 0, open: 0 };
    var rows = res.data || [];
    var open = rows.filter(function(r) {
      var s = String(r.status || '').toLowerCase();
      return s !== 'done' && s !== 'archived' && s !== 'used';
    }).length;
    return { total: rows.length, open: open };
  } catch (e) { return { total: 0, open: 0 }; }
}

async function metricsTrend() {
  try {
    var res = await supabase
      .from('bt_metrics_snapshots')
      .select('snapshot_date, yt_subs, tiktok_followers, patreon_subs, avg_views, created_at')
      .order('snapshot_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(14);
    if (res.error || !res.data || !res.data.length) return null;
    var rows = res.data;            // newest first
    var latest = rows[0];
    var prev = rows[1] || null;
    function delta(k) {
      if (!prev || prev[k] == null || latest[k] == null) return null;
      return latest[k] - prev[k];
    }
    var chrono = rows.slice().reverse(); // oldest -> newest for sparklines
    return {
      date: latest.snapshot_date,
      ytSubs: latest.yt_subs,
      tiktokFollowers: latest.tiktok_followers,
      patreonSubs: latest.patreon_subs,
      avgViews: latest.avg_views,
      deltas: {
        ytSubs: delta('yt_subs'),
        tiktokFollowers: delta('tiktok_followers'),
        patreonSubs: delta('patreon_subs'),
        avgViews: delta('avg_views'),
      },
      series: {
        ytSubs: chrono.map(function(r) { return r.yt_subs || 0; }),
        tiktokFollowers: chrono.map(function(r) { return r.tiktok_followers || 0; }),
        patreonSubs: chrono.map(function(r) { return r.patreon_subs || 0; }),
        avgViews: chrono.map(function(r) { return r.avg_views || 0; }),
      },
    };
  } catch (e) { return null; }
}

/**
 * Build the full overview snapshot. Never throws for the optional sections;
 * a hard failure only happens if the core board read fails.
 */
export async function buildOverview() {
  var now = new Date();
  var cards = await fetchCards();
  var acc = buildAccountability(cards, now);

  var overdue = [];
  var stuck = [];
  var dueSoon = [];
  var blocked = [];
  var shipped = [];
  var columnTally = {};

  cards.forEach(function(card) {
    var done = isDone(card);
    var col = String((card && card.column_id) || 'unknown').toLowerCase();
    columnTally[col] = (columnTally[col] || 0) + 1;
    if (card.blocked && !done) blocked.push(slim(card));

    if (isOverdue(card, now)) {
      overdue.push(slim(card, { daysOverdue: Math.abs(daysUntil(card.due_date, now) || 0) }));
    }
    var sd = staleDays(card, now);
    if (sd > 0) stuck.push(slim(card, { staleDays: sd }));
    if (isDueSoon(card, now)) dueSoon.push(slim(card, { daysUntil: daysUntil(card.due_date, now) }));

    if (done) {
      var changed = parseDate(card.column_changed_at) || parseDate(card.updated_at);
      if (changed && (now.getTime() - changed.getTime()) <= 7 * MS_PER_DAY) {
        shipped.push(slim(card, { shippedAt: changed.toISOString() }));
      }
    }
  });

  overdue.sort(function(a, b) { return (b.daysOverdue || 0) - (a.daysOverdue || 0); });
  stuck.sort(function(a, b) { return (b.staleDays || 0) - (a.staleDays || 0); });
  dueSoon.sort(function(a, b) { return (a.daysUntil || 0) - (b.daysUntil || 0); });

  // Crew accountability rows (counts only, sorted by who needs attention most).
  var members = Object.keys(acc.members).map(function(name) {
    var b = acc.members[name];
    return {
      name: name,
      role: ROLE_BY_NAME[name] || '',
      active: b.active.length,
      overdue: b.overdue.length,
      stuck: b.stuck.length,
      dueSoon: b.dueSoon.length,
    };
  }).filter(function(m) {
    // Keep known crew always; drop stray names that have nothing.
    return ROLE_BY_NAME[m.name] != null || m.active || m.overdue || m.stuck || m.dueSoon;
  });
  members.sort(function(a, b) {
    var pa = a.overdue * 3 + a.stuck * 2 + a.dueSoon;
    var pb = b.overdue * 3 + b.stuck * 2 + b.dueSoon;
    if (pb !== pa) return pb - pa;
    return b.active - a.active;
  });

  // Departments with palette metadata for the UI.
  var departments = acc.departments.map(function(d) {
    var meta = DEPT_META[d.id] || {};
    return Object.assign({}, d, { color: meta.color || '#888', icon: meta.icon || 'tag' });
  });

  var feed = await recapFeed();
  var ideas = await ideaStats();
  var jira = await jiraOverview().catch(function() { return { configured: false }; });

  return {
    generatedAt: now.toISOString(),
    totals: {
      active: acc.totals.active,
      overdue: acc.totals.overdue,
      stuck: acc.totals.stuck,
      dueSoon: acc.totals.dueSoon,
      blocked: blocked.length,
      shippedThisWeek: shipped.length,
      cards: acc.totals.cards,
      ideasOpen: ideas.open,
    },
    departments: departments,
    members: members,
    lists: {
      overdue: overdue.slice(0, 12),
      stuck: stuck.slice(0, 12),
      dueSoon: dueSoon.slice(0, 12),
      blocked: blocked.slice(0, 12),
      shipped: shipped.slice(0, 12),
    },
    columns: orderColumns(columnTally),
    latestRecap: feed.latest,
    recaps: feed.list,
    ideas: ideas,
    jira: jira,
  };
}

// Put board columns in a sensible left-to-right pipeline order, unknown columns
// appended after the known ones.
var COLUMN_ORDER = ['ideas', 'backlog', 'todo', 'in_progress', 'doing', 'review', 'published', 'archive'];
var COLUMN_LABEL = { ideas: 'Ideas', backlog: 'Backlog', todo: 'To do', in_progress: 'In progress', doing: 'Doing', review: 'Review', published: 'Published', archive: 'Archive' };
function orderColumns(tally) {
  var keys = Object.keys(tally);
  keys.sort(function(a, b) {
    var ia = COLUMN_ORDER.indexOf(a); var ib = COLUMN_ORDER.indexOf(b);
    if (ia === -1) ia = 99; if (ib === -1) ib = 99;
    return ia - ib;
  });
  return keys.map(function(k) {
    return { id: k, label: COLUMN_LABEL[k] || (k.charAt(0).toUpperCase() + k.slice(1)), count: tally[k], done: k === 'published' || k === 'archive' };
  });
}
