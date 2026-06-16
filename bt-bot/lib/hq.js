/**
 * hq.js - the single source of truth for the BrosephTech HQ Discord layout.
 *
 * Every bot channel is bt- prefixed and lives under one category named
 * "BrosephTech HQ". This module is pure: it exports the category name, the
 * ordered list of channels (name + topic), a department-to-channel helper, and
 * a department color map. No side effects, no Discord calls.
 */

import { BT_DEPARTMENTS } from '../config/crew.js';

// The single category every bot channel lives under.
export var HQ_CATEGORY = 'BrosephTech HQ';

// Hex color + display label per department id. Mirrors BT_DEPARTMENTS but kept
// as small flat lookups so callers do not have to walk the department array.
export var DEPT_COLOR = {};
export var DEPT_LABEL = {};
for (var d = 0; d < BT_DEPARTMENTS.length; d++) {
  DEPT_COLOR[BT_DEPARTMENTS[d].id] = BT_DEPARTMENTS[d].color;
  DEPT_LABEL[BT_DEPARTMENTS[d].id] = BT_DEPARTMENTS[d].label;
}

// Coalesce any value to a known department id (mirrors the board's
// resolveDepartment so the bot and the web app never disagree).
export function resolveDeptId(deptId) {
  var id = String(deptId || '').toLowerCase();
  return DEPT_COLOR[id] ? id : 'content';
}

// Display label for a department, e.g. "Engineering". Never blank.
export function deptLabel(deptId) {
  return DEPT_LABEL[resolveDeptId(deptId)] || 'Content';
}

// Per-department stage (column) labels, mirroring the board (src/lib/btcrew.js)
// so a card reads the same in Discord as it does on the board.
var DEFAULT_STAGES = { ideas: 'Backlog', writing: 'Planned', production: 'In Progress', review: 'Review', published: 'Done', archive: 'Archive' };
var STAGES = {
  content: { ideas: 'Ideas', writing: 'Writing', production: 'Production', review: 'Review', published: 'Published', archive: 'Archive' },
  engineering: { ideas: 'Backlog', writing: 'Planned', production: 'Building', review: 'In Review', published: 'Shipped', archive: 'Archive' },
  design: { ideas: 'Backlog', writing: 'Briefed', production: 'Designing', review: 'Review', published: 'Delivered', archive: 'Archive' },
  marketing: { ideas: 'Backlog', writing: 'Drafting', production: 'Producing', review: 'Review', published: 'Live', archive: 'Archive' },
  ops: { ideas: 'Backlog', writing: 'Planned', production: 'Doing', review: 'Review', published: 'Done', archive: 'Archive' },
};

export function stageLabel(deptId, columnId) {
  var dept = STAGES[resolveDeptId(deptId)] || {};
  var col = String(columnId || '').toLowerCase();
  return dept[col] || DEFAULT_STAGES[col] || col || 'Backlog';
}

export var PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };
export function priorityLabel(p) {
  return PRIORITY_LABEL[String(p || '').toLowerCase()] || 'Medium';
}

// The channel name for a department ("bt-" + id). Returns null for an
// unknown / falsy department id so callers can fail safe.
export function departmentChannel(deptId) {
  if (!deptId) return null;
  return 'bt-' + String(deptId);
}

// Build the per-department channels in BT_DEPARTMENTS order.
var DEPARTMENT_CHANNELS = BT_DEPARTMENTS.map(function(dept) {
  return {
    name: departmentChannel(dept.id),
    topic: dept.label + ' department - cards, discussion, and updates for the ' + dept.label.toLowerCase() + ' crew.',
  };
});

// Every HQ channel in display order. Shared channels first, then the
// per-department channels.
export var HQ_CHANNELS = [
  { name: 'bt-board', topic: 'Live feed: every new card, ship, and block. The heartbeat of the team.' },
  { name: 'bt-standup', topic: 'Daily standup embed, posted automatically at 09:30.' },
  { name: 'bt-meetings', topic: 'Meeting recaps from /meeting land here.' },
  { name: 'bt-blocked', topic: 'Blocked-card alerts. Owners get pinged so nothing stalls silently.' },
  { name: 'bt-wins', topic: 'Cards moved to published or shipped, celebrated here.' },
].concat(DEPARTMENT_CHANNELS);
