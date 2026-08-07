/**
 * Tests that the bot can actually be built and registered.
 *
 * Two failure modes this catches, both of which only show up in production
 * otherwise:
 *
 *  1. Discord rejects an embed field whose value is empty or over 1024
 *     characters, and rejects the whole message with it. A board with two
 *     hundred long card titles is exactly the day that happens.
 *  2. `npm run deploy` fails on a malformed SlashCommandBuilder (a bad option
 *     name, too many choices, an over-long description). Building every command
 *     definition here means that never gets discovered against the live API.
 */

import './env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { standupEmbed, nudgeContent } from '../lib/embeds.js';
import { newCardEmbed, shippedEmbed, blockedEmbed } from '../lib/feed.js';
import { buildDigest, digestEmbed } from '../lib/scoring.js';
import { buildAccountability } from '../lib/board.js';
import { boardEmbed } from '../commands/board.js';
import { myTasksEmbed } from '../commands/mytasks.js';
import { blockedListEmbed } from '../commands/blocked.js';
import { scorecardEmbed } from '../commands/scorecard.js';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var COMMANDS_DIR = path.join(__dirname, '..', 'commands');

var NOW = new Date('2026-08-07T12:00:00Z');

function daysAgo(n) {
  return new Date(NOW.getTime() - n * 86400000).toISOString();
}

// Discord's own limits. Everything the bot builds has to fit inside these.
var LIMITS = { title: 256, description: 4096, fieldName: 256, fieldValue: 1024, fields: 25 };

function assertValidEmbed(embed, label) {
  var json = embed.toJSON();
  if (json.title) assert.ok(json.title.length <= LIMITS.title, label + ': title within limit');
  if (json.description) assert.ok(json.description.length <= LIMITS.description, label + ': description within limit');
  var fields = json.fields || [];
  assert.ok(fields.length <= LIMITS.fields, label + ': at most 25 fields');
  fields.forEach(function(f, i) {
    assert.ok(f.name && f.name.length > 0, label + ': field ' + i + ' has a name');
    assert.ok(f.name.length <= LIMITS.fieldName, label + ': field ' + i + ' name within limit');
    // An empty field value is the one that actually gets the whole message
    // rejected, and it is the easy one to introduce by accident.
    assert.ok(f.value && f.value.length > 0, label + ': field ' + i + ' (' + f.name + ') has a value');
    assert.ok(f.value.length <= LIMITS.fieldValue, label + ': field ' + i + ' (' + f.name + ') value is '
      + f.value.length + ' chars, over the ' + LIMITS.fieldValue + ' cap');
  });
  return json;
}

// ---- standup -----------------------------------------------------------------

test('the standup builds on a clean board', function() {
  var acc = buildAccountability([], NOW);
  var json = assertValidEmbed(standupEmbed(acc, NOW), 'clean standup');
  assert.ok(json.title.indexOf('empty') !== -1 || json.title.indexOf('clean') !== -1);
});

test('the standup builds on a healthy board with real work', function() {
  var cards = [];
  for (var i = 0; i < 12; i++) {
    cards.push({
      id: 'ok' + i,
      title: 'A perfectly normal card ' + i,
      column_id: 'production',
      department: 'engineering',
      assignees: ['Levitate'],
      column_changed_at: NOW.toISOString(),
    });
  }
  var acc = buildAccountability(cards, NOW);
  assertValidEmbed(standupEmbed(acc, NOW), 'healthy standup');
});

test('the standup survives a board that has completely fallen over', function() {
  // 200 overdue, stuck, blocked cards with the longest titles the board allows.
  // This is the case that used to blow the 1024 character field cap.
  var longTitle = new Array(15).join('a very long card title indeed ');
  var cards = [];
  for (var i = 0; i < 200; i++) {
    cards.push({
      id: 'bad' + i,
      title: longTitle + i,
      column_id: 'production',
      department: 'engineering',
      assignees: ['Levitate', 'Fridley', 'Tactic'],
      blocked: i % 3 === 0,
      due_date: daysAgo(20),
      column_changed_at: daysAgo(40),
    });
  }
  var acc = buildAccountability(cards, NOW);
  var json = assertValidEmbed(standupEmbed(acc, NOW), 'overloaded standup');

  var attention = (json.fields || []).filter(function(f) { return f.name.indexOf('NEEDS ATTENTION') === 0; })[0];
  assert.ok(attention, 'the attention section is present');
  assert.ok(/and \d+ more/.test(attention.value), 'and it admits what it dropped');
});

// ---- nudges ------------------------------------------------------------------

test('a nudge is null for someone with nothing owed', function() {
  assert.equal(nudgeContent('Levitate', { overdue: [], stuck: [] }, NOW), null);
  assert.equal(nudgeContent(null, null, NOW), null);
});

test('a nudge fits inside a Discord message even for a disastrous week', function() {
  var overdue = [];
  for (var i = 0; i < 120; i++) {
    overdue.push({ id: 'o' + i, title: 'Something that should have been done ages ago ' + i, due_date: daysAgo(9) });
  }
  var content = nudgeContent('Levitate', { overdue: overdue, stuck: [] }, NOW);
  assert.ok(content.length > 0);
  assert.ok(content.length <= 2000, 'a message body caps at 2000 characters, got ' + content.length);
});

// ---- every other card ---------------------------------------------------------

function fixtureCards() {
  function card(o) {
    return Object.assign({
      id: 'x' + Math.random(),
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
  return [
    card({ title: 'Overdue thing', due_date: daysAgo(4), department: 'engineering' }),
    card({ title: 'Blocked thing', blocked: true, department: 'design' }),
    card({ title: 'Quiet thing', column_changed_at: daysAgo(11), department: 'ops' }),
    card({ title: 'Shipped thing', column_id: 'published', updated_at: daysAgo(2) }),
    card({ title: 'Unowned thing', assignees: [], column_id: 'ideas', department: 'marketing' }),
  ];
}

test('every card the bot builds is a valid embed', function() {
  var cards = fixtureCards();
  var checks = [
    ['/board', boardEmbed(cards, null, NOW)],
    ['/board filtered', boardEmbed(cards, 'engineering', NOW)],
    ['/board empty', boardEmbed([], null, NOW)],
    ['/mytasks', myTasksEmbed('Levitate', cards, NOW)],
    ['/mytasks empty', myTasksEmbed('Cathy', cards, NOW)],
    ['/blocked', blockedListEmbed(cards, NOW)],
    ['/blocked clean', blockedListEmbed([], NOW)],
    ['/scorecard', scorecardEmbed('Levitate', cards, NOW)],
    ['digest', digestEmbed(buildDigest(cards, NOW))],
    ['digest empty', digestEmbed(buildDigest([], NOW))],
    ['feed new', newCardEmbed(cards[4])],
    ['feed shipped', shippedEmbed(cards[3])],
    ['feed blocked', blockedEmbed(cards[1])],
  ];
  checks.forEach(function(pair) { assertValidEmbed(pair[1], pair[0]); });
});

test('no card puts native timestamp markup where Discord renders plain text', function() {
  // Titles, author names, field names and footers are literal text. A <t:...>
  // in any of them ships as visible markup, which is invisible in code review
  // and extremely visible in the channel.
  var cards = fixtureCards();
  var acc = buildAccountability(cards, NOW);
  var all = [
    standupEmbed(acc, NOW),
    boardEmbed(cards, null, NOW),
    myTasksEmbed('Levitate', cards, NOW),
    blockedListEmbed(cards, NOW),
    scorecardEmbed('Levitate', cards, NOW),
    digestEmbed(buildDigest(cards, NOW)),
    newCardEmbed(cards[4]),
    shippedEmbed(cards[3]),
    blockedEmbed(cards[1]),
  ];

  all.forEach(function(embed, i) {
    var json = embed.toJSON();
    var plainSlots = [
      ['title', json.title],
      ['author', json.author && json.author.name],
      ['footer', json.footer && json.footer.text],
    ];
    (json.fields || []).forEach(function(f, fi) { plainSlots.push(['field ' + fi + ' name', f.name]); });

    plainSlots.forEach(function(slot) {
      if (!slot[1]) return;
      assert.ok(slot[1].indexOf('<t:') === -1,
        'embed ' + i + ' ' + slot[0] + ' contains a native timestamp, which renders as raw markup: ' + slot[1]);
    });
  });
});

// ---- slash command definitions ------------------------------------------------

test('every command builds a valid slash command definition', async function() {
  var files = readdirSync(COMMANDS_DIR).filter(function(f) { return f.endsWith('.js'); });
  assert.ok(files.length > 0, 'there are commands to check');

  var seenNames = {};
  var seenPrefixes = {};

  for (var i = 0; i < files.length; i++) {
    var mod = await import(pathToFileURL(path.join(COMMANDS_DIR, files[i])).href);
    assert.ok(mod.data, files[i] + ' exports data');
    assert.ok(typeof mod.execute === 'function', files[i] + ' exports execute');

    // This is the exact call deploy-commands.js makes, so a definition that
    // passes here cannot fail registration for a shape reason.
    var json = mod.data.toJSON();
    assert.ok(/^[a-z0-9_-]{1,32}$/.test(json.name), files[i] + ' has a legal command name: ' + json.name);
    assert.ok(json.description && json.description.length <= 100, files[i] + ' has a description within limit');
    assert.ok(!seenNames[json.name], 'command name /' + json.name + ' is not declared twice');
    seenNames[json.name] = files[i];

    // A component prefix owned by two commands would route interactions to
    // whichever module happened to load last.
    (mod.componentIds || []).forEach(function(prefix) {
      assert.ok(!seenPrefixes[prefix], 'component prefix "' + prefix + '" is claimed by both '
        + seenPrefixes[prefix] + ' and ' + files[i]);
      seenPrefixes[prefix] = files[i];
    });

    // Any command exporting handleComponent must declare what it answers to,
    // or the router in index.js will never call it.
    if (mod.handleComponent) {
      assert.ok((mod.componentIds || []).length > 0,
        files[i] + ' handles components but declares no componentIds, so the router cannot reach it');
    }
  }
});

test('the guide poster referenced by /guide exists', async function() {
  var fs = await import('node:fs');
  var poster = path.join(__dirname, '..', 'docs', 'images', 'guide-card.png');
  assert.ok(fs.existsSync(poster), 'run "npm run guide:render" to regenerate docs/images/guide-card.png');
});
