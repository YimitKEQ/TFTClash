/**
 * board.js - read + classify the BrosephTech content board.
 *
 * Pure, side-effect free helpers (apart from fetchCards, which reads Supabase).
 * Everything is relative to the current time so the same card naturally moves
 * between "due soon", "overdue", and "stuck" as time passes.
 */

import { supabase } from './supabase.js';
import { BT_CREW, BT_DEPARTMENTS } from '../config/crew.js';

// Columns that mean the work is finished and should be ignored by accountability.
var DONE_COLUMNS = ['published', 'archive'];

// A card is "stuck" once it has sat untouched in one column this many days.
var STALE_DAYS = 5;

// A card is "due soon" when it is due within this many days.
var DUE_SOON_DAYS = 2;

var MS_PER_DAY = 86400000;

// Fetch every card on the board. Throws on a hard query error so the caller
// can surface it; returns [] when the table is simply empty.
export async function fetchCards() {
  var res = await supabase.from('bt_content_cards').select('*');
  if (res.error) {
    throw new Error('Failed to read bt_content_cards: ' + res.error.message);
  }
  return res.data || [];
}

function columnOf(card) {
  return String((card && card.column_id) || '').toLowerCase();
}

function isDoneColumn(card) {
  return DONE_COLUMNS.indexOf(columnOf(card)) !== -1;
}

function parseDate(value) {
  if (!value) return null;
  var d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// True when the card has a past due date and is not in a done column.
export function isOverdue(card, now) {
  if (!card || isDoneColumn(card)) return false;
  var due = parseDate(card.due_date);
  if (!due) return false;
  var ref = now || new Date();
  return due.getTime() < ref.getTime();
}

// Days a card has sat untouched in its current column. Returns 0 when the card
// is done or has not been idle long enough to count as stuck.
export function staleDays(card, now) {
  if (!card || isDoneColumn(card)) return 0;
  var touched =
    parseDate(card.column_changed_at) ||
    parseDate(card.updated_at) ||
    parseDate(card.created_at);
  if (!touched) return 0;
  var ref = now || new Date();
  var days = Math.floor((ref.getTime() - touched.getTime()) / MS_PER_DAY);
  if (days < STALE_DAYS) return 0;
  return days;
}

// True when the card is due within the due-soon window and not done.
// Cards that are already overdue are not "due soon" (they are overdue).
export function isDueSoon(card, now) {
  if (!card || isDoneColumn(card)) return false;
  var due = parseDate(card.due_date);
  if (!due) return false;
  var ref = now || new Date();
  var diffDays = (due.getTime() - ref.getTime()) / MS_PER_DAY;
  return diffDays >= 0 && diffDays <= DUE_SOON_DAYS;
}

// The crew names responsible for a card. Prefers an assignees array, falls back
// to a single assignee field. Always returns an array (possibly empty).
export function assigneesOf(card) {
  if (!card) return [];
  if (Array.isArray(card.assignees) && card.assignees.length) {
    return card.assignees.filter(function(a) { return !!a; }).map(function(a) { return String(a); });
  }
  if (card.assignee) return [String(card.assignee)];
  return [];
}

function emptyBuckets() {
  return { overdue: [], stuck: [], dueSoon: [], active: [] };
}

function departmentOf(card) {
  return String((card && card.department) || '').toLowerCase();
}

// Build a full accountability snapshot of the board.
// Returns:
//   members: { [crewName]: { overdue, stuck, dueSoon, active } }
//   totals:  { cards, active, overdue, stuck, dueSoon }
//   departments: [{ id, label, active, overdue, stuck, dueSoon, total }]
export function buildAccountability(cards, now) {
  var ref = now || new Date();
  var list = Array.isArray(cards) ? cards : [];

  // Seed a bucket set for every known crew member so they always appear.
  var members = {};
  BT_CREW.forEach(function(m) { members[m.name] = emptyBuckets(); });

  var totals = { cards: list.length, active: 0, overdue: 0, stuck: 0, dueSoon: 0 };

  var deptCounts = {};
  BT_DEPARTMENTS.forEach(function(d) {
    deptCounts[d.id] = { id: d.id, label: d.label, active: 0, overdue: 0, stuck: 0, dueSoon: 0, total: 0 };
  });

  list.forEach(function(card) {
    var done = isDoneColumn(card);
    var overdue = isOverdue(card, ref);
    var stuck = staleDays(card, ref) > 0;
    var dueSoon = isDueSoon(card, ref);
    var active = !done;

    if (active) totals.active++;
    if (overdue) totals.overdue++;
    if (stuck) totals.stuck++;
    if (dueSoon) totals.dueSoon++;

    var deptId = departmentOf(card);
    if (deptCounts[deptId]) {
      deptCounts[deptId].total++;
      if (active) deptCounts[deptId].active++;
      if (overdue) deptCounts[deptId].overdue++;
      if (stuck) deptCounts[deptId].stuck++;
      if (dueSoon) deptCounts[deptId].dueSoon++;
    }

    var owners = assigneesOf(card);
    owners.forEach(function(name) {
      if (!members[name]) members[name] = emptyBuckets();
      if (overdue) members[name].overdue.push(card);
      if (stuck) members[name].stuck.push(card);
      if (dueSoon) members[name].dueSoon.push(card);
      if (active) members[name].active.push(card);
    });
  });

  var departments = BT_DEPARTMENTS.map(function(d) { return deptCounts[d.id]; });

  return { members: members, totals: totals, departments: departments };
}
