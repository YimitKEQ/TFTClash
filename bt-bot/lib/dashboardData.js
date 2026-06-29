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

async function recentMeetings() {
  try {
    var res = await supabase
      .from('bt_meetings')
      .select('id, title, summary, created_by, tasks_created, created_at')
      .order('created_at', { ascending: false })
      .limit(6);
    if (res.error) return [];
    return (res.data || []).map(function(m) {
      return {
        id: m.id,
        title: m.title || 'Untitled meeting',
        summary: m.summary || '',
        createdBy: m.created_by || '',
        tasksCreated: m.tasks_created || 0,
        createdAt: m.created_at,
      };
    });
  } catch (e) { return []; }
}

async function recentVoice() {
  try {
    var res = await supabase
      .from('bt_voice_sessions')
      .select('id, channel_name, status, started_at, ended_at, duration_seconds, tasks_created, summary, created_at')
      .order('created_at', { ascending: false })
      .limit(6);
    if (res.error) return [];
    return (res.data || []).map(function(v) {
      return {
        id: v.id,
        channelName: v.channel_name || '',
        status: v.status || '',
        durationSeconds: v.duration_seconds || 0,
        tasksCreated: v.tasks_created || 0,
        summary: v.summary || '',
        createdAt: v.created_at || v.started_at,
      };
    });
  } catch (e) { return []; }
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
      .select('snapshot_date, yt_subs, tiktok_followers, patreon_subs, avg_views')
      .order('snapshot_date', { ascending: false })
      .limit(2);
    if (res.error || !res.data || !res.data.length) return null;
    var latest = res.data[0];
    var prev = res.data[1] || null;
    function delta(k) {
      if (!prev || prev[k] == null || latest[k] == null) return null;
      return latest[k] - prev[k];
    }
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

  cards.forEach(function(card) {
    var done = isDone(card);
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

  var meetings = await recentMeetings();
  var voice = await recentVoice();
  var ideas = await ideaStats();
  var metrics = await metricsTrend();

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
    meetings: meetings,
    voice: voice,
    ideas: ideas,
    metrics: metrics,
  };
}
