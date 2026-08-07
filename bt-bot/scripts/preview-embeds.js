/**
 * preview-embeds.js - render every embed the bot builds, as a picture.
 *
 * Run with: npm run preview
 *
 * Builds each card from fixture data, serialises it exactly as discord.js would
 * send it, then draws it in Discord's own dark-theme embed chrome and takes a
 * screenshot. Writes docs/images/embed-preview.png.
 *
 * The point is being able to LOOK at a redesign without posting a test message
 * into the crew's channels, and without booting a second gateway session (which
 * would make the live feed double-post while the preview ran).
 *
 * This is a dev tool. The bot never imports it.
 */

// MUST be first: it seeds the environment that lib/supabase.js demands at
// import time. Static imports are hoisted, so this cannot be inline code.
import './preview-env.js';

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, writeFileSync } from 'fs';

import { standupEmbed, nudgeContent } from '../lib/embeds.js';
import { newCardEmbed, shippedEmbed, blockedEmbed } from '../lib/feed.js';
import { buildDigest, digestEmbed } from '../lib/scoring.js';
import { buildAccountability } from '../lib/board.js';
import { boardEmbed } from '../commands/board.js';
import { myTasksEmbed } from '../commands/mytasks.js';
import { blockedListEmbed } from '../commands/blocked.js';
import { scorecardEmbed } from '../commands/scorecard.js';
import { buildEmbeds as dashboardEmbeds } from '../commands/dashboard.js';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var root = path.join(__dirname, '..');
var OUT_DIR = path.join(root, 'docs', 'images');
var OUT = path.join(OUT_DIR, 'embed-preview.png');
var HTML = path.join(OUT_DIR, '.embed-preview.html');

var NOW = new Date('2026-08-07T12:00:00Z');

function days(n) {
  return new Date(NOW.getTime() + n * 86400000).toISOString();
}

// ---- fixture board -----------------------------------------------------------

function card(o) {
  return Object.assign({
    id: 'c' + Math.round(Math.random() * 1e9),
    title: 'A card',
    column_id: 'production',
    department: 'content',
    assignees: ['Levitate'],
    priority: 'medium',
    blocked: false,
    column_changed_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
  }, o);
}

var CARDS = [
  card({ title: 'Set 15 reroll comps video', department: 'content', column_id: 'production', due_date: days(-4), assignees: ['Cathy'], priority: 'high' }),
  card({ title: 'Thumbnail pack for the August uploads', department: 'design', column_id: 'writing', blocked: true, assignees: ['Axel'] }),
  card({ title: 'Rewrite the tournament sign up flow', department: 'engineering', column_id: 'production', column_changed_at: days(-11), assignees: ['Fridley'] }),
  card({ title: 'Patch 15.4 tier list refresh', department: 'content', column_id: 'review', due_date: days(1), assignees: ['Levitate'] }),
  card({ title: 'Sponsor deck for Q4', department: 'marketing', column_id: 'ideas', due_date: days(2), assignees: ['Maestosoya'] }),
  card({ title: 'Discord onboarding revamp', department: 'ops', column_id: 'production', column_changed_at: days(-7), assignees: ['Tactic'] }),
  card({ title: 'Clip compilation, week 31', department: 'content', column_id: 'published', updated_at: days(-2), assignees: ['Bacrif'] }),
  card({ title: 'Landing page hero rebuild', department: 'design', column_id: 'published', updated_at: days(-5), assignees: ['Tactic'] }),
  card({ title: 'Ladder climb series, episode 3', department: 'content', column_id: 'writing', assignees: ['Levitate'] }),
  card({ title: 'Fix the standings recount job', department: 'engineering', column_id: 'review', due_date: days(-1), assignees: ['Fridley'], priority: 'high' }),
  card({ title: 'Weekly newsletter draft', department: 'marketing', column_id: 'production', assignees: ['Cathy'] }),
  card({ title: 'Archive the old brand assets', department: 'ops', column_id: 'ideas', assignees: [] }),
];

// The dashboard reads a composed overview, not raw cards, so build the shape
// buildOverview() would have returned.
function overviewFixture() {
  var acc = buildAccountability(CARDS, NOW);
  function slim(c, extra) {
    return Object.assign({
      id: c.id, title: c.title, department: c.department, column_id: c.column_id,
      priority: c.priority, assignees: c.assignees, due_date: c.due_date || null, blocked: !!c.blocked,
    }, extra || {});
  }
  return {
    generatedAt: NOW.toISOString(),
    totals: {
      active: acc.totals.active, overdue: acc.totals.overdue, stuck: acc.totals.stuck,
      dueSoon: acc.totals.dueSoon, blocked: acc.totals.blocked, shippedThisWeek: 2,
      cards: acc.totals.cards, ideasOpen: 7,
    },
    departments: acc.departments,
    members: [
      { name: 'Cathy', role: 'Scriptwriter', active: 2, overdue: 1, stuck: 0, dueSoon: 0 },
      { name: 'Fridley', role: 'Developer', active: 2, overdue: 1, stuck: 1, dueSoon: 0 },
      { name: 'Axel', role: 'Graphics', active: 1, overdue: 0, stuck: 0, dueSoon: 0 },
      { name: 'Tactic', role: 'Design', active: 2, overdue: 0, stuck: 1, dueSoon: 0 },
    ],
    lists: {
      overdue: [slim(CARDS[0], { daysOverdue: 4 }), slim(CARDS[9], { daysOverdue: 1 })],
      stuck: [slim(CARDS[2], { staleDays: 11 }), slim(CARDS[5], { staleDays: 7 })],
      dueSoon: [slim(CARDS[3], { daysUntil: 1 }), slim(CARDS[4], { daysUntil: 2 })],
      blocked: [slim(CARDS[1])],
      shipped: [slim(CARDS[6]), slim(CARDS[7])],
    },
    columns: [
      { id: 'ideas', label: 'Ideas', count: 2, done: false },
      { id: 'writing', label: 'Planned', count: 2, done: false },
      { id: 'production', label: 'In progress', count: 4, done: false },
      { id: 'review', label: 'Review', count: 2, done: false },
      { id: 'published', label: 'Published', count: 2, done: true },
    ],
    latestRecap: {
      id: 'm1', title: 'Weekly sync', createdBy: 'Levitate', createdAt: days(-1),
      tldr: 'Agreed to cut the second August upload and put the time into the tournament page rebuild. Axel is blocked on brand assets until Tactic exports them.',
      tasksCreated: 4, participants: ['Levitate', 'Tactic', 'Axel'], durationSeconds: 2280,
      decisions: [], blockers: [], tasks: [],
    },
    recaps: [
      { id: 'm1', title: 'Weekly sync', tasksCreated: 4, createdAt: days(-1) },
      { id: 'm2', title: 'Sponsor call prep', tasksCreated: 2, createdAt: days(-4) },
      { id: 'm3', title: 'Set 15 content planning', tasksCreated: 6, createdAt: days(-8) },
    ],
    ideas: { total: 19, open: 7 },
    jira: {
      configured: true, projectKey: 'KAN',
      counts: { todo: 6, inProgress: 3, done: 14 },
      openItems: [
        { key: 'KAN-41', url: 'https://example.atlassian.net/browse/KAN-41', summary: 'Rewrite the tournament sign up flow', priority: 'High' },
        { key: 'KAN-44', url: 'https://example.atlassian.net/browse/KAN-44', summary: 'Fix the standings recount job', priority: 'High' },
        { key: 'KAN-47', url: 'https://example.atlassian.net/browse/KAN-47', summary: 'Discord onboarding revamp', priority: 'Medium' },
      ],
    },
  };
}

// ---- collect every card ------------------------------------------------------

function collect() {
  var acc = buildAccountability(CARDS, NOW);
  var overview = overviewFixture();
  var groups = [];

  groups.push({
    heading: 'Daily standup  (09:30 cron, and /standup)',
    embeds: [standupEmbed(acc, NOW)],
    note: nudgeContent('Fridley', acc.members.Fridley, NOW),
  });

  groups.push({
    heading: '/dashboard  (the command centre, four sections)',
    embeds: dashboardEmbeds(overview, null),
  });

  groups.push({ heading: '/mytasks', embeds: [myTasksEmbed('Fridley', CARDS, NOW)] });
  groups.push({ heading: '/board', embeds: [boardEmbed(CARDS, null, NOW)] });
  groups.push({ heading: '/blocked', embeds: [blockedListEmbed(CARDS, NOW)] });
  groups.push({ heading: '/scorecard', embeds: [scorecardEmbed('Fridley', CARDS, NOW)] });
  groups.push({ heading: 'Weekly digest  (Monday cron, and /digest)', embeds: [digestEmbed(buildDigest(CARDS, NOW))] });
  groups.push({
    heading: 'Live feed  (posted automatically as cards change)',
    embeds: [newCardEmbed(CARDS[4]), shippedEmbed(CARDS[6]), blockedEmbed(CARDS[1])],
  });

  return groups.map(function(g) {
    return {
      heading: g.heading,
      note: g.note || null,
      embeds: g.embeds.map(function(e) { return e.toJSON(); }),
    };
  });
}

// ---- render ------------------------------------------------------------------

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Just enough Discord markdown to make the preview honest about what a reader
// will actually see. Native timestamps are resolved against the fixture clock.
function md(text) {
  var s = esc(text);
  s = s.replace(/&lt;t:(\d+):([A-Za-z])&gt;/g, function(_, secs, style) {
    var d = new Date(Number(secs) * 1000);
    var diff = Math.round((d.getTime() - NOW.getTime()) / 86400000);
    var label;
    if (style === 't') label = d.toISOString().slice(11, 16);
    else if (style === 'd') label = d.toISOString().slice(0, 10);
    else if (diff === 0) label = 'today';
    else if (diff > 0) label = 'in ' + diff + ' day' + (diff === 1 ? '' : 's');
    else label = Math.abs(diff) + ' day' + (diff === -1 ? '' : 's') + ' ago';
    return '<span class="ts">' + label + '</span>';
  });
  s = s.replace(/&lt;@(\d+)&gt;/g, '<span class="mention">@crew</span>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/\*([^*]+)\*/g, '<i>$1</i>');
  return s.replace(/\n/g, '<br>');
}

function hex(n) {
  return '#' + Number(n == null ? 0x5865f2 : n).toString(16).padStart(6, '0');
}

function renderEmbed(e) {
  var out = '<div class="embed" style="border-left-color:' + hex(e.color) + '">';
  if (e.author) out += '<div class="author">' + esc(e.author.name) + '</div>';
  if (e.title) out += '<div class="title">' + md(e.title) + '</div>';
  if (e.description) out += '<div class="desc">' + md(e.description) + '</div>';
  var fields = e.fields || [];
  if (fields.length) {
    out += '<div class="fields">';
    fields.forEach(function(f) {
      out += '<div class="field' + (f.inline ? ' inline' : '') + '">'
        + '<div class="fname">' + esc(f.name) + '</div>'
        + '<div class="fval">' + md(f.value) + '</div></div>';
    });
    out += '</div>';
  }
  if (e.image && e.image.url) out += '<div class="imgnote">[ poster image attached ]</div>';
  if (e.footer) out += '<div class="footer">' + esc(e.footer.text) + '</div>';
  return out + '</div>';
}

function renderPage(groups) {
  var body = groups.map(function(g) {
    var cards = g.embeds.map(renderEmbed).join('');
    var note = g.note ? '<div class="msg">' + md(g.note) + '</div>' : '';
    return '<section><h2>' + esc(g.heading) + '</h2>' + note + cards + '</section>';
  }).join('');

  return '<!doctype html><html><head><meta charset="utf-8"><style>'
    + '*{box-sizing:border-box;margin:0;padding:0}'
    + 'body{background:#313338;color:#dbdee1;font-family:"gg sans","Segoe UI",system-ui,sans-serif;font-size:16px;padding:32px;width:1240px;column-count:2;column-gap:32px}'
    + 'section{break-inside:avoid;margin-bottom:30px}'
    + 'h2{color:#f2f3f5;font-size:15px;font-weight:700;margin-bottom:10px;padding-bottom:7px;border-bottom:1px solid #3f4147;letter-spacing:.2px}'
    + '.msg{color:#dbdee1;font-size:14px;line-height:1.4;margin-bottom:8px;padding:8px 12px;background:#2b2d31;border-radius:6px}'
    + '.embed{background:#2b2d31;border-left:4px solid #5865f2;border-radius:4px;padding:9px 16px 16px 12px;margin-bottom:9px;max-width:520px}'
    + '.author{color:#f2f3f5;font-size:14px;font-weight:600;margin-bottom:8px}'
    + '.title{color:#f2f3f5;font-size:16px;font-weight:600;margin-bottom:8px;line-height:1.35}'
    + '.desc{font-size:14px;line-height:1.42;margin-bottom:9px}'
    + '.fields{display:flex;flex-wrap:wrap;gap:9px 0;margin-top:8px}'
    + '.field{width:100%}'
    + '.field.inline{width:33.33%;padding-right:9px}'
    + '.fname{color:#f2f3f5;font-size:14px;font-weight:600;margin-bottom:2px}'
    + '.fval{font-size:14px;line-height:1.42;word-wrap:break-word}'
    + '.footer{color:#949ba4;font-size:12px;margin-top:9px;line-height:1.4}'
    + '.imgnote{color:#949ba4;font-size:12px;margin-top:9px;padding:22px;text-align:center;border:1px dashed #4e5058;border-radius:6px}'
    + 'code{background:#1e1f22;border-radius:3px;padding:1px 3px;font-family:ui-monospace,Consolas,monospace;font-size:13px}'
    + 'a{color:#00a8fc;text-decoration:none}'
    + '.mention{background:rgba(88,101,242,.3);color:#c9cdfb;border-radius:3px;padding:0 2px}'
    + '.ts{background:#3f4147;border-radius:3px;padding:0 2px}'
    + 'b{font-weight:700;color:#f2f3f5}'
    + '</style></head><body>' + body + '</body></html>';
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(HTML, renderPage(collect()), 'utf8');

  var browser = await chromium.launch();
  try {
    var page = await browser.newPage({ viewport: { width: 1240, height: 1400 }, deviceScaleFactor: 2 });
    await page.goto('file://' + HTML.split(path.sep).join('/'));
    await page.waitForTimeout(300);
    await page.screenshot({ path: OUT, fullPage: true });
    console.log('Wrote ' + OUT);
  } finally {
    await browser.close();
  }
}

main().catch(function(e) {
  console.error('Preview failed: ' + ((e && e.message) || e));
  process.exit(1);
});
